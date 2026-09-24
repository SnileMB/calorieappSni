# Phase 1: Foundation & Infrastructure - Research

**Researched:** 2026-09-23
**Domain:** Installable React/Vite PWA + Supabase Auth/Postgres/RLS backend + GitHub Actions keep-alive
**Confidence:** HIGH (Supabase official docs, npm registry, vite-plugin-pwa official docs) / MEDIUM (iOS Safari PWA behavior, GitHub Actions keep-alive patterns — community-sourced, cross-verified across multiple independent sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** React + Vite for the client. Lightweight SPA, no SSR (Supabase is the backend, so SSR adds nothing here). Use `vite-plugin-pwa` for manifest/service-worker generation.
- **D-02:** This supersedes the Expo/React Native assumption baked into the earlier STACK.md/ARCHITECTURE.md research (written pre-pivot) — those docs' AI-model and Supabase-architecture conclusions remain valid, but their client-side code (Expo Router structure, `expo-image-manipulator`, `expo-camera`, React Native-specific Blob/upload anti-pattern) does not apply and must be re-derived for a browser client during Phase 1/2 research.
- **D-03:** Minimal schema for Phase 1, not the full schema. Create only what's needed to prove auth + RLS + cross-device sync works (e.g. a `profiles` table keyed on `auth.uid()`). Every table still gets RLS enabled in the same migration that creates it (non-negotiable, per ARCHITECTURE.md Anti-Pattern 2).
- **D-04:** Each later phase (2-5) adds its own tables via migration when it actually needs them (e.g. Phase 2 adds `logs`/`log_items`/`foods`, Phase 4 adds `goals`/`weight`). No upfront full-schema design in Phase 1.
- **D-05:** A GitHub Actions scheduled workflow (cron trigger) pings a lightweight Supabase endpoint (simple authenticated REST call or trivial Edge Function) on a recurring schedule to prevent the 7-day free-tier auto-pause. Lives in the repo (`.github/workflows/`), no third-party cron account needed.
- **D-06:** Phase 1 delivers both installability (manifest + icons + meets install-prompt criteria) AND offline app-shell caching via a service worker (caches JS/CSS/static assets so the UI shell opens with no network, even though app functionality still requires Supabase connectivity for actual data).

### Claude's Discretion

- Exact GitHub Actions cron schedule/frequency (must be well within the 7-day pause window — e.g. daily).
- Service worker caching strategy specifics (which assets, cache invalidation approach) — `vite-plugin-pwa` defaults are a reasonable starting point.
- Auth screen visual design, exact `profiles` table columns, icon/branding assets.
- Whether the keep-alive ping hits PostgREST directly vs. a dedicated Edge Function — pick whichever is simpler to verify "independently running."

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| SETUP-01 | App is an installable PWA (add-to-Home-Screen, manifest + service worker) accessible from any browser, including the user's iPhone — no code-signing, no app store, no reinstall cycle | `vite-plugin-pwa` manifest/icon/service-worker patterns (Architecture Patterns → Pattern 1); iOS install-flow pitfalls and platform-branching detection code (Common Pitfalls 1-2, Code Examples) |
| SETUP-02 | Backend runs entirely on Supabase free tier (Auth, Postgres, Edge Functions, Storage) with RLS enabled on every table from creation | Table + RLS same-migration SQL pattern (Architecture Patterns → Pattern 3); cross-account RLS verification approach (Common Pitfalls 3) |
| SETUP-03 | Supabase project stays awake via a scheduled keep-alive ping (avoids the 7-day free-tier auto-pause) | GitHub Actions cron workflow pattern + PostgREST ping (Code Examples, Common Pitfalls 4-5) |
| SYNC-01 | User's data (diary, goals, saved meals, profile) is stored in Supabase Postgres and accessible from any of the user's own signed-in devices | Architectural Responsibility Map (cross-device visibility = Postgres/RLS, not a sync layer); System Architecture Diagram second-device flow |
| SYNC-02 | User authenticates via email/password (not anonymous auth) so data persists reliably across devices and reinstalls | Supabase client + session persistence pattern (Architecture Patterns → Pattern 2), including the cross-device session clarification |
</phase_requirements>

## Summary

Phase 1 has three independent technical tracks that only share the Supabase project as a common dependency: (1) a Vite + React SPA made installable via `vite-plugin-pwa`, which auto-generates the manifest and a Workbox-based service worker for offline app-shell caching; (2) Supabase email/password Auth wired into the SPA via `@supabase/supabase-js`, which persists sessions to `localStorage` by default (no extra config needed for cross-restart persistence) — cross-*device* "sync" is really just "every device independently authenticates and reads the same Postgres rows via RLS," not a sync protocol; and (3) a Supabase Postgres migration that creates a `profiles` table with RLS enabled and an `auth.uid()`-scoped policy in the same migration file, plus a GitHub Actions scheduled workflow that pings a Supabase endpoint to reset the 7-day free-tier inactivity pause timer.

The biggest platform-specific risk is iOS Safari: unlike Chrome/Android, iOS has **no `beforeinstallprompt` event and no automatic install banner** — install is manual only (Share → Add to Home Screen), so "see an install prompt" from the phase's success criteria must be interpreted as an in-app instructional UI (not a native browser prompt) on iOS, while Chrome/Android/desktop can use the real `beforeinstallprompt` event. This is a scope-defining fact for task planning, not just an implementation detail.

**Primary recommendation:** Scaffold with `npm create vite@latest` (React + TS template), add `vite-plugin-pwa` with `registerType: 'autoUpdate'` and a manifest including 192/512 PNG icons plus a separate 180×180 `apple-touch-icon.png` (opaque, no transparency — iOS ignores manifest icons for the home-screen icon and always uses the apple-touch-icon link tag). Use `@supabase/supabase-js` v2 with default `persistSession: true` for auth. Write one Supabase migration that creates `profiles` + enables RLS + creates all four CRUD policies scoped to `(select auth.uid())` in the same file. Use a GitHub Actions daily cron hitting the Supabase REST endpoint (`/rest/v1/<table>?select=id&limit=1`) with the anon key as the keep-alive ping — simplest to verify independently, no Edge Function needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PWA installability (manifest, icons, install UX) | Browser / Client | — | Manifest + service worker are static assets served to the browser; install behavior is entirely browser-owned |
| Offline app-shell caching | Browser / Client | CDN / Static | Service worker (Workbox, generated by `vite-plugin-pwa`) intercepts requests client-side; static build output is what gets cached |
| Auth (sign up / log in / session persistence) | API / Backend (Supabase Auth) | Browser / Client | Supabase Auth issues/validates JWTs server-side; `supabase-js` on the client stores and auto-refreshes the session token in `localStorage` |
| Cross-device data visibility | Database / Storage | API / Backend | Postgres is the single source of truth; every device independently queries it through PostgREST with the same `auth.uid()` — there is no separate "sync" layer to build |
| RLS enforcement | Database / Storage | — | Policies live in Postgres itself (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`); enforced regardless of which client calls it |
| Keep-alive ping | API / Backend (PostgREST or Edge Function) | CI/CD (GitHub Actions) | The actual "activity" that resets Supabase's inactivity clock must hit the Supabase API; GitHub Actions is only the external scheduler/trigger |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | 8.3.0 [VERIFIED: npm registry] | Build tool / dev server for the React SPA | Fast HMR, native ESM, first-class plugin ecosystem including `vite-plugin-pwa`; already the project's chosen build tool per CONTEXT.md D-01 |
| `react` / `react-dom` | 19.3.0 [VERIFIED: npm registry] | UI library | Locked by CONTEXT.md D-01 |
| `vite-plugin-pwa` | 1.3.0 [VERIFIED: npm registry] | Generates web app manifest + Workbox service worker, injects registration | Locked by CONTEXT.md D-01/D-06; official, actively maintained (vite-pwa org), zero-config default that satisfies installability + offline app-shell caching in one plugin |
| `@supabase/supabase-js` | 2.117.1 [VERIFIED: npm registry] | Supabase client: Auth, Postgres (via PostgREST), Storage, Realtime | Official SDK; default config persists sessions to `localStorage` and auto-refreshes tokens — exactly what SYNC-01/SYNC-02 need with zero extra wiring |
| `typescript` | 7.0.2 [VERIFIED: npm registry] | Type safety | Standard for Vite React projects; not explicitly locked by CONTEXT.md but consistent with project conventions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase CLI (`supabase`) | latest [ASSUMED — not verified via npm view in this session, standard install is via Homebrew/npx, not a project dependency] | Local migration authoring (`supabase migration new`), linking to remote project, applying migrations (`supabase db push`) | Always for schema/RLS work — migrations must be files in `supabase/migrations/`, not ad hoc dashboard SQL, so they're reproducible and reviewable |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vite-plugin-pwa` (Workbox `generateSW` default) | Hand-rolled `sw.js` | More control over caching strategy, but reinvents manifest injection, precache manifest generation, and update lifecycle handling that Workbox already solves correctly — explicitly against "Don't Hand-Roll" guidance below |
| GitHub Actions PostgREST ping (this phase's choice) | Dedicated Supabase Edge Function as the keep-alive target | Edge Function adds a deploy step and a second thing that can silently fail; a direct PostgREST `select` against an existing RLS-protected table (using the anon key, or a `select`-only policy) is simpler to verify "independently running" and needs no extra Supabase deploy |
| Supabase `persistSession: true` default (localStorage) | Custom cookie-based session storage (`@supabase/ssr` cookie adapter) | Cookie-based storage matters for SSR frameworks needing the session on the server; irrelevant here since CONTEXT.md D-01 explicitly rules out SSR — default localStorage persistence is correct and sufficient |

**Installation:**
```bash
npm create vite@latest . -- --template react-ts
npm install @supabase/supabase-js
npm install -D vite-plugin-pwa
```

**Version verification:** Verified 2026-09-23 via `npm view <package> version` against the live npm registry (see table above). All five core packages passed `slopcheck install --ecosystem npm` with `[OK]` status (see Package Legitimacy Audit).

## Package Legitimacy Audit

Ran `slopcheck install vite vite-plugin-pwa @supabase/supabase-js react react-dom --ecosystem npm` in an isolated scratch directory (not the project directory) on 2026-09-23. All five packages resolved against the real npm registry and were flagged clean.

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `vite` | npm | [OK] | Approved |
| `vite-plugin-pwa` | npm | [OK] | Approved |
| `@supabase/supabase-js` | npm | [OK] | Approved |
| `react` | npm | [OK] | Approved |
| `react-dom` | npm | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Note: an earlier invocation of `slopcheck install` without `--ecosystem npm` auto-detected PyPI (no `package.json` existed yet in the project directory at research time) and installed unrelated PyPI packages coincidentally also named `vite`/`react`/etc. into the local Python environment — these were identified and `pip uninstall`-ed immediately. This is a direct illustration of the documented cross-ecosystem confusion risk; the planner should ensure `package.json` exists (or `--ecosystem npm` is passed explicitly) before any future `slopcheck install` call in this repo.

The Supabase CLI itself is not an npm dependency (typically installed via Homebrew, a standalone binary, or `npx supabase`) and was not run through slopcheck; treat it as `[ASSUMED]` and verify its provenance (official `supabase/cli` GitHub releases) before installing.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐
│   iPhone Safari / any        │
│   browser                    │
│                               │
│  1. Visit app URL             │
│  2. Manifest + SW detected    │
│     → install-eligible        │
│  3a. Chrome/Android: native   │
│      beforeinstallprompt       │
│  3b. iOS Safari: in-app        │
│      "Add to Home Screen"      │
│      instructions (manual)     │
│  4. Standalone app icon        │
│     on Home Screen             │
└───────────────┬───────────────┘
                │ HTTPS (required for SW + install)
                ▼
┌───────────────────────────────┐
│  Vite build output (static)    │
│  - index.html                  │
│  - manifest.webmanifest        │
│  - sw.js (Workbox, precache)   │
│  - React SPA bundle             │
└───────────────┬────────────────┘
                │ supabase-js (fetch to PostgREST/GoTrue)
                ▼
┌────────────────────────────────────────────┐
│         Supabase project (free tier)         │
│  ┌───────────┐   ┌─────────────────────┐    │
│  │  Auth      │──▶│ issues JWT on        │    │
│  │  (GoTrue)  │   │ signUp/signInWith-   │    │
│  │            │   │ Password             │    │
│  └───────────┘   └──────────┬───────────┘    │
│                              │ JWT (auth.uid())│
│                              ▼                 │
│  ┌────────────────────────────────────────┐  │
│  │  PostgREST → Postgres                    │  │
│  │  profiles table                          │  │
│  │  RLS: auth.uid() = user_id                │  │
│  └────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │ GitHub Actions (cron, daily)    │
        │ curl → /rest/v1/profiles?limit=1│
        │ resets 7-day inactivity clock   │
        └─────────────────────────────────┘
```

Second device (proving SYNC-01/cross-device visibility): repeats the same flow — signs in with the same email/password, `supabase-js` requests the same `profiles` row through PostgREST, RLS lets it through because `auth.uid()` matches, and Postgres (not a sync layer) is what makes the write visible on the second device.

### Recommended Project Structure
```
src/
├── lib/
│   └── supabase.ts         # single supabase-js client instance, reads import.meta.env
├── auth/
│   ├── AuthContext.tsx     # onAuthStateChange subscription, exposes session/user
│   ├── SignIn.tsx
│   └── SignUp.tsx
├── App.tsx
└── main.tsx
public/
├── apple-touch-icon.png    # 180x180, opaque, no alpha — iOS-only, NOT in manifest
├── pwa-192x192.png
└── pwa-512x512.png
supabase/
└── migrations/
    └── <timestamp>_create_profiles.sql   # CREATE TABLE + ENABLE RLS + CREATE POLICY, one file
.github/
└── workflows/
    └── keep-alive.yml
vite.config.ts               # VitePWA plugin config (manifest + workbox options)
```

### Pattern 1: Manifest + service worker generation (`vite-plugin-pwa`)
**What:** The plugin generates `manifest.webmanifest`, injects the `<link rel="manifest">` tag, generates a Workbox service worker (`generateSW` strategy by default) that precaches the built JS/CSS/HTML app shell, and injects the SW registration script.
**When to use:** Always for this phase — this single plugin satisfies both the installability requirement (SETUP-01) and the offline app-shell caching requirement (D-06).
**Example:**
```typescript
// Source: https://vite-pwa-org.netlify.app/guide/ (official docs)
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'BOBLUR',
        short_name: 'BOBLUR',
        description: 'Personal AI calorie & macro tracker',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      devOptions: { enabled: true } // lets install/SW be tested in `vite dev`, not just build
    })
  ]
})
```
**iOS-specific note:** iOS Safari does not read the manifest's `icons` array for the Home Screen icon — it requires a separate `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` tag (180×180 PNG, opaque background, no transparency; iOS composites its own rounding/shadow and renders alpha as black). `includeAssets` above ensures this file is copied into the build; the link tag itself must be added to `index.html` (or via the plugin's `injectManifest`/head-injection options).

### Pattern 2: Supabase client + session persistence
**What:** One shared `supabase-js` client instance; default `auth` config already persists sessions to `localStorage` and auto-refreshes tokens.
**When to use:** Always — create once in `src/lib/supabase.ts`, import everywhere.
**Example:**
```typescript
// Source: https://supabase.com/docs/reference/javascript/initializing (official docs)
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,   // default true; explicit here for clarity — this IS what satisfies "session persists across app restarts"
      detectSessionInUrl: true
    }
  }
)
```
Session key is stored in `localStorage` as `sb-<project-ref>-auth-token` [CITED: github.com/orgs/supabase/discussions/11100]. Subscribe to `supabase.auth.onAuthStateChange` in an `AuthContext` to react to sign-in/sign-out/token-refresh events across the app without manual polling.

**Cross-device clarification:** "Session persists ... across devices" (success criterion 2) does NOT mean a session token itself syncs between devices — each device has its own independent `localStorage` session after its own sign-in. What syncs is the *data* (via Postgres + RLS), and the user experience of "sign in once per device, then it just works" comes from `persistSession` surviving restarts on that one device. Task planning should verify this distinction: don't build any session-sharing mechanism, just correct per-device persistence + shared backend data.

### Pattern 3: Table + RLS in one migration
**What:** A single migration file creates the table, enables RLS, and creates all needed policies — never split across migrations, never leave a table RLS-disabled even temporarily.
**When to use:** Every table, starting with `profiles` in this phase (per CONTEXT.md D-03, non-negotiable per ARCHITECTURE.md Anti-Pattern 2).
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security (official docs)
-- supabase/migrations/<timestamp>_create_profiles.sql

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using ( (select auth.uid()) = id );

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check ( (select auth.uid()) = id );

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

create policy "Users can delete their own profile"
  on public.profiles for delete
  to authenticated
  using ( (select auth.uid()) = id );
```
Note: using `id uuid references auth.users(id)` (rather than a separate `user_id` column) is the standard Supabase `profiles` pattern — the profile row's primary key IS the auth user's id, so a `select ... where id = auth.uid()` (or the policy above) is the whole scoping mechanism, with no risk of a mismatched foreign key. Wrapping `auth.uid()` in `(select auth.uid())` is a documented Postgres performance optimization (caches the result once per statement instead of re-evaluating per row) [CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices].

