# Feature Research

**Domain:** Personal AI calorie/macro tracker — deep dive on OCR label/menu capture and adaptive TDEE
**Researched:** 2026-09-23
**Confidence:** MEDIUM-HIGH (OCR approach: HIGH: Vision framework and vision-LLM structured output are both well-documented, publicly verified capabilities. TDEE algorithm: MEDIUM — MacroFactor does not publish source code or exact formulas; the recommended algorithm below is an original, publicly-described-concept-inspired design, not a copy of proprietary internals.)

> Note: this file intentionally does NOT re-survey the general feature bundle (photo/voice/barcode logging, diary, goals, saved meals) — that's already covered by the existing competitive dossier referenced in PROJECT.md. This file goes deep on the two v1 features called out as needing more depth: (1) nutrition-label/menu OCR → custom food, and (2) TDEE autopilot.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Label scan → editable custom food | MyNetDiary/Cronometer-tier apps all support this; manual entry from a label is tedious and error-prone | MEDIUM | See recommended approach below — vision LLM extraction, not classic OCR pipeline |
| TDEE autopilot after ~2 weeks of data | MacroFactor made this the category's new bar; static Mifflin-St Jeor goals feel "wrong" within days for most users | MEDIUM-HIGH | Needs a minimum data threshold and a stability/confidence indicator, not just raw math |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Menu OCR (not just packaged labels) → custom food | Restaurant items are the accuracy failure point for AI plate-photo estimation; menus with listed nutrition (chains) are far more reliable than estimating a cooked plate | MEDIUM | Same vision-LLM pipeline as label scan; menus are messier (multi-column, per-item nutrition tables) so prompt/schema needs more tolerance |
| Confidence/stability indicator on TDEE estimate | Builds trust; MacroFactor explicitly communicates "still calibrating" vs "stable" states rather than presenting a single number as gospel — matches this project's "editable draft, not authority" principle from PROJECT.md | LOW-MEDIUM | Just surface variance/data-count as a badge; no extra infra |
| Manual override / lock TDEE | User (yourself) may want to freeze the target during a planned event, injury, refeed, etc. | LOW | Simple toggle + stored override value; autopilot skips recompute while locked |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Building a dedicated OCR + NLP nutrition-table parser (regex/column detection over raw Tesseract/Vision text) | Feels more "real" / more control than an LLM call | High engineering cost for single-user app; brittle across label layouts (US vs EU formats, restaurant PDFs, low-light photos); this is exactly the kind of custom pipeline SnapCalorie/MyNetDiary spent real engineering teams on | Send the photo directly to a vision-capable LLM with a strict JSON schema prompt — dramatically less code, more robust to layout variance, "good enough" for personal use |
| Real-time Kalman/Bayesian filter replicating MacroFactor's exact internals | Sounds more "proper" / scientifically rigorous | MacroFactor's exact algorithm is proprietary and unpublished; reverse-engineering or approximating it too closely risks both wasted effort chasing an unknown target and (per PROJECT.md's explicit legal/ethical line) uncomfortably close imitation of a competitor's actual mechanism | Build a simpler, fully-transparent, self-documented adaptive algorithm from public energy-balance principles (below) — good enough for one user, and honest about what it is |
| Daily TDEE recompute / reacting to single-day weight swings | Feels more "responsive" | Day-to-day weight is dominated by water/glycogen/GI noise (often 1-3 lb / 0.5-1.4 kg swings); reacting daily produces a jumpy, untrustworthy target that erodes trust in autopilot | Recompute weekly (or on a rolling trigger) off the smoothed weight trend, not raw daily weight |

---

## Deep Dive 1: Nutrition-Label / Menu OCR

### Recommended approach: vision-capable LLM with structured JSON output — NOT a dedicated OCR pipeline

**Why this beats on-device OCR (Apple Vision framework / expo-ocr / ML Kit) for this project:**

- On-device OCR (Apple's `Vision` framework via a native module, or community wrappers like `expo-ocr`/`react-native-vision-camera` + `VisionKit` text recognition) gives you **raw text only** — you still have to write parsing logic to turn "Total Fat 8g / Saturated Fat 1g / Sodium 160mg / Total Carbohydrate 37g ... Protein 3g" into structured fields, handle multi-column restaurant menus, handle EU label layout differences (kJ vs kcal, "of which sugars" vs "sugars"), handle skewed/low-light photos, etc. That parsing layer is real, ongoing engineering effort for a single-user free app.
- A vision-capable LLM (e.g., Google Gemini's free-tier vision models, which is the project's already-decided AI provider direction per PROJECT.md) can be given the raw photo **plus a JSON schema** and asked to directly return `{name, servingSize, servingsPerContainer, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, confidence}` in one call. Modern Gemini models support **structured output / JSON schema mode**, which guarantees schema-conformant JSON rather than free-text you have to regex — this removes the entire "parse OCR text into fields" layer.
- This also uniformly handles both nutrition labels *and* restaurant menus (a menu line like "Chicken Bowl — 650 cal, 45g protein, 60g carbs, 22g fat" needs the exact same "photo in, structured nutrition out" call — no separate pipeline).
- For a single-user, free-tier app, this is a 1-2 day feature (a camera capture screen you likely already have for food photo logging, reused; one prompt; one schema; the existing "review/edit draft" screen already required by PROJECT.md for all AI-derived entries) vs. a multi-week OCR-parsing subsystem.

**Recommended flow:**
1. Reuse the existing photo-capture UI (already required for AI plate-photo logging).
2. Send image to the vision LLM with a prompt instructing: "This is a nutrition facts label or restaurant menu nutrition listing. Extract structured nutrition facts. If multiple serving sizes or multiple menu items are visible, return an array. If a field is unreadable, omit it and lower confidence rather than guessing." + JSON schema (Gemini structured output / `responseSchema`, or Groq/Llama vision function-calling equivalent if Gemini's free tier proves insufficient).
3. Map the returned JSON into the same "editable draft" custom-food entry screen used elsewhere in the app (per PROJECT.md's "always an editable draft, never an unchallengeable answer" principle) — user reviews/corrects before saving as a personal custom food.
4. Persist as a reusable custom food in Supabase (same table as saved meals/foods), tagged with source = "label_scan" or "menu_scan" for later reference.

**When on-device OCR would still make sense:** if the free-tier vision LLM proves unreliable/rate-limited in practice, a fallback of Apple Vision text recognition + a much simpler "just show raw extracted text pre-filled into a manual-entry form" (skip structured parsing entirely) is a reasonable low-effort degradation path — cheaper than building a real parser, and still faster than fully manual entry. Recommend NOT building this unless the LLM path fails in testing.

**Complexity:** MEDIUM (bounded mainly by prompt/schema iteration and menu-layout edge cases, not infrastructure).

**Confidence:** HIGH that vision-LLM structured extraction is viable and is the standard 2026 approach for this scale of app (Gemini's JSON-schema/structured-output mode is officially documented and stable; community nutrition apps and internal tooling commonly use this pattern in place of classic OCR+parsing). MEDIUM on exact free-tier rate limits holding up for daily personal use — verify actual current Gemini free-tier quota at implementation time, as these change.

---

## Deep Dive 2: TDEE "Autopilot" (Adaptive Goal Recalculation)

### What's publicly known about MacroFactor's approach (verified via their own published articles, not reverse-engineered)

MacroFactor's own public documentation confirms the **concept** but explicitly does not publish exact formulas or source code:
- Core relationship they state outright: **"Calories out = Calories in − Change in stored energy."** (i.e., rearranged energy balance: TDEE = average logged intake − (rate of stored-energy change expressed in calories/day)).
- They use a **weight-trend smoothing algorithm** ("an averaging approach that accounts for the influence of weight values over a pretty long time scale, while placing more weight on more recent values") — i.e., some form of recency-weighted moving average, not raw daily scale weight.
- Initial TDEE estimate starts from a standard predictive equation (age/sex/height/weight/activity), then is **continually corrected** by comparing predicted vs. actual weight trend against logged intake.
- Adjustments are **deliberately damped/conservative**: they describe a two-step pattern — tentative adjustment if week 1 shows a mismatch, larger adjustment only if the mismatch persists into week 2 — explicitly to avoid overreacting to noise.
- They do not disclose whether this is a Kalman filter, Bayesian updater, or a simpler weighted-regression scheme. Any claim online that it's specifically "a Kalman filter" is unverified speculation, not something MacroFactor has published — treat as LOW confidence and do not rely on it.

**Given this, the following is an original algorithm built from the public *concept* (energy balance + recency-weighted trend + damped updates), not copied proprietary code — appropriate per PROJECT.md's legal/ethical constraint.**

### Recommended concrete algorithm

**Step 1 — Smooth the weight signal (trend weight).**
Maintain an exponentially weighted moving average (EWMA) of daily weight entries to filter water/food noise:

```
trend_weight[t] = alpha * raw_weight[t] + (1 - alpha) * trend_weight[t-1]
```

- Recommend `alpha ≈ 0.1–0.15` (roughly a 7–13 day half-life: `half_life ≈ ln(0.5)/ln(1-alpha)`), which is in the same range as the ~19-day half-life some public reimplementations use for water-weight smoothing, but tightened toward MacroFactor's own stated 2-3 week stabilization window.
- Missing weigh-in days: skip update (don't decay toward nothing); require at least 4-5 weigh-ins/week for the trend to be considered "reliable" that week.

**Step 2 — Compute weekly energy balance from the trend.**
At the end of each rolling 7-day (or 14-day, see threshold below) window:

```
weight_change_kg = trend_weight[t] - trend_weight[t-7]
daily_energy_balance_kcal = (weight_change_kg * 7700) / 7
```

(7700 kcal/kg — equivalently ~3500 kcal/lb — is the standard, publicly documented approximate energy density of body-mass change; note this is a simplification, real composition-dependent energy density varies ~6500-9500 kcal/kg, which is a known source of estimate error worth stating in-app, not hiding.)

**Step 3 — Back-calculate implied TDEE for the window.**

```
avg_logged_intake_kcal = mean(logged_calories over same window)
implied_TDEE = avg_logged_intake_kcal - daily_energy_balance_kcal
```

(If in surplus and gaining, `daily_energy_balance_kcal` is positive, so implied TDEE is intake minus the surplus — i.e., lower than intake; if losing weight, implied TDEE is higher than intake. This matches the public "Calories out = Calories in − Change in stored energy" relationship MacroFactor states.)

**Step 4 — Blend into the running TDEE estimate with damping (avoid single-week overreaction).**
Rather than replacing the estimate outright, blend it, weighted more heavily as more windows accumulate confidence:

```
current_TDEE = (1 - beta) * current_TDEE + beta * implied_TDEE
```

- Recommend `beta ≈ 0.25–0.35` per weekly update while under 4 weeks of data (faster convergence early, matching MacroFactor's "tentative then larger if it persists" pattern), stepping down to `beta ≈ 0.15–0.2` once ≥4 windows of history exist (more stable, harder to move).
- Track a simple confidence/stability flag: `LOW` confidence until the minimum-data threshold (see below) is met; `MODERATE` from 2-4 weekly updates; `STABLE` once the implied TDEE across the last 3 windows varies by less than some tolerance (e.g. ±75-100 kcal), surfaced in the UI per PROJECT.md's "editable draft, not authority" principle.

**Step 5 — Minimum data threshold before autopilot engages.**
Per PROJECT.md's own requirement ("after ~14 days of data"): do not run Step 3 onward until at least 14 days of data exist with:
- ≥10 of 14 days having a logged weight entry, AND
- ≥10 of 14 days having logged intake (skip zero-log days from the intake average, don't treat them as 0 kcal).

Below this threshold, use the standard static goal (Mifflin-St Jeor or user-set) and show "Autopilot: collecting data (X/14 days)" rather than silently doing nothing.

**Step 6 — Recompute cadence and macro re-derivation.**
- Recompute weekly (e.g., every Sunday, or every 7 days from account start) — not daily — for the same noise-avoidance reason MacroFactor states.
- When `current_TDEE` changes by more than a small threshold (e.g. >2-3%, or >50-75 kcal) from the prior stored value, update the daily calorie target; otherwise leave it unchanged even if the raw computation drifted slightly, to avoid target-jitter.
- Re-derive macro targets (protein/carb/fat) from the new calorie target using the user's existing macro-split preference (e.g., protein g/kg fixed, remaining split by ratio) — don't re-ask the user for split preferences on every autopilot update.
- Respect a manual "lock autopilot" override (see Differentiators table) — if locked, skip Steps 3-6 entirely and just log the computed implied TDEE silently for future reference/debugging.

**Complexity:** MEDIUM-HIGH. The math itself (EWMA + weekly blend) is straightforward to implement and unit-test in isolation (pure functions over weight/intake time series — no external API dependency, can be built and tested entirely client-side or as a Supabase edge function/cron). The harder part is data-quality handling: missing weigh-ins, missing log days, outlier weight entries (e.g., a single 5kg misreading), and clearly communicating confidence/stability state in the UI so a single-week static number doesn't feel arbitrary. Budget real design/testing time for the "sparse or noisy data" edge cases, not just the happy-path formula.

**Confidence:** HIGH on the underlying energy-balance math and EWMA smoothing approach (standard, publicly documented techniques, verifiable independent of MacroFactor). MEDIUM on the specific alpha/beta/threshold constants recommended above — these are reasonable engineering defaults inspired by MacroFactor's publicly stated *behavior* (2-3 week stabilization, two-step damped adjustment) but were not extracted from any published formula; expect to tune them against your own real logged data after a few weeks of use.

---

## Feature Dependencies

```
Nutrition-label/menu OCR scan
    └──requires──> Photo capture UI (already required for AI plate-photo logging — reused, not new)
    └──requires──> Editable-draft review screen (already required for all AI-derived entries)
    └──produces──> Custom food entry (feeds into "saved/favorite foods" feature)

TDEE Autopilot
    └──requires──> Daily weight logging (needs a weight-entry surface; check if Apple Health weight sync — noted as post-MVP stretch in PROJECT.md — can double as the input, or build minimal in-app weight entry first)
    └──requires──> Daily calorie logging (already core to app)
    └──requires──> ≥14 days of both data streams before activating (Step 5 threshold)
    └──enhances──> Goal-setting feature (replaces/refines the static BMR/TDEE estimate goal)

Manual TDEE lock/override ──conflicts──> Autopilot auto-recompute (mutually exclusive per period; lock suppresses recompute)
```

### Dependency Notes

- **OCR scan requires the editable-draft review screen:** this screen is already mandated by PROJECT.md for photo/voice/barcode logging — build it generically enough (arbitrary structured nutrition fields, not just "detected foods list") that the OCR feature can reuse it rather than building a second review UI.
- **Autopilot requires reliable daily weight input:** if Apple Health weight sync isn't ready by the time autopilot ships, a lightweight in-app "log today's weight" entry point must exist first — this is a hard prerequisite, not optional, since Step 1-5 of the algorithm has nothing to smooth without it.
- **Autopilot enhances goal-setting, doesn't replace it:** the static Mifflin-St Jeor-style estimate from the goals feature remains the fallback/starting point until the 14-day threshold is met, and remains visible/referenceable even after autopilot engages (useful for comparison and for the "lock" override state).

---

## MVP Definition

### Launch With (v1)
- [ ] Nutrition-label OCR → editable custom food (vision-LLM structured extraction) — core requirement explicitly in PROJECT.md
- [ ] Basic in-app daily weight entry (if Apple Health sync isn't ready) — hard prerequisite for autopilot
- [ ] TDEE autopilot Steps 1-5 (smoothing + threshold-gated implied-TDEE calc + weekly recompute) — explicit v1 requirement in PROJECT.md, "after ~14 days of data"

### Add After Validation (v1.x)
- [ ] Restaurant menu OCR (same pipeline as label OCR, but validate label-scan accuracy/prompt quality first since menus are messier — multi-item tables, inconsistent formats)
- [ ] Confidence/stability badge UI polish for autopilot (start with a minimal "collecting data" vs "active" state, refine to 3-tier confidence once real usage data exists)
- [ ] Manual TDEE lock/override toggle

### Future Consideration (v2+)
- [ ] On-device OCR fallback (Apple Vision) if free-tier vision-LLM quota/reliability proves inadequate in real personal use
- [ ] Outlier weight-entry detection/exclusion (e.g., flag a scale misread) — worth having eventually, not essential for a single trusted user who can just delete a bad entry manually

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Label OCR → custom food (vision LLM) | HIGH | MEDIUM | P1 |
| Menu OCR → custom food | MEDIUM-HIGH | MEDIUM (incremental over label OCR) | P2 |
| TDEE autopilot core algorithm | HIGH | MEDIUM-HIGH | P1 |
| Autopilot confidence/stability UI | MEDIUM | LOW | P2 |
| Manual TDEE lock/override | LOW-MEDIUM | LOW | P2 |
| On-device OCR fallback | LOW (only matters if P1 approach fails) | MEDIUM-HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | MacroFactor | MyNetDiary / Cronometer-tier apps | Our Approach |
|---------|-------------|-----------------------------------|--------------|
| Adaptive TDEE | Proprietary damped weight-trend-vs-intake algorithm, unpublished internals, publicly described concept only | Mostly static formula-based goals (not adaptive) | Original EWMA-smoothed, threshold-gated, damped-blend implementation built from the public concept — see Deep Dive 2 |
| Label/menu OCR | Not MacroFactor's focus (manual entry + verified database) | Some support label scanning via classic OCR + database matching | Vision-LLM structured JSON extraction direct to custom food — simpler, no OCR-parsing layer, works for labels and menus alike |

---

## Sources

- [MacroFactor's Algorithms and Core Philosophy](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/) — MEDIUM confidence (official but intentionally high-level, no formulas disclosed)
- [How Accurate is MacroFactor's Expenditure Algorithm?](https://macrofactor.com/algorithm-accuracy/) — MEDIUM confidence (official, conceptual only)
- [How Should I Interpret Changes to my Energy Expenditure? — MacroFactor Help Center](https://help.macrofactorapp.com/en/articles/26-how-should-i-interpret-changes-to-my-energy-expenditure) — MEDIUM confidence (official, confirms "Calories out = Calories in − Change in stored energy" and the two-step damped adjustment pattern)
- [MacroFactor's Adaptive TDEE: How Accurate Is It Really? — caleye.fit](https://caleye.fit/blog/macrofactor-tdee-tracking-accuracy/) — LOW-MEDIUM confidence, third-party analysis
- [GitHub - MitCaine/Nutrition-App (on-device Apple Vision OCR nutrition tracker)](https://github.com/MitCaine/Nutrition-App) — MEDIUM confidence, real-world example of the on-device OCR approach and its added parsing complexity
- [GitHub - barthap/expo-ocr](https://github.com/barthap/expo-ocr) — MEDIUM confidence, example on-device text recognition wrapper for Expo/React Native (iOS Vision framework)
- [Structured outputs | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/structured-output) — HIGH confidence, official docs confirming JSON-schema-constrained structured output from vision-capable Gemini models
- [Gemini 2.0 Flash API Free Tier Guide](https://dev.to/claudeprime/gemini-20-flash-api-free-tier-guide-for-developers-4bh2) — LOW-MEDIUM confidence (community-written; verify current quota numbers directly against Google's official pricing/quota page at implementation time, as free-tier limits change)
- Standard energy-balance approximation (7700 kcal/kg ≈ 3500 kcal/lb of body-mass change) — HIGH confidence, long-established public-domain nutrition science, independent of any competitor's implementation

---
*Feature research for: BOBLUR — personal AI calorie/macro tracker (OCR capture + adaptive TDEE deep dive)*
*Researched: 2026-09-23*
