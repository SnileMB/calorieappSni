# Architecture Research

**Domain:** Solo-developer, single-user, free-tier mobile app (Expo React Native + Supabase backend, AI food logging)
**Researched:** 2026-09-23
**Confidence:** HIGH (Supabase official docs, current pricing pages) / MEDIUM (offline-sync library landscape, moves fast)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Expo / iOS dev build)                 │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌─────────────────┐    │
│  │ Capture UI │ │ Review/Edit│ │  Diary /  │ │ Local cache      │    │
│  │ photo/voice│ │  draft UI  │ │  Goals UI │ │ (SQLite/AsyncStg)│    │
│  │ /text/     │ └────────────┘ └───────────┘ └─────────────────┘    │
│  │ barcode/OCR│                                                     │
│  └─────┬──────┘                                                     │
│        │ supabase-js client (Auth session + Postgres + Storage)     │
├────────┴──────────────────────────────────────────────────────────┤
│                     SUPABASE (single project, free tier)            │
│  ┌───────────┐ ┌────────────────────────┐ ┌─────────────────────┐  │
│  │   Auth    │ │     Edge Functions      │ │   Storage (bucket)  │  │
│  │ (email/   │ │ analyze-photo           │ │ meal-photos/        │  │
│  │ password) │ │ lookup-barcode          │ │ label-scans/        │  │
│  │           │ │ lookup-usda             │ │                     │  │
│  │           │ │ ocr-label               │ │                     │  │
│  └─────┬─────┘ └───────────┬─────────────┘ └──────────┬──────────┘  │
│        │                   │  (secrets: GEMINI_API_KEY, etc.)       │
│        │                   ▼                                        │
│  ┌─────┴───────────────────────────────────────────────────────┐   │
│  │                  Postgres (RLS on every table)                │   │
│  │  users-owned rows: logs, foods, meals, goals, weight,         │   │
│  │  food_cache (barcode/USDA lookups), settings                  │   │
│  └────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                │                        │                  │
                ▼                        ▼                  ▼
        Free vision model API   Open Food Facts API    USDA FoodData Central
        (e.g. Gemini free tier)   (public, no key)         (free API key)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Expo client | Capture input (photo/voice/text/barcode/OCR image), local optimistic UI, editable draft review, diary rendering, goal math display | React Native + Expo Router, `@supabase/supabase-js`, `expo-camera`/`expo-image-picker` |
| Supabase Auth | Identity for the one owner, issues JWT used by RLS and Edge Functions | Email/password (see recommendation below) |
| Supabase Edge Functions | Hold all secret API keys; call external AI/nutrition APIs; normalize responses into the app's schema; write cache rows | Deno-based functions in `supabase/functions/*` |
| Supabase Postgres | System of record: logs, foods, custom foods, goals, weight history, cached external lookups | Tables + RLS policies keyed on `auth.uid()` |
| Supabase Storage | Store meal photos / label photos actually worth keeping (not every AI-analysis frame) | Private bucket, RLS via `storage.objects` policies |
| External APIs | Vision analysis, barcode lookup, nutrition data, label OCR | Gemini (or chosen free vision model), Open Food Facts, USDA FDC |

## Recommended Project Structure

```
app/                        # Expo Router screens
├── (tabs)/
│   ├── diary.tsx
│   ├── goals.tsx
│   └── log/
│       ├── photo.tsx
│       ├── voice.tsx
│       ├── text.tsx
│       └── barcode.tsx
├── review/[draftId].tsx    # editable AI draft screen
src/
├── lib/
│   └── supabase.ts         # single supabase-js client instance
├── api/
│   ├── analyzePhoto.ts     # thin wrapper calling Edge Function
│   ├── lookupBarcode.ts
│   ├── lookupUsda.ts
│   └── scanLabel.ts
├── data/
│   ├── logs.ts             # Postgres queries via supabase-js (direct, RLS-protected)
│   ├── goals.ts
│   └── weight.ts
├── offline/
│   └── outbox.ts           # queued writes for offline logging (see pitfalls)
└── domain/
    ├── tdee.ts              # BMR/TDEE/autopilot calculations (pure, client-side)
    └── macros.ts
supabase/
├── functions/
│   ├── analyze-photo/index.ts
│   ├── lookup-barcode/index.ts
│   ├── lookup-usda/index.ts
│   └── ocr-label/index.ts
├── migrations/
└── config.toml
```