### Anti-Patterns to Avoid
- **Creating a table then adding RLS "later":** Even a brief window with RLS disabled on a table exposes all rows to any authenticated (or anonymous, if the anon key is used) request. Always same-migration, per CONTEXT.md D-03/ARCHITECTURE.md Anti-Pattern 2.
- **Relying on iOS `beforeinstallprompt`:** It does not exist on iOS Safari [CITED: multiple sources, cross-verified — see Sources]. Any task that says "show the native install prompt" must branch: real event-driven prompt on Chromium/Android, static instructional UI ("Tap Share, then Add to Home Screen") on iOS/Safari, detected via UA sniffing or `navigator.standalone` check.
- **Hand-rolling the service worker:** Custom `sw.js` reinvents precache manifest generation and cache-busting that Workbox (via `vite-plugin-pwa`) already does correctly — see Don't Hand-Roll below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| PWA manifest + service worker generation | Hand-written `sw.js` with manual `caches.open`/`fetch` interception, hand-written `manifest.json` | `vite-plugin-pwa` (Workbox `generateSW`) | Correct precache-manifest hashing/cache-busting on every build, correct update lifecycle (`skipWaiting`/`clientsClaim` when `registerType: 'autoUpdate'`), already locked in by CONTEXT.md D-01 |
| Auth session storage/refresh | Custom JWT storage + manual refresh timer | `@supabase/supabase-js` default `persistSession`/`autoRefreshToken` | Handles token expiry, refresh races, and storage abstraction already; reinventing this risks silent session-expiry bugs |
| Row-level authorization | Application-layer `WHERE user_id = ?` checks scattered across API calls | Postgres RLS policies | RLS is enforced at the database layer regardless of which code path queries it — an app-layer check can be forgotten in one query and silently leak data; RLS cannot be bypassed by a missed `WHERE` clause |
| Keep-alive scheduling | A custom always-on server/daemon that pings Supabase | GitHub Actions scheduled workflow (`on: schedule: cron:`) | Free, already-available infra (no server to host/maintain), matches CONTEXT.md D-05 exactly |

