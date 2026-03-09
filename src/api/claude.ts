import type { Email, TriageResult } from "../types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are an AI assistant helping a K-12 district technology director triage their inbox.
Analyze the email and respond ONLY with valid JSON. No markdown, no explanation, no preamble.`;

function buildTriagePrompt(email: Email): string {
  return `Analyze this email and return ONLY this JSON structure:
{
  "urgency": "Critical|High|Medium|Low",
  "urgencyReason": "one sentence explaining the urgency rating",
  "category": "Security Alert|Action Required|Vendor / Sales|HR / Admin|Parent / Staff|Newsletter / FYI|Finance / Budget|Tech Support|General",
  "actionItems": ["concise action item", "another if applicable"],
  "summary": "Two sentence plain-English summary of what this email is about and what needs to happen."
}

Email:
Subject: ${email.subject}
From: ${email.from?.emailAddress?.name} <${email.from?.emailAddress?.address}>
Received: ${email.receivedDateTime}
Body preview: ${email.bodyPreview?.slice(0, 500)}`;
}

const FALLBACK: (email: Email) => TriageResult = (email) => ({
  urgency: "Medium",
  urgencyReason: "Could not determine urgency.",
  category: "General",
  actionItems: [],
  summary: email.bodyPreview?.slice(0, 120) ?? "",
});

/**
 * Calls the backend proxy at /api/triage (preferred — keeps API key server-side).
 */
async function triageViaBackend(email: Email): Promise<TriageResult> {
  const res = await fetch("/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: email.subject,
      from_name: email.from?.emailAddress?.name ?? "",
      from_address: email.from?.emailAddress?.address ?? "",
      received_at: email.receivedDateTime,
      body_preview: email.bodyPreview ?? "",
    }),
  });

  if (!res.ok) throw new Error(`Backend triage error ${res.status}`);
  return (await res.json()) as TriageResult;
}

/**
 * Calls the Anthropic API directly from the browser (dev fallback only).
 * Requires VITE_ANTHROPIC_API_KEY to be set.
 */
async function triageDirectBrowser(
  email: Email,
  apiKey: string
): Promise<TriageResult> {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildTriagePrompt(email) }],
    }),
  });

  const data = await res.json();
  if (!res.ok)
    throw new Error(
      `Claude API error ${res.status}: ${data?.error?.message ?? "unknown"}`
    );

  const text: string =
    data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "{}";

  return JSON.parse(text.replace(/```json|```/g, "").trim()) as TriageResult;
}

/**
 * Triages an email via Claude.
 *
 * Strategy:
 * 1. Try the backend proxy (/api/triage) — API key stays server-side.
 * 2. If the backend is unavailable and VITE_ANTHROPIC_API_KEY is set,
 *    fall back to a direct browser call (dev convenience only).
 */
export async function triageEmail(email: Email): Promise<TriageResult> {
  // Primary: backend proxy
  try {
    return await triageViaBackend(email);
  } catch {
    // Backend not running — fall through to direct call
  }

  // Fallback: direct browser call (dev only)
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (apiKey) {
    try {
      return await triageDirectBrowser(email, apiKey);
    } catch {
      return FALLBACK(email);
    }
  }

  return FALLBACK(email);
}

/**
 * Requests a reply draft from the backend.
 * Returns null if the backend is unavailable.
 */
export async function draftReply(
  email: Email,
  triage: TriageResult
): Promise<string | null> {
  try {
    const res = await fetch("/api/draft-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: email.subject,
        from_name: email.from?.emailAddress?.name ?? "",
        from_address: email.from?.emailAddress?.address ?? "",
        body_preview: email.bodyPreview ?? "",
        summary: triage.summary,
        action_items: triage.actionItems,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.draft as string;
  } catch {
    return null;
  }
}
