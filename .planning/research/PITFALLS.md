# Pitfalls Research

**Domain:** Solo-developer personal iOS app — Expo (sideload/dev-build, no App Store) + Supabase free tier + free/open multimodal AI vision API
**Researched:** 2026-09-23
**Confidence:** MEDIUM-HIGH (stack mechanics verified against official docs/changelogs; exact free-tier numbers change often and are flagged LOW where volatile)

This file intentionally excludes general product pitfalls already covered in the competitor dossier (AI accuracy, nutrition-DB trust, legal/privacy of a tracking app). It focuses only on pitfalls created by *this specific infrastructure combination*: Expo sideload distribution, Supabase free tier, and a free vision AI model, all operated solo for one private user.

## Critical Pitfalls

### Pitfall 1: The 7-day certificate expiry kills the app silently (free Apple Developer account)

**What goes wrong:**
Distributing an iOS app without App Store/TestFlight requires code signing. If you sign with a **free** Apple ID (no $99/yr Apple Developer Program), the provisioning profile/certificate expires after **7 days**, not 90. The app simply stops launching on-device with no warning — it just crashes or refuses to open. Developers often discover this a week after they thought the project was "done," and it looks like a build/app bug when it's actually just an expired signature.

**Why it happens:**
Expo/EAS documentation focuses on ad-hoc and internal distribution mechanics but assumes you already have a paid Apple Developer account for provisioning. Solo devs building "just for me" often try to avoid the $99/yr fee and use a free Apple ID, not realizing the 7-day profile lifetime this imposes (this is an Apple platform limit, not an Expo one).

**How to avoid:**
Pay the $99/yr Apple Developer Program fee up front — it is the only way to get device-based ad-hoc distribution with a 1-year provisioning profile via EAS, and it unlocks TestFlight (90-day builds, no manual reinstall, push notification entitlements work correctly). For a project intended to run indefinitely as a daily-use personal app, treat this as a required cost, not optional — otherwise budget recurring manual reinstall labor (SideStore/AltStore-style refresh workflows) that a solo dev will eventually forget to do.

**Warning signs:** App suddenly won't launch with no code change; "Unable to Install" or silent crash on open a week or more after last build.

**Phase to address:** Address in the initial project-setup/distribution phase, before any feature work — decide once whether to pay for an Apple Developer account (recommended: use TestFlight internal testing, not raw ad-hoc) or accept the 7-day refresh cycle.

---

### Pitfall 2: TestFlight is actually the better "sideload" path than raw ad-hoc — most solo devs default to the harder option

**What goes wrong:**
Developers assume "not on the App Store" means ad-hoc `.ipa` builds distributed via EAS internal distribution links (QR code install). This requires manually registering every device UDID (`eas device:create`) and rebuilding whenever a new device is added, and profiles need periodic renewal. It also means no automatic update mechanism for native changes — only JS/OTA updates via `expo-updates` work without a full rebuild.

