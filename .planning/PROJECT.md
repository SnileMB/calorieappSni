# BOBLUR

## What This Is

BOBLUR is a personal AI-powered calorie and macro tracker built as an installable PWA (install-to-Home-Screen web app), for private/single-user use (no App Store distribution). It replicates the core "honest scanner" job-to-be-done of apps like CalBot, Cal AI, and MyFitnessPal — photo/text food logging with an editable review step, a daily diary, and goal tracking — without cloning any proprietary UI, prompts, database content, or private APIs.

## Core Value

A fast, accurate-enough food logger that treats AI output as an editable draft, not an authority — log a meal in seconds via photo or text, review and correct it, and see accurate daily totals against personal goals.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can log food via photo upload/capture (AI-detected foods, portions, calories, macros, confidence)
- [ ] User can log food via typed natural language
- [ ] User can log food via barcode entry/photo (web camera or manual code entry, Open Food Facts primary source)
- [ ] User can review and edit any AI/barcode-derived entry before saving (adjust items, servings, calories, macros)
- [ ] User can view a daily diary: meals, totals, calories remaining, macro breakdown
- [ ] User can set personal goals (BMR/TDEE estimate, weight goal, activity level, macro targets)
- [ ] User can save and quickly re-log recent/favorite foods and meals
- [ ] User can scan/photograph a nutrition label or restaurant menu (via vision AI) to create a personal custom food
- [ ] App adjusts calorie/macro targets over time based on logged weight trend + intake (TDEE autopilot, after ~14 days of data)
- [ ] User can export and import their data as JSON/CSV for personal backup/portability
- [ ] Data syncs via Supabase so it's available across the user's own devices, accessible from any browser
- [ ] Weight sync with Apple Health (deferred indefinitely — HealthKit is not accessible from a PWA; would require a native wrapper)

### Out of Scope

- Social/community features — not needed for single-user private use
- Ads or ad SDKs — private app, no monetization
- Subscription/paywall/RevenueCat — private app, no monetization
- Complex meal plans / recipe library — not core to the tracking job
- AI coach chatbot — dossier's own research says this is separable from the logging assistant; revisit later
- Wearables beyond Apple Health weight/active-energy — Android/other wearables deferred
- Native app store distribution (iOS or Android) — PWA install-to-Home-Screen instead, works on any device with a browser
- Native camera/barcode SDK polish and background tasks — PWA web APIs (getUserMedia, etc.) are weaker here; acceptable tradeoff for avoiding native build/signing entirely
- HealthKit integration — not accessible from a PWA without a native wrapper; would require reintroducing native app complexity this pivot was meant to avoid
- Fine-tuned/custom models — use existing free/open hosted vision models as-is
- Reverse engineering, scraping, or calling private APIs of Cal AI, MyFitnessPal, Cronometer, or any competitor — legally and ethically off-limits regardless of "private use" framing; use only public APIs (Open Food Facts, USDA FDC, Cal AI's *public* documented API if used at all) and original UX/prompts/code

## Context

This project follows an internal research dossier (2026-09-23) surveying the AI calorie-tracker market (CalBot, Cal AI, MyFitnessPal, SnapCalorie, Cronometer, MacroFactor, Lifesum, YAZIO, MyNetDiary, Foodvisor, Lose It!). Key findings informing this build:

- The winning feature bundle across competitors is consistent: photo/voice/text/barcode capture → AI recognition → nutrition database resolution → user correction → diary → goals. The differentiation is polish and distribution, not the underlying architecture.
- MacroFactor's key insight: TDEE should be inferred from logged weight trend + intake, not from wearable calorie-burn estimates — this app adopts that adaptive-goal approach.
- MyNetDiary/SnapCalorie's insight: nutrition-label and menu OCR are more reliable than estimating a cooked plate from a photo, and are good "private-use" features to prioritize.
- A scanner should always produce an editable draft, never an unchallengeable answer — friction/trust problems in competitor apps stem from forcing AI results without easy correction.
- Legal/ethical boundary (self-imposed, from dossier's risk analysis): no reverse engineering, scraping, or private-API use against any competitor, even though this is for private use. Use only public nutrition APIs and build original UX/prompts/code.
- **Platform pivot (2026-09-23):** Originally scoped as a native iOS app via Expo React Native. Pivoted to an installable PWA (install-to-Home-Screen) specifically to eliminate Apple's 7-day free-provisioning-profile reinstall cycle and to allow access from any browser, not just one sideloaded device. Tradeoff accepted: weaker native camera/barcode polish, no background tasks, no HealthKit — acceptable since none of those are core to the logging job. A follow-up research pass on PWA-specific patterns (camera capture via `getUserMedia`, service worker/offline caching, install prompts, Supabase Edge Function calls from a web client) should happen during phase-level planning since the initial research round (STACK/ARCHITECTURE/PITFALLS.md) was written assuming Expo/EAS/native distribution and is stale on those distribution-specific points. The Supabase backend architecture, AI vision model choice (Gemini 3.1 Flash-Lite), and OCR/TDEE algorithm research remain valid regardless of client platform.

Repo: `SnileMB/calorieappSni` (GitHub, empty at project start — no commits yet).

## Constraints

- **Users**: Single user (owner) only. No account system beyond what Supabase requires for sync; no multi-tenant concerns.
- **Platform**: Installable PWA (install-to-Home-Screen web app), not a native app. No App Store/Play Store submission, no Expo/EAS, no code-signing cycle. Accessible from any browser, including the owner's iPhone.
- **Budget**: Free tier only across the board — Supabase free tier, free AI model APIs, Open Food Facts/USDA (both free). No paid API fallbacks unless free tiers prove unworkable, in which case revisit.
- **AI provider**: Must use a free/open vision-capable model (hosted free tier preferred, e.g. Gemini free tier, Groq-hosted Llama vision, or similar) instead of OpenAI — exact choice to be determined by research phase.
- **Legal/compliance**: Not medical advice; calorie/nutrition estimates are approximate. No reverse engineering, scraping, or bypassing of any competitor's access controls, subscriptions, or private APIs.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Private/single-user only, no App Store submission | Avoids paywall, ads, compliance-copy, and monetization complexity entirely | — Pending |
| Installable PWA instead of native iOS app via Expo | Avoids Apple's 7-day free-provisioning reinstall cycle entirely and allows browser access from any device; accepted tradeoff of weaker camera/barcode polish and no HealthKit | — Pending |
| Supabase for sync/storage (not local-only) | User wants cross-device access to their own data, not just single-device local storage | — Pending |
| Free/open AI vision model instead of OpenAI | User preference; avoids paid API costs; requires research to pick a specific provider | — Pending |
| Pull nutrition/menu OCR, TDEE autopilot, and data export/import into v1 | User wants broader scope now rather than deferring to v2 | — Pending |
| No reverse engineering / scraping / private APIs of any competitor | Dossier's explicit legal/ethical line — applies even to private-use build | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/bm:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/bm:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-23 after initialization*
