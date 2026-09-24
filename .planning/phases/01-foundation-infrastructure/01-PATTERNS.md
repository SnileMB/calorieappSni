# Phase 1: Foundation & Infrastructure - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 13 (new)
**Analogs found:** 0 / 13 — greenfield repo, no application code exists yet

## Context

This repository currently contains only `.planning/` and `CLAUDE.md` — no `src/`, no `package.json`, no prior commits of application code. There is no existing codebase to mine for analog patterns. This is confirmed by CONTEXT.md's `<code_context>` section ("Reusable Assets: None — greenfield project, no application code exists yet") and independently verified here via `find . -maxdepth 3` (only `.git`, `.planning`, `CLAUDE.md` present).

Because there are no in-repo analogs, this PATTERNS.md instead pins each new file to the **exact, concrete pattern already specified in RESEARCH.md** (official docs, verified versions) so the planner has the same level of copy-paste concreteness it would get from a real analog. Treat RESEARCH.md's `## Architecture Patterns` and `## Code Examples` sections as the canonical source for every file below — the excerpts are reproduced here with file targets attached.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|---------------|
| `package.json` | config | — | none | no analog (greenfield) |
| `vite.config.ts` | config | — | none | no analog — pattern from RESEARCH.md Pattern 1 |
| `index.html` | config | — | none | no analog — needs `apple-touch-icon` link tag (Pitfall 2) |
| `src/main.tsx` | provider | request-response | none | no analog — standard Vite React entrypoint |
| `src/App.tsx` | component | request-response | none | no analog |
| `src/lib/supabase.ts` | service | request-response | none | no analog — pattern from RESEARCH.md Pattern 2 |
| `src/auth/AuthContext.tsx` | provider | event-driven | none | no analog — `onAuthStateChange` subscription pattern |
| `src/auth/SignIn.tsx` | component | request-response | none | no analog |
| `src/auth/SignUp.tsx` | component | request-response | none | no analog |
| `public/manifest icons (pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png)` | config (static asset) | — | none | no analog |
| `supabase/migrations/<timestamp>_create_profiles.sql` | migration | CRUD | none | no analog — pattern from RESEARCH.md Pattern 3 |
| `.github/workflows/keep-alive.yml` | config (CI) | event-driven | none | no analog — pattern from RESEARCH.md Code Examples |
| `.env` / `.env.example` (Supabase URL + anon key) | config | — | none | no analog |

**Data flow note:** No streaming, file-I/O, or pub-sub files exist in this phase — Phase 1 is entirely request-response (auth calls, RLS-scoped CRUD reads) and CRUD (schema/migration), plus one event-driven CI cron job and one event-driven auth-state subscription.

## Pattern Assignments

### `vite.config.ts` (config)

**Source of truth:** RESEARCH.md → Architecture Patterns → Pattern 1 (verbatim, official `vite-pwa-org.netlify.app` docs)

```typescript
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
      devOptions: { enabled: true }
    })
  ]
})
```

**Note:** `includeAssets` copies `apple-touch-icon.png` into the build, but the `<link rel="apple-touch-icon">` tag itself must be added by hand to `index.html` — iOS ignores the manifest `icons` array entirely (Pitfall 2).

---

### `src/lib/supabase.ts` (service, request-response)

**Source of truth:** RESEARCH.md → Architecture Patterns → Pattern 2 (verbatim, official `supabase.com/docs/reference/javascript/initializing`)

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
)
```

Single shared instance, imported everywhere else (`AuthContext.tsx`, `SignIn.tsx`, `SignUp.tsx`, and every future data-access file in later phases). Do not construct a second client instance anywhere in the app.

---

### `src/auth/AuthContext.tsx` (provider, event-driven)

**Source of truth:** RESEARCH.md Pattern 2 narrative + Standard Stack table. No `@supabase/auth-helpers-react` (deprecated per RESEARCH.md State of the Art) — use plain `supabase.auth.onAuthStateChange` inside a React context provider:

```typescript
// Derived from RESEARCH.md Pattern 2 (onAuthStateChange subscription) — no direct
// official code sample was provided verbatim for the React context wrapper itself;
// this is the standard shape implied by "Subscribe to supabase.auth.onAuthStateChange
// in an AuthContext to react to sign-in/sign-out/token-refresh events across the app
// without manual polling."
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

const AuthContext = createContext<{ session: Session | null }>({ session: null })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
```

**Never:** call `supabase.auth.signInAnonymously()` anywhere (SYNC-02 explicitly requires email/password, not anonymous auth) — this is a smoke-test assertion listed in RESEARCH.md's Validation Architecture table.

---

### `src/auth/SignIn.tsx`, `src/auth/SignUp.tsx` (component, request-response)

No analog exists. Both call `supabase.auth.signInWithPassword({ email, password })` / `supabase.auth.signUp({ email, password })` directly from `src/lib/supabase.ts`'s shared client. Wrap the call in try/catch and surface `error.message` from the returned `{ data, error }` shape (supabase-js v2 convention — never throws, always returns an error object to check).

---

### `supabase/migrations/<timestamp>_create_profiles.sql` (migration, CRUD)

**Source of truth:** RESEARCH.md → Architecture Patterns → Pattern 3 (verbatim, official Supabase RLS docs) — **non-negotiable, same-file table + RLS + all 4 policies**:

```sql
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

