import type { Email, TriageResult } from "../types";

const MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are an AI assistant helping a K-12 district technology director triage their inbox.
Analyze the email and respond ONLY with valid JSON. No markdown, no explanation, no preamble.`;

function buildUserPrompt(email: Email): string {
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

/**
 * Sends an email to Claude for triage analysis.
 *
 * WARNING: This calls the Anthropic API directly from the browser, which
 * exposes the API key to end users. This is acceptable for local development
 * only. In production, proxy this call through a backend service (FastAPI,
 * Express, etc.) so the key never leaves the server.
 */
export async function triageEmail(
  email: Email,
  apiKey: string
): Promise<TriageResult> {
  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required for browser-side requests to bypass CORS restrictions
      // via a backend proxy. For direct dev calls, this header is also needed.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(email) }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Claude API error ${response.status}: ${data?.error?.message ?? "unknown"}`
    );
  }

  const text: string =
    data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "{}";

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as TriageResult;
  } catch {
    // Fallback when JSON parsing fails — surface the email preview as summary
    return {
      urgency: "Medium",
      urgencyReason: "Could not determine urgency.",
      category: "General",
      actionItems: [],
      summary: email.bodyPreview?.slice(0, 120) ?? "",
    };
  }
}
