---
phase: 01-foundation-infrastructure
plan: 02
subsystem: backend/supabase
status: complete
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
  duration: "~2 hours across two sessions (paused once for a dashboard setting, resumed and completed)"
  completed: "2026-09-24"
---

# Phase 1 Plan 02: Supabase Backend (Profiles Table + RLS) Summary

**One-liner:** `profiles` table with RLS + 4 `auth.uid()`-scoped policies is live on the remote Supabase database, proven both by a local pgTAP cross-account test (6/6 passing) and a live two-account PostgREST black-box check against the real deployed API (user A sees exactly their own row, anon sees none, A's write to B's row affects zero rows).

## Status: COMPLETE — all three tasks done

## Tasks Completed

### Task 1: Provision the Supabase project and supply credentials — DONE

Verified (without printing values) that `.env` at the repo root contains all four required variables, all non-empty:
- `VITE_SUPABASE_URL` (40 chars)
- `VITE_SUPABASE_ANON_KEY` (208 chars)
- `SUPABASE_DB_PASSWORD` (15 chars after trimming a stray trailing-space formatting artifact in the file — see Deviations)
- `SUPABASE_ACCESS_TOKEN` (44 chars)

`git check-ignore .env` exits 0 (ignored, not tracked). `curl .../auth/v1/health` returned `200`.

No commit needed for this task — `.env` is gitignored and was not modified by the executor.

### Task 2: Write the profiles migration and pgTAP isolation test — DONE

- Ran `supabase init` (created `supabase/config.toml`, `supabase/.gitignore`).
- Ran `supabase link --project-ref <ref>` non-interactively using `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` from the shell.
- Ran `supabase migration new create_profiles`, then wrote `supabase/migrations/20260924174540_create_profiles.sql`: `profiles` table (`id`, `display_name`, `updated_at`, `created_at` — the plan frontmatter's interface contract, which includes `updated_at` in addition to PATTERNS.md's 3-column example) + `enable row level security` + all four `auth.uid()`-scoped policies, all `to authenticated`, all in one file. Header comment declares it the canonical template.
- Wrote `supabase/tests/profiles_rls.test.sql`: pgTAP test with 6 assertions — RLS enabled check, A sees exactly 1 row (their own), A cannot see B's row, A's update of B's row affects 0 rows, A's delete of B's row affects 0 rows, A's update of their own row affects 1 row. Uses `begin/rollback` so it leaves no residue.

All acceptance criteria confirmed: 1 migration file matches the glob; `create table` + `enable row level security` + 4× `create policy` present; 5× `(select auth.uid())`, 4× `to authenticated`; `grep -c 'create table' supabase/migrations/*.sql` totals 1; test file references `pg_tables`, `rowsecurity`, `request.jwt.claims`; `supabase/config.toml` exists; `git check-ignore supabase/.temp` exits 0.

Committed: `930b0b5` — `feat(01-02): add profiles table migration with RLS and pgTAP isolation test`

### Task 3: Push the schema and run the RLS isolation test — DONE

1. **`supabase db push`** — exited 0, applied `20260924174540_create_profiles.sql` to the remote database.
2. **Schema landed verification** — ran `supabase db query --linked`:
   - `pg_tables`: `rowsecurity = true` for `public.profiles`. Confirmed.
   - `pg_policies`: exactly 4 rows for `public.profiles` (`Users can view their own profile` / SELECT, `Users can insert their own profile` / INSERT, `Users can update their own profile` / UPDATE, `Users can delete their own profile` / DELETE). Confirmed.
3. **pgTAP isolation test** — Docker was available, so used the preferred path: `supabase start` (pulled and started local Postgres + pg_prove image), `supabase db reset` (applied the migration locally), then `supabase test db`.
   - Result: **`All tests successful. Files=1, Tests=6, ... Result: PASS`** — all 6 pgTAP assertions passed, run against the local instance, not production data, per the plan's preferred path.
   - `supabase stop` afterward to tear down local containers.