**Key insight:** Every "don't hand-roll" item in this phase already has an official, zero-cost, already-decided solution (`vite-plugin-pwa`, `supabase-js` defaults, Postgres RLS, GitHub Actions cron) — this phase should not require writing any of these subsystems from scratch, only correctly configuring and wiring existing ones.

## Common Pitfalls

### Pitfall 1: Assuming iOS shows an install prompt like Chrome
**What goes wrong:** Code waits for a `beforeinstallprompt` event on iOS Safari that never fires, so the "install" UI never appears and the success criterion ("see an install prompt... add it to the Home Screen") silently fails for the platform the phase explicitly names (iPhone).
**Why it happens:** `beforeinstallprompt` is a Chromium-only API; Apple has never implemented it [CITED: cross-verified across MagicBell, MobiLoud, Brainhub PWA-iOS guides, 2026].
**How to avoid:** Detect platform (`/iPad|iPhone|iPod/.test(navigator.userAgent)` combined with checking `!(window.navigator as any).standalone`) and show a custom "Tap the Share icon, then Add to Home Screen" instructional banner on iOS/Safari instead of relying on the native prompt. Use the real `beforeinstallprompt` event + `prompt()` call only on browsers that support it.
**Warning signs:** Manually testing only in desktop Chrome (where `beforeinstallprompt` works) and never testing the actual iPhone Safari flow before considering SETUP-01 done.

