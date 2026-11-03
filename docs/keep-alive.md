# Supabase Keep-Alive

## What it does

`.github/workflows/keep-alive.yml` runs a scheduled GitHub Actions job daily at
12:00 UTC (and on-demand via `workflow_dispatch`). The job issues a real
PostgREST select against `/rest/v1/profiles?select=id&limit=1` using the anon
key, so Supabase sees genuine database API activity every day.

It requires two GitHub repository secrets, by exact name:

- `SUPABASE_URL` — the project's Project URL
- `SUPABASE_ANON_KEY` — the project's anon public key

Both are read only through the `secrets` context in the workflow file; they
are never hardcoded and never echoed. The job prints only the numeric HTTP
status code it received, which GitHub will mask if it ever happens to match a
registered secret value.

## Why PostgREST, not `/auth/v1/health`

A health-check endpoint is not confirmed to count as "activity" for Supabase's
pause timer, and a request against a route that doesn't exist (a typo'd path,
wrong project URL) would still return a response — just not necessarily a
200. The failure mode this guards against: a workflow that runs green every
day while actually hitting a 404 or the wrong endpoint, silently failing to
reset the pause clock while looking like a success (Pitfall 4 in
`01-RESEARCH.md`). Issuing a real `select` against a real table, with the
response code asserted to be exactly `200`, is the safer interpretation used
by the community solutions this pattern is based on.

**Open question, stated honestly:** Supabase has not published a precise,
official definition of what counts as qualifying activity for the 7-day pause
window. This job's daily PostgREST select is the best-available mitigation,
not a documented guarantee. The only real proof that it works is observing
the project's status over a full pause-window-plus-margin period with no
manual interaction — not a single green dispatch run.

## Known risk: the 60-day GitHub Actions auto-disable

GitHub automatically disables scheduled workflows on repositories that have
had no activity (commits, PRs, etc.) for 60 days. If that happens, this job
stops running with no error on the Supabase side — the workflow simply never
fires again. There is no way to solve this purely within GitHub Actions for a
single-user repository with naturally low commit cadence.

This is an accepted, monitored risk, not a solved problem. Any commit to the
repository resets the 60-day clock. If the Supabase project ever shows as
paused unexpectedly, the first thing to check is whether the scheduled
workflow was disabled (Actions tab → "Supabase Keep-Alive" → look for a
GitHub banner saying the scheduled workflow was disabled due to inactivity).

## How to confirm it is actually working

- The Actions tab shows a green "Supabase Keep-Alive" run once per day.
- The Supabase dashboard shows the project as **Active**, not **Paused**,
  after a stretch of 8+ days with zero manual dashboard interaction.
- If the project ever does show as paused, check the Actions history first:
  was there a daily green run every day in that window, or did the schedule
  stop firing (the 60-day auto-disable)?

## Assumptions log

The "7 days of inactivity triggers a pause" window, and the exact definition
of qualifying "activity," are community-sourced findings rather than a single
authoritative Supabase statement found during this project's research pass
(see `01-RESEARCH.md`, Assumptions Log A3). Treat the schedule and endpoint
choice here as the best-available mitigation under that uncertainty, not as a
contractually guaranteed fix.
