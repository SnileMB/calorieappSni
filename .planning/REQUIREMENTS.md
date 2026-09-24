# Requirements: BOBLUR

**Defined:** 2026-09-23
**Core Value:** A fast, accurate-enough food logger that treats AI output as an editable draft, not an authority.

## v1 Requirements

Requirements for initial private release. Each maps to roadmap phases.

### Setup

- [ ] **SETUP-01**: App is an installable PWA (add-to-Home-Screen, manifest + service worker) accessible from any browser, including the user's iPhone — no code-signing, no app store, no reinstall cycle
- [ ] **SETUP-02**: Backend runs entirely on Supabase free tier (Auth, Postgres, Edge Functions, Storage) with RLS enabled on every table from creation
- [ ] **SETUP-03**: Supabase project stays awake via a scheduled keep-alive ping (avoids the 7-day free-tier auto-pause)

### Capture

- [ ] **CAP-01**: User can log a meal by taking (via browser camera) or uploading a photo; the app returns detected food items, portion estimates, calories, macros, and a confidence indicator
- [ ] **CAP-02**: User can log a meal via typed natural-language text (e.g. "two eggs, toast with butter, coffee with milk")
- [ ] **CAP-03**: User can add a typed note alongside a photo to improve portion/ingredient accuracy (browser dictation/OS keyboard mic can supply voice-to-text; no dedicated audio pipeline needed)
- [ ] **CAP-04**: User can log a packaged food by scanning its barcode via browser camera (web barcode-detection library) or manual code entry, resolved first against Open Food Facts
- [ ] **CAP-05**: User can photograph a nutrition label to create a personal custom food from the extracted values
- [ ] **CAP-06**: User can photograph a restaurant menu and convert selected items into personal custom foods

### Review & Correction

- [ ] **REV-01**: Every AI-derived or scanned entry (photo, label, menu) is shown on an editable review screen before being saved to the diary — never auto-saved
- [ ] **REV-02**: User can add, remove, or edit individual food items, servings, calories, and macros on the review screen before confirming

### Diary

- [ ] **DIA-01**: User can view a day view showing all logged meals, grouped by meal type
- [ ] **DIA-02**: User can see daily totals for calories and macros, plus calories remaining against their goal
- [ ] **DIA-03**: User can view progress over time (weekly/monthly charts of calories and macros)

### Goals

- [ ] **GOAL-01**: User can set/edit profile inputs (sex, birth year, height, weight, target weight, activity level, goal type) to derive a starting BMR/TDEE and macro targets
- [ ] **GOAL-02**: After 14+ days of logged weight and intake data, the app computes an adaptive TDEE estimate (EWMA weight-trend + energy-balance method) and proposes updated calorie/macro targets, with a visible confidence level and manual override/lock
- [ ] **GOAL-03**: Before the 14-day data threshold is met, the app clearly shows "collecting data" status instead of a false autopilot result

### Saved & Recent Foods

- [ ] **SAVE-01**: User can save a logged meal as a favorite for fast re-logging
- [ ] **SAVE-02**: User can quickly re-log a recent or saved meal without re-running AI analysis

### Data Portability

- [ ] **DATA-01**: User can export all their data (profile, goals, diary entries, saved meals) as JSON and/or CSV
- [ ] **DATA-02**: User can import previously exported data back into the app

### Sync

- [ ] **SYNC-01**: User's data (diary, goals, saved meals, profile) is stored in Supabase Postgres and accessible from any of the user's own signed-in devices
- [ ] **SYNC-02**: User authenticates via email/password (not anonymous auth) so data persists reliably across devices and reinstalls

## v2 Requirements

Deferred to a future milestone.

### Health & Coaching

- **HEALTH-01**: Apple Health sync for weight and active energy — deferred indefinitely; not accessible from a PWA without a native wrapper, which would reintroduce the native build/signing complexity this pivot avoided
- **COACH-01**: AI coach chatbot that reads diary history and answers questions

### Reliability

- **REL-01**: Automatic fallback to a secondary vision provider (Groq Llama 4 Scout) when the primary (Gemini) free-tier quota is exhausted

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Social/community features | Not needed for single-user private use |
| Ads / ad SDKs | Private app, no monetization |
| Subscriptions / paywall / RevenueCat | Private app, no monetization |
| Complex meal plans / recipe library | Not core to the tracking job |
| Android support | iOS only for now; Expo keeps this open later if ever needed |
| Fine-tuned/custom AI models | Use existing free/open hosted vision models as-is |
| App Store submission / public distribution | Private use only, sideload/TestFlight-free distribution |
| Reverse engineering, scraping, or private-API use against any competitor | Legal/ethical line from the research dossier, applies regardless of private-use framing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Pending |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SYNC-01 | Phase 1 | Pending |
| SYNC-02 | Phase 1 | Pending |
| CAP-01 | Phase 2 | Pending |
| CAP-02 | Phase 2 | Pending |
| CAP-03 | Phase 2 | Pending |
| REV-01 | Phase 2 | Pending |
| REV-02 | Phase 2 | Pending |
| DIA-01 | Phase 2 | Pending |
| DIA-02 | Phase 2 | Pending |
| DIA-03 | Phase 2 | Pending |
| CAP-04 | Phase 3 | Pending |
| CAP-05 | Phase 3 | Pending |
| CAP-06 | Phase 3 | Pending |
| GOAL-01 | Phase 4 | Pending |
| GOAL-02 | Phase 4 | Pending |
| GOAL-03 | Phase 4 | Pending |
| SAVE-01 | Phase 5 | Pending |
| SAVE-02 | Phase 5 | Pending |
| DATA-01 | Phase 5 | Pending |
| DATA-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23/23 ✓
- Unmapped: 0

---
*Requirements defined: 2026-09-23*
*Last updated: 2026-09-23 after roadmap creation*
