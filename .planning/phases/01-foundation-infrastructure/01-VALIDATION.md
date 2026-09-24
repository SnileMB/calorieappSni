---
phase: 01
slug: foundation-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-23
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — greenfield repo, no test runner configured yet. `supabase test db` (pgTAP) recommended for the one automatable check (RLS cross-account isolation). |
| **Config file** | none — Wave 0 introduces `supabase/tests/` if pgTAP is adopted |
| **Quick run command** | `npx lighthouse <url> --only-categories=pwa` (PWA installability smoke check) |
| **Full suite command** | `supabase test db` (if pgTAP RLS tests added) + manual pass through all 5 success criteria |
| **Estimated runtime** | ~30-60s (Lighthouse) / manual steps untimed |

---

## Sampling Rate

- **After every task commit:** Manual verification per the Per-Task Verification Map below — no automated unit-test framework exists yet for this phase's largely infrastructure/operational scope
- **After every plan wave:** Full manual pass through all 5 success criteria in ROADMAP.md §Phase 1
- **Before `/bm:verify-work`:** All 5 success criteria manually confirmed true; Lighthouse PWA audit green; RLS cross-account check passes
- **Max feedback latency:** N/A — this phase has no automated red/green test loop; feedback is manual per task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-XX-XX | TBD | TBD | SETUP-01 | — | App installable (manifest valid, SW registers, iOS Add-to-Home-Screen instructional fallback shown) | manual/smoke | `npx lighthouse <url> --only-categories=pwa` + manual iPhone Safari test | ❌ W0 | ⬜ pending |
| 01-XX-XX | TBD | TBD | SETUP-02 | T-01-RLS | Every Supabase table has RLS enabled in the same migration that creates it; signed-in user cannot read another user's rows | integration | `supabase test db` (pgTAP) or manual two-account script | ❌ W0 | ⬜ pending |
| 01-XX-XX | TBD | TBD | SETUP-03 | — | Keep-alive GitHub Actions workflow independently pings Supabase on schedule | operational check | GitHub Actions run history + Supabase dashboard "last active" observed after ~8+ days | ❌ W0 (inherently manual/operational — no automated test) | ⬜ pending |
| 01-XX-XX | TBD | TBD | SYNC-01 | — | Data written by one signed-in device/session is immediately visible on a second device/session | manual/e2e | Manual: sign in on two browser sessions, write on one, reload on the other | ❌ W0 | ⬜ pending |
| 01-XX-XX | TBD | TBD | SYNC-02 | — | Auth is email/password, not anonymous | manual/smoke | Manual sign-up/sign-in flow test; assert no `signInAnonymously` call exists in code | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders — the planner fills in real Plan/Wave/Task IDs when PLAN.md files are created.*

---

## Wave 0 Requirements

- [ ] Decide/introduce a test framework for any pure-function unit tests that emerge later (e.g. Vitest) — this phase itself is mostly infrastructure/manual-verification work, not unit-testable logic
- [ ] `supabase/tests/profiles_rls.sql` (pgTAP) — optional but recommended for an automatable RLS cross-account check, covers SETUP-02
- [ ] No app logic exists yet to unit test — this phase's verification is primarily manual/operational, which is appropriate given its infrastructure nature

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (manual-verification phase)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