**This is the template every later phase's migration (Phase 2 `logs`/`log_items`/`foods`, Phase 4 `goals`/`weight`) must follow: same-migration `CREATE TABLE` + `ENABLE ROW LEVEL SECURITY` + all applicable `CREATE POLICY` statements, `to authenticated`, `(select auth.uid())` wrapping.** Never split table creation and RLS enablement across separate migrations (Anti-Pattern, RESEARCH.md).

---

### `.github/workflows/keep-alive.yml` (config/CI, event-driven)

**Source of truth:** RESEARCH.md → Code Examples → GitHub Actions keep-alive workflow (verbatim, cross-verified community pattern):

```yaml
name: Supabase Keep-Alive

on:
  schedule:
    - cron: '0 12 * * *'
  workflow_dispatch: {}

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

`SUPABASE_URL` / `SUPABASE_ANON_KEY` must be GitHub repository secrets, never hardcoded. `curl -sf` ensures a broken ping fails the workflow visibly (Pitfall 4).

---

### `index.html` (config)

No analog. Must include, in addition to whatever `vite-plugin-pwa` auto-injects:

```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

This tag is not optional and is not generated by the plugin automatically for the iOS home-screen icon (Pitfall 2) — plan a task specifically to add it.

---

### Install-eligibility / iOS fallback detection (likely `src/App.tsx` or a dedicated `src/InstallPrompt.tsx`)

**Source of truth:** RESEARCH.md → Code Examples → "Detecting install eligibility + iOS fallback UI" (verbatim):

```typescript
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

Branch: real `beforeinstallprompt`-driven UI on Chromium/Android; static instructional banner on iOS/Safari (Pitfall 1 — no `beforeinstallprompt` on iOS, ever).

## Shared Patterns

### Supabase client singleton
**Source:** `src/lib/supabase.ts` (to be created)
**Apply to:** Every file that touches auth or data (`AuthContext.tsx`, `SignIn.tsx`, `SignUp.tsx`, and all later-phase data-access code) — one `createClient` call in the entire app, imported everywhere else.

### RLS same-migration pattern
**Source:** `supabase/migrations/<timestamp>_create_profiles.sql` (to be created)
**Apply to:** Every future migration in every later phase — `CREATE TABLE` + `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` (all CRUD verbs needed) must land in the same file, never split.

### `(select auth.uid())` scoping idiom
**Source:** RESEARCH.md Pattern 3
**Apply to:** Every RLS policy written in this phase and beyond — wrapping `auth.uid()` in a subselect is the documented Postgres performance optimization and the project's standard idiom.

### Env var access via `import.meta.env.VITE_*`
**Source:** RESEARCH.md Pattern 2
**Apply to:** Any client-side code needing `SUPABASE_URL`/`SUPABASE_ANON_KEY` — Vite convention, must be prefixed `VITE_` to be exposed to client bundle. Never put `service_role` key in any client-side file.

### Error-shape handling for supabase-js v2 calls
**Apply to:** `SignIn.tsx`, `SignUp.tsx`, `AuthContext.tsx`, and all future Supabase calls — check the returned `{ data, error }` object rather than relying on thrown exceptions.

## No Analog Found

All 13 files/file-groups above have no in-repo analog — this is a confirmed greenfield repository (verified via directory listing: only `.git`, `.planning`, `CLAUDE.md` exist). RESEARCH.md's `## Architecture Patterns` and `## Code Examples` sections (reproduced above with concrete file targets) serve as the substitute source of truth for the planner; all of these are HIGH-confidence, official-docs-sourced patterns per RESEARCH.md's Metadata section, except the iOS-install-detection and GitHub Actions keep-alive patterns, which are MEDIUM-confidence (community-sourced but cross-verified across 2+ independent sources).

## Metadata

**Analog search scope:** Entire repository root (`find . -maxdepth 3`, excluding `.git`), confirmed empty of application code.
**Files scanned:** 3 (`.git`, `.planning/`, `CLAUDE.md`) — no source files exist to scan.
**Convention derivation:** Skipped — `gsd-tools.cjs verify conventions --derive` module not found in this environment (`CLAUDE_PLUGIN_ROOT` unset, no cached plugin install located), and repo has zero source files to derive conventions from regardless (would return `{ skipped: true }` for lack of files). No `.claude/skills/` or `.agents/skills/` directories exist either.
**Pattern extraction date:** 2026-09-23