### Pitfall 2: Manifest icons alone are not enough for a correct iOS home-screen icon
**What goes wrong:** Icon appears as a blank/generic browser icon (or a black square) on the iPhone Home Screen despite a correctly configured manifest.
**Why it happens:** iOS Safari does not consume the Web App Manifest's `icons` array for the Home Screen icon; it requires a same-origin `<link rel="apple-touch-icon">` and applies its own rounded-corner mask, rendering any transparency in the source PNG as black. SVG icons are also not honored by iOS/many Android launchers.
**How to avoid:** Ship a dedicated 180×180 PNG (`apple-touch-icon.png`) with a fully opaque background (no alpha channel), referenced via the `<link rel="apple-touch-icon">` tag, separate from the manifest icon set. `includeAssets` in the `VitePWA` config ensures the file ships in the build.
**Warning signs:** Icon looks correct on Android Chrome install but wrong/cropped/black on the actual iPhone test.

### Pitfall 3: Testing RLS only as the developer's own signed-in user
**What goes wrong:** Success criterion 3 explicitly requires confirming "a signed-in user cannot read another user's rows" — a single-account manual smoke test doesn't prove this; a bug in the policy expression (e.g., using `user_id` when the column is actually named `id`, or omitting the `to authenticated` clause so the policy also applies to `anon`) can pass casual testing while still leaking data.
**Why it happens:** RLS policies are easy to write with a typo that silently fails "closed" in the tester's favor (their own row is visible) while being wrong in ways only visible with a second account.
**How to avoid:** Create two test accounts, insert a row as each, and explicitly attempt (and expect to fail) a cross-account `select` using each user's own JWT — this is the only way to actually verify RLS scoping, not the presence of any policy at all. Supabase's own recommended approach is a `supabase/tests/*.sql` pgTAP test run via `supabase test db` [CITED: Supabase RLS docs / community best-practice writeups], or an equivalent manual two-browser-session check for this phase's small scope.
**Warning signs:** RLS "verification" consists only of confirming the policy SQL ran without error, not an actual cross-user negative test.

