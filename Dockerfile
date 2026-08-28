# syntax=docker/dockerfile:1

# Coolify/Hetzner için optimize Dockerfile
# Amaç: paketler ve Next.js build cache'i katman katman saklanır,
# böylece sadece değişen dosyalar yeniden derlenir (Vercel gibi).

# ---------- 1) Temel imaj ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- 2) Bağımlılıklar ----------
# package.json / package-lock.json değişmedikçe bu katman cache'lenir,
# npm ci tekrar ÇALIŞMAZ (en büyük zaman kazancı).
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------- 3) Build ----------
# Next.js build cache'i (.next/cache) kalıcı tutulur: değişmeyen sayfalar
# yeniden derlenmez.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache npm run build

# ---------- 4) Çalıştırma ----------
# Mevcut davranışla birebir aynı: "npm start" -> chunk-compat + next start
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app /app
RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

CMD ["npm", "start"]
