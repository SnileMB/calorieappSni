# Project Research Summary

**Project:** BOBLUR
**Domain:** Solo-developer, single-user personal AI calorie/macro tracker (Expo/React Native iOS sideload + Supabase free-tier backend + free-tier vision LLM)
**Researched:** 2026-09-23
**Confidence:** MEDIUM-HIGH

## Executive Summary

BOBLUR is a personal, single-user "honest scanner" food logger — photo/voice/text/barcode logging with a mandatory editable-draft review step, a diary, goal tracking, and an adaptive TDEE autopilot. Experts building this class of app in 2026 do it with a hosted vision-capable LLM (not a classic OCR + parsing pipeline) for both meal-photo analysis and nutrition-label/menu extraction, a managed BaaS (Supabase: Auth + Postgres + Edge Functions + Storage, all free tier) instead of custom backend infrastructure, and a damped, recency-weighted energy-balance algorithm for adaptive TDEE rather than a static Mifflin-St Jeor formula. This is the standard, low-code path for a solo developer building for one user — every piece of it stays within generous free tiers if quotas and secrets are managed deliberately.

The recommended approach: use Gemini 3.1 Flash-Lite as the primary vision model (best benchmarked ingredient recognition among 10 models tested, free-tier friendly, native JSON-schema output) with Gemini 3.x Flash as an on-demand higher-accuracy fallback and Groq's Llama 4 Scout vision as an independent-quota emergency fallback. All AI/secret-bearing calls must be proxied through Supabase Edge Functions — never called directly from the client — and all user data must be protected by Row Level Security from the first migration, not added later. The nutrition-label/menu OCR feature reuses the same vision-LLM-with-JSON-schema pattern (and the same editable-draft review screen) rather than building a dedicated OCR+parsing subsystem, and the TDEE autopilot is built from openly published energy-balance concepts (EWMA-smoothed weight trend, damped weekly blend, 14-day minimum data gate) rather than reverse-engineering MacroFactor's proprietary internals.

The dominant risk profile for this project is not "hard engineering," it's **operational/infrastructure fragility specific to running everything on free tiers as a solo dev**: a free Apple signing certificate silently kills the app after 7 days, a Supabase project auto-pauses after 7 days of inactivity, free vision-model daily quotas are easy to exhaust with normal multi-meal daily use, and RLS is disabled by default on every new table (the single most common real-world Supabase data-exposure cause). None of these are exotic risks — they are well-documented, entirely preventable failure modes if addressed in the setup/infrastructure phase rather than discovered after the fact. The single biggest mitigation across all of them is: pay for the Apple Developer Program and use TestFlight from day one, set up a keep-alive ping for Supabase, treat RLS as part of "table done," and always keep a zero-AI-dependency manual-entry fallback so a quota outage never blocks core logging.

## Key Findings

### Recommended Stack

The stack centers on Google's Gemini API for vision analysis, called exclusively from Supabase Edge Functions, with Groq as an independent-quota fallback provider. Client-side, photos are downscaled/re-encoded via `expo-image-manipulator` before any network call — this single step prevents multiple downstream failure modes (oversized HEIC uploads, wasted token quota, slow cellular uploads). Zod validates all AI JSON responses before they're trusted, since even schema-constrained model output can be malformed.

**Core technologies:**
- Gemini 3.1 Flash-Lite (via `@google/genai`) — primary vision model; best benchmarked food-ingredient recognition among 10 models tested, most generous free-tier quota in the Gemini family, native JSON-schema structured output
- Gemini 3.x Flash — on-demand "higher accuracy" fallback for ambiguous plates, spent sparingly from a smaller separate quota
- Groq Llama 4 Scout (vision, Preview) via `groq-sdk` — independent-provider fallback when Gemini's daily quota (HTTP 429) is exhausted
- Supabase (Auth + Postgres + Edge Functions + Storage, free tier) — entire backend; Edge Functions hold all API secrets and proxy every call requiring a credential
- Expo React Native + `expo-dev-client` (custom dev build, not Expo Go) — required from day one because camera/barcode/health integrations need native config Expo Go doesn't support
- Zod — runtime validation of AI JSON responses before they're trusted or persisted

### Expected Features

Full feature bundle (photo/voice/barcode logging, diary, goals, saved meals) is already scoped in PROJECT.md; this research went deep on two specific v1 features.

**Must have (table stakes):**
- Nutrition-label/menu scan → editable custom food (vision-LLM JSON extraction, not classic OCR+parsing)
- TDEE autopilot after ~14 days of data, with a minimum-data gate and stability indicator — a static formula-only goal feels stale within days for this category

