---
phase: 01-foundation-infrastructure
plan: 02
subsystem: backend/supabase
status: blocked
tags: [supabase, database, rls, auth, user-setup]
dependency-graph:
  requires: []
  provides: [profiles-table, rls-policies]
  affects: [01-03, 01-04]
tech-stack:
  added: [supabase-cli]
  patterns: [rls-same-migration, "(select auth.uid())-scoping"]
key-files:
  created:
    - supabase/config.toml
    - supabase/.gitignore
    - supabase/migrations/20260924174540_create_profiles.sql
    - supabase/tests/profiles_rls.test.sql
  modified: []
decisions:
  - "profiles table includes updated_at (per plan frontmatter interface contract) in addition to the PATTERNS.md example's minimal 3-column version"
metrics:
  duration: "~90 minutes (Tasks 1-2 complete, Task 3 partially complete)"
  completed: "2026-09-24"
---

# Phase 1 Plan 02: Supabase Backend (Profiles Table + RLS) Summary

**One-liner:** `profiles` table with RLS + 4 `auth.uid()`-scoped policies is live on the remote Supabase database and proven by a local pgTAP cross-account test (6/6 passing); the live two-account PostgREST black-box check is blocked because the project's "Confirm email" auth setting was never turned off, and toggling it programmatically was denied by the execution environment as a security-weakening action requiring an explicit human decision.

## Status: PARTIALLY COMPLETE — Tasks 1 and 2 done, Task 3 blocked on one remaining check

## Tasks Completed

### Task 1: Provision the Supabase project and supply credentials — DONE

Verified (without printing values) that `.env` at the repo root contains all four required variables, all non-empty:
- `VITE_SUPABASE_URL` (40 chars)
- `VITE_SUPABASE_ANON_KEY` (208 chars)
- `SUPABASE_DB_PASSWORD` (15 chars after trimming a stray trailing-space formatting artifact in the file — see Deviations)
- `SUPABASE_ACCESS_TOKEN` (44 chars)

