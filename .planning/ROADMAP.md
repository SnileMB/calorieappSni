# Roadmap: BOBLUR

**Core Value:** A fast, accurate-enough food logger that treats AI output as an editable draft, not an authority.
**Granularity:** coarse (5 phases; hybrid structure explicitly requested — one horizontal foundation phase, four vertical-slice phases)
**Created:** 2026-09-23

## Phases

- [ ] **Phase 1: Foundation & Infrastructure** - PWA shell, Supabase schema/RLS/Auth, and keep-alive ping so every later feature has a backend and installable app to build on
- [ ] **Phase 2: Core Logging — Photo/Text Capture, Review & Diary** - Users log meals via photo or text, correct the AI's draft, and see accurate daily totals
- [ ] **Phase 3: Barcode & Label/Menu OCR Logging** - Users log packaged foods via barcode and turn nutrition labels/menus into personal custom foods
- [ ] **Phase 4: Goals & TDEE Autopilot** - Users get a starting calorie/macro goal that adapts automatically once enough real data exists
- [ ] **Phase 5: Saved Foods, Data Portability & Sync Polish** - Users re-log fast from history and their data is fully exportable/importable and durable across devices

## Phase Details

### Phase 1: Foundation & Infrastructure

**Goal**: The PWA shell, Supabase backend, and authenticated cross-device storage exist so every later feature has something to build on
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SYNC-01, SYNC-02
**Success Criteria** (what must be TRUE):

  1. User can open the app URL on their iPhone (or any browser), see an install prompt, and add it to the Home Screen as a standalone app with no browser chrome
  2. User can sign up and log in with email/password, and their session persists across app restarts and across devices
  3. Every Supabase table has RLS enabled with an `auth.uid()`-scoped policy created in the same migration as the table, verified by confirming a signed-in user cannot read another user's rows
  4. The Supabase project stays active (does not auto-pause) after 7+ days of no manual interaction, confirmed by an independently-running scheduled keep-alive job
  5. Data written to any table by the signed-in user is immediately visible when the user loads the app from a second browser/device

**Plans**: 5 plans in 3 waves
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Vite + React + TS scaffold, Supabase client singleton, Vitest guard tests (wave 1)
- [x] 01-02-PLAN.md — Supabase project, profiles migration with same-migration RLS, db push, cross-account isolation test (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — Email/password auth, AuthContext session provider, profile read/write cross-device sync proof (wave 2)
- [x] 01-04-PLAN.md — GitHub Actions daily keep-alive ping against PostgREST (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-05-PLAN.md — vite-plugin-pwa manifest/service worker, icon set, branching install UI, real-device install verification (wave 3)

**UI hint**: yes

### Phase 2: Core Logging — Photo/Text Capture, Review & Diary

**Goal**: Users can log meals in seconds via photo or text, correct the AI's draft before it's saved, and see accurate daily totals against their goal
**Depends on**: Phase 1
**Requirements**: CAP-01, CAP-02, CAP-03, REV-01, REV-02, DIA-01, DIA-02, DIA-03
**Success Criteria** (what must be TRUE):

  1. User can take or upload a meal photo and receive detected food items, portion estimates, calories, macros, and a confidence indicator
  2. User can type a natural-language meal description (e.g. "two eggs, toast with butter, coffee with milk") and get the same structured, editable breakdown
  3. User can add a typed note alongside a photo and see it visibly change/improve the AI's portion or ingredient guess
  4. No AI-derived entry is ever written to the diary without first passing through an editable review screen, where the user can add, remove, or edit individual items, servings, calories, and macros before confirming
  5. User can view a day's diary grouped by meal type, see daily totals for calories/macros and calories remaining against goal, and view a weekly/monthly chart of past intake

**Plans**: TBD
**UI hint**: yes

### Phase 3: Barcode & Label/Menu OCR Logging

**Goal**: Users can log packaged foods and turn nutrition labels or restaurant menus into personal custom foods without hand-typing nutrition data
**Depends on**: Phase 2
**Requirements**: CAP-04, CAP-05, CAP-06
**Success Criteria** (what must be TRUE):

  1. User can scan a barcode with the browser camera, or type the code manually, and get a pre-filled editable draft resolved first against Open Food Facts
  2. User can photograph a nutrition label and get a personal custom food created from the extracted calorie/macro values, editable before saving
  3. User can photograph a restaurant menu, select items from it, and convert them into personal custom foods

**Plans**: TBD
**UI hint**: yes

### Phase 4: Goals & TDEE Autopilot

**Goal**: Users get a personalized calorie/macro goal that starts from a formula and adapts automatically as real weight and intake data accumulates
**Depends on**: Phase 2 (requires the diary/intake logging and weight entry established there to accumulate the 14-day data window)
**Requirements**: GOAL-01, GOAL-02, GOAL-03
**Success Criteria** (what must be TRUE):

  1. User can enter profile inputs (sex, birth year, height, weight, target weight, activity level, goal type) and immediately see a derived starting BMR/TDEE estimate and macro targets
  2. Before 14 days of logged weight and intake data exist, the app clearly shows a "collecting data" state instead of a false autopilot result
  3. Once 14+ days of data exist, the app computes an adaptive TDEE estimate (EWMA weight-trend + energy-balance method), displays a visible confidence/stability level, proposes updated calorie/macro targets, and lets the user lock or manually override them

**Plans**: TBD
**UI hint**: yes

### Phase 5: Saved Foods, Data Portability & Sync Polish

**Goal**: Users can log faster from their own history, and their data is fully portable and durable across devices
**Depends on**: Phase 2 (saved/recent meals), Phase 3 (custom foods also eligible to save), Phase 1 (sync/storage foundation)
**Requirements**: SAVE-01, SAVE-02, DATA-01, DATA-02
**Success Criteria** (what must be TRUE):

  1. User can save any logged meal as a favorite and see it in a saved-foods list
  2. User can re-log a recent or saved meal in one action without re-running AI analysis
  3. User can export all their data (profile, goals, diary entries, saved meals) as JSON and/or CSV
  4. User can import a previously exported file and have it restore their data into the app

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 4/5 | In Progress|  |
| 2. Core Logging — Photo/Text Capture, Review & Diary | 0/TBD | Not started | - |
| 3. Barcode & Label/Menu OCR Logging | 0/TBD | Not started | - |
| 4. Goals & TDEE Autopilot | 0/TBD | Not started | - |
| 5. Saved Foods, Data Portability & Sync Polish | 0/TBD | Not started | - |

---
*Roadmap created: 2026-09-23*
*Last updated: 2026-09-23 after Phase 1 planning*