**Should have (competitive):**
- Restaurant menu OCR (same pipeline as label OCR, ship after label-scan accuracy is validated — menus are messier: multi-item tables, inconsistent formats)
- Confidence/stability badge on the TDEE estimate ("collecting data" vs "stable") — builds trust, matches the app's "editable draft, not authority" principle
- Manual TDEE lock/override toggle

**Defer (v2+):**
- On-device OCR fallback (Apple Vision) — only build if the free-tier vision-LLM path proves unreliable in real use
- Outlier weight-entry detection/exclusion — not essential for a single trusted user who can just delete a bad entry

### Architecture Approach

Expo client talks to a single Supabase project. Any call requiring a secret (vision API key, USDA FDC key) is always proxied through a Supabase Edge Function; any call touching only the user's own Postgres data goes directly client → Postgres, protected by RLS — this is the decisive, non-negotiable rule for the whole architecture. AI/OCR output is always returned to client state as an editable draft first; only an explicit user "confirm" action writes to Postgres. Offline resilience is handled with a minimal write-outbox (queued writes flushed on reconnect), explicitly not a full CRDT/offline-first sync framework, since that machinery solves multi-user conflict problems this single-user app doesn't have.

**Major components:**
1. Expo client (capture UI, editable-draft review screen, diary/goals UI, local outbox) — all user interaction and local optimistic state
2. Supabase Edge Functions (`analyze-photo`, `ocr-label`, `lookup-usda`, `lookup-barcode`) — sole holders of secret API keys, normalize external API responses into the app's schema
3. Supabase Postgres (RLS on every table) — system of record for logs, foods, goals, weight history, cached external lookups
4. Supabase Storage (private bucket, opt-in photo retention) — meal/label photos the user chooses to keep, signed URLs only

### Critical Pitfalls

1. **Free Apple Developer account's 7-day certificate expiry silently kills the app** — pay for the $99/yr Apple Developer Program and use TestFlight internal testing from the start; free ad-hoc signing is not viable for a daily-use app
2. **Supabase free-tier project auto-pauses after 7 days of inactivity** — set up a scheduled keep-alive ping (GitHub Actions or uptime monitor) hitting the project every 5-6 days, before the app is used interactively
3. **RLS disabled by default on new tables** — the single most common real-world Supabase data-exposure cause; enable RLS + write a scoped `auth.uid()` policy in the same migration that creates each table, never as a follow-up
4. **Free vision-model daily quotas are easy to exhaust with normal multi-meal use** — calculate worst-case daily call volume against real quota limits, always keep a zero-AI manual-entry fallback, and consider dual-provider failover (Gemini primary, Groq fallback)
5. **Free/open vision models don't reliably honor JSON-schema requests** — never trust raw model output as JSON; strip markdown fences, validate defensively with Zod, and surface parse failures as "enter manually" rather than crashing or silently dropping data

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Project & Infrastructure Setup
**Rationale:** Every pitfall research flag for distribution/backend/auth is cheapest to prevent before any feature code exists, and the architecture research confirms schema+auth must exist before any Edge Function or screen is built.
**Delivers:** Custom Expo dev client installed on-device via EAS; paid Apple Developer Program enrolled with TestFlight internal testing configured; Supabase project created with base schema (users-owned tables) and RLS enabled+policy-scoped on every table from the first migration; Supabase keep-alive ping scheduled.
**Addresses:** No user-facing feature yet — pure infrastructure foundation.
**Avoids:** Pitfall 1 (7-day cert expiry), Pitfall 4 (Supabase auto-pause), Pitfall 5 (RLS disabled by default), Pitfall 10 (Expo Go incompatibility).

