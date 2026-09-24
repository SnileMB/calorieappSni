# Stack Research

**Domain:** AI vision model selection for free-tier food-photo calorie/macro analysis (BOBLUR)
**Researched:** 2026-09-23
**Confidence:** MEDIUM (free-tier quotas fluctuate; model quality claims backed by a peer-reviewed-adjacent benchmark; exact numbers cross-checked across multiple community sources since Google no longer publishes fixed free-tier numbers in its own docs)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Google Gemini API — **Gemini 3.1 Flash-Lite** (primary) | current (`gemini-3.1-flash-lite`) | Vision-capable multimodal model for food photo → structured JSON (items, portions, calories, macros, confidence) | A 2026 peer-reviewed-adjacent benchmark (bioRxiv/PMC, 10 models, 3,229 food images) found Gemini 3.1 Flash-Lite had the **best ingredient-recognition score (Jaccard 0.655)** and near-top calorie accuracy (CCC 0.754) among all 10 models tested — including GPT-4o, GPT-5 Mini, and Claude Haiku 4.5 — at the lowest per-image cost of the top performers. It is the free-tier-friendliest model in the family (Google reserves its most generous free daily quotas for Flash-Lite tiers) and natively supports JSON-schema-constrained output. |
| Google Gemini API — **Gemini 3.x Flash** (quality fallback, same provider) | current (`gemini-3.0-flash` / `gemini-3.5-flash`) | Higher-accuracy fallback for ambiguous/complex plates | Same benchmark found Gemini 3.0 Flash had the single best calorie-estimation accuracy of all 10 models (CCC 0.767, MAE 80.7 kcal). Use as an occasional "escalate for a second opinion" call, not as the default, since its free daily quota is smaller than Flash-Lite's. |
| Groq API — **Llama 4 Scout (vision, Preview)** | `meta-llama/llama-4-scout-17b-16e-instruct` | Independent secondary provider / offline-Gemini fallback | Separate quota pool from Google (30 RPM / 6,000 TPM / 1,000 RPD on Groq's free tier as of Sept 2026), extremely fast inference (Groq's LPU hardware), supports image input up to 20MB. Marked "Preview" by Groq — acceptable for a personal single-user app, not for production SLAs. Use only when Gemini's daily quota is exhausted. |
| `@google/genai` (npm) | latest (1.x) | Official TypeScript/JS SDK for Gemini, callable from Supabase Edge Functions (Deno) via `npm:@google/genai` specifier | Officially maintained by Google, supports `inlineData` image parts + `responseSchema`/`responseMimeType: "application/json"` for schema-constrained structured output — exactly the shape needed (items/portions/calories/macros/confidence). Works in Deno via the `npm:` prefix Supabase Edge Functions require. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `groq-sdk` (npm) | latest | Call Groq's OpenAI-compatible chat completions API with vision input | Only in the fallback code path when Gemini returns a quota-exhausted (429) error |
| Zod | latest | Define the food-analysis response schema once in TS, derive the JSON schema passed to Gemini's `responseSchema`, and validate/parse the model's JSON reply before trusting it | Always — never trust raw model JSON without runtime validation, since even schema-constrained output can occasionally omit optional fields or return out-of-range numbers |
| `expo-image-manipulator` | latest (Expo SDK) | Downscale/compress photos client-side (e.g., to ~1024px longest edge, JPEG ~80%) before base64-encoding and uploading | Always, before sending to any vision API — keeps requests fast, cheap on tokens, and under both providers' image size limits (Gemini: 20MB per request across all inline parts; Groq: 20MB per image) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Google AI Studio (aistudio.google.com) | Get a free Gemini API key, and — critically — check your **live** current rate limits | Google stopped publishing fixed free-tier RPD/RPM/TPM numbers in its docs (see "What NOT to Use" note below); AI Studio's `/rate-limit` dashboard is the only authoritative live source for your account's actual quota |
| Groq Console (console.groq.com) | Get a free Groq API key; free tier requires no credit card | Rate limits shown per-model in the console; apply at the org level |

## Installation

```bash
# Core — Gemini SDK for the Edge Function
npm install @google/genai zod

# Fallback provider
npm install groq-sdk

# Client-side image prep (Expo app, not the Edge Function)
npx expo install expo-image-manipulator expo-image-picker
```