### Pitfall 4: Keep-alive ping technically running but not actually resetting the pause timer
**What goes wrong:** A GitHub Actions cron job runs "successfully" (green checkmark) but the request doesn't count as qualifying activity — e.g., it hits a URL that 404s, or only exercises Supabase Auth's `/auth/v1/health` endpoint rather than the database, and the project still pauses after 7 days.
**Why it happens:** Community reports differ on exactly what counts as "activity" for the pause timer — official Supabase docs describe pausing after 7 days of *API* inactivity generally, and most working community solutions issue a real PostgREST `select` against a table (not just a health check) to be safe.
**How to avoid:** Have the workflow issue a genuine `select` against the `profiles` table via `/rest/v1/profiles?select=id&limit=1` with both `apikey` and `Authorization: Bearer <anon-or-service-key>` headers (not just the `/auth/v1/health` endpoint), and use `curl -f` (fail on HTTP error) so a broken ping fails the GitHub Actions run visibly rather than silently succeeding on a 404.
**Warning signs:** Workflow always shows green, but nobody has confirmed what response code/body it actually receives — add an explicit response-code check to the workflow step.

### Pitfall 5: GitHub Actions scheduled workflows get disabled after 60 days of *repository* inactivity
**What goes wrong:** The keep-alive workflow itself silently stops running (not a script bug, GitHub disables scheduled workflows on repos with no activity for 60 days), defeating the entire purpose without any error being visible in Supabase.
**Why it happens:** Documented GitHub platform behavior, unrelated to workflow correctness [CITED: multiple sources cross-verified].
**How to avoid:** For a single-user side project this is a known, accepted risk (any commit resets the 60-day clock) — not fully solvable within GitHub Actions alone. Document it as an operational note; do not treat "the workflow ran once successfully" as proof it will keep running indefinitely with zero repo activity.
**Warning signs:** Long gaps between commits/PRs on the repo with no other monitoring of whether the Supabase project actually stayed active.