**Why it happens:**
"Internal distribution" is the first thing EAS docs show for quick testing, so it looks like the natural personal-distribution channel, when in fact TestFlight (which still doesn't require public App Store review — just an internal test group, and can be limited to yourself) is more durable: builds last 90 days, installation happens through the TestFlight app with proper update prompts, and no manual UDID registration/rebuild dance is needed per device.

**How to avoid:**
For a single-user permanent personal app, use **TestFlight internal testing** (requires the paid Apple Developer account either way) rather than ad-hoc distribution. Reserve ad-hoc/internal-distribution builds for quick preview builds during active development (`eas build --profile preview`), and ship the "daily driver" build via TestFlight.

**Warning signs:** Manually re-signing/reinstalling the app periodically; needing to physically plug in or re-register a device to get an update.

**Phase to address:** Distribution/setup phase, alongside Pitfall 1.

---

### Pitfall 3: EAS free-tier build quota runs out mid-project from routine iteration

**What goes wrong:**
The EAS free plan allows a limited number of builds per month (historically ~15 iOS builds/month on the Free tier, enforced since the 2023 EAS free-plan limits change and still in effect in some form). A solo dev iterating on native config (adding a new native module, permissions, icons, `app.json` changes) burns builds quickly — each requires a full native rebuild, unlike JS-only changes. Running out mid-month blocks you from testing native changes until the quota resets.

**Why it happens:**
Early development involves lots of native-level churn (camera permissions, background tasks, health integration, new native deps) that each require a fresh EAS build, and it's easy to not track usage until the "quota exceeded" error appears.

**How to avoid:**
Use **`expo-dev-client`** simulator/local builds (`eas build --local` or `expo run:ios` against a physical device via Xcode directly, which doesn't consume EAS cloud build minutes) for early native-shakedown iteration, and reserve cloud EAS builds for milestone builds you actually want to install via TestFlight. Batch native-config changes so you rebuild less often. Track remaining monthly builds in the Expo dashboard.

**Warning signs:** Frequent `app.json`/`app.config.js` edits each triggering a full EAS cloud build; approaching the monthly build cap early in the month.

**Phase to address:** Address when native modules are first introduced (camera, health sync, notifications) — establish a local-build workflow before burning cloud quota.

---

### Pitfall 4: Supabase free-tier project auto-pauses after 7 days of inactivity — silent app breakage for a "personal use" app with irregular usage

**What goes wrong:**
Supabase free-tier projects pause automatically after 7 consecutive days without API activity. Because this app is for a single private user, gaps of a week (travel, illness, a break from logging) are entirely plausible — and when the user opens the app again, every request fails until the project is manually un-paused from the dashboard. For a food-logging habit app, this is exactly the moment a user is most likely to *want* to resume, and instead they hit total failure.

**Why it happens:**
Free-tier pausing exists to control Supabase's infrastructure costs for abandoned projects; a solo personal-use app with intermittent logging patterns is a near-perfect match for the "looks abandoned" heuristic even though it's actively used.

**How to avoid:**
Set up a scheduled keep-alive: a lightweight external cron (e.g., a free GitHub Actions scheduled workflow, or an uptime-monitor ping like cron-job.org / UptimeRobot hitting a trivial Supabase Edge Function or REST endpoint) at least every 5-6 days to prevent the inactivity window from being reached. Alternatively/additionally, build in-app resilience: detect a paused-project error state and show the user a clear "backend sleeping — tap to wake, may take ~30s" message rather than a generic network error, since first request after resume takes 10-30s to cold-start the database.
**Warning signs:** Requests failing after a period of no app use, especially with connection-refused or timeout errors rather than auth/data errors.

**Phase to address:** Backend/infrastructure setup phase — put the keep-alive job in place before the app is used interactively, not after the first pause incident.

---

### Pitfall 5: RLS disabled or overly permissive — "single user" mentality leads to skipping proper row security

**What goes wrong:**
Because there's only one user, it's tempting to skip Row Level Security entirely, or write `USING (true)` policies "temporarily" and never tighten them. New Supabase tables have RLS **disabled by default**, meaning any table created without an explicit `ENABLE ROW LEVEL SECURITY` + policy is immediately queryable/writable by anyone holding the public anon key — and the anon key is, by design, embedded in the client app bundle (it's meant to be public, but only safe *because* RLS is expected to gate it). A sideloaded personal app with a leaked/decompiled anon key and no RLS means anyone who gets the key can read/write the user's entire food/weight/health log.
This is the single most-reproduced Supabase security failure in the wild — the majority of publicized Supabase data exposures trace back to exactly this.

**Why it happens:**
"It's just me, who cares" thinking, combined with RLS being opt-in per table rather than on-by-default, means it's easy to create a new table, get the feature working, and never circle back to lock it down.

**How to avoid:**
Enable RLS on every table at creation time, even for a single-user app — write a policy scoped to `auth.uid() = user_id` (Supabase Auth still applies even with one real user; this also future-proofs the schema if a second device/account is ever added). Never use the `service_role` key in the mobile client — only the anon key, gated by RLS. Add an explicit checklist step at the end of every schema migration: "RLS enabled + policy written for this table?"

**Warning signs:** Any table where `supabase db` dashboard shows RLS "Disabled"; any policy expression that reduces to `true`; the service_role key appearing anywhere in the Expo app's JS bundle or `.env` shipped to the client.

**Phase to address:** Database schema phase — treat RLS policy-writing as part of "done" for every table, not a follow-up task.

---

### Pitfall 6: Free vision-model quotas are small, reset daily (not monthly), and are easy to exhaust with normal daily food-logging use

**What goes wrong:**
Free tiers on hosted multimodal models (Gemini free tier via AI Studio, Groq-hosted vision models, etc.) are rate-limited per-minute *and* per-day, and the per-day caps can be surprisingly low for some model tiers (e.g., some Gemini flash-tier free allowances have been as low as ~20-500 requests/day depending on model version; Groq free tier is commonly cited around 14,400 requests/day org-wide but with per-minute caps like 30 RPM / low TPM that a single large food photo can consume in one call). A single day of enthusiastic use (breakfast, lunch, dinner, snacks, retries on bad photos, nutrition-label OCR calls) can plausibly hit a daily cap that resets only at midnight UTC (or a rolling 24h window depending on provider) — leaving the user unable to log via photo for the rest of the day with no fallback.

**Why it happens:**
Developers pick "the free vision model" during prototyping when usage is light, then don't model out real daily-use volume (3-6 meals x possible retries x nutrition-label OCR calls) against the provider's actual daily/per-minute quota before shipping.

**How to avoid:**
1. Pick a free-tier provider/model combo and explicitly calculate worst-case daily call volume against its published daily/per-minute limits before committing (verify current numbers at implementation time — these values change frequently and are not stable across model versions).
2. Design the app to degrade gracefully when quota is hit: manual text/voice logging must always work with zero AI dependency, so a quota outage on the vision endpoint never blocks core logging.
3. Consider having two free-tier providers configured (e.g., Gemini as primary, Groq-hosted Llama vision as fallback) and failing over automatically when one returns a 429, since quotas are provider-specific and independent.
4. Cache/reuse results for identical images (e.g., re-logging a favorite meal) instead of re-calling vision on every repeat.

**Warning signs:** 429/rate-limit errors from the vision API; users unable to photo-log in the evening after a heavy-use morning.

**Phase to address:** AI-integration phase — build the fallback-to-manual-entry path and (optionally) multi-provider failover as part of the initial vision-logging feature, not as a later patch.

---

### Pitfall 7: Free/open vision models don't reliably honor structured-output (JSON schema) requests the way premium APIs do

**What goes wrong:**
The app's core "editable draft" UX (per PROJECT.md) depends on the AI reliably returning structured data — food items, portions, calories, macros, confidence — as parseable JSON. Free/open-weight vision models (Llama-vision variants on Groq, smaller open models) are less consistent than GPT-4o/Gemini-Pro-tier models at strictly honoring JSON schema/function-calling constraints: they may wrap JSON in markdown fences, add explanatory prose before/after, use inconsistent key names, or omit fields when uncertain. A parser written against "always valid JSON" will crash or silently drop entries on malformed responses.

**Why it happens:**
Structured-output guarantees (strict JSON mode, function calling) are a more mature, heavily-invested feature on paid frontier APIs; free/open hosted models support it to varying, less-tested degrees, and behavior can even change between model versions Groq or others swap in.

**How to avoid:**
Never trust raw model output as JSON. Always: (1) strip markdown code fences before parsing, (2) parse defensively with try/catch and a schema validator (e.g., zod) that tolerates missing/extra fields with sensible defaults, (3) if parsing fails, surface the failure as "AI couldn't read this — enter manually" rather than crashing, (4) prefer models/providers with documented JSON-mode or function-calling support (verify current per-model capability at implementation time, since it varies model-to-model even within one provider), and (5) keep prompts explicit about exact schema and examples, which measurably improves compliance even on weaker models.

**Warning signs:** Occasional silent failures to log a scanned meal; crash logs showing JSON.parse errors; entries appearing with missing macro fields.

**Phase to address:** AI-integration phase — build the defensive parsing layer as a first-class piece of the photo-logging feature, before it's considered "working."

---

### Pitfall 8: Vision API image-size/format limits reject phone camera photos outright

**What goes wrong:**
Modern iPhone cameras produce large HEIC images (often several MB, non-standard format for many APIs) or, if using `expo-camera`'s JPEG output, still potentially large files. Free vision APIs often cap upload size (e.g., some vision endpoints reject files over ~20MB, others much smaller in their free tier, and many require JPEG/PNG rather than HEIC). Sending a raw camera capture without resizing/re-encoding can produce silent 400 errors or extremely slow uploads on cellular data.

**Why it happens:**
Developers test in the simulator or with small sample images during prototyping, and don't hit real device photo sizes until later; HEIC is Apple's default capture format and isn't universally accepted by AI vision endpoints.

**How to avoid:**
Always downscale and re-encode photos client-side before sending to any vision API — resize to a bounded max dimension (e.g., 1024-1600px on the long edge, which is more than sufficient for food recognition and also reduces token/cost usage) and convert to JPEG using `expo-image-manipulator` immediately after capture, regardless of which vision provider is used. Treat this as a mandatory step in the capture pipeline, not an optimization.

**Warning signs:** Vision calls failing specifically on real-device photos but working with pasted-in sample images; slow uploads on cellular.

**Phase to address:** AI-integration / photo-capture phase — build the resize step into the capture pipeline from the first version, not as a later performance fix.

---

### Pitfall 9: `expo-camera` barcode scanning is less reliable than expected, and the legacy `expo-barcode-scanner` package is deprecated

**What goes wrong:**
Barcode scanning is now built into `expo-camera`'s `CameraView` (the standalone `expo-barcode-scanner` package is deprecated) — but on iOS, `expo-camera` barcode detection can fail to reliably scan unless the barcode is held near-perfectly centered and unrotated, which is a common source of "the scanner doesn't work" bug reports for real-world curved packaging (cans, bottles) and crumpled wrappers. Additionally, some Expo SDK versions have shipped with barcode-scanning regressions (e.g., `barcodeScannerEnabled` not taking effect on certain SDK releases) requiring workarounds or pinning specific SDK patch versions.

**Why it happens:**
`expo-camera`'s in-house barcode scanner is convenient (no extra native dependency) but is not as robust as dedicated scanning libraries (e.g., `react-native-vision-camera` + `vision-camera-code-scanner`/ML Kit) which have significantly better detection tolerance, at the cost of ejecting further from managed Expo simplicity.

**How to avoid:**
Start with `expo-camera`'s built-in `CameraView` barcode scanning (`barcodeScannerSettings` with the relevant `barcodeTypes`, e.g., `ean13`, `ean8`, `upc_a`/`upc_e` for food packaging) since it avoids extra native complexity appropriate for a solo/personal project — but budget time for real-world testing against actual pantry items (curved, reflective, small labels), not just flat test barcodes. If detection reliability proves unacceptably poor in testing, be ready to swap to `react-native-vision-camera` with an ML Kit code-scanner plugin, which requires a custom dev client rebuild (fine, since this project already uses EAS dev builds, not Expo Go).
**Warning signs:** Barcode scan works on a flat printed test barcode but repeatedly fails on real cans/bottles; increased user (self) frustration re-scanning items.

**Phase to address:** Barcode-scanning feature phase — validate against real product packaging early, not just flat printed samples, before considering the feature complete.

---

### Pitfall 10: Expo Go cannot be used for this app at all — easy to waste setup time before realizing it

**What goes wrong:**
Because the app needs camera + barcode scanning with custom native config, background/health integrations, and possibly custom native modules, it cannot run in the generic **Expo Go** sandbox app — it requires a **custom dev client** (`expo-dev-client`) built via EAS from day one. Developers used to Expo Go's zero-build convenience sometimes start there, then hit a wall (missing native module, can't configure entitlements) partway through and have to backtrack to set up dev-client builds and provisioning.

**Why it happens:**
Expo's own quick-start tutorials default to Expo Go for the fastest "hello world," which doesn't surface until later that camera/barcode/health APIs and any custom native config require ejecting to a dev client.

**How to avoid:**
Set up `expo-dev-client` and an EAS `development` build profile as the very first infrastructure step, before writing any feature code — treat "can I install a custom dev build on my own phone" as the actual environment-setup milestone, not "does Expo Go show a blank screen."

**Warning signs:** Needing a native module Expo Go doesn't support (e.g., HealthKit) after having already built UI assuming Expo Go workflow.

**Phase to address:** Project setup phase — first milestone should explicitly be "custom dev client installed on device via EAS," before any feature work begins.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Skip RLS "since it's just me" | Faster schema iteration | Full data exposure if anon key leaks/app is decompiled | Never |
| Use `service_role` key in the mobile app to "just make it work" | Bypasses RLS friction during dev | Total bypass of all access control if key is extracted from the app bundle | Never, not even temporarily |
| Hardcode a single free-tier AI provider with no fallback | Simpler integration code | Full outage of photo-logging when daily quota is hit | Only for a throwaway prototype, not the shipped app |
| Skip image resize before sending to vision API | Less capture-pipeline code | Failed/slow uploads on real photos, wasted token quota | Never — resize is cheap and prevents multiple downstream failures |
| Ad-hoc/manual UDID device builds instead of TestFlight | Avoids Apple Developer Program cost up front | Recurring manual re-signing labor, weekly app breakage on free accounts | Only during first week of prototyping, before daily-use begins |
| Trust raw AI JSON output without validation | Faster to ship "it works on my test photo" | Crashes/silent data loss on malformed responses in real use | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|------------------|--------------------|
| EAS Build (iOS) | Assume ad-hoc distribution = App Store-free = no cost; use free Apple ID | Budget the $99/yr Apple Developer Program; use TestFlight internal testing for the daily-use build |
| Supabase | Treat free-tier pause as a one-time annoyance; manually restore each time | Set up a scheduled keep-alive ping (cron/GitHub Actions) hitting the project at least every 5-6 days |
| Supabase Auth/RLS | Build tables first, "add security later" | Enable RLS + write a policy in the same migration that creates each table |
| Vision AI API | Wire up one provider assuming its free quota is "enough" without doing the math | Calculate worst-case daily call volume against provider's real daily/per-minute limits; add manual-entry fallback and consider multi-provider failover |
| expo-camera barcode | Assume built-in scanner works like a dedicated scanner SDK | Test against real curved/reflective packaging early; have `react-native-vision-camera` + ML Kit as a documented fallback plan |
| expo-image-manipulator | Send raw camera output (HEIC, full resolution) directly to AI API | Always resize to ~1024-1600px + convert to JPEG before any network call |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Supabase free-tier cold start after pause | First app open of the day takes 10-30s or times out | Keep-alive ping; graceful "waking up" UI state | After any 7-day gap in usage |
| Vision API daily quota shared across all use cases (photo log + label OCR + menu OCR) | Mid-evening "AI unavailable" errors | Track usage client-side or budget calls per feature; prioritize which AI-dependent feature degrades first | Around 15-30+ AI calls/day depending on provider/model, verify actual number at implementation time |
| Full EAS cloud rebuild per native/config tweak | Monthly build quota exhausted early | Use local builds (`eas build --local`, `expo run:ios`) during native iteration; reserve cloud builds for milestone installs | Roughly a dozen or so builds/month on the free tier (verify current cap) |
| Large unoptimized food photos stored in Supabase Storage | 1GB free storage tier fills up faster than expected | Resize/compress images before upload; consider not persisting the original full-res photo, just a thumbnail + AI result | After a few thousand full-res photos, or sooner if photos aren't resized |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS disabled on any table | Entire table readable/writable by anyone with the anon key (extractable from a sideloaded IPA) | Enable RLS + explicit `auth.uid()`-scoped policy on every table at creation |
| `service_role` key embedded in client app | Total bypass of all access control | Never ship service_role key in the mobile bundle; only use it in trusted server contexts (e.g., Supabase Edge Functions triggered server-side, not called with client-supplied secrets) |
| Vision API key embedded directly in client app | Key theft from a sideloaded/decompiled IPA leads to quota theft or billing abuse if the key is later upgraded to paid | Proxy AI calls through a Supabase Edge Function that holds the API key server-side, rather than calling the vision API directly from the RN app |
| Assuming "private app" means no auth needed | Anyone with the anon key (or a copy of the sideloaded IPA) could access all data if RLS is skipped | Use Supabase Auth even for a single user; scope all data to that user's `auth.uid()` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No fallback when AI quota is exhausted | User can't log a meal, breaks the "log in seconds" core value | Always allow manual text entry with zero AI dependency; surface quota errors as a friendly "AI limit reached today, log manually" message |
| Generic network error on Supabase cold-start/pause | Looks like the app is broken | Detect the specific timeout/cold-start pattern and show "waking up backend, ~20s" messaging |
| Silent failure on malformed AI JSON | Meal appears to vanish or log with blank macros | Explicit "couldn't parse AI response, review manually" state instead of silent drop |
| No visibility into remaining AI/build/backend quotas | Developer (as the sole user) hits surprise outages | Personal-use apps benefit from a simple internal debug screen showing today's AI call count and Supabase project status |

## "Looks Done But Isn't" Checklist

- [ ] **Photo logging:** Often missing image resize/re-encode before API call — verify actual device photos (not simulator/sample images) are sent as reasonably-sized JPEGs
- [ ] **AI response parsing:** Often missing defensive JSON parsing — verify the app doesn't crash on a deliberately malformed/truncated AI response
- [ ] **Barcode scanning:** Often only tested against flat printed test codes — verify against real curved cans/bottles/small labels
- [ ] **Supabase schema:** Often missing RLS on newly added tables — verify every table shows RLS "Enabled" with a non-`true` policy before considering a feature done
- [ ] **Distribution build:** Often assumed to "just work" indefinitely — verify what happens to the installed app after 7+ days (free account) or 90 days (paid account/TestFlight) with no rebuild
- [ ] **Backend availability:** Often not tested after a real inactivity gap — verify app behavior after intentionally leaving the Supabase project idle for 7+ days
- [ ] **AI quota exhaustion:** Often never tested — verify the manual-entry fallback path actually works when the AI call is forced to fail/429

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| App broken from expired 7-day free-account certificate | LOW | Rebuild and reinstall via EAS/TestFlight; if recurring, switch to paid Apple Developer account |
| Supabase project paused | LOW | Manually restore from Supabase dashboard (may take a minute); then add the keep-alive job so it doesn't recur |
| RLS missing discovered post-hoc | MEDIUM | Immediately enable RLS + write policies on affected tables; audit Supabase logs for any anomalous access during the exposure window; rotate anon key if abuse is suspected |
| Vision provider quota permanently reduced/deprecated | MEDIUM | Swap to an alternate free-tier provider (keep the AI-calling logic behind a single abstraction/interface from the start to make this a config change, not a rewrite) |
| Vision API key leaked from decompiled IPA | MEDIUM | Rotate the key immediately; migrate to proxying calls through a Supabase Edge Function so the key never ships in the client going forward |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 7-day free-account cert expiry | Project setup / distribution phase | Confirm Apple Developer Program enrollment (paid) and TestFlight internal testing set up before daily use begins |
| Ad-hoc vs TestFlight choice | Project setup / distribution phase | Daily-use build is installed via TestFlight, not a manually re-signed ad-hoc IPA |
| EAS build quota exhaustion | Native-integration phase (camera, health, notifications) | Local/simulator builds used for iteration; cloud build count tracked and stays within free tier monthly cap |
| Supabase auto-pause | Backend/infrastructure setup phase | A scheduled keep-alive job exists and has been observed to run at least weekly |
| RLS misconfiguration | Database schema phase | Every table shows RLS "Enabled" with a scoped (non-`true`) policy before the phase is marked complete |
| Vision API quota exhaustion mid-day | AI-integration phase | Manual-entry fallback verified to work when AI call is forced to fail; quota math documented against chosen provider's real limits |
| Non-compliant/malformed AI JSON | AI-integration phase | Defensive parser tested against deliberately malformed sample responses, not just happy-path outputs |
| Oversized/HEIC images breaking vision calls | AI-integration / capture pipeline phase | Real device photos (not simulator images) resized/re-encoded and successfully sent end-to-end |
| Unreliable barcode scanning on real packaging | Barcode-scanning feature phase | Tested against actual curved/reflective pantry items, not just flat printed test barcodes |
| Expo Go incompatibility | Project setup phase | First milestone is "custom dev client installed on device via EAS," not "Expo Go shows a screen" |
| API keys embedded in client bundle | AI-integration + backend phase | Vision API key called only via a server-side proxy (Supabase Edge Function), never directly from the RN client bundle |

## Sources

- [EAS Build limitations - Expo Documentation](https://docs.expo.dev/build-reference/limitations/)
- [Internal distribution - Expo documentation](https://docs.expo.dev/build/internal-distribution/)
- [Create and share internal distribution build - Expo documentation](https://docs.expo.dev/tutorial/eas/internal-distribution-builds/)
- [Enforcement of EAS Free plan limits — Expo changelog](https://expo.dev/changelog/2023-08-01-eas-free-plan-limits)
- [Subscriptions, plans, and add-ons - Expo documentation](https://docs.expo.dev/billing/plans/)
- [That is not true. To sideload an app a free Apple Developer is required. A 7 day... | Hacker News](https://news.ycombinator.com/item?id=36023322)
- [New limitations imposed on free Apple Developer account | myByways](https://mybyways.com/blog/new-limitations-imposed-on-free-apple-developer-account/)
- [Sideloading your own iOS app without paying Apple $99/year](https://filipstachura.com/posts/ios-sideloading/)
- [Project Pausing | Supabase Docs](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Pricing & Fees | Supabase](https://supabase.com/pricing)
- [10 Common Supabase Security Misconfigurations (and How to Fix Them)](https://modernpentest.com/blog/supabase-security-misconfigurations)
- [Supabase RLS in the Wild: 2026 Misconfiguration Atlas](https://vibe-eval.com/data-studies/supabase-rls-misconfiguration-atlas-2026/)
- [Supabase Anon Key: Is It Safe to Expose? RLS and 2026 Keys](https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster)
- [Gemini API Rate Limits 2026 (aggregated third-party trackers, verify current values at implementation time)](https://aipromptshub.co/limits/gemini-rate-limits-2026)
- [Groq Free Tier Limits 2026 (aggregated third-party trackers, verify current values at implementation time)](https://tokenmix.ai/blog/groq-free-tier-limits-2026)
- [expo-camera/next is ready for a close up — Expo blog](https://expo.dev/blog/expo-camera-next)
- [[SDK 55] expo-camera barcode scanning disabled despite barcodeScannerEnabled: true · Issue #44491 · expo/expo](https://github.com/expo/expo/issues/44491)
- [Comparing React Native barcode scanner libraries — Scanbot](https://scanbot.io/blog/react-native-vision-camera-vs-expo-camera/)
- [Camera - Expo documentation](https://docs.expo.dev/versions/latest/sdk/camera/)

**Confidence note:** Exact free-tier numeric limits (EAS monthly build count, Supabase MB/GB thresholds, Gemini/Groq per-day/per-minute quotas) shift frequently between provider announcements and were sourced primarily from third-party trackers rather than a single authoritative current page for each — treat specific numbers as MEDIUM/LOW confidence and re-verify against each provider's live pricing/limits page at implementation time. The underlying *mechanics* (pause-on-inactivity, RLS-off-by-default, 7-day free-signing expiry, deprecated barcode-scanner package, structured-output inconsistency on open models) are HIGH confidence, corroborated by official docs/changelogs and multiple independent sources.

---
*Pitfalls research for: Solo personal AI food-tracking app on Expo/Supabase/free-AI-vision stack*
*Researched: 2026-09-23*