In a Supabase Edge Function (Deno), import with the `npm:` specifier instead:
```typescript
import { GoogleGenAI, Type } from "npm:@google/genai";
import { z } from "npm:zod";
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Gemini 3.1 Flash-Lite | Gemini 3.0 Flash | When you want the single most accurate calorie estimate for a hard/ambiguous photo and can tolerate spending more of the smaller Flash free quota |
| Gemini (Google-hosted) | Groq Llama 4 Scout (vision, Preview) | When Gemini's daily free quota is exhausted for the day, or as an A/B cross-check; do not use as primary — it's still Preview-status on Groq and has a much smaller open-benchmark track record for food-specific tasks |
| Gemini (Google-hosted) | OpenRouter free-tier vision router (`openrouter/free`, e.g. Llama 3.2 11B Vision, Qwen2-VL) | Only as a third-tier emergency fallback if both Gemini and Groq are exhausted in the same day. OpenRouter's free model roster is unstable — providers add/remove/reprice free models frequently (reports of "22–29 free models" changing month to month), and neither Gemini nor Claude currently offer free models through OpenRouter, so it doesn't help hedge against a Google outage the way Groq does |
| Gemini (Google-hosted) | Self-hosted Moondream 3 / Qwen-VL / Llama 3.2 Vision (local inference) | Only if you later want zero API dependency and have GPU hardware (or accept slow CPU inference) — not recommended for MVP: adds real infra complexity (model serving, GPU cost or very slow CPU latency) for a single-user app where a hosted free API already works well |
| Claude (Anthropic) | — | **Not viable as a free option.** The Claude *API* has no perpetual free tier — only a one-time ~$5 trial credit for new Console accounts (requires SMS verification), after which it's pay-as-you-go. Claude.ai's free consumer tier (web/app) is not an API and cannot be called programmatically. Excluded per user's explicit request to avoid paid fallbacks. |
| OpenAI | — | Explicitly excluded per project constraint. Not evaluated further. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Hard-coding a specific "N requests/day" number into app logic as a guarantee | Google's own rate-limits and pricing docs (`ai.google.dev/gemini-api/docs/rate-limits`, `.../pricing`) **no longer publish fixed free-tier RPD numbers** — they explicitly say limits "depend on a variety of factors... and can be viewed in Google AI Studio," and Google has cut free quotas by 50–80% without notice at least once (Dec 2025). Community-reported numbers (e.g., Flash-Lite ~500–1,000 RPD, Flash ~20 RPD post-cut) are directionally useful but not contractual. | Query/handle HTTP 429 responses gracefully, fall back to Groq, and always re-check current limits live in AI Studio (`aistudio.google.com/rate-limit`) before assuming a quota |
| Relying on Gemini free tier for any data you'd consider sensitive without accepting the tradeoff | On the **free** API tier (unlike the paid tier), Google's terms allow using your submitted prompts/images "to improve Google products," including human review; this only stops once you attach a billing account and move to a paid tier | Accept this tradeoff for a personal food-photo app (low sensitivity), or note it explicitly as a known constraint in privacy-adjacent product copy |
| Groq's Llama 4 Scout vision endpoint as your *only* provider | Meta/Groq both mark image input on Llama 4 Scout as **Preview**, not GA — no production SLA, and it has far less independent food-benchmark validation than Gemini | Use Gemini as primary, Groq only as the fallback path |
| OpenRouter as a primary provider | The free-model catalog changes month to month as providers add/remove/reprice; you cannot depend on a specific model ID staying free or even staying listed | Use OpenRouter only as a last-resort emergency fallback, and re-verify the free model list at runtime/deploy time, not at design time |
| Any competitor's private/undocumented API (Cal AI, MyFitnessPal, etc.) for food recognition | Explicitly out of scope per this project's own legal/ethical constraint (see PROJECT.md) — not actually a "free AI model" option in the first place | Gemini / Groq as above |

## Stack Patterns by Variant

**If Gemini free quota is exhausted for the day (HTTP 429):**
- Catch the 429 in the Supabase Edge Function, retry once against Groq's Llama 4 Scout vision endpoint using the same prompt + Zod schema (translated to Groq's OpenAI-compatible `response_format: {type: "json_schema", ...}` or a strict "return only JSON matching this schema" instruction if Groq's structured-output support proves weaker in practice)
- Surface a subtle "using backup AI provider today" note in the UI so results can be sanity-checked more carefully by the user (consistent with the project's "AI output is a draft, never authority" principle)

**If a photo produces a low-confidence result from either provider:**
- Ask the model to return a numeric `confidence` field per item (0–1) as part of the JSON schema; route low-confidence items into the mandatory review/edit step more prominently (larger UI affordance) rather than auto-accepting

**If you want higher accuracy on a specific hard photo (e.g., mixed plate, restaurant meal):**
- Offer a manual "re-analyze with higher accuracy" button that calls Gemini 3.x Flash (full, not Flash-Lite) instead of Flash-Lite, spending a small amount of the separate, smaller Flash quota only on demand

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@google/genai@1.x` | Node 18+ and Deno (via `npm:` specifier) | Confirmed usable inside Supabase Edge Functions, which run on Deno; use `npm:@google/genai` import specifier, not a bare specifier |
| `zod@3.x/4.x` | `@google/genai` `responseSchema` (Gemini's own `Type` enum) | Gemini's structured-output config uses its own `Type.OBJECT/STRING/...` schema format, not raw JSON Schema/Zod directly — write the schema once by hand (or via a small Zod→Gemini-Type converter) and validate the *response* with Zod after parsing |
| `groq-sdk` | OpenAI SDK-compatible API shape | Groq's chat completions API is OpenAI-compatible, so prompt/message structuring code can be shared/mirrored between the Gemini and Groq code paths with minor adapter differences |

## Sources

- [Gemini API structured outputs — official docs](https://ai.google.dev/gemini-api/docs/structured-output) — HIGH confidence: confirms JSON-schema-constrained output support for multimodal (image) requests
- [Gemini API models — official docs](https://ai.google.dev/gemini-api/docs/models) — HIGH confidence: confirmed current model lineup (Gemini 3.8/3.7/3.6/3.5 Flash, 3.5/3.1 Flash-Lite) as of Sept 2026 via direct fetch
- [Gemini API rate limits — official docs](https://ai.google.dev/gemini-api/docs/rate-limits) — HIGH confidence for the *meta-finding*: Google no longer publishes fixed free-tier numbers, directs to live AI Studio dashboard instead
- [Gemini API pricing — official docs](https://ai.google.dev/gemini-api/docs/pricing) — HIGH confidence: confirms free tier exists for Flash/Flash-Lite models with "free input & output tokens," no fixed RPD published
- Vision-Language Models for Image-Based Dietary Assessment: A Benchmark of Accuracy, Cost, and Prompt Strategies Across Ten Models — [bioRxiv](https://www.biorxiv.org/content/10.64898/2026.07.26.740845v1) / [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13483877/) — MEDIUM-HIGH confidence: preprint (not yet fully peer-reviewed at time of research) but methodologically rigorous, 3,229 real food images, 10 models compared including Gemini 2.0/2.5/3.0 Flash, 3.1 Flash-Lite, GPT-4o/4o-mini/5-mini, Claude Haiku 4.5, Qwen2-VL-7B — directly answers "which free-tier-eligible vision model is best at food photos"
- [Groq API free tier limits — community analysis](https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb) and [TokenMix Groq free tier breakdown](https://tokenmix.ai/blog/groq-free-tier-limits-2026) — MEDIUM confidence: community-reported, cross-checked across 2 independent sources agreeing on Llama 4 Scout free tier ≈30 RPM / 6,000 TPM / 1,000 RPD and 20MB image limit, Preview status
- [Llama 4 Acceptable Use Policy](https://www.llama.com/llama4/use-policy/) and [Llama 4 Community License](https://www.llama.com/llama4/license/) — HIGH confidence, official — no restriction blocking personal/non-commercial single-user use; EU-domiciled individuals are excluded from multimodal model rights (not applicable here)
- Gemini free-tier data usage policy — MEDIUM confidence, cross-referenced across multiple community sources (no single official page found stating this plainly in one place, but consistent across sources): free-tier prompts/images may be used to improve Google products until a billing account is attached
- [OpenRouter free models collection](https://openrouter.ai/collections/free-models) — MEDIUM confidence: confirms a free vision-model router exists but roster is volatile and does not include Gemini or Claude
- Anthropic Claude API free tier research — MEDIUM confidence, multiple community sources agree: no perpetual free API tier exists, only a one-time ~$5 trial credit; consumer Claude.ai free tier is not API-accessible
- [`@google/genai` npm package](https://www.npmjs.com/package/@google/genai) and [googleapis/js-genai GitHub](https://github.com/googleapis/js-genai) — HIGH confidence, official SDK, confirms `inlineData` image parts + `responseSchema`/`responseMimeType` JSON structured output pattern
- [Supabase Edge Functions docs](https://supabase.com/docs/guides/functions) — HIGH confidence, official: confirms `npm:` specifier requirement for external deps like `@google/genai` inside Deno-based Edge Functions

---
*Stack research for: AI vision model selection for BOBLUR food-photo analysis*
*Researched: 2026-09-23*
