# syntax=docker/dockerfile:1

# Coolify/Hetzner için optimize Dockerfile
# - npm ci katmanı cache'lenir (package-lock değişmedikçe)
# - next build cache'i .next/cache mount ile saklanır
# - runtime imajı standalone çıktısı ile KÜÇÜK tutulur (chown/export hızlı olur)

# ---------- 1) Temel imaj ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- 2) Bağımlılıklar ----------
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------- 3) Build ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache npm run build \
  && node scripts/chunk-compat.js

# ---------- 4) Çalıştırma (standalone = küçük imaj) ----------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
