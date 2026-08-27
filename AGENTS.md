# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Bilet Ekosistemi is a multilingual (TR/DE/EN) event ticketing platform built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Supabase (cloud-hosted). It has a public storefront, admin panel (`/yonetim`), organizer portal (`/panel`), and login (`/giris`).

### Running the dev server
Use Turbopack mode — the standard webpack dev mode (`npm run dev`) has a pre-existing "Element type is invalid" SSR error on all pages. The recommended commands are:

```
npm run dev:turbo     # Next.js dev with Turbopack
npm run dev:clean     # Cleans .next then starts Turbopack
```

Both serve on port 3000. Pages like `/tr`, `/yonetim`, `/giris` should return HTTP 200.

### Lint / Build / Check
- `npm run lint` — ESLint (warnings only, no errors)
- `npm run build` — Production build (all 66 pages)
- `npm run check` — Lint + build combined

### Environment variables
Copy `.env.example` to `.env.local`. The three required Supabase vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must be valid URL/JWT format or the build's prerender step fails. With placeholder URLs (e.g. `https://placeholder.supabase.co`), pages render but Supabase-dependent API routes return errors — this is expected without real credentials.

### No local database or Docker
All data lives in a cloud Supabase project. There is no Docker, Makefile, or local DB setup. SQL migration scripts in `supabase/` are meant to run via Supabase Dashboard SQL Editor.

### Node.js version
Node 22 (system default) works. Node 18 also works but triggers Supabase deprecation warnings. No `.nvmrc` or version pinning file exists.

### Package manager
npm with `package-lock.json`.

### Key gotchas
- `npm run dev` (webpack mode) returns 500 on all routes due to a pre-existing component resolution bug. Always use `npm run dev:turbo`.
- The `NEXT_PUBLIC_SUPABASE_URL` env var must be a valid URL (not a bare string like `your_supabase_url`) or `npm run build` will fail on the `/api/test-supabase` prerender step.
- Without real Supabase credentials, the homepage (`/tr`) may show a client-side error modal from `GlobalErrorHandler` due to failed Supabase fetch. Other pages (FAQ, login, cart, admin) render fine. To test UI without credentials, use pages like `/tr/bilgilendirme/sss`, `/giris`, `/tr/sepet`.
- Sentry is only active during production builds when `NEXT_PUBLIC_SENTRY_DSN` is set; it's safely disabled otherwise.
- `eslint: { ignoreDuringBuilds: true }` is set in `next.config.mjs`, so `npm run build` skips lint. Run `npm run lint` separately.
- The i18n language switcher in the header works for switching between `/tr/`, `/de/`, `/en/` prefixed routes.