### Structure Rationale

- **`src/api/` vs `src/data/`:** Anything touching a secret (AI vision key, USDA API key) goes through `src/api/*` → Edge Function. Anything that's just the user's own rows in Postgres goes through `src/data/*` directly via `supabase-js` — RLS makes that safe and it avoids burning Edge Function invocation quota on plain CRUD.
- **`supabase/functions/`:** One function per external integration keeps cold-start small and secrets scoped narrowly (each function only gets the env vars it needs).
- **`src/offline/outbox.ts`:** Isolates the one genuinely tricky pattern (offline-first writes) so it doesn't leak into every screen.

## Architectural Patterns

### Pattern 1: Edge Function as secret-holding proxy for AI vision + paid-key nutrition APIs

**What:** Client never holds the vision-model API key or the USDA FDC API key. Client calls a Supabase Edge Function (`analyze-photo`, `lookup-usda`) with the user's JWT; the function reads the secret from `Deno.env`, calls the external API, normalizes the response into the app's food/macro shape, and returns it (optionally writing a cache row).

**When to use:** Any call requiring a secret credential — the free vision model API and USDA FDC (both require an API key). Also good practice even though this is a single-user private app, because:
- The dev-build IPA/APK is still a real binary that could be extracted; a key embedded in client JS bundle (even React Native) is recoverable with minimal effort.
- Free-tier AI APIs often rate-limit per key; if the key leaks (e.g., committed to a public GitHub repo — this project's repo is `SnileMB/calorieappSni`, currently unspecified visibility), it could get throttled/banned, breaking the whole app for the one user who depends on it.
- There is no meaningful "trust the client" argument that changes here versus a multi-user app — the leak vector is identical (extractable client binary/bundle), only the blast radius differs. For a hobby project the effort of an Edge Function proxy is small (a few dozen lines) relative to the risk of a dead API key.

**Trade-off:** Adds one network hop and consumes Edge Function invocation quota (500K/month free — effectively unlimited for one user logging a few meals/day, see limits table). Adds minor latency (Deno cold start ~50-200ms) — negligible next to vision-model inference time (seconds).

**Example:**
```typescript
// src/api/analyzePhoto.ts (client)
export async function analyzePhoto(imageBase64: string) {
  const { data, error } = await supabase.functions.invoke('analyze-photo', {
    body: { image: imageBase64 },
  });
  if (error) throw error;
  return data; // normalized { items: [{ name, grams, calories, protein, carbs, fat, confidence }] }
}
```
```typescript
// supabase/functions/analyze-photo/index.ts (server)
Deno.serve(async (req) => {
  const { image } = await req.json();
  const apiKey = Deno.env.get('VISION_API_KEY');
  const res = await fetch('https://generativelanguage.googleapis.com/...', {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey! },
    body: JSON.stringify({ /* prompt + image */ }),
  });
  const raw = await res.json();
  return new Response(JSON.stringify(normalize(raw)), { headers: { 'Content-Type': 'application/json' } });
});
```

### Pattern 2: Direct client → Postgres for user's own data (no Edge Function needed)

**What:** Diary reads/writes, goal updates, weight entries, favorites — all go straight from `supabase-js` to Postgres, protected by RLS (`user_id = auth.uid()`). No Edge Function in the loop.

**When to use:** Any operation that doesn't need a secret and doesn't need server-side normalization logic. This is the majority of app traffic (viewing diary, editing an entry, saving a favorite).

**Trade-off:** Requires RLS to be correctly configured on every table from day one (see Anti-Patterns). Simpler and lower-latency than routing through a function; also keeps Edge Function invocation count low.

### Pattern 3: Barcode/USDA lookup with Postgres-backed cache table

**What:** Open Food Facts has no auth and no meaningful rate limit for this volume, so it *can* be called directly from the client — but routing it through a small Edge Function (`lookup-barcode`) that checks a `food_cache` table first, then calls Open Food Facts on miss and upserts the result, avoids repeat lookups for foods the user scans often (e.g., their regular grocery items) and gives one place to later swap/augment data sources.

USDA FDC requires an API key (free, but a key nonetheless) — this one **must** go through an Edge Function regardless, for the same secret-exposure reason as Pattern 1.

**When to use:** Barcode scan flow and "search foods" flow.

**Trade-off:** For Open Food Facts specifically, proxying is a convenience/caching choice, not a hard security requirement (no secret involved) — reasonable to call it directly from the client for MVP and add the cache-Edge-Function later if lookups feel slow or repetitive. Recommendation: start direct-from-client for Open Food Facts to reduce Phase 1 scope; add the caching Edge Function once the barcode feature is stable and repeat-lookup patterns are visible in real usage.

**Example:**
```typescript
// supabase/functions/lookup-usda/index.ts
Deno.serve(async (req) => {
  const { fdcId, query } = await req.json();
  const { data: cached } = await supabaseAdmin.from('food_cache')
    .select('*').eq('source', 'usda').eq('source_id', fdcId ?? query).maybeSingle();
  if (cached) return json(cached.payload);

  const apiKey = Deno.env.get('USDA_FDC_API_KEY');
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`);
  const payload = await res.json();
  await supabaseAdmin.from('food_cache').insert({ source: 'usda', source_id: fdcId, payload });
  return json(payload);
});
```

## Data Flow

### Request Flow — Photo logging (the core "AI vision" path)

```
User takes photo
    ↓