## Code Examples

### GitHub Actions keep-alive workflow
```yaml
# Source: pattern cross-verified across multiple community implementations
# (dev.to/krishna-builds-dev, dev.to/nasreenkhalid, github.com/Misto0o/supabase-keepalive) — MEDIUM confidence
# .github/workflows/keep-alive.yml
name: Supabase Keep-Alive

on:
  schedule:
    - cron: '0 12 * * *'   # daily at 12:00 UTC — well within the 7-day pause window
  workflow_dispatch: {}      # allow manual trigger for verification

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST endpoint
        run: |
          curl -sf \
            "${{ secrets.SUPABASE_URL }}/rest/v1/profiles?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```
`SUPABASE_URL` and `SUPABASE_ANON_KEY` are stored as GitHub repository secrets, not hardcoded. Using the anon key against `profiles` works because RLS will simply return zero rows for an unauthenticated request (the `to authenticated` policies above exclude `anon`) — the point isn't to read data, it's to register as qualifying API activity. `curl -sf` fails the step (non-zero exit) on any HTTP error, making pipeline failures visible per Pitfall 4.

### Detecting install eligibility + iOS fallback UI
```typescript
// Pattern derived from cross-verified iOS PWA limitation sources — MEDIUM confidence, no single official Apple doc states this API surface directly
let deferredPrompt: any = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  // show custom "Install" button; on click: deferredPrompt.prompt()
})

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isStandalone = (window.navigator as any).standalone === true
  || window.matchMedia('(display-mode: standalone)').matches

if (isIOS && !isStandalone) {
  // show static instructional banner: "Tap Share, then Add to Home Screen"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Create React App + `workbox-webpack-plugin` for PWA | Vite + `vite-plugin-pwa` (Workbox under the hood) | CRA deprecated/unmaintained since ~2023 | Confirms CONTEXT.md D-01's choice is current best practice, not a legacy pattern |
| Supabase `@supabase/auth-helpers-react` | Plain `@supabase/supabase-js` `onAuthStateChange` + custom context, or `@supabase/ssr` for SSR frameworks | auth-helpers packages deprecated in favor of `@supabase/ssr` (for SSR) or direct `supabase-js` (for pure SPAs) | This project has no SSR (D-01), so the direct `supabase-js` + `onAuthStateChange` pattern shown above is the currently-recommended approach, not a legacy one |

**Deprecated/outdated:**
- `@supabase/auth-helpers-*` packages: superseded by `@supabase/ssr` for SSR use cases; not applicable here since there's no SSR framework, but flagging so it isn't mistakenly installed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Supabase CLI install method/version (Homebrew/npx, "latest") | Standard Stack → Supporting | Low — CLI is a dev-time tool, not a runtime dependency; any current version supports `migration new`/`db push` |
| A2 | Exact wording/UX Apple currently uses for "Add to Home Screen" (Share icon location, menu wording) may shift slightly between iOS versions | Common Pitfalls, Pitfall 1 | Low-Medium — affects only copy of the in-app instructional banner, not functionality; verify against the actual test device's iOS version during implementation |
| A3 | "7-day" pause window and what specifically counts as qualifying "activity" (community-sourced, not found stated precisely in one official Supabase doc during this session) | Common Pitfalls, Pitfall 4; Summary | Medium — if actual qualifying-activity criteria differ from "any PostgREST select," a daily cron might still not prevent pause; mitigate by monitoring project status for the first 1-2 weeks after setup rather than assuming success from a single manual test |

## Open Questions

1. **Does a `select` via the anon key (no authenticated session) definitely count as "activity" that resets Supabase's pause timer, or does it need to be an authenticated/service-role request?**
   - What we know: Multiple community writeups use unauthenticated PostgREST `select` calls successfully; Supabase's own pause behavior is described only at a high level ("no API requests for 7 days") in secondary sources during this session.
   - What's unclear: No single official Supabase doc was found (in this research pass) stating precisely which request types count.
   - Recommendation: Implement with the anon-key `select` approach (simplest, matches CONTEXT.md's "whichever is simpler to verify independently"), but have the planner include a task to actually observe the Supabase dashboard project-status after ~8-10 days of no manual interaction as the real verification of success criterion 4, not just "the workflow ran green."

2. **Exact current Supabase free-tier pause window** — confirmed as "7 days" per CONTEXT.md/ROADMAP.md framing and consistent with community sources checked in this session; not independently re-verified against Supabase's live pricing page in this research pass (Sources note pricing/limits pages change over time in the pre-existing ARCHITECTURE.md doc too). Low risk since the daily cron schedule has wide margin either way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js / npm | Vite build, all npm installs | ✓ (used successfully in this session) | not explicitly queried | — |
| `slopcheck` (Python/pip) | Package legitimacy verification (research-time only, not a runtime dependency) | ✓ | 0.6.1 | — |
| Supabase account/project | Everything in this phase | Not verified in this research session (no Supabase project credentials available to the researcher) | — | Planner/implementer must create the Supabase project and obtain URL/anon key/service key before implementation |
| GitHub repository with Actions enabled | Keep-alive workflow | Repo exists (`SnileMB/calorieappSni` per PROJECT.md) but Actions availability not independently confirmed in this session | — | — |

**Missing dependencies with no fallback:**
- A live Supabase project (URL + anon key + service role key) must be created before any of this phase's tasks can be executed against real infrastructure — this is expected first-implementation-step work, not a research gap.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — greenfield repo, no test runner configured yet |
| Config file | none — see Wave 0 |
| Quick run command | TBD once framework chosen (e.g., `npm run test`) |
| Full suite command | TBD |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SETUP-01 | App is installable (manifest valid, SW registers, iOS instructional fallback shown) | manual/smoke | Lighthouse PWA audit (`npx lighthouse <url> --only-categories=pwa`) + manual iPhone Safari test | ❌ Wave 0 |
| SETUP-02 | Every table has RLS enabled from creation | integration (pgTAP or manual cross-account) | `supabase test db` (if pgTAP tests added) or manual two-account script | ❌ Wave 0 |
| SETUP-03 | Keep-alive workflow independently pings Supabase | operational check | GitHub Actions run history + Supabase dashboard "last active" after ~8+ days | ❌ Wave 0 (no automated test; this is inherently an operational/manual verification) |
| SYNC-01 | Data written by one device is visible on a second device/session | manual/e2e | Manual: sign in on two browser sessions, write on one, reload on the other | ❌ Wave 0 |
| SYNC-02 | Email/password auth, not anonymous | manual/smoke | Manual sign-up/sign-in flow test; assert no `signInAnonymously` call exists in code | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual verification per the table above (no automated unit-test framework exists yet for this phase's mostly-infrastructure scope)
- **Per wave merge:** Full manual pass through all 5 success criteria in ROADMAP.md §Phase 1
- **Phase gate:** All 5 success criteria manually confirmed true before `/bm:verify-work`

### Wave 0 Gaps
- [ ] Decide/introduce a test framework (e.g., Vitest for any pure-function unit tests that emerge later; this phase itself is mostly infrastructure/manual-verification work, not unit-testable logic)
- [ ] `supabase/tests/profiles_rls.sql` (pgTAP) — optional but recommended for an automatable RLS cross-account check, covers SETUP-02
- [ ] No app logic exists yet to unit test — this phase's "tests" are primarily manual/operational verification steps, which is appropriate given its infrastructure nature

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | yes | Supabase Auth (GoTrue) — email/password, managed password hashing/verification server-side, no custom auth code |
| V3 Session Management | yes | `supabase-js` default JWT session handling (`persistSession`, `autoRefreshToken`) — no custom token storage/refresh logic |
| V4 Access Control | yes | Postgres RLS policies scoped to `(select auth.uid())` — enforced at the database layer, not just in application code |
| V5 Input Validation | yes (minimal this phase) | Supabase Auth itself validates email format/password rules; the `profiles` table has few user-editable fields this phase, but any client form should still do basic client-side validation as UX, not as the security boundary |
| V6 Cryptography | yes (delegated) | Never hand-roll — password hashing is entirely handled by Supabase Auth (GoTrue); the only "secret" this phase's client holds is the anon key, which is safe to expose (RLS is the actual security boundary, not key secrecy) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Missing/misconfigured RLS policy exposing other users' rows | Information Disclosure | Same-migration RLS + explicit `to authenticated` role targeting + mandatory cross-account negative test (Pitfall 3) |
| Anon key mistaken for a secret and treated as sufficient access control | Elevation of Privilege | Document explicitly: the anon key is public by design; RLS (not key secrecy) is the actual authorization boundary. Never put the `service_role` key in client-side code (it bypasses RLS entirely) |
| Keep-alive workflow secrets leaked via workflow logs | Information Disclosure | Use GitHub Actions `secrets.*` (not hardcoded), avoid `echo`-ing key values in workflow steps, rely on GitHub's automatic secret masking |
| Service worker caching stale/sensitive auth state | Tampering / Information Disclosure | `vite-plugin-pwa`'s default Workbox strategy precaches only the static build (JS/CSS/HTML app shell), not API responses/auth tokens — do not add runtime caching rules for Supabase API responses in this phase without deliberate cache-control consideration |

## Sources

### Primary (HIGH confidence)
- [Vite PWA official guide](https://vite-pwa-org.netlify.app/guide/) — installation, manifest config, registerType/autoUpdate behavior, Workbox generateSW default
- [Supabase RLS official docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — CREATE TABLE + ENABLE RLS + CREATE POLICY pattern, `(select auth.uid())` performance note
- [Supabase JS client initialization — official reference](https://supabase.com/docs/reference/javascript/initializing) — createClient code, auth config options
- [Supabase RLS performance/best practices — official docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select auth.uid())` caching rationale
- npm registry (`npm view` direct queries, 2026-09-23) — verified current versions of vite, vite-plugin-pwa, @supabase/supabase-js, react, react-dom, typescript
- `slopcheck install --ecosystem npm` (local tool run, 2026-09-23) — all 5 core packages verified `[OK]` against live npm registry