4. **Live two-account PostgREST black-box check** — first attempt hit `429 over_email_send_rate_limit` because the Supabase project's "Confirm email" setting was still ON (`mailer_autoconfirm: false`), so `/auth/v1/signup` queued confirmation emails instead of returning an immediate session. This was flagged as a blocking human decision (see prior paused state) rather than auto-fixed, since toggling that setting programmatically was denied by the execution environment's security classifier.

   The user turned OFF "Confirm email" in the Supabase Dashboard (Authentication → Providers → Email). Re-verified via the Management API (`GET /v1/projects/{ref}/config/auth`): `mailer_autoconfirm: true`. Re-ran the live check:
   - Signed up two throwaway users via `/auth/v1/signup` — both returned an immediate session (access token), confirming autoconfirm now works.
   - Inserted a `profiles` row as each user via `/rest/v1/profiles` (both `201 Created`).
   - `GET /rest/v1/profiles?select=id` with user A's JWT returned exactly 1 row, containing only A's own id.
   - `GET /rest/v1/profiles?select=id` with the anon key as bearer (no user JWT) returned an empty array (0 rows).
   - `PATCH /rest/v1/profiles?id=eq.<B_id>` with user A's JWT returned 0 affected rows.
   - Cleaned up both throwaway profile rows (each user deleted their own row, both `204 No Content`) — no residue left on the remote project. The two throwaway `auth.users` records remain (Supabase Auth users cannot be deleted via anon-key REST calls; this is expected and harmless for a personal dev project — they can be removed later from the dashboard if desired).

All of Task 3's acceptance criteria are now confirmed by directly observed command output, not assumption.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `.env` parsing script needed to handle a missing trailing newline and a stray leading space in `SUPABASE_DB_PASSWORD`**
- **Found during:** Task 1 verification / Task 3 (`supabase db push`)
- **Issue:** `.env` has no trailing newline after its last line, so a naive `while IFS='=' read` loop silently dropped `SUPABASE_ACCESS_TOKEN` (the last line). Separately, `SUPABASE_DB_PASSWORD`'s value had a leading space (`SUPABASE_DB_PASSWORD= <password>`), which `supabase db push` took literally and failed SASL auth against the pooler.
- **Fix:** Read `.env` with `while IFS='=' read -r key val || [ -n "$key" ]` (processes the final line even without a trailing newline) and trimmed leading/trailing whitespace from each value before exporting. Did not modify `.env` itself.
- **Files modified:** None (shell-only, not committed).
- **Commit:** N/A (no file change).

### Routed to Human Decision (resolved)

**1. [Rule 4 - Security-relevant setting] "Confirm email" auth toggle**
- **Found during:** Task 3, live PostgREST check (first attempt)
- **Issue:** Task 1's setup instructions asked the user to disable "Confirm email" in the Supabase dashboard; this was not done initially, so `/auth/v1/signup` did not return an immediate session and the live two-account check could not run.
- **Why not auto-fixed:** The execution environment's auto-mode classifier denied a `PATCH .../config/auth` call to set `mailer_autoconfirm: true`, flagging it as a security-weakening action requiring an explicit human decision.
- **Resolution:** User manually disabled "Confirm email" in the Supabase Dashboard. Re-verified and re-ran the check successfully — see Task 3 above.

## Self-Check

- `supabase/config.toml` — FOUND
- `supabase/.gitignore` — FOUND
- `supabase/migrations/20260924174540_create_profiles.sql` — FOUND (committed `930b0b5`)
- `supabase/tests/profiles_rls.test.sql` — FOUND (committed `930b0b5`)
- Commit `930b0b5` — FOUND in `git log`
- Remote `public.profiles` table: `rowsecurity = true` — CONFIRMED via `supabase db query --linked`
- Remote `pg_policies` for `public.profiles`: 4 rows — CONFIRMED via `supabase db query --linked`
- `supabase test db`: 6/6 pgTAP assertions passed (local instance) — CONFIRMED, observed real command output
- Live two-account PostgREST check: A sees 1 row (own), anon sees 0, A's patch of B affects 0 rows — CONFIRMED, observed real command output; test rows cleaned up afterward