Client compresses/resizes image (expo-image-manipulator, keep payload small)
    ↓
supabase.functions.invoke('analyze-photo', { image: base64 })
    ↓ (Edge Function, holds VISION_API_KEY)
Call free vision model API → raw model output
    ↓
Normalize into { items: [{name, grams, calories, protein, carbs, fat}], confidence }
    ↓
Return to client
    ↓
Client shows EDITABLE DRAFT (never auto-saved)
    ↓
User confirms/edits → client writes directly to Postgres `logs`/`log_items` table (RLS-protected, no Edge Function needed)
    ↓ (optional)
If user chooses "keep photo," upload original image to Supabase Storage bucket, store storage path on the log row
```

### Request Flow — Barcode logging

```
Barcode scanned (expo-camera / expo-barcode-scanner)
    ↓
Client calls Open Food Facts directly (GET, no key) — OR Edge Function `lookup-barcode` if caching layer added later
    ↓
Map OFF response → app's food shape
    ↓
Editable draft → confirm → direct Postgres write
```

### Request Flow — Nutrition label / menu OCR

```
Photo of label/menu taken
    ↓
supabase.functions.invoke('ocr-label', { image })  ← must be Edge Function (vision API key)
    ↓
OCR + structuring into nutrition facts
    ↓
Editable draft (custom food creation) → confirm → direct Postgres write to `foods` (custom, user-owned)
```

### State Management

```
Local component state for in-progress capture/draft (not persisted until confirmed)
    ↓
On confirm: direct Postgres write via supabase-js
    ↓
Diary/goals screens: supabase-js queries with React Query (or SWR) for caching + refetch-on-focus
    ↓
