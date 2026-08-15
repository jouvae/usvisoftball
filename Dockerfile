# syntax=docker/dockerfile:1

# Multi-stage build for the USVI Softball Federation Next.js 16 app, deployed to
# Fly.io. Fonts are SELF-HOSTED (geist package + vendored Oswald woff2), so
# `next build` performs NO build-time network fetch — this image builds offline.
#
# Runtime secrets are supplied as Fly SECRETS (never baked into the image, never
# committed). Set them with `fly secrets set NAME=value`. Required NAMES (mirrors the
# app's process.env reads + the README Environment table):
#   NEXT_PUBLIC_SUPABASE_URL              — Supabase project URL (browser-safe)
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  — publishable/anon key, RLS-enforced (browser-safe)
#   SUPABASE_KEY                          — sb_secret_… key (server-only, RLS-bypassing)
# Optional:
#   NEXT_PUBLIC_AI_DRAFT_ENABLED          — leave UNSET/false in prod to hide the AI
#                                           draft panel (see README "Feature flags").
# (SUPABASE_DB_URL is `psql`-only for out-of-band migrations — NOT an app runtime secret.)
# The NEXT_PUBLIC_* values are build-time inlined; supply them as build args if the
# public client must be wired at build. They are NOT secrets, but keep real values
# out of source control regardless.

# ---- deps ----------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder -------------------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner --------------------------------------------------------------------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Fly injects PORT; the standalone server honors it. Bind all interfaces.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# The standalone output ships a minimal server + only the node_modules it needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
