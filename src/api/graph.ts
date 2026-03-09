import type { Account, Email } from "../types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const LIST_ENDPOINT =
  `${GRAPH_BASE}/me/messages` +
  "?$top=20" +
  "&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,importance" +
  "&$orderby=receivedDateTime desc";

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetches the 20 most recent emails from Microsoft Graph.
 * Requires the Mail.Read delegated permission.
 */
export async function fetchEmails(token: string): Promise<Email[]> {
  const res = await fetch(LIST_ENDPOINT, { headers: authHeader(token) });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.value as Email[];
}

/**
 * Fetches a single email by ID. Used when an SSE event announces a new message.
 */
export async function fetchSingleEmail(
  emailId: string,
  token: string
): Promise<Email> {
  const url =
    `${GRAPH_BASE}/me/messages/${emailId}` +
    "?$select=id,subject,from,receivedDateTime,bodyPreview,isRead,importance";

  const res = await fetch(url, { headers: authHeader(token) });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }

  return (await res.json()) as Email;
}

/**
 * Marks an email as read via a PATCH request.
 * Requires the Mail.ReadWrite delegated permission.
 */
export async function markAsRead(
  emailId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/me/messages/${emailId}`, {
    method: "PATCH",
    headers: {
      ...authHeader(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mark-as-read error ${res.status}: ${body}`);
  }
}

/**
 * Fetches the authenticated user's profile from Microsoft Graph.
 * Used to populate account display name and email after OAuth.
 */
export async function fetchMe(
  token: string
): Promise<Pick<Account, "displayName" | "email">> {
  const res = await fetch(
    `${GRAPH_BASE}/me?$select=displayName,mail,userPrincipalName`,
    { headers: authHeader(token) }
  );

  if (!res.ok) {
    return { displayName: "Unknown", email: "" };
  }

  const data = await res.json();
  return {
    displayName: data.displayName ?? "Unknown",
    email: data.mail ?? data.userPrincipalName ?? "",
  };
}
