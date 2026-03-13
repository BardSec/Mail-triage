# Inbox Triage — Deployment Guide

AI-powered Microsoft 365 inbox triage for K-12 district technology directors.
Connects to Microsoft Graph, fetches your 20 most recent emails, and uses Claude AI to score urgency, categorize messages, and extract action items.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Microsoft Entra ID App Registration](#2-microsoft-entra-id-app-registration)
3. [Get an Anthropic API Key](#3-get-an-anthropic-api-key)
4. [Local Development](#4-local-development)
5. [Docker Deployment (Recommended)](#5-docker-deployment-recommended)
6. [Production Deployment](#6-production-deployment)
7. [Real-time Email Notifications (Optional)](#7-real-time-email-notifications-optional)
8. [Verifying Everything Works](#8-verifying-everything-works)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 20 | https://nodejs.org |
| Python | 3.11 | https://python.org |
| Docker + Docker Compose | 24 / 2.24 | https://docs.docker.com/get-docker |
| Git | any | https://git-scm.com |

You also need:

- A **Microsoft 365 account** (work/school — not a personal Microsoft account)
- Access to your organization's **Microsoft Entra admin center** to register an app (or an admin who can do it for you)
- An **Anthropic API key** (Claude)

---

## 2. Microsoft Entra ID App Registration

This step authorizes the app to read your mailbox via Microsoft Graph.

### 2a. Create the app registration

1. Sign in to [https://entra.microsoft.com](https://entra.microsoft.com) as a Global Administrator or Application Administrator.
2. Navigate to **Identity → Applications → App registrations**.
3. Click **New registration**.
4. Fill in the form:
   - **Name:** `Inbox Triage` (or any name you like)
   - **Supported account types:** *Accounts in this organizational directory only*
   - **Redirect URI:**
     - Platform: **Single-page application (SPA)**
     - URI: `http://localhost:5173`
5. Click **Register**.

### 2b. Note your IDs

After registration, copy these two values from the **Overview** page — you will need them later:

- **Application (client) ID** → this is your `VITE_CLIENT_ID`
- **Directory (tenant) ID** → this is your `VITE_TENANT_ID`

### 2c. Enable implicit grant for access tokens

1. In the app registration, go to **Authentication**.
2. Under **Implicit grant and hybrid flows**, check **Access tokens**.
3. Click **Save**.

### 2d. Add API permissions

1. Go to **API permissions → Add a permission → Microsoft Graph → Delegated permissions**.
2. Search for and add:
   - `Mail.Read`
   - `Mail.ReadWrite`
3. Click **Add permissions**.
4. Click **Grant admin consent for [your org]** and confirm.

### 2e. (Production only) Add your production redirect URI

If you are deploying to a public URL (e.g. `https://triage.yourdistrict.org`):

1. Go to **Authentication → Add URI** under the SPA platform.
2. Add your production URL (e.g. `https://triage.yourdistrict.org`).
3. Click **Save**.

---

## 3. Get an Anthropic API Key

1. Sign in at [https://console.anthropic.com](https://console.anthropic.com).
2. Go to **API Keys → Create Key**.
3. Copy the key — you will not be able to see it again.

---

## 4. Local Development

Use this method to run the frontend and backend separately with hot-reload.

### 4a. Clone the repository

```bash
git clone <repo-url>
cd Mail-triage
```

### 4b. Configure the frontend

```bash
cp .env.example .env
```

Edit `.env`:

```bash
VITE_CLIENT_ID=<your Application (client) ID from step 2b>
VITE_TENANT_ID=<your Directory (tenant) ID from step 2b>
# Leave VITE_ANTHROPIC_API_KEY blank — the backend handles AI calls
```

### 4c. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```bash
ANTHROPIC_API_KEY=<your Anthropic API key from step 3>
GRAPH_CLIENT_STATE=<generate with: python -c "import uuid; print(uuid.uuid4())">
```

### 4d. Install dependencies

```bash
# Frontend (from repo root)
npm install

# Backend
cd backend
pip install -r requirements.txt
```

### 4e. Start both servers

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

You should see: `Uvicorn running on http://0.0.0.0:8000`

**Terminal 2 — Frontend:**
```bash
# from repo root
npm run dev
```

You should see: `Local: http://localhost:5173`

### 4f. Open the app

Navigate to [http://localhost:5173](http://localhost:5173).

If you set `VITE_CLIENT_ID` and `VITE_TENANT_ID` in `.env`, the login fields will be pre-filled. Click **Sign in with Microsoft** and authenticate with your M365 account.

---

## 5. Docker Deployment (Recommended)

Docker bundles both the frontend (nginx) and backend (FastAPI) into a single `docker compose up` command. This is the simplest way to run the app on a server.

### 5a. Configure environment files

**Frontend build args** — create a `.env` in the repo root (used only at build time):

```bash
cp .env.example .env
```

Edit `.env`:

```bash
VITE_CLIENT_ID=<your Application (client) ID>
VITE_TENANT_ID=<your Directory (tenant) ID>
# Do NOT set VITE_ANTHROPIC_API_KEY — the backend handles it
```

**Backend runtime secrets** — create `backend/.env`:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```bash
ANTHROPIC_API_KEY=<your Anthropic API key>
GRAPH_CLIENT_STATE=<random UUID>
CORS_ORIGINS=http://localhost,http://localhost:80,http://frontend
```

### 5b. Build and start

```bash
# From repo root
docker compose up --build -d
```

Docker will:
1. Build the React app (baking in `VITE_CLIENT_ID` / `VITE_TENANT_ID`)
2. Start the FastAPI backend
3. Start the nginx frontend (waits for the backend health check to pass)

### 5c. Verify containers are running

```bash
docker compose ps
```

Both `frontend` and `backend` should show **Up** / **healthy**.

### 5d. Open the app

Navigate to [http://localhost](http://localhost) (port 80).

### 5e. Useful Docker commands

```bash
# View logs
docker compose logs -f

# View backend logs only
docker compose logs -f backend

# Stop everything
docker compose down

# Rebuild after code changes
docker compose up --build -d

# Restart without rebuilding
docker compose restart
```

---

## 6. Production Deployment

### 6a. Server requirements

- Linux server (Ubuntu 22.04+ recommended), 1 vCPU / 1 GB RAM minimum
- Docker + Docker Compose installed
- Ports 80 and 443 open in your firewall
- A domain name pointed at the server (for HTTPS)

### 6b. Add production redirect URI to Entra

Before deploying, add your production domain to the Entra app registration (see [step 2e](#2e-production-only-add-your-production-redirect-uri)).

### 6c. Set environment variables

Copy and edit the env files on the server as described in [step 5a](#5a-configure-environment-files), using your production domain where applicable.

Update `backend/.env`:

```bash
CORS_ORIGINS=https://triage.yourdistrict.org
```

### 6d. Set up HTTPS with a reverse proxy

Place a reverse proxy (nginx, Caddy, Traefik) in front of the Docker containers to terminate TLS.

**Example with Caddy** (simplest — auto-issues Let's Encrypt certificates):

```bash
# Install Caddy on the host
sudo apt install -y caddy

# /etc/caddy/Caddyfile
triage.yourdistrict.org {
    reverse_proxy localhost:80
}
```

```bash
sudo systemctl enable --now caddy
```

### 6e. Deploy

```bash
git clone <repo-url> /opt/inbox-triage
cd /opt/inbox-triage

# Configure .env and backend/.env as above
docker compose up --build -d
```

### 6f. Keep containers running across reboots

Docker Compose services are configured with `restart: unless-stopped`, so they restart automatically after a server reboot once started.

---

## 7. Real-time Email Notifications (Optional)

This feature pushes new emails to the UI instantly via Server-Sent Events (SSE) and Microsoft Graph webhooks. It requires your backend to be reachable from the internet.

### 7a. Expose the backend with ngrok (development)

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 8000
```

Note the HTTPS forwarding URL (e.g. `https://abc123.ngrok.io`).

### 7b. Create a Graph webhook subscription

```bash
curl -X POST http://localhost:5173/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "graph_token": "<your Microsoft Graph access token>",
    "notification_url": "https://<your-ngrok-id>.ngrok.io/api/webhooks/graph"
  }'
```

For production, replace the `ngrok` URL with your actual public backend URL (e.g. `https://triage.yourdistrict.org/api/webhooks/graph`).

### 7c. Subscription expiry

Graph subscriptions expire after **3 days**. Re-run the curl command above to renew. Alternatively, open the app — it will continue working without real-time updates after expiry (emails appear on next page load).

---

## 8. Verifying Everything Works

### Backend health check

```bash
curl http://localhost:8000/api/health
```

Expected response: `{"status":"ok","anthropic_configured":true}`

If `anthropic_configured` is `false`, check that `ANTHROPIC_API_KEY` is set in `backend/.env`.

### Frontend loads

Open the app URL in your browser. You should see the Inbox Triage login screen with the Microsoft sign-in button.

### End-to-end flow

1. Sign in with your M365 account.
2. After authentication, the app fetches your 20 most recent emails.
3. Each email card should display an urgency level (Critical / High / Medium / Low), a category, and a summary powered by Claude.
4. Click an email card to expand it and view action items.
5. Click **Draft Reply** to generate a Claude-written reply.

---

## 9. Troubleshooting

### "AADSTS" error during Microsoft sign-in

- Verify the redirect URI in your Entra app registration exactly matches the URL you are accessing (including scheme and port).
- Confirm **Access tokens** is enabled under **Authentication → Implicit grant**.

### Emails load but triage results never appear

- Check that the backend is running: `curl http://localhost:8000/api/health`
- Check backend logs: `docker compose logs backend` or the uvicorn terminal.
- Verify `ANTHROPIC_API_KEY` is valid and has quota remaining.

### "403 Forbidden" from Microsoft Graph

- Confirm `Mail.Read` and `Mail.ReadWrite` delegated permissions are added and admin consent has been granted.

### Docker build fails on `npm ci`

- Ensure `package-lock.json` is committed to the repository.
- Run `npm install` locally first to generate it, then rebuild.

### Frontend shows but API calls return 502 Bad Gateway

- The backend container may still be starting. Wait ~15 seconds and reload.
- Check `docker compose ps` — the backend should show **healthy**.
- Inspect logs: `docker compose logs backend`.

### Port 80 already in use

Edit `docker-compose.yml` and change `"80:80"` to another port, e.g. `"8080:80"`, then access the app at `http://localhost:8080`.