### Phase 2: Core Logging — Photo, Text/Voice, Diary
**Rationale:** Photo-based AI logging is the app's core value proposition and the riskiest integration (vision API + structured output + image handling); building it early surfaces quota/parsing issues while the rest of the app is still small.
**Delivers:** Photo capture → resize/re-encode → Edge Function (`analyze-photo`, Gemini 3.1 Flash-Lite) → Zod-validated editable draft → confirm → Postgres write; text/voice manual logging (zero-AI-dependency fallback, must work even if photo path is down); basic diary view (meals, totals, macros).
**Uses:** Gemini 3.1 Flash-Lite + `@google/genai`, `expo-image-manipulator`, Zod, Edge Function proxy pattern.
**Implements:** Pattern 1 (Edge Function as secret-holding proxy) and Pattern 2 (direct client→Postgres for user's own data) from ARCHITECTURE.md.
**Avoids:** Pitfall 6 (quota exhaustion — build manual-entry fallback as part of this phase, not later), Pitfall 7 (non-compliant JSON), Pitfall 8 (oversized/HEIC image rejection), Anti-Pattern 4 (treating AI output as final instead of draft).

### Phase 3: Barcode Logging & Nutrition-Label/Menu OCR
**Rationale:** Both features reuse the photo-capture UI and editable-draft review screen built in Phase 2, and both are naturally grouped as "structured external nutrition data acquisition." Sequenced after core logging so the review-screen and Edge Function patterns are already proven.
**Delivers:** Barcode scan (Open Food Facts direct-from-client for MVP) → editable draft → confirm; nutrition-label OCR (`ocr-label` Edge Function, vision-LLM JSON extraction) → editable draft → custom food; USDA FDC lookup via Edge Function with `food_cache` table.
**Addresses:** Table-stakes label scan, differentiator menu OCR (defer menu OCR to a later sub-phase/v1.x per FEATURES.md — validate label-scan accuracy first).
**Avoids:** Pitfall 9 (unreliable barcode scanning on real curved packaging — test against real product packaging, not just flat test codes).

### Phase 4: Goals & TDEE Autopilot
**Rationale:** Autopilot has a hard 14-day data-collection prerequisite (both weight and intake logging must already be working from Phases 2-3), so it is necessarily sequenced last among core v1 features; it's also the most algorithmically novel piece and benefits from having real logged data to validate against.
**Delivers:** Static BMR/TDEE goal-setting (Mifflin-St Jeor fallback), in-app weight entry, TDEE autopilot Steps 1-5 (EWMA weight-trend smoothing, threshold-gated implied-TDEE calc, damped weekly blend, confidence/stability state), manual lock/override toggle.
**Addresses:** Table-stakes TDEE autopilot, differentiator confidence/stability indicator and manual lock.
**Avoids:** FEATURES.md anti-pattern of daily TDEE recompute reacting to noisy single-day weight swings; legal/ethical constraint against reverse-engineering MacroFactor's proprietary algorithm (this uses only publicly documented energy-balance concepts).

### Phase 5: Sync, Export/Import & Polish (Apple Health stretch)
**Rationale:** Cross-device sync is already inherent to the Supabase-Postgres architecture (no separate sync protocol needed) so this phase is mostly export/import plumbing and the explicitly-labeled post-MVP Apple Health stretch goal, appropriately sequenced last.
**Delivers:** JSON/CSV export/import for personal backup; Apple Health weight/active-energy sync (native module, on-device only, post-MVP stretch per PROJECT.md).

### Phase Ordering Rationale

- Infrastructure-first ordering directly follows PITFALLS.md's "phase to address" column — every critical pitfall maps to the earliest possible phase, since all of them (cert expiry, RLS, auto-pause, Expo Go) are dramatically cheaper to prevent than to recover from.
- Photo logging before barcode/OCR because it's architecturally riskier (vision API integration, structured output, image pipeline) and the editable-draft review screen it establishes is explicitly designed in ARCHITECTURE.md to be reused generically by later features — building it once, generically, in Phase 2 avoids a second review-UI being built in Phase 3.
- TDEE autopilot last among core features is a hard dependency, not a preference: FEATURES.md's dependency graph shows autopilot requires ≥14 days of both weight and intake data, which can only start accumulating once Phases 2-3 are live.
- Grouping barcode + label/menu OCR together in Phase 3 reflects FEATURES.md's explicit feature-dependency note that OCR "requires" the same photo-capture UI and draft-review screen already built for photo logging — no new UI infrastructure, just new Edge Functions and prompts.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Core Logging):** Needs research-phase — exact current free-tier rate limits for Gemini/Groq change frequently and must be re-verified live (AI Studio dashboard) at implementation time; prompt/schema design for reliable structured output benefits from iteration research.
- **Phase 4 (TDEE Autopilot):** Needs research-phase — the EWMA alpha/beta damping constants recommended in FEATURES.md are engineering defaults, not verified formulas; expect to tune against real personal data, and validate the "looks done" edge cases (missing weigh-ins, outlier readings).
- **Phase 3 (Barcode/OCR):** Light research-phase recommended for menu OCR specifically (messier multi-column layouts) — label OCR and barcode lookup have well-documented patterns.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure Setup):** Well-documented, standard Supabase/EAS/Expo setup patterns — official docs are sufficient.
- **Phase 5 (Sync/Export):** Standard CRUD/export patterns; Postgres+RLS already provides sync with no custom protocol needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Model quality claims backed by a credible 2026 benchmark preprint (not yet fully peer-reviewed); free-tier quota numbers are volatile and explicitly flagged as needing re-verification at implementation time since Google no longer publishes fixed RPD numbers |
| Features | MEDIUM-HIGH | OCR approach is HIGH confidence (well-documented, stable Gemini structured-output capability); TDEE algorithm is MEDIUM — built from MacroFactor's publicly stated concepts, not their (unpublished) exact formula, so specific tuning constants are estimates |
| Architecture | HIGH | Grounded in official Supabase docs and current pricing pages; only the offline-sync library landscape and exact free-tier numeric limits are lower confidence (move fast, third-party summaries may lag) |
| Pitfalls | MEDIUM-HIGH | Underlying mechanics (RLS-off-by-default, 7-day free-signing expiry, Supabase pause-on-inactivity, deprecated barcode-scanner package, structured-output inconsistency) are HIGH confidence and corroborated by official docs/changelogs; exact numeric quota/limit values are explicitly flagged LOW/MEDIUM and volatile |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Exact current free-tier rate limits (Gemini RPD/RPM, Groq RPD, EAS monthly build cap, Supabase resource thresholds) are all explicitly flagged across research files as changing frequently — re-verify each live at implementation time (Google AI Studio dashboard, Groq console, Expo dashboard, Supabase pricing page) rather than trusting the numbers cited in research.
- TDEE autopilot's specific damping constants (alpha ≈0.1–0.15, beta ≈0.25–0.35→0.15–0.2) are reasonable engineering defaults, not verified formulas — plan to tune against the user's own real logged data after a few weeks of live use; treat Phase 4 as needing a tuning/validation pass, not just initial implementation.
- Groq's Llama 4 Scout vision endpoint is marked "Preview" status by both Meta and Groq with far less independent food-benchmark validation than Gemini — treat it strictly as an emergency fallback, and re-confirm its status hasn't changed (GA vs Preview) before depending on it in Phase 2.
- Free-tier Gemini data-usage policy (prompts/images may be used to improve Google products until a billing account is attached) is a known, accepted tradeoff for this low-sensitivity personal app — no action needed, but worth a one-line note in any privacy-adjacent in-app copy.

