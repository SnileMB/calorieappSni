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
  duration: "~15 minutes (Tasks 1-2 only; Task 3 is a pending human checkpoint)"
  completed: "2026-11-03 (Tasks 1-2); Task 3 pending"
---

# Phase 1 Plan 4: GitHub Actions Supabase Keep-Alive Summary

Daily GitHub Actions cron that issues a genuine PostgREST `select` against `/rest/v1/profiles` with an explicit HTTP-200 gate, plus an operational note covering the 60-day Actions auto-disable risk — reaching but not yet resolving the human-only checkpoint that adds repository secrets and observes a live run.

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

## Pending: Task 3 (blocking human-verify checkpoint — NOT completed)

**This plan is not fully done.** Task 3 requires GitHub repository-owner access this executor does not have (the local `gh` CLI session is authenticated as a different account than the repo owner, and secrets/workflow_dispatch require write access to `SnileMB/calorieappSni`). No attempt was made to use `gh` to set secrets or trigger `workflow_dispatch` — per instructions, this was left entirely to the user.

**What the user needs to do** (verbatim from the plan's checkpoint, Task 3):

1. In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add two repository secrets:
   - `SUPABASE_URL` — the Project URL from plan 01-02
   - `SUPABASE_ANON_KEY` — the anon key from plan 01-02
2. Confirm **Settings → Actions → General** allows workflows to run.
3. Push this plan's commits (already made on this worktree branch) to the default branch if not already there — GitHub only schedules cron workflows that exist on the default branch.
4. In the **Actions** tab, select "Supabase Keep-Alive" and click **Run workflow** (`workflow_dispatch`).
5. Open the run log. Confirm the step prints status `200` and the run is green. Confirm the log shows `***` in place of any secret value, never the real URL or key.
6. If the status is 404, the table name or project URL is wrong; if 401, the anon key is wrong — either way the run must be RED, not green (that is the Pitfall 4 protection working).
7. **Follow-up observation date:** check back in 8-10 days — target window **2026-11-11 to 2026-11-13** — with no manual Supabase dashboard interaction in between, that the Supabase project still shows as Active (not Paused) and the Actions history shows a green run each day. That observation, not the single dispatch run, is the real proof of ROADMAP criterion 4.

**Resume signal for the checkpoint:** reply "approved" with the observed HTTP status, or describe the failure, so a follow-up executor can close out Task 3 and finalize this plan.

## Deviations from Plan

None - Tasks 1 and 2 executed exactly as written; all grep/acceptance gates passed on first attempt, no auto-fixes needed.

## Self-Check

- `FOUND: .github/workflows/keep-alive.yml`
- `FOUND: docs/keep-alive.md`
- `FOUND: e4d3533` (git log)
- `FOUND: 7370f6d` (git log)

## Self-Check: PASSED
