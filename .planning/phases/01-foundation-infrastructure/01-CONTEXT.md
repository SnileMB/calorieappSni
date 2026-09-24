# Phase 1: Foundation & Infrastructure - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The PWA shell, Supabase backend, and authenticated cross-device storage exist so every later feature has something to build on. Covers: installable PWA shell, Supabase Auth (email/password), RLS-protected schema foundation, and a scheduled keep-alive ping to prevent free-tier auto-pause. Does NOT cover any logging/capture/diary features — those are Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Frontend framework/build tool
- **D-01:** React + Vite for the client. Lightweight SPA, no SSR (Supabase is the backend, so SSR adds nothing here). Use `vite-plugin-pwa` for manifest/service-worker generation.
- **D-02:** This supersedes the Expo/React Native assumption baked into the earlier STACK.md/ARCHITECTURE.md research (written pre-pivot) — those docs' AI-model and Supabase-architecture conclusions remain valid, but their client-side code (Expo Router structure, `expo-image-manipulator`, `expo-camera`, React Native-specific Blob/upload anti-pattern) does not apply and must be re-derived for a browser client during Phase 1/2 research.

### Database schema scope
- **D-03:** Minimal schema for Phase 1, not the full schema. Create only what's needed to prove auth + RLS + cross-device sync works (e.g. a `profiles` table keyed on `auth.uid()`). Every table still gets RLS enabled in the same migration that creates it (non-negotiable, per ARCHITECTURE.md Anti-Pattern 2).
- **D-04:** Each later phase (2-5) adds its own tables via migration when it actually needs them (e.g. Phase 2 adds `logs`/`log_items`/`foods`, Phase 4 adds `goals`/`weight`). No upfront full-schema design in Phase 1.

### Keep-alive ping mechanism
- **D-05:** A GitHub Actions scheduled workflow (cron trigger) pings a lightweight Supabase endpoint (simple authenticated REST call or trivial Edge Function) on a recurring schedule to prevent the 7-day free-tier auto-pause. Lives in the repo (`.github/workflows/`), no third-party cron account needed.

### PWA install & offline scope
- **D-06:** Phase 1 delivers both installability (manifest + icons + meets install-prompt criteria) AND offline app-shell caching via a service worker (caches JS/CSS/static assets so the UI shell opens with no network, even though app functionality still requires Supabase connectivity for actual data).

### Claude's Discretion
- Exact GitHub Actions cron schedule/frequency (must be well within the 7-day pause window — e.g. daily).
- Service worker caching strategy specifics (which assets, cache invalidation approach) — `vite-plugin-pwa` defaults are a reasonable starting point.
- Auth screen visual design, exact `profiles` table columns, icon/branding assets.
- Whether the keep-alive ping hits PostgREST directly vs. a dedicated Edge Function — pick whichever is simpler to verify "independently running."

</decisions>

<specifics>
## Specific Ideas

No specific product references discussed for this phase — decisions above are the concrete requirements.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Core value, constraints (free tier only, single user, no native app), out-of-scope list, platform pivot rationale
- `.planning/REQUIREMENTS.md` — SETUP-01, SETUP-02, SETUP-03, SYNC-01, SYNC-02 (this phase's requirements)
- `.planning/ROADMAP.md` §Phase 1 — Goal and success criteria for this phase

### Architecture & backend (valid, pre-pivot)
- `.planning/research/ARCHITECTURE.md` — Supabase architecture patterns remain valid: Edge Function as secret-holding proxy (Pattern 1), direct client→Postgres for user's own data (Pattern 2), RLS anti-pattern (Anti-Pattern 2), free-tier limits table, and the explicit "Auth: email/password, not anonymous" recommendation. **Ignore the Expo-specific client code/structure in this doc** — superseded by D-01/D-02.
- `.planning/research/STACK.md` — AI vision model choice (Gemini 3.1 Flash-Lite) remains valid for later phases; not relevant to Phase 1 itself (no AI calls in this phase).

### Stale / needs re-research
- No existing doc covers PWA-specific patterns (Vite PWA plugin setup, service worker offline caching, install-prompt requirements, browser camera APIs). Per STATE.md's own note, this is expected to be researched fresh during Phase 1 planning — flagging explicitly here so the researcher doesn't assume ARCHITECTURE.md/STACK.md cover it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
None — greenfield project, no application code exists yet (repo only contains `.planning/` and `CLAUDE.md`).

### Established Patterns
None yet established in code; architectural patterns to follow come from `.planning/research/ARCHITECTURE.md` (see canonical_refs above).

### Integration Points
N/A for this phase — Phase 1 IS the integration point every later phase builds on (Supabase client instance, auth session, base schema/RLS pattern).

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-09-23*