## Sources

### Primary (HIGH confidence)
- [Gemini API structured outputs — official docs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API models — official docs](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API pricing — official docs](https://ai.google.dev/gemini-api/docs/pricing)
- [`@google/genai` npm package / googleapis/js-genai GitHub](https://github.com/googleapis/js-genai)
- [Supabase Edge Functions / Auth / Secrets / RLS — official docs](https://supabase.com/docs/guides/functions)
- [Supabase Free Project Pausing — official docs](https://supabase.com/docs/guides/platform/free-project-pausing)
- [EAS Build limitations / Internal distribution — Expo official docs](https://docs.expo.dev/build-reference/limitations/)
- [Expo local-first architecture — official docs](https://docs.expo.dev/guides/local-first/)
- Standard energy-balance approximation (7700 kcal/kg ≈ 3500 kcal/lb) — long-established public-domain nutrition science

### Secondary (MEDIUM confidence)
- Vision-Language Models for Image-Based Dietary Assessment benchmark (bioRxiv/PMC preprint, 10 models, 3,229 images) — Gemini 3.1 Flash-Lite / 3.0 Flash accuracy findings
- MacroFactor's Algorithms and Core Philosophy / Help Center articles — official but intentionally high-level, conceptual only, no formulas disclosed
- Supabase pricing/free-tier limit third-party summaries (jetadmin.io, automationatlas.io, itpathsolutions.com)
- Groq free-tier limits (grizzlypeaksoftware.com, tokenmix.ai) — cross-checked across 2 independent sources
- Supabase RLS misconfiguration studies (modernpentest.com, vibe-eval.com, stingrai.io)

### Tertiary (LOW confidence)
- Community-reported exact Gemini free-tier RPD numbers — Google no longer publishes these; re-verify live at implementation time
- Groq Llama 4 Scout vision food-specific benchmark track record — thin, Preview status
- OpenRouter free-model roster — volatile, changes month to month, not relied upon as primary

---
*Research completed: 2026-09-23*
*Ready for roadmap: yes*
