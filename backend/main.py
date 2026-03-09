"""
Inbox Triage — FastAPI backend proxy.

Responsibilities:
- Proxy Claude AI calls so ANTHROPIC_API_KEY never leaves the server
- Handle Microsoft Graph webhook notifications (change subscriptions)
- Push real-time new-email events to connected frontend clients via SSE
- Generate reply drafts via Claude

Run with:
    uvicorn main:app --reload --port 8000

Env vars (see .env.example):
    ANTHROPIC_API_KEY   — Anthropic API key
    GRAPH_CLIENT_STATE  — Secret shared with Microsoft Graph to verify notifications
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import anthropic
import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Inbox Triage API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Anthropic client
# ---------------------------------------------------------------------------

_api_key = os.environ.get("ANTHROPIC_API_KEY", "")
client = anthropic.Anthropic(api_key=_api_key) if _api_key else None

MODEL = "claude-sonnet-4-20250514"

TRIAGE_SYSTEM = (
    "You are an AI assistant helping a K-12 district technology director triage their inbox. "
    "Analyze the email and respond ONLY with valid JSON. No markdown, no explanation, no preamble."
)

REPLY_SYSTEM = (
    "You are an AI assistant helping a K-12 district technology director write professional email replies. "
    "Generate a concise, professional reply. Respond ONLY with the email body text — "
    "no subject line, no 'Subject:' prefix."
)

# ---------------------------------------------------------------------------
# SSE state — simple in-memory queues per connected client
# ---------------------------------------------------------------------------

sse_queues: list[asyncio.Queue] = []

# ---------------------------------------------------------------------------
# Graph webhook client state (shared secret verified on every notification)
# ---------------------------------------------------------------------------

GRAPH_CLIENT_STATE = os.environ.get("GRAPH_CLIENT_STATE", str(uuid.uuid4()))

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class TriageRequest(BaseModel):
    subject: str
    from_name: str
    from_address: str
    received_at: str
    body_preview: str


class DraftReplyRequest(BaseModel):
    subject: str
    from_name: str
    from_address: str
    body_preview: str
    summary: str
    action_items: list[str]


class SubscriptionRequest(BaseModel):
    graph_token: str
    notification_url: str  # must be publicly reachable by Microsoft (use ngrok for dev)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": MODEL, "anthropic_configured": client is not None}


# ---------------------------------------------------------------------------
# Triage endpoint — Claude JSON analysis
# ---------------------------------------------------------------------------


@app.post("/api/triage")
async def triage_email(req: TriageRequest):
    if not client:
        raise HTTPException(503, "ANTHROPIC_API_KEY is not configured on the server.")

    user_prompt = f"""Analyze this email and return ONLY this JSON structure:
{{
  "urgency": "Critical|High|Medium|Low",
  "urgencyReason": "one sentence explaining the urgency rating",
  "category": "Security Alert|Action Required|Vendor / Sales|HR / Admin|Parent / Staff|Newsletter / FYI|Finance / Budget|Tech Support|General",
  "actionItems": ["concise action item", "another if applicable"],
  "summary": "Two sentence plain-English summary of what this email is about and what needs to happen."
}}

Email:
Subject: {req.subject}
From: {req.from_name} <{req.from_address}>
Received: {req.received_at}
Body preview: {req.body_preview[:500]}"""

    message = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        system=TRIAGE_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )

    text: str = message.content[0].text  # type: ignore[index]
    try:
        return json.loads(text.replace("```json", "").replace("```", "").strip())
    except json.JSONDecodeError:
        return {
            "urgency": "Medium",
            "urgencyReason": "Could not determine urgency.",
            "category": "General",
            "actionItems": [],
            "summary": req.body_preview[:120],
        }


# ---------------------------------------------------------------------------
# Reply draft endpoint
# ---------------------------------------------------------------------------


@app.post("/api/draft-reply")
async def draft_reply(req: DraftReplyRequest):
    if not client:
        raise HTTPException(503, "ANTHROPIC_API_KEY is not configured on the server.")

    action_str = "\n".join(f"- {a}" for a in req.action_items) if req.action_items else "None"

    user_prompt = f"""Draft a professional reply to the following email.

Original email:
Subject: {req.subject}
From: {req.from_name} <{req.from_address}>
Preview: {req.body_preview[:500]}

AI summary: {req.summary}
Action items identified:
{action_str}

Write a concise, professional reply. Output only the body text of the reply."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=REPLY_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )

    return {"draft": message.content[0].text}  # type: ignore[index]


# ---------------------------------------------------------------------------
# Microsoft Graph subscription management
# ---------------------------------------------------------------------------


@app.post("/api/subscriptions")
async def create_subscription(req: SubscriptionRequest):
    """
    Creates a Microsoft Graph change notification subscription for new mail.

    Requirements:
    - req.notification_url must be publicly accessible by Microsoft.
      For local dev use ngrok: ngrok http 8000 → use https://<id>.ngrok.io/api/webhooks/graph
    - Subscription expires in 3 days (Graph max for Mail.Read delegated).
    """
    expiry = (datetime.now(timezone.utc) + timedelta(days=3)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    payload = {
        "changeType": "created",
        "notificationUrl": req.notification_url,
        "resource": "me/messages",
        "expirationDateTime": expiry,
        "clientState": GRAPH_CLIENT_STATE,
    }

    async with httpx.AsyncClient() as http:
        resp = await http.post(
            "https://graph.microsoft.com/v1.0/subscriptions",
            headers={
                "Authorization": f"Bearer {req.graph_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )

    if not resp.is_success:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    return resp.json()


# ---------------------------------------------------------------------------
# Microsoft Graph webhook — validation + notification handler
# ---------------------------------------------------------------------------


@app.api_route("/api/webhooks/graph", methods=["GET", "POST"])
async def graph_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Dual-purpose endpoint:
    - GET  with ?validationToken=... → echo back the token (subscription validation)
    - POST with JSON body            → handle change notifications
    """
    # Subscription validation handshake
    validation_token = request.query_params.get("validationToken")
    if validation_token:
        return PlainTextResponse(content=validation_token, media_type="text/plain")

    # Change notification
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    for notification in body.get("value", []):
        # Verify the shared secret so we ignore spoofed notifications
        if notification.get("clientState") != GRAPH_CLIENT_STATE:
            continue

        resource_data = notification.get("resourceData", {})
        email_id = resource_data.get("id")

        if email_id:
            event_payload = json.dumps({"type": "new_email", "emailId": email_id})
            for queue in list(sse_queues):
                await queue.put(event_payload)

    # Microsoft requires a 202 response within 3 seconds
    return {"status": "accepted"}


# ---------------------------------------------------------------------------
# Server-Sent Events — real-time push to frontend
# ---------------------------------------------------------------------------


@app.get("/api/events")
async def sse_events(request: Request):
    """
    Persistent SSE connection. The frontend connects here on startup.
    When Graph sends a change notification (new email), the backend pushes
    a JSON event: { "type": "new_email", "emailId": "<id>" }
    """
    queue: asyncio.Queue = asyncio.Queue()
    sse_queues.append(queue)

    async def event_generator():
        try:
            # Confirm connection to client
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {event}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive comment — prevents proxies from closing the connection
                    yield ": heartbeat\n\n"
        finally:
            if queue in sse_queues:
                sse_queues.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
            "Connection": "keep-alive",
        },
    )
