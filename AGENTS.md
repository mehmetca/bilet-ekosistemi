# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
Bilet Ekosistemi is a Next.js 14 (App Router) event ticketing platform in TypeScript with Tailwind CSS. It uses Supabase (hosted PostgreSQL + Auth + Storage) as the sole backend; there is no separate backend service to run.

### Running the dev server
```
npm run dev        # http://localhost:3000
npm run dev:turbo  # Turbopack mode (faster HMR)
npm run dev:fresh  # clears .next cache then starts dev
```

### Lint / Build / Check
```
npm run lint       # ESLint (warnings only, no errors expected)
npm run build      # Production build
npm run check      # lint + build combined
```

### Environment variables
Copy `.env.example` to `.env.local`. The three Supabase variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must be valid HTTP URLs / JWTs. With placeholder values the dev server starts and compiles pages, but data-fetching pages will show errors since the Supabase API is unreachable. See `.env.example` for the full list.

### Key gotchas
- **No automated test suite**: The project has no unit/integration test runner configured (no Jest, Vitest, etc.). `npm run lint` and `npm run build` are the primary automated checks.
- **Supabase is external**: There is no local Supabase container or Docker setup. All data comes from a hosted Supabase project. Without real credentials, pages that fetch data will 500 at SSR time but the dev server still compiles and serves the error pages.
- **i18n routing**: All public pages are under `/{locale}/` (`tr`, `de`, `en`). The root `/` redirects to `/tr`.
- **Admin panel** is at `/yonetim` (not locale-prefixed). It requires Supabase auth.
- The `eslint: { ignoreDuringBuilds: true }` in `next.config.mjs` means `npm run build` skips lint — run `npm run lint` separately.
- **Login / auth pages** at `/tr/giris` render fully without real Supabase credentials. Form submission returns "Failed to fetch" (expected). `/yonetim` redirects to `/tr/giris` when unauthenticated.
- **i18n check script**: `node scripts/check-i18n-keys.js` validates all 3 locale files match (743 keys). Run this after editing translation files.
- 112 SQL migrations live in `supabase/migrations/`; they are applied via Supabase Dashboard or `supabase db push`, not during local dev.
