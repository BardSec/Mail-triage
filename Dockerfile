# ── Stage 1: Build the React/Vite app ─────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first (separate layer — cached unless package.json changes)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Vite bakes VITE_* vars into the bundle at build time.
# Pass them as build args so they end up in the static output.
# VITE_ANTHROPIC_API_KEY is not needed in Docker (backend handles AI calls).
ARG VITE_CLIENT_ID
ARG VITE_TENANT_ID

ENV VITE_CLIENT_ID=$VITE_CLIENT_ID
ENV VITE_TENANT_ID=$VITE_TENANT_ID

RUN npm run build

# ── Stage 2: Serve with nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Custom nginx config — proxies /api/* to the FastAPI backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
