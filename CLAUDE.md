# CLAUDE.md — M365 Inbox Triage

AI assistant context for the **Inbox Triage** project.
Read this before making any changes to the codebase.

---

## Project Summary

A production-ready single-page application that connects to a user's Microsoft 365 mailbox via Microsoft Graph, fetches their 20 most recent emails, and uses Claude AI to score urgency, categorize each message, and extract action items. Results are displayed as an expandable, filterable card-based inbox.

**Target user:** K-12 district technology director
**Stack:** React 18 + TypeScript, Vite, IBM Plex Mono (inline styles — no CSS framework)
**Backend:** FastAPI (Python) — proxies Claude calls, handles Graph webhooks, serves SSE
**Auth:** Microsoft Entra ID implicit grant → Microsoft Graph
**AI:** Anthropic Claude (`claude-sonnet-4-20250514`)

---

## Repository Layout

```
Mail-triage/
├── CLAUDE.md                      ← you are here
├── .env.example                   ← frontend env var template
├── .env                           ← (gitignored) real frontend secrets
├── .gitignore
├── package.json
├── vite.config.ts                 ← Vite + proxy: /api/* → localhost:8000
├── tsconfig.json
├── index.html                     ← loads IBM Plex Mono font; defines CSS animations
├── backend/
│   ├── main.py                    ← FastAPI app (triage proxy, draft-reply, SSE, webhooks)
│   ├── requirements.txt
│   └── .env.example               ← ANTHROPIC_API_KEY, GRAPH_CLIENT_STATE
└── src/
    ├── main.tsx                   ← React DOM entry point
    ├── App.tsx                    ← root; owns all state; orchestrates auth → fetch → triage
    ├── api/
    │   ├── graph.ts               ← fetchEmails, fetchSingleEmail, markAsRead, fetchMe
    │   └── claude.ts              ← triageEmail (backend proxy + direct fallback), draftReply
    ├── auth/
    │   └── msal.ts                ← buildAuthUrl, parseTokenFromHash, currentRedirectUri
    ├── components/
    │   ├── LoginScreen.tsx        ← Entra ID credential form + OAuth redirect
    │   ├── InboxDashboard.tsx     ← header stats + filter/sort toolbar + card list
    │   ├── EmailCard.tsx          ← expandable card with mark-as-read + draft-reply actions
    │   ├── ComposeModal.tsx       ← Claude-generated reply draft modal
    │   └── AccountSwitcher.tsx    ← multi-account dropdown (add / switch accounts)
    ├── types/
    │   └── index.ts               ← Email, TriageResult, Account, Urgency, Category, ...
    ├── constants/
    │   └── index.ts               ← CATEGORIES, URGENCY_COLORS, URGENCY_ORDER, filter/sort options
    └── utils/
        ├── cache.ts               ← localStorage triage cache (24-hour TTL)
        └── accounts.ts            ← localStorage/sessionStorage account persistence helpers
```

---

## Environment Variables

### Frontend (`.env`)
```bash
VITE_CLIENT_ID=<Entra App Client ID>       # optional — can be entered in the UI
VITE_TENANT_ID=<Entra Directory Tenant ID> # optional — can be entered in the UI
VITE_ANTHROPIC_API_KEY=<key>               # dev fallback only — not used when backend runs
```

### Backend (`backend/.env`)
```bash
ANTHROPIC_API_KEY=<Anthropic API key>      # kept server-side
GRAPH_CLIENT_STATE=<random UUID>           # shared secret for Graph webhook verification
```

> **Security:** `VITE_*` variables are embedded in the browser bundle. `VITE_ANTHROPIC_API_KEY` is only used as a dev fallback when the backend is not running — never set it in production. The backend's `ANTHROPIC_API_KEY` never leaves the server.

---

## Running the Application

