# Phase 1: Foundation & Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-09-23
**Phase:** 01-foundation-infrastructure
**Mode:** discuss (default)
**Areas discussed:** Frontend framework/build tool, Database schema scope, Keep-alive ping mechanism, PWA install & offline scope

## Discussion

### Frontend framework/build tool
**Options presented:** React + Vite / Next.js / SvelteKit / Something else, you decide
**Selected:** React + Vite
**Notes:** No SSR needed since Supabase is the backend; pairs with `vite-plugin-pwa`.

### Database schema scope
**Options presented:** Full schema upfront (recommended) / Minimal now, extend per phase
**Selected:** Minimal now, extend per phase
**Notes:** User: "extend per phase, ill just do migrations on the db as we go." RLS still required on every table from the migration that creates it, regardless of when each table is added.

### Keep-alive ping mechanism
**Options presented:** GitHub Actions scheduled workflow (recommended) / External free cron service / Supabase pg_cron + Edge Function
**Selected:** GitHub Actions scheduled workflow

### PWA install & offline scope
**Options presented:** Installability only (recommended) / Installability + offline app-shell caching
**Selected:** Installability + offline app-shell caching
**Notes:** User opted for the broader scope — service worker app-shell caching included in Phase 1, not deferred.

## Deferred Ideas

None — discussion stayed within phase scope.

## Claude's Discretion Items

- GitHub Actions cron frequency
- Service worker caching strategy specifics
- Auth screen visual design, `profiles` table columns, icon/branding assets
- Keep-alive ping implementation detail (PostgREST call vs. dedicated Edge Function)

---

*Phase: 01-foundation-infrastructure*
*Discussion logged: 2026-09-23*
