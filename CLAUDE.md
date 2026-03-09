# CLAUDE.md — M365 Inbox Triage

AI assistant context for the **Inbox Triage** project.
Read this before making any changes to the codebase.

---

## Project Summary

A production-ready single-page application that connects to a user's Microsoft 365 mailbox via Microsoft Graph, fetches their 20 most recent emails, and uses Claude AI to score urgency, categorize each message, and extract action items. Results are displayed as an expandable, filterable card-based inbox.

**Target user:** K-12 district technology director
**Stack:** React 18 + TypeScript, Vite, IBM Plex Mono (inline styles — no CSS framework)
**Auth:** Microsoft Entra ID implicit grant → Microsoft Graph
**AI:** Anthropic Claude (`claude-sonnet-4-20250514`)

---

## Repository Layout

```
Mail-triage/
├── CLAUDE.md                  ← you are here
├── .env.example               ← template for required env vars
├── .env                       ← (gitignored) real secrets
├── .gitignore
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html                 ← loads IBM Plex Mono font; defines CSS animations
└── src/
    ├── main.tsx               ← React DOM entry point
    ├── App.tsx                ← root component; owns all state; orchestrates auth → fetch → triage
    ├── api/
    │   ├── graph.ts           ← fetchEmails() — Microsoft Graph REST calls
    │   └── claude.ts          ← triageEmail() — Anthropic API calls
    ├── auth/
    │   └── msal.ts            ← parseTokenFromHash(), buildAuthUrl()
    ├── components/
    │   ├── LoginScreen.tsx    ← Entra ID credential form + OAuth redirect
    │   ├── InboxDashboard.tsx ← header stats + filter/sort toolbar + card list
    │   └── EmailCard.tsx      ← individual expandable email card
    ├── types/
    │   └── index.ts           ← Email, TriageResult, Urgency, Category, FilterBy, SortBy
    └── constants/
        └── index.ts           ← CATEGORIES, URGENCY_COLORS, URGENCY_ORDER, filter/sort options
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in real values before running:

```bash
VITE_CLIENT_ID=<Entra App Client ID>
VITE_TENANT_ID=<Entra Directory Tenant ID>
VITE_ANTHROPIC_API_KEY=<Anthropic API key>
```

> **Security warning:** `VITE_*` variables are embedded in the browser bundle at build time.
> The Anthropic API key is therefore visible to anyone who inspects the bundle.
> **Never deploy to production this way.** Phase 2 calls for a backend proxy (FastAPI/Express) to keep the key server-side.

---

## Authentication Flow

```
User fills in Client ID + Tenant ID
        ↓
buildAuthUrl() constructs Microsoft OAuth URL (implicit grant, response_type=token)
        ↓
Browser redirects to login.microsoftonline.com
        ↓
After consent, Microsoft redirects back to the app with #access_token=... in the hash
        ↓
parseTokenFromHash() extracts the token; window.history.replaceState clears the hash
        ↓
App stores token in state → triggers email fetch
```

Key files: `src/auth/msal.ts`, `src/components/LoginScreen.tsx`, `src/App.tsx` (useEffect #1)

### Entra ID App Registration Requirements

Before the auth flow works, the app must be registered in the Azure portal:

- **Redirect URI type:** Single-page application (SPA)
- **Redirect URI value:** `http://localhost:5173` (or the deployed URL)
- **Implicit grant:** Access tokens checkbox enabled
- **API permissions:** Microsoft Graph → Delegated → `Mail.Read` (admin consent granted)

---

## Data Flow

```
App.tsx useEffect (token set)
  │
  ├─→ fetchEmails(token)            [src/api/graph.ts]
  │     GET /me/messages?$top=20&...
  │     Returns Email[]
  │
  └─→ for each email (sequential):
        triageEmail(email, apiKey)  [src/api/claude.ts]
          POST https://api.anthropic.com/v1/messages
          Returns TriageResult
          setTriageMap(prev => ({ ...prev, [email.id]: result }))
```

Triage runs **sequentially** (not in parallel) to avoid rate-limit issues with the Anthropic API. Cards update progressively as each result arrives.

---

## Key Types (`src/types/index.ts`)

```typescript
type Urgency  = "Critical" | "High" | "Medium" | "Low";
type Category = "Security Alert" | "Action Required" | "Vendor / Sales"
              | "HR / Admin" | "Parent / Staff" | "Newsletter / FYI"
              | "Finance / Budget" | "Tech Support" | "General";

interface Email {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;   // ISO 8601
  bodyPreview: string;
  isRead: boolean;
  importance: string;
}

interface TriageResult {
  urgency: Urgency;
  urgencyReason: string;      // one sentence
  category: Category;
  actionItems: string[];      // short action strings
  summary: string;            // 2-sentence plain-English
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

**No CSS framework is used.** All styling is done with React inline style objects. Two CSS animations are defined globally in `index.html`:
- `fadeUp` — cards animate in on mount (staggered by `index * 60ms`)
- `pulse` — used for pending/loading states

Cards have a **colored left border** (3 px) matching their urgency level. Unread emails show a `#0078d4` dot indicator next to the category label.

---

## Claude API Integration (`src/api/claude.ts`)

- **Model:** `claude-sonnet-4-20250514`
- **Max tokens:** 1000
- **Required headers:** `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`

The system prompt instructs Claude to respond **only with valid JSON** — no markdown fences, no explanation. If JSON parsing fails, `triageEmail()` returns a safe fallback result (Medium urgency, General category) rather than throwing.

Claude's JSON schema:
```json
{
  "urgency": "Critical|High|Medium|Low",
  "urgencyReason": "<one sentence>",
  "category": "<one of 9 categories>",
  "actionItems": ["<short action>"],
  "summary": "<two sentences>"
}
```

---

## Development Workflow

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Type-check without building
npm run typecheck

# Production build (outputs to dist/)
npm run build
```

---

## Conventions

- **State lives in `App.tsx`.** Child components receive data and callbacks as props — no context or external state library.
- **No default exports from components** (except `App`). Named exports only: `export function EmailCard(...)`.
- **API keys come from `import.meta.env`** prefixed with `VITE_`. Never hard-code credentials.
- **Inline styles over class names.** Keep style objects close to the element; extract to a `const` only when reused within the same file.
- **Type everything.** Avoid `any`. The `triageEmail` response is the main boundary — cast to `TriageResult` after parsing.
- **Sequential triage, not concurrent.** The `for...of` loop in `App.tsx` is intentional — do not refactor to `Promise.all`.

---

## Phase 2 Roadmap (Not Yet Implemented)

| Feature | Notes |
|---|---|
| Backend proxy | FastAPI or Express service; moves `VITE_ANTHROPIC_API_KEY` off the client |
| Reply drafting | "Draft Reply" button per card; Claude generates suggested response |
| Mark as read | `PATCH /me/messages/{id}` via Graph API |
| Persistent triage cache | localStorage or SQLite so re-runs skip already-triaged emails |
| Webhook / real-time | Microsoft Graph change notifications |
| Multi-account | Support multiple M365 tenants |

---

## Reference Prototype

`inbox-triage.jsx` (if present alongside this file) is a single-file React prototype that implements the full auth → fetch → triage → render loop. It served as the design reference for the modular `src/` structure. Do not modify it — treat it as read-only documentation.