### Secondary (MEDIUM confidence)
- [MagicBell — PWA iOS Limitations and Safari Support 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — no `beforeinstallprompt`, manual install flow
- [MobiLoud — Do PWAs Work on iOS? 2026](https://www.mobiloud.com/blog/progressive-web-apps-ios/) — install process, iOS 16.4+ requirement
- [Brainhub — PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios) — cross-verification of manual-install-only behavior
- [GitHub discussion #11100 — Supabase auth persistence](https://github.com/orgs/supabase/discussions/11100) — localStorage session key format, default persistence behavior
- [dev.to — GitHub Actions cron Supabase keep-alive](https://dev.to/krishna-builds-dev/how-to-keep-your-supabase-free-project-active-no-cost-cron-with-github-actions-1nnd) and [dev.to/nasreenkhalid equivalent](https://dev.to/nasreenkhalid/how-to-set-up-a-github-actions-cron-job-to-prevent-supabase-inactivity-3m6b) — cron pattern, apikey/Authorization headers, PostgREST select approach, cross-verified across 2+ independent writeups
- [github.com/Misto0o/supabase-keepalive](https://github.com/Misto0o/supabase-keepalive) — working example repo of the pattern
- 60-day GitHub Actions scheduled-workflow auto-disable behavior — cross-verified across multiple sources returned in the GitHub Actions keep-alive search

### Tertiary (LOW confidence)
- Exact current Supabase "what counts as activity" definition for the 7-day pause — not found stated precisely in a single official doc during this research session; treated as Open Question 1 above, mitigated by using a real data-table `select` (the safest interpretation across all community sources) rather than a lighter health-check endpoint.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified live against npm registry and cross-checked with slopcheck; `vite-plugin-pwa` and `supabase-js` patterns confirmed against official docs
- Architecture: HIGH for Supabase/RLS pattern (official docs), MEDIUM for iOS PWA install behavior (no single official Apple doc found; consistent across 3+ independent community sources)
- Pitfalls: MEDIUM — iOS PWA behavior and GitHub Actions keep-alive specifics are community-sourced but consistently cross-verified across multiple independent writeups in this session

**Research date:** 2026-09-23
**Valid until:** 2026-10-23 (30 days — stable domain: Supabase RLS/Auth patterns and vite-plugin-pwa are mature/stable; iOS PWA behavior changes slowly across iOS major versions, but re-verify if a new iOS version ships before implementation)
