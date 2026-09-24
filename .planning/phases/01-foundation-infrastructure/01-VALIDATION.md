---
phase: 01
slug: foundation-infrastructure
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-23
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Vitest** (introduced plan 01-01 Task 3) for JS/TS unit + source-assertion tests; **pgTAP** via `supabase test db` (introduced plan 01-02) for the RLS cross-account isolation check. |
| **Config file** | `vite.config.ts` (`test:` block) for Vitest; `supabase/config.toml` + `supabase/tests/profiles_rls.test.sql` for pgTAP |
| **Quick run command** | `npm test` (Vitest, `vitest run` — no watch flag) |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run build && supabase test db`, then `npx lighthouse http://localhost:4173 --only-categories=pwa`, then the 3 checkpoint verifications |
| **Estimated runtime** | ~10-20s (Vitest + typecheck), ~30-60s (build + Lighthouse), pgTAP ~10s / checkpoint steps untimed |

---

## Sampling Rate

- **After every task commit:** Run the task's `Automated Command` from the Per-Task Verification Map below. 12 of 15 tasks have a real automated gate; the 3 checkpoint tasks are device- or time-bound and are verified by the human steps in their plan.
- **After every plan wave:** Full manual pass through all 5 success criteria in ROADMAP.md §Phase 1
- **Before `/bm:verify-work`:** All 5 success criteria manually confirmed true; Lighthouse PWA audit green; RLS cross-account check passes
- **Max feedback latency:** < 60s for every automated gate. No run of 3 consecutive tasks lacks an automated verify (the checkpoints at 01-03-T3, 01-04-T3, 01-05-T3 are each preceded by 2 automated-gate tasks in the same plan).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01-01 | 1 | SETUP-01 | T-01-04, T-01-SC | Scaffold builds; `.env` gitignored; only audited packages installed | build/smoke | `npm run build && npx tsc --noEmit` | ✅ created by 01-01 T1 | ⬜ pending |
| 01-01-T2 | 01-01 | 1 | SETUP-01 | T-01-01, T-01-02 | Single Supabase client; no `service_role` in client code; session persistence on | typecheck/source | `npx tsc --noEmit` | ✅ created by 01-01 T2 | ⬜ pending |
| 01-01-T3 | 01-01 | 1 | SYNC-02 | T-01-03 | Automated guard: no `signInAnonymously`, one `createClient`, no service-role key | unit (source assertion) | `npm test` | ✅ `src/lib/__tests__/supabase-client.test.ts` (closes Wave 0 test-runner gap) | ⬜ pending |
| 01-02-T1 | 01-02 | 1 | SETUP-02 | T-01-07 | Real credentials in gitignored `.env`; no token/DB password written to disk | manual/CLI | `curl -sf -o /dev/null -w '%{http_code}' "$VITE_SUPABASE_URL/auth/v1/health" -H "apikey: $VITE_SUPABASE_ANON_KEY"` → 200 | ✅ `.env` | ⬜ pending |
| 01-02-T2 | 01-02 | 1 | SETUP-02 | T-01-RLS, T-01-05, T-01-06 | Table + RLS enable + 4 `to authenticated` policies scoped `(select auth.uid())`, one migration file | source assertion | `grep -v '^--' supabase/migrations/*_create_profiles.sql \| grep -ci 'enable row level security'` | ✅ migration + `supabase/tests/profiles_rls.test.sql` (closes Wave 0 pgTAP gap) | ⬜ pending |
| 01-02-T3 | 01-02 | 1 | SETUP-02 | T-01-RLS, T-01-08 | **[BLOCKING]** schema pushed to remote; cross-account read/update/delete denied | integration (pgTAP + live PostgREST) | `supabase db push && supabase test db` | ✅ `supabase/tests/profiles_rls.test.sql` | ⬜ pending |
| 01-03-T1 | 01-03 | 2 | SYNC-01, SYNC-02 | T-01-10, T-01-11 | Error copy never leaks raw Supabase/HTTP text or account existence; profile access is RLS-scoped, not app-scoped | unit | `npm test` | ✅ `src/auth/__tests__/authErrors.test.ts`, `src/profile/__tests__/profileApi.test.ts` | ⬜ pending |
| 01-03-T2 | 01-03 | 2 | SYNC-01, SYNC-02 | T-01-09, T-01-13, T-01-14 | Email/password only; session derived from `onAuthStateChange` with unsubscribe; sign-out clears UI | build + source assertion | `npm run build && npm test && npx tsc --noEmit` | ✅ | ⬜ pending |
| 01-03-T3 | 01-03 | 2 | SYNC-01, SYNC-02 | T-01-12 | Session survives reload/restart; write on session A visible in session B | manual/e2e (checkpoint) | none — two live browser sessions required (see Manual-Only Verifications) | ✅ | ⬜ pending |
| 01-04-T1 | 01-04 | 2 | SETUP-03 | T-01-15, T-01-16, T-01-17, T-01-19 | Daily PostgREST select; explicit HTTP 200 gate; secrets never hardcoded or echoed | config validation | `python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/keep-alive.yml'));t=d.get(True) or d.get('on');assert 'schedule' in t and 'workflow_dispatch' in t"` | ✅ `.github/workflows/keep-alive.yml` | ⬜ pending |
| 01-04-T2 | 01-04 | 2 | SETUP-03 | T-01-18 | 60-day Actions auto-disable risk documented, not assumed away | doc assertion | `test -s docs/keep-alive.md && grep -qi '60 days' docs/keep-alive.md` | ✅ `docs/keep-alive.md` | ⬜ pending |
| 01-04-T3 | 01-04 | 2 | SETUP-03 | T-01-17 | Real dispatch run returns 200 with masked secrets; 8-10 day pause observation scheduled | operational (checkpoint) | none — GitHub Actions run history + Supabase dashboard over 8+ days | ✅ | ⬜ pending |
| 01-05-T1 | 01-05 | 3 | SETUP-01 | T-01-20, T-01-21, T-01-22, T-01-SC | Manifest + SW generated; no `runtimeCaching` of API/auth responses; 180×180 opaque apple-touch-icon linked | build assertion | `npm run build && test -f dist/manifest.webmanifest && test -f dist/sw.js && test -f dist/apple-touch-icon.png` | ✅ | ⬜ pending |
| 01-05-T2 | 01-05 | 3 | SETUP-01 | T-01-24 | iOS gets an instructional banner (never an inert Install button); installed state hides both affordances | unit | `npm test` | ✅ `src/lib/__tests__/installDetect.test.ts` | ⬜ pending |
| 01-05-T3 | 01-05 | 3 | SETUP-01 | T-01-23 | Lighthouse PWA clean; offline shell renders; real iPhone Add-to-Home-Screen icon correct; standalone launch | manual/smoke (checkpoint) | `npx lighthouse http://localhost:4173 --only-categories=pwa --quiet --chrome-flags="--headless"` + real-device pass | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders — the planner fills in real Plan/Wave/Task IDs when PLAN.md files are created.*

