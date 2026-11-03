---
phase: 01-foundation-infrastructure
plan: 04
subsystem: ci-ops
tags: [github-actions, supabase, keep-alive, cron]
dependency_graph:
  requires: ["01-02"]
  provides: ["daily Supabase keep-alive cron (SETUP-03)"]
  affects: ["ROADMAP Phase 1 success criterion 4 (project stays active with no manual interaction)"]
tech_stack:
  added: ["GitHub Actions scheduled workflow (no third-party marketplace actions, inline curl only)"]
  patterns: ["PostgREST status-code gate pattern from 01-PATTERNS.md / 01-RESEARCH.md Pitfall 4"]
key_files:
  created:
    - .github/workflows/keep-alive.yml
    - docs/keep-alive.md
  modified: []
decisions:
  - "Targeted /rest/v1/profiles directly (not a dedicated Edge Function or /auth/v1/health) per CONTEXT.md D-05 discretion note — fewer moving parts, trivially verifiable in the Actions log, and matches the community-verified pattern in 01-RESEARCH.md Pitfall 4"
  - "Used explicit %{http_code} capture + exit 1 on non-200 instead of relying on curl -f alone, so a 404/401 is auditable in the SUMMARY and not just a bare non-zero exit"
metrics:
  duration: "~15 minutes (Tasks 1-2); Task 3 checkpoint resolved same day after a GitHub-side indexing issue was diagnosed and fixed"
  completed: "2026-11-03 (all 3 tasks)"
status: complete
---

# Phase 1 Plan 4: GitHub Actions Supabase Keep-Alive Summary

Daily GitHub Actions cron that issues a genuine PostgREST `select` against `/rest/v1/profiles` with an explicit HTTP-200 gate, plus an operational note covering the 60-day Actions auto-disable risk. All three tasks complete: a live `workflow_dispatch` run returned HTTP 200 with secrets correctly masked in the log.

## What Was Done

### Task 1: Daily keep-alive workflow (committed)

Created `.github/workflows/keep-alive.yml`:
- Triggers: `schedule` (`0 12 * * *`, daily 12:00 UTC) and `workflow_dispatch` for on-demand verification.
- Single `ping` job on `ubuntu-latest`, no third-party marketplace actions — inline `curl` only.
- Issues `GET ${{ secrets.SUPABASE_URL }}/rest/v1/profiles?select=id&limit=1` with `apikey` and `Authorization: Bearer` headers sourced only from `secrets.SUPABASE_URL` / `secrets.SUPABASE_ANON_KEY`.
- Captures the response code via `curl -sS --max-time 30 -o /dev/null -w '%{http_code}'`, explicitly compares it to `200`, and `exit 1`s with the actual code on mismatch (closes Pitfall 4 — a 404/401 turns the run red, not a silent green).
- No `continue-on-error`; no hardcoded URL or key; top-of-file comment records purpose, the 60-day Actions risk, and a pointer to `docs/keep-alive.md`.

Verified directly (ran each check, observed actual output, not inferred):
- YAML parses; `schedule` and `workflow_dispatch` both present — `ok`
- `cron` count = 1
- `/rest/v1/profiles` present — pass
- `auth/v1/health` absent — not found (good)
- `%{http_code}` present — pass
- `continue-on-error` absent — not found (good)
- No hardcoded `https://*.supabase.co` URL outside comments — not found (good)
- No inlined JWT-shaped string outside comments — not found (good)
- Both `secrets.SUPABASE_URL` and `secrets.SUPABASE_ANON_KEY` referenced — pass

Commit: `e4d3533` — `feat(01-04): add daily Supabase keep-alive GitHub Actions workflow`

### Task 2: Operational documentation (committed)

Created `docs/keep-alive.md` covering: what the job does and its schedule, the two required secret names, why PostgREST is targeted instead of `/auth/v1/health` (citing RESEARCH.md Pitfall 4 and honestly recording Open Question 1 — Supabase has not published a precise "what counts as activity" definition), the 60-day GitHub Actions auto-disable risk in plain terms (accepted, monitored, not solved), a "how to confirm it is actually working" checklist, and the Assumptions Log A3 caveat that the 7-day window is community-sourced.

Verified directly:
- File non-empty — pass
- Contains `60 days` — pass
- Contains `SUPABASE_ANON_KEY` and `SUPABASE_URL` — pass
- Contains `Paused`/`auto-pause` language — pass
- Explains the `/auth/v1/health` vs PostgREST choice — pass (string present)
- No JWT-shaped string in the file — not found (good)

Commit: `7370f6d` — `docs(01-04): document keep-alive operational contract and failure modes`

## Task 3: Repository secrets added and live run verified (complete)

The user added both repository secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) via Settings → Secrets and variables → Actions, matching the values from plan 01-02's `.env`.

**Root cause found and fixed — GitHub workflow indexing bug on first-ever push:** This repository had never been pushed to GitHub before this plan (origin had zero branches). The first push landed on a `dev` branch, which GitHub auto-promoted to `default_branch` (confirmed via API). However, GitHub's Actions indexer did not register the workflow file despite it being present, valid, and on the reported default branch — `GET /actions/workflows` returned `{"total_count":0}` and a direct `workflow_dispatch` API call 404'd, even after a fresh empty-commit push and after re-authenticating `gh` as the correct account (`SnileMB`) to rule out a permissions issue. Explicitly pushing a branch named `main` and `PATCH`-ing `default_branch` to `"main"` via the GitHub API immediately fixed it — the workflow registered within seconds. Branch *name* vs. the explicit API `PATCH` call cannot be fully disambiguated from this one data point, but the practical fix is recorded here: **a brand-new, previously-empty GitHub repo should have its first push go to a branch explicitly set as `default_branch` via the API/UI, not just left to auto-promotion, especially if that branch isn't named `main`.**

**Live verification result:**
- Dispatched via `workflow_dispatch` against `main` → run `41701083479`
- Run log: `Response status: 200` / `Keep-alive ping succeeded.` — run concluded `success`
- Secret values correctly masked (`***`) in the log for both the URL and the apikey/Authorization headers — no leakage
- All of plan 01-02's and 01-04's work is now on `main`, which is also GitHub's registered default branch

**Follow-up observation date:** check back **2026-11-11 to 2026-11-13** (8-10 days out), with no manual Supabase dashboard interaction in between, that the Supabase project still shows Active (not Paused) and the Actions history shows a green run each day. That observation — not this single dispatch — is the real proof of ROADMAP Phase 1 success criterion 4.

## Deviations from Plan

None - Tasks 1 and 2 executed exactly as written; all grep/acceptance gates passed on first attempt, no auto-fixes needed.

## Self-Check

- `FOUND: .github/workflows/keep-alive.yml`
- `FOUND: docs/keep-alive.md`
- `FOUND: e4d3533` (git log)
- `FOUND: 7370f6d` (git log)

## Self-Check: PASSED