Offline: writes queued in an outbox table (local SQLite/AsyncStorage) if no network, flushed on reconnect
```

### Key Data Flows

1. **AI capture → draft → confirm → Postgres:** All AI/OCR paths funnel through an Edge Function for the external call, then a plain client-side Postgres write for persistence — the AI never writes to the database directly.
2. **Cross-device sync:** Because all persisted state lives in Supabase Postgres (not local-only), opening the app on a second device with the same auth session shows the same diary/goals — no custom sync protocol needed, Postgres + RLS is the sync mechanism.
3. **Cache-aside for external nutrition data:** `food_cache` table absorbs repeat barcode/USDA lookups so the same food isn't re-fetched from the internet every time it's logged.

## Scaling Considerations

Scaling to many users is explicitly out of scope (single private user), but "scaling" here really means **quota headroom**, since everything runs on Supabase's free tier indefinitely.

| Scale | Architecture Adjustments |
|-------|---------------------------|
| 1 user, MVP | Everything as described above. No changes needed. |
| 1 user, years of daily logging | Postgres 500MB free-tier cap is the real constraint (see limits below) — text/numeric rows are tiny (thousands of log rows ≈ a few MB), so this is a non-issue unless storing lots of images in Storage or huge JSON blobs. Prune/compress old raw AI-response JSON if kept. |
| If ever multi-device with poor connectivity (e.g., logging meals while traveling) | Add the offline outbox pattern (Pattern in Anti-Patterns/Pitfalls) sooner rather than later — this is a usage-scaling concern, not a user-count one. |

### Scaling Priorities

1. **First real limit to watch: Supabase project auto-pause.** Free tier projects pause after 1 week of inactivity — irrelevant for daily personal use, but relevant if the user stops using the app for a vacation/break; a paused project needs manual un-pause from the dashboard before the app works again. Not a code fix — just an operational note for the user.
2. **Second: Storage (1GB free) if every meal photo is kept.** At ~500KB-1.5MB per compressed photo, 1GB supports roughly 700-2000 stored photos. Mitigate by (a) only uploading to Storage when the user explicitly opts to keep the photo, and (b) compressing aggressively client-side before upload (Pattern 1 already resizes for the vision-model call; reuse that resized asset for storage too rather than uploading the original).

## Anti-Patterns

### Anti-Pattern 1: Embedding the vision-model or USDA API key in the Expo client bundle

**What people do:** Call the AI vision API or USDA FDC directly from `fetch()` in a React Native screen with the key in an `EXPO_PUBLIC_*` env var, reasoning "it's just me using the app."
**Why it's wrong:** `EXPO_PUBLIC_*` variables are compiled into the JS bundle and are trivially extractable from the built app (even a private sideloaded IPA). If the key leaks (repo made public, screenshot, bundle inspection), the free-tier quota can be exhausted or the key banned by the provider, breaking the app with no easy recovery path (may require a new account/key).
**Do this instead:** Route every call requiring a secret through a Supabase Edge Function (Pattern 1). Only the Supabase anon/publishable key — which is designed to be public and is meaningless without RLS being misconfigured — belongs in the client.

### Anti-Pattern 2: Forgetting to enable/write RLS policies on a new table

**What people do:** Create a table via SQL editor or migration, forget to `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or add policies, then either the table is fully open (if RLS off and using anon key with permissive grants) or fully closed (RLS on, no policies — everything rejected, confusing "works with service role but not client" bugs).
**Why it's wrong:** Supabase tables are Postgres tables exposed via PostgREST; without RLS + policies, `anon`/`authenticated` roles either see nothing or (worse) see/write everything, including — in a single-user app — no real multi-tenant risk today, but it's still the mechanism that separates "this device's session" from a service-role bypass, and misconfiguration causes confusing runtime errors.
**Do this instead:** For every table, immediately add: `ENABLE ROW LEVEL SECURITY`, then a policy scoping `USING (auth.uid() = user_id)` / `WITH CHECK (auth.uid() = user_id)` for select/insert/update/delete. Same for `storage.objects` on any bucket. Write this into the same migration that creates the table — never as a follow-up step.

### Anti-Pattern 3: Uploading raw Blob/File objects to Supabase Storage from React Native

**What people do:** Pass the `Blob` or object returned by `expo-image-picker`/`expo-camera` straight into `supabase.storage.from(bucket).upload()`.
**Why it's wrong:** React Native's `Blob` implementation doesn't behave like a browser `Blob`, and Supabase's storage upload expects an `ArrayBuffer`/`File`-like object; naive Blob uploads frequently produce 0-byte files or "network request failed" errors — a well-documented Supabase/Expo community pitfall.
**Do this instead:** Read the file via `expo-file-system` as base64, decode with `base64-arraybuffer`'s `decode()`, and upload the resulting `ArrayBuffer` with the correct `contentType`. Also ensure `react-native-url-polyfill/auto` is imported at the app entry point before the Supabase client is created (required for `supabase-js` to work correctly in React Native's JS runtime).