`git check-ignore .env` exits 0 (ignored, not tracked). `grep -E 'service_role|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD' .env` returns no matches for those two forbidden-in-file names being anything other than the var name itself (they are present as the var's own name/value pair, which is expected — the acceptance criterion is about not leaking these into `src/` or other committed files, which was confirmed separately). `curl .../auth/v1/health` returned `200`.

No commit needed for this task — `.env` is gitignored and was not modified by the executor.

### Task 2: Write the profiles migration and pgTAP isolation test — DONE

- Ran `supabase init` (created `supabase/config.toml`, `supabase/.gitignore`).
- Ran `supabase link --project-ref <ref>` non-interactively using `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` from the shell.
- Ran `supabase migration new create_profiles`, then wrote `supabase/migrations/20260924174540_create_profiles.sql`: `profiles` table (`id`, `display_name`, `updated_at`, `created_at` — the plan frontmatter's interface contract, which includes `updated_at` in addition to PATTERNS.md's 3-column example) + `enable row level security` + all four `auth.uid()`-scoped policies, all `to authenticated`, all in one file. Header comment declares it the canonical template.
- Wrote `supabase/tests/profiles_rls.test.sql`: pgTAP test with 6 assertions — RLS enabled check, A sees exactly 1 row (their own), A cannot see B's row, A's update of B's row affects 0 rows, A's delete of B's row affects 0 rows, A's update of their own row affects 1 row. Uses `begin/rollback` so it leaves no residue.

Verification run:
```
test -f supabase/tests/profiles_rls.test.sql && grep -v '^--' supabase/migrations/*_create_profiles.sql | grep -ci 'enable row level security'
→ 1
```
All acceptance criteria confirmed: 1 migration file matches the glob; `create table` + `enable row level security` + 4× `create policy` present; 5× `(select auth.uid())`, 4× `to authenticated`; `grep -c 'create table' supabase/migrations/*.sql` totals 1; test file references `pg_tables`, `rowsecurity`, `request.jwt.claims`; `supabase/config.toml` exists; `git check-ignore supabase/.temp` exits 0.

Committed: `930b0b5` — `feat(01-02): add profiles table migration with RLS and pgTAP isolation test`

### Task 3: Push the schema and run the RLS isolation test — PARTIALLY DONE, one check blocked

Completed sub-steps:
1. **`supabase db push`** — exited 0, applied `20260924174540_create_profiles.sql` to the remote database.
2. **Schema landed verification** — ran `supabase db query --linked`:
   - `pg_tables`: `rowsecurity = true` for `public.profiles`. Confirmed.
   - `pg_policies`: exactly 4 rows for `public.profiles` (`Users can view their own profile` / SELECT, `Users can insert their own profile` / INSERT, `Users can update their own profile` / UPDATE, `Users can delete their own profile` / DELETE). Confirmed.
3. **pgTAP isolation test** — Docker was available, so used the preferred path: `supabase start` (pulled and started local Postgres + pg_prove image), `supabase db reset` (applied the migration locally), then `supabase test db`.
   - Result: **`All tests successful. Files=1, Tests=6, ... Result: PASS`** — all 6 pgTAP assertions passed, run against the local instance, not production data, per the plan's preferred path.
   - `supabase stop` afterward to tear down local containers.

Blocked sub-step:
4. **Live two-account PostgREST black-box check** — attempted to sign up two throwaway users via `/auth/v1/signup` to get real user JWTs for the black-box check. Signup calls returned `429 over_email_send_rate_limit`. Investigation via the Supabase Management API (`GET /v1/projects/{ref}/config/auth`) confirmed `mailer_autoconfirm: false` and `disable_signup: false` — i.e., the "Confirm email" toggle from Task 1's setup instructions (`how-to-verify` step 3: "Turn OFF 'Confirm email'") was never actually turned off in the dashboard, so `/auth/v1/signup` does not return an access token immediately; it instead queues a confirmation email, and the free-tier email-send rate limit was hit after a couple of attempts.

   Attempted to auto-fix by calling `PATCH /v1/projects/{ref}/config/auth` with `{"mailer_autoconfirm": true}` (mechanically completing the setup step already specified in the plan's Task 1 `dashboard_config`). This was **denied by the execution environment's auto-mode security classifier** ("Security Weaken" — disabling email confirmation is treated as a security-relevant auth setting change requiring an explicit human decision, not something to toggle automatically even though the plan had already specified it as a setup step). No workaround was attempted, per the classifier's guidance.

   No test data was left behind on the remote project — both signup attempts failed before any `auth.users` or `profiles` rows were created.

## What The User Needs To Do

To complete the remaining live PostgREST check (ROADMAP success criterion 3's black-box proof, in addition to the pgTAP proof already passing):

1. Go to Supabase Dashboard → Authentication → Providers → Email, and turn OFF "Confirm email" (this was step 3 of Task 1's original setup instructions and was missed).
2. Wait for the free-tier email rate limit to reset (roughly an hour from the last attempt), or simply proceeding once "Confirm email" is off avoids sending any email at all.
3. Re-run this plan (or just the live-check portion) to complete the two-account `/auth/v1/signup` → `/rest/v1/profiles` cross-account negative test.

Alternatively, if the user prefers to keep "Confirm email" on for the real app, explicitly grant permission for the executor to toggle `mailer_autoconfirm` via the Management API for the duration of this one verification, then revert it — or accept the local pgTAP result (which already proves the RLS policies are correct at the database layer) as sufficient evidence for this plan's RLS goal, and treat the live black-box check as a manual follow-up.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `.env` parsing script needed to handle a missing trailing newline and a stray leading space in `SUPABASE_DB_PASSWORD`**
- **Found during:** Task 1 verification / Task 3 (`supabase db push`)
- **Issue:** `.env` has no trailing newline after its last line, so a naive `while IFS='=' read` loop silently dropped `SUPABASE_ACCESS_TOKEN` (the last line). Separately, `SUPABASE_DB_PASSWORD`'s value had a leading space (`SUPABASE_DB_PASSWORD= <password>`), which `supabase db push` took literally and failed SASL auth against the pooler.
- **Fix:** Read `.env` with `while IFS='=' read -r key val || [ -n "$key" ]` (processes the final line even without a trailing newline) and trimmed leading/trailing whitespace from each value before exporting. Did not modify `.env` itself.
- **Files modified:** None (shell-only, not committed).
- **Commit:** N/A (no file change).

### Blocked Issues (not auto-fixed — routed to human decision)

**1. [Rule 4 - Security-relevant setting] "Confirm email" auth toggle**
- **Found during:** Task 3, live PostgREST check
- **Issue:** Task 1's setup instructions asked the user to disable "Confirm email" in the Supabase dashboard; this was not done, so `/auth/v1/signup` never returns an immediate session and the live two-account check cannot run without either the user completing that dashboard step or issuing explicit permission for the executor to toggle it via the Management API.
- **Why not auto-fixed:** The execution environment's auto-mode classifier explicitly denied a `PATCH .../config/auth` call to set `mailer_autoconfirm: true`, flagging it as a security-weakening action. This is treated as a genuine human decision, not a mechanical blocking-issue fix, despite the setting already being specified in the plan's own Task 1 instructions.
- **Resolution path:** See "What The User Needs To Do" above.

## Self-Check

- `supabase/config.toml` — FOUND
- `supabase/.gitignore` — FOUND
- `supabase/migrations/20260924174540_create_profiles.sql` — FOUND (committed `930b0b5`)
- `supabase/tests/profiles_rls.test.sql` — FOUND (committed `930b0b5`)
- Commit `930b0b5` — FOUND in `git log`
- Remote `public.profiles` table: `rowsecurity = true` — CONFIRMED via `supabase db query --linked`
- Remote `pg_policies` for `public.profiles`: 4 rows — CONFIRMED via `supabase db query --linked`
- `supabase test db`: 6/6 pgTAP assertions passed (local instance) — CONFIRMED, observed real command output
- Live two-account PostgREST check — NOT RUN (blocked, see above). Not claimed as verified.
