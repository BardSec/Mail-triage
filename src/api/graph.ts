import type { Email } from "../types";

const GRAPH_ENDPOINT =
  "https://graph.microsoft.com/v1.0/me/messages" +
  "?$top=20" +
  "&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,importance" +
  "&$orderby=receivedDateTime desc";

/**
 * Fetches the 20 most recent emails from Microsoft Graph using a bearer token.
 * Requires the Mail.Read delegated permission.
 */
export async function fetchEmails(token: string): Promise<Email[]> {
  const res = await fetch(GRAPH_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.value as Email[];
}