```bash
# Terminal 1 — Frontend
npm install
npm run dev                        # http://localhost:5173

# Terminal 2 — Backend (required for reply drafting; optional for triage)
cd backend
pip install -r requirements.txt
cp .env.example .env               # fill in ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

Vite proxies all `/api/*` requests to `http://localhost:8000` during development.

---

## Authentication Flow

```
User fills in Client ID + Tenant ID (or reads from .env)
        ↓
buildAuthUrl() constructs Microsoft OAuth URL (implicit grant, response_type=token)
        + optional `state` param (UUID) for multi-account identification
        ↓
Browser redirects to login.microsoftonline.com
        ↓
After consent → redirected back with #access_token=...&expires_in=...&state=...
        ↓
parseTokenFromHash() extracts token + expiresIn + state
window.history.replaceState clears the hash
        ↓
fetchMe(token) → gets displayName + email from Graph /me
        ↓
Account stored in localStorage; set as active
```

### Multi-Account Flow (adding a second account)

1. User clicks **+ ADD ACCOUNT** in the `AccountSwitcher` dropdown
2. Enters Client ID + Tenant ID for the new account
3. `savePendingAccount({id, clientId, tenantId})` written to sessionStorage
4. OAuth redirect with `state=<pendingId>`
5. On return: `loadAndClearPendingAccount()` matches the pending record → creates new Account
6. Accounts array updated in localStorage; new account set as active

### Entra ID App Registration Requirements

- **Redirect URI type:** Single-page application (SPA)
- **Redirect URI value:** `http://localhost:5173` (or deployed URL)
- **Implicit grant:** Access tokens checkbox enabled
- **API permissions:** Microsoft Graph → Delegated → `Mail.Read` + `Mail.ReadWrite` → admin consent

---

## Data Flow

```
App.tsx (activeAccountId changes)
  │
  ├─→ fetchEmails(token)              [graph.ts]   → Email[]
  │     GET /me/messages?$top=20&...
  │
  └─→ for each email (sequential):
        getCachedTriage(email.id)     [cache.ts]   → TriageResult | null
        if cached → use it, skip Claude
        else:
          triageEmail(email)          [claude.ts]
            1. POST /api/triage (backend proxy) → TriageResult
            2. fallback: POST api.anthropic.com (dev only, VITE_ANTHROPIC_API_KEY)
          setCachedTriage(email.id, result)
          setTriageMap(...)

SSE connection (/api/events):
  Backend receives Graph change notification → pushes {type:"new_email", emailId}
  Frontend fetchSingleEmail + triageEmail + prepend to list
```

---

## Key Types (`src/types/index.ts`)

```typescript
type Urgency  = "Critical" | "High" | "Medium" | "Low";
type Category = "Security Alert" | "Action Required" | "Vendor / Sales"
              | "HR / Admin" | "Parent / Staff" | "Newsletter / FYI"
              | "Finance / Budget" | "Tech Support" | "General";

interface Email {
  id: string; subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string; bodyPreview: string;
  isRead: boolean; importance: string;
}

interface TriageResult {
  urgency: Urgency; urgencyReason: string;
  category: Category; actionItems: string[]; summary: string;
}

interface Account {
  id: string; clientId: string; tenantId: string;
  displayName: string; email: string;
  token: string; tokenExpiry: number; // unix ms
}
```

---

## Design System

| Token | Value |
|---|---|
| Background | `#0a0b0d` |
| Surface | `#111315` |
| Border | `#1a1d20` |
| Accent (Microsoft blue) | `#0078d4` |
| Text primary | `#e8eaf0` |
| Text muted | `#555` |
| Font | IBM Plex Mono (400, 600, 700) |

### Urgency Colors

| Level | Hex |
|---|---|
| Critical | `#ff2222` |
| High | `#ff8c00` |
| Medium | `#eab308` |
| Low | `#22c55e` |

**No CSS framework.** All styling via React inline style objects. CSS animations (`fadeUp`, `pulse`) defined globally in `index.html`. Cards have a 3 px colored left border matching urgency level.

---

## Backend API Reference (`backend/main.py`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check; confirms Anthropic is configured |
| POST | `/api/triage` | Proxy: Claude email analysis → TriageResult JSON |
| POST | `/api/draft-reply` | Proxy: Claude reply draft → `{ draft: string }` |
| POST | `/api/subscriptions` | Create Graph change notification subscription |
| GET/POST | `/api/webhooks/graph` | Graph webhook (validation handshake + notifications) |
| GET | `/api/events` | SSE stream — pushes `{type:"new_email", emailId}` events |

### Webhook / Real-time Setup (ngrok required for dev)

```bash
# 1. Expose backend to the internet
ngrok http 8000

# 2. Create Graph subscription via the frontend (or curl):
curl -X POST http://localhost:5173/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"graph_token": "<user-token>", "notification_url": "https://<ngrok-id>.ngrok.io/api/webhooks/graph"}'

# Subscription expires in 3 days. Re-create as needed.
```

---

## Conventions

- **State lives in `App.tsx`.** Child components are pure — they receive data + callbacks as props.
- **No default exports from components** (except `App`). Use named exports: `export function EmailCard(...)`.
- **API keys come from `import.meta.env`** (frontend) or `os.environ` (backend). Never hard-code.
- **Inline styles over class names.** Extract to a `const` only when reused within the same file.
- **Type everything.** Avoid `any`. External API responses are cast after parsing.
- **Sequential triage, not concurrent.** The `for...of` loop in `App.tsx` is intentional — do not refactor to `Promise.all` (rate limits).
- **Cache check before Claude call.** Always call `getCachedTriage` before `triageEmail` in the triage loop.
- **SSE handler uses a ref.** `activeAccountRef` lets the SSE `onmessage` handler read the latest token without re-subscribing on every token change.

---

## localStorage / sessionStorage Keys

| Key | Store | Purpose |
|---|---|---|
| `inbox-triage:accounts` | localStorage | JSON array of all Account objects |
| `inbox-triage:active-account-id` | localStorage | Currently active account UUID |
| `inbox-triage:triage:<emailId>` | localStorage | Cached TriageResult (24-hour TTL) |
| `inbox-triage:pending-account` | sessionStorage | In-progress OAuth account (cleared after redirect) |

---

## Phase 2 Features (Implemented)

| Feature | Status | Key Files |
|---|---|---|
| Backend proxy (API key off client) | ✅ Done | `backend/main.py`, `claude.ts`, `vite.config.ts` |
| Reply drafting | ✅ Done | `ComposeModal.tsx`, `claude.ts#draftReply`, `/api/draft-reply` |
| Mark as read | ✅ Done | `EmailCard.tsx`, `graph.ts#markAsRead` |
| Persistent triage cache | ✅ Done | `utils/cache.ts` (localStorage, 24-hour TTL) |
| Webhook / real-time | ✅ Done | `/api/webhooks/graph`, `/api/events`, SSE in `App.tsx` |
| Multi-account | ✅ Done | `AccountSwitcher.tsx`, `utils/accounts.ts`, OAuth `state` param |

---

## Reference Prototype

`inbox-triage.jsx` (if present alongside this file) is a single-file React prototype that implements the full auth → fetch → triage → render loop. It served as the design reference for the modular `src/` structure. Do not modify it — treat it as read-only documentation.