---

## Wave 0 Requirements

- [x] Test framework: **Vitest**, introduced in plan 01-01 Task 3 (`npm test` → `vitest run`, no watch flag). Config lives in the `test:` block of `vite.config.ts`.
- [x] `supabase/tests/profiles_rls.test.sql` (pgTAP) — created in plan 01-02 Task 2, executed in 01-02 Task 3 via `supabase test db`; covers SETUP-02 cross-account isolation.
- [x] Source-assertion guard suite (`src/lib/__tests__/supabase-client.test.ts`) converts three previously manual code-review checks (no `signInAnonymously`, single `createClient`, no `service_role` in `src/`) into automated tests.
- [x] Remaining genuinely-manual items are the three checkpoint tasks (01-03-T3 cross-device, 01-04-T3 operational pause observation, 01-05-T3 real-device install) — all device- or time-bound, none automatable in-process.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| PWA install prompt / iOS Add-to-Home-Screen | SETUP-01 | No native `beforeinstallprompt` event on iOS Safari; requires real-device visual confirmation | Open app URL on iPhone Safari, confirm Share → Add to Home Screen produces a standalone app icon with no browser chrome on launch. On Chrome/Android, confirm native install prompt appears. |
| Keep-alive prevents auto-pause | SETUP-03 | Supabase's exact "activity" qualification for resetting the pause timer is undocumented; only provable by observing real project status over time | After the GitHub Actions cron has run daily for 8+ days, check the Supabase dashboard confirms the project is still active (not paused). |
| Cross-device data sync | SYNC-01 | Requires two live authenticated sessions to observe real-time visibility of writes | Sign in as the same user in two separate browser sessions/devices, write a row in one, reload the other, confirm the row appears. |
| Email/password auth only | SYNC-02 | Confirming absence of anonymous auth is a code-review + live-flow check, not a unit test | Manually complete sign-up and sign-in with email/password; grep codebase for `signInAnonymously` and confirm no matches. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit checkpoint tasks with human verification steps
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Vitest in 01-01 T3, pgTAP in 01-02 T2)
- [x] No watch-mode flags (`npm test` is `vitest run`)
- [x] Feedback latency < 60s for all automated gates
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-filled 2026-09-23; awaiting execution results