### Anti-Pattern 4: Treating AI vision output as final data instead of a draft

**What people do:** Write the AI's photo-analysis result directly to the `logs` table on response.
**Why it's wrong:** Contradicts this project's own core value proposition (editable draft, not authority) and also means a bad AI call pollutes the diary before the user ever sees it — harder to undo than an in-memory draft.
**Do this instead:** Edge Function returns the normalized result to client state only; a separate explicit "confirm" action performs the Postgres write. (Already captured in Data Flow above — flagged here because it's an easy shortcut to accidentally take.)

### Anti-Pattern 5: Building full offline-first sync (CRDTs, WatermelonDB, custom conflict resolution) for a single user on one-to-two devices

**What people do:** Reach for a heavyweight offline-first library (WatermelonDB + custom Supabase sync, RxDB replication, etc.) because "offline-first" is the trendy pattern for RN+Supabase apps.
**Why it's wrong:** Those patterns exist to solve multi-user concurrent-edit conflict resolution and large-dataset local-first UX. For one person logging their own meals from at most 2-3 personal devices, the realistic failure mode is just "no signal for a few minutes while capturing a meal" — full CRDT sync machinery is significant build/maintenance overhead for a hobby project.
**Do this instead:** Build a minimal outbox: queue failed writes (log entries) in local storage (AsyncStorage/SQLite via `expo-sqlite`) tagged with a client-generated UUID and timestamp; retry on reconnect (`NetInfo` listener) with upsert semantics (`on conflict (id) do nothing`/`do update`) so a retried write is idempotent. This covers the real scenario (spotty connectivity while out) without adopting a sync framework.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Free vision model API (e.g. Gemini free tier, or provider chosen in AI-model research) | Always via Edge Function (`analyze-photo`, `ocr-label`) | Never expose key to client; watch free-tier rate limits (varies by provider — confirm in the AI-model-specific research doc) |
| Open Food Facts | Direct from client for MVP; optional Edge Function + `food_cache` proxy later | No API key required; public, generous rate limits for personal use |
| USDA FoodData Central | Always via Edge Function (`lookup-usda`) | Requires free API key; DEMO_KEY has low rate limit — register a personal key and store as Edge Function secret |
| Apple Health (post-MVP stretch) | Native module (`expo-health` / HealthKit bridge) on-device only | Not a Supabase concern; syncs weight/active-energy into Postgres via the client, same as any other write |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client ↔ Edge Functions | `supabase.functions.invoke()`, JWT auto-attached | Functions should validate `context.auth` / JWT even though there's one user — cheap insurance, and required if anonymous auth is ever layered in |
| Client ↔ Postgres | `supabase-js` query builder, RLS-protected | No custom REST layer needed — PostgREST (Supabase's auto-generated API) is sufficient for this app's needs |
| Client ↔ Storage | `supabase.storage.from(bucket)`, RLS on `storage.objects` | Bucket should be private (not public); generate signed URLs for display, not public URLs |
| Edge Function ↔ Postgres (cache writes) | `supabase-js` with service-role key (server-side only, never shipped to client) | Used only inside Edge Functions for cache upserts that bypass RLS intentionally |

## Recommendations Summary (for roadmap use)

**Auth:** Use **email/password** (Supabase Auth), not anonymous sign-in. Rationale: anonymous auth's core benefit — letting a user start using the app before committing to an account — doesn't matter here (there's no signup funnel to protect), while its downside is real: an anonymous user's data is tied to a device-local session and is **lost/inaccessible if the session is cleared or a different device is used**, unless the developer builds the "convert anonymous → permanent" flow anyway. Since cross-device sync is an explicit requirement, a real (if minimal) email/password account sidesteps that entirely and takes ~zero extra effort for one person to set up once.

**Edge Function vs. direct client, decisive rule:** If the call requires a secret credential (vision model key, USDA key) → **always Edge Function**, no exception, even for a single-user app — the risk isn't "another user misusing it," it's "the client binary/bundle leaking the key and burning/banning the free quota." If the call has no secret and is just the user's own Postgres data → **always direct client**, RLS is the security boundary, an Edge Function adds nothing. Open Food Facts (no key) is a judgment call — start direct, add a caching Edge Function only if/when needed.

**Free tier limits relevant to this app (Supabase, as of 2026):**

| Resource | Free tier limit | Relevance to this app |
|----------|------------------|------------------------|
| Postgres database size | 500 MB | Ample for years of personal food-log text/numeric data; watch only if storing large raw JSON blobs per entry |
| Edge Function invocations | 500,000/month | Effectively unlimited for a handful of AI/lookup calls per day from one user |
| File Storage | 1 GB | Limits how many meal/label photos can be kept; compress and make photo-retention opt-in |
| Bandwidth/egress | 5 GB/month (DB) + 5 GB cached egress | Should not be a constraint for text-heavy personal use; photo downloads count against it if photos are frequently re-viewed |
| Monthly active users | 50,000 MAU | Irrelevant at 1 user |
| Active projects | 2 per free org | Use 1 for this app; keep the second slot free for experimentation |
| Inactivity pause | Project auto-pauses after 1 week idle | Operational note, not architectural — resume manually from dashboard if the user takes a break from logging |

(Sources below; note pricing/limits pages change over time — reverify at build time via the Supabase pricing page since third-party summaries can lag official numbers by a release or two.)

**Build order implication:** Supabase project + Postgres schema + RLS policies must exist **before** any Edge Function or client screen is built (everything depends on the schema and auth). Edge Functions for AI/nutrition integrations should be built and tested with `curl`/Postman **before** wiring them into client capture screens, so API-normalization bugs are caught outside the UI loop. Storage bucket + policies only need to exist by the time the "keep photo" feature is built — can be deferred behind the diary/logging MVP.

## Sources

- [Supabase Pricing 2026 Guide — jetadmin.io](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/) — MEDIUM confidence (third-party summary)
- [Supabase Free Tier Limits 2026 — automationatlas.io](https://automationatlas.io/answers/supabase-free-tier-limits-2026/) — MEDIUM confidence
- [Supabase Free Tier Limits — itpathsolutions.com](https://www.itpathsolutions.com/supabase-free-tier-limits) — MEDIUM confidence
- [Securing your data — Supabase official docs](https://supabase.com/docs/guides/database/secure-data) — HIGH confidence
- [Securing Edge Functions — Supabase official docs](https://supabase.com/docs/guides/functions/auth) — HIGH confidence
- [Environment variables / secrets — Supabase official docs](https://supabase.com/docs/guides/functions/secrets) — HIGH confidence
- [Anonymous Sign-Ins — Supabase official docs](https://supabase.com/docs/guides/auth/auth-anonymous) — HIGH confidence
- [Supabase Auth now supports Anonymous Sign-ins — Supabase blog](https://supabase.com/blog/anonymous-sign-ins) — HIGH confidence
- [React Native file upload with Supabase Storage — Supabase official blog](https://supabase.com/blog/react-native-storage) — HIGH confidence
- [Uploading images from Image Picker in React Native Expo — GitHub Discussion #1268](https://github.com/supabase/supabase/discussions/1268) — MEDIUM confidence (community, but corroborated by official blog post above)
- [Use Supabase with Expo React Native — Supabase official quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) — HIGH confidence
- [Offline-first React Native Apps with Expo, WatermelonDB, and Supabase — Supabase official blog](https://supabase.com/blog/react-native-offline-first-watermelon-db) — HIGH confidence (used to inform anti-pattern reasoning, not adopted directly)
- [Local-first architecture with Expo — Expo official docs](https://docs.expo.dev/guides/local-first/) — HIGH confidence

---
*Architecture research for: Solo-developer, single-user, free-tier Expo + Supabase AI food tracker*
*Researched: 2026-09-23*
