# Stack Research — v2.13 Style-from-Reference Generation

**Domain:** Vision-based design-template extraction from uploaded slideshow images, fed into the existing Gemini emit pipeline.
**Researched:** 2026-05-10
**Confidence:** HIGH (all Gemini specifics verified against live `ai.google.dev` docs and the `@google/genai` SDK via Context7 on 2026-05-10; existing app patterns verified by reading production code in `src/lib/ai/match-photos-to-slides.ts`).

---

## Executive Summary

**v2.13 needs zero new vendor relationships and zero new Tier-1 dependencies.** Every primitive required for vision-based style extraction is already in the production stack:

- `@google/genai@^1.46.0` SDK (already calling `gemini-2.5-flash` in 7 production files)
- `responseMimeType: 'application/json' + responseSchema` pattern (already used in 5 emit paths including `match-photos-to-slides.ts`, which already sends multiple inline images per request)
- `sharp@^0.33.5` server-side (already installed for v2.9 photo treatment pipeline) — exact tool we need for pre-vision downscale
- Supabase `createSignedUploadUrl` pattern (already used in `/api/v1/me/brand-kit/logo-upload-url/route.ts` for brand-kit logo uploads — same pattern fits reference uploads)
- `node-vibrant@4.0.4` (already installed for derived palette extraction; useful as a deterministic cross-check on Gemini's reported palette)

The only **new** runtime concern is reference-image lifecycle (a new private Supabase Storage bucket with retention policy) and a small `style_specs` Postgres table to persist the structured output. Everything else is wiring existing primitives together.

**Bottom line:** This milestone is a wedge layered on top of v2.12, NOT a stack expansion.

---

## What's Already In Place (DO NOT Re-Add)

These are already validated in production. Phase plans should consume them, not re-research them.

| Capability | Existing tool | Where it's used today | Reuse for v2.13 |
|---|---|---|---|
| Vision-capable LLM | `gemini-2.5-flash` via `@google/genai@^1.46.0` | `src/lib/ai/match-photos-to-slides.ts` (multi-image input + JSON schema response) | **Same model, same SDK** — extract style spec instead of photo assignments |
| Structured JSON output | `config.responseMimeType: 'application/json' + responseSchema` | `generate-slides.ts`, `match-photos-to-slides.ts`, `editor-actions.ts`, `captions/generate-captions.ts`, `imagen/generate-prompt.ts`, `brand-kit/actions.ts` | **Same pattern** — define `StyleSpec` schema, pass as `responseSchema` |
| Server-side image processing | `sharp@^0.33.5` | `src/lib/photo-treatment/treat.ts` (B&W / duotone presets) | **Same lib** — downscale references to ≤1024px max edge before sending to Gemini |
| Private storage + signed URLs | Supabase Storage `createSignedUploadUrl` | `src/app/api/v1/me/brand-kit/logo-upload-url/route.ts`, `editor-actions.ts` | **Same pattern** — new bucket `slide-references` with per-user RLS |
| Palette extraction (deterministic) | `node-vibrant@^4.0.4` (server-only ≤256×256) | `src/lib/photo-treatment/treat.ts` writing `derived_palette` to `style_overrides` | **Optional cross-check** of Gemini's reported palette (not required, but cheap and useful) |
| Credit ledger (charge-then-refund-on-failure) | `gemini_vision_match` row in `credit_events` (v2.9) | `match-photos-to-slides.ts` | **Same pattern** — new event type `gemini_vision_extract_style` |
| Zod silent-drop at AI ingest | Pattern from v2.7/v2.12 (`safeParse`, drop unknowns) | `src/lib/schemas/slide.ts` | **Same pattern** — silent-drop unknown enum values in `StyleSpec` |

---

## Gemini Vision API — Verified Specs

All facts below verified on **2026-05-10** against:
- https://ai.google.dev/gemini-api/docs/image-understanding (cited "Last updated 2026-05-07 UTC")
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/structured-output
- Context7 `/googleapis/js-genai` v2.0.1 SDK reference

### Model

| Field | Value |
|---|---|
| Model ID | `gemini-2.5-flash` (stable; same model already in production for the app) |
| Vision support | YES (multimodal — text + image input) |
| Structured output | YES — supports `responseMimeType: 'application/json'` + `responseSchema` (and the newer `responseJsonSchema` form) |
| Status | Stable (NOT preview). `gemini-3-flash-preview` exists as of 2026-05 but is preview-only. **Do not adopt for v2.13** — stay on the stable model the rest of the app uses. |

### Image input limits

| Limit | Value | Source |
|---|---|---|
| Max images per request | 3,600 image files | image-understanding docs |
| Supported MIME types | `image/png`, `image/jpeg`, `image/webp`, `image/heic`, `image/heif` | image-understanding docs |
| Token cost — small image | 258 tokens flat if both dims ≤ 384 px | image-understanding docs |
| Token cost — large image | Tiled into 768×768 px tiles, **258 tokens per tile** | image-understanding docs |
| Token-budget control | `media_resolution` parameter caps tokens per image | image-understanding docs |
| Max image size (MB) | Not stated in vision docs; use the SDK inline limit (≤20MB inline base64; use Files API for larger). For v2.13 we cap at 5MB post-downscale via sharp. | — |

### Pricing — `gemini-2.5-flash` (Standard tier, paid)

| Direction | Price |
|---|---|
| Text input | $0.30 / 1M tokens |
| Image input | $0.30 / 1M tokens (charged via the per-image token math above) |
| Output | $2.50 / 1M tokens |

**Per-call cost estimate for v2.13** (worst case, no preprocessing):
- 3 reference slides at 1080×1920 each ≈ 3 × ~6 tiles × 258 tokens = ~4,640 input tokens ≈ $0.0014 input
- ~600-token style-spec JSON output ≈ $0.0015 output
- **Total ≈ $0.003 per style extraction.** Negligible. Even with 10 reference slides (~$0.01), this is nothing.

**With sharp downscale to 768×1366** (1 tile per dim → 2 tiles per slide):
- 3 slides × 2 tiles × 258 = ~1,548 tokens ≈ $0.0005 input + $0.0015 output ≈ **$0.002 / extraction**.

**Decision:** Downscale on the server with `sharp` before the Gemini call. Reduces tokens ~3×, reduces latency, and bounds cost predictably at scale.

### Latency expectations

Live docs do not publish per-image latency. Empirical pattern from the existing `match-photos-to-slides.ts` (8 photos + JSON schema) is sub-10s — that file uses a 10s `Promise.race` timeout with index-order fallback. For v2.13 we adopt the **same 10s timeout pattern** but with no graceful fallback on the style-extract path (it's the whole feature — surface the error and let the user retry). For the apply-style emit path, fall through to a default template if extraction failed earlier.

### Structured output — verified syntax

The SDK supports both `responseSchema` (legacy) and `responseJsonSchema` (newer). The existing app uses `responseSchema`; **stay on it for consistency.**

```typescript
import { GoogleGenAI } from '@google/genai'
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{
    role: 'user',
    parts: [
      { text: 'Extract the visual design template from these slideshow images. Return a structured StyleSpec.' },
      { inlineData: { mimeType: 'image/jpeg', data: base64Image1 } },
      { inlineData: { mimeType: 'image/jpeg', data: base64Image2 } },
      // ... up to N images
    ],
  }],
  config: {
    responseMimeType: 'application/json',
    responseSchema: STYLE_SPEC_SCHEMA, // OpenAPI-subset JSON schema
  },
})

// response.text is guaranteed valid JSON matching the schema
const spec = StyleSpecZod.parse(JSON.parse(response.text)) // belt + suspenders
```

**Schema constraints (verified):**
- Subset of JSON Schema / OpenAPI: `STRING`, `NUMBER`, `INTEGER`, `BOOLEAN`, `ARRAY`, `OBJECT`, `NULL`
- Supports `description`, `enum`, `format`, `minimum`, `maximum`, `required`, `propertyOrdering`
- `Type.OBJECT` cannot be empty — must contain properties
- "API may reject very large or deeply nested schemas. If you encounter errors, try simplifying" — keep StyleSpec ≤ ~3 levels deep

---

## Recommended Stack Additions for v2.13

### Core — required

| Technology | Version | Purpose | Why |
|---|---|---|---|
| `gemini-2.5-flash` | (stable, in use) | Vision LLM for style extraction | Same model already powering the rest of the app — cost-aligned, JSON-mode verified, vision-capable. Zero new vendor risk. |
| `@google/genai` | `^1.46.0` (in use) | SDK | Already in production. No version bump needed for vision — vision API is stable on the version in use. |
| `sharp` | `^0.33.5` (in use) | Pre-vision downscale (≤768px max edge) + JPEG transcode (HEIC/PNG → JPEG@quality=85) | Already in production for v2.9 photo treatment. Server-side processing is the right place — keeps client lightweight, gives us deterministic preprocessing, lets us cap byte size before the Gemini call. |
| `@supabase/supabase-js` | `^2.99.3` (in use) | Signed-URL upload + private bucket storage for reference images | Pattern already proven by `brand-kit/logo-upload-url/route.ts`. New bucket `slide-references`, per-user RLS folder layout. |
| `zod` | (in use) | Validate parsed StyleSpec at the AI-ingest boundary | Same silent-drop pattern from v2.7 / v2.9 / v2.12. Belt-and-suspenders even though Gemini structured output is "guaranteed valid JSON". |

### Supporting — recommended

| Library | Version | Purpose | When to use |
|---|---|---|---|
| `node-vibrant` | `^4.0.4` (in use) | Deterministic palette extraction from each reference as a cross-check on Gemini's reported palette | Optional. Cheap. If Gemini's palette wildly disagrees with Vibrant's dominant colors, log a warning + reconcile (Vibrant wins on raw color; Gemini wins on semantic role assignment like "accent"). |
| `nanoid` (in use) | — | Generate unique reference upload IDs | Standard pattern — same as elsewhere in the app. |

### Storage layout — new

**New Supabase Storage bucket:** `slide-references` (private)
- Path layout: `{user_id}/{ref_set_id}/{slide_index}.jpg`
- RLS: identical pattern to `slide-backgrounds-treated` from v2.9 (per-user folder access)
- Retention: `pg_cron` job deletes ref sets older than **30 days** (same pattern as `slide-backgrounds-treated` 7-day retention; longer here because users may want to re-extract from the same uploads)

**New table:** `public.style_specs`
- `id uuid PK`, `user_id uuid FK`, `ref_set_id text` (groups uploads), `spec jsonb` (the StyleSpec), `created_at`, `extraction_model text` (default `'gemini-2.5-flash'`), `version int` (start at 1 for forward compat)
- RLS: owner-only read/write
- Phase plans should propose this; do not pre-bake.

---

## Image Preprocessing — Decision

**Question:** Do we need client-side downscale/transcode before sending to vision (cost/latency)?

**Answer:** **No client-side preprocessing.** All preprocessing on the server with `sharp`. Rationale:

1. **HEIC handling.** iPhone screenshots default to HEIC. Gemini supports HEIC, but Safari is the only browser that can decode HEIC client-side reliably. Doing the transcode on the server with sharp = consistent across browsers.
2. **Determinism.** Server-side sharp pipeline is byte-identical regardless of client. Important for the cache pattern below.
3. **Existing pattern.** v2.9 already does server-side sharp for photo treatment. Same architecture, new caller.
4. **Cost is already trivial.** $0.002–$0.01 per extraction (see Gemini pricing math above) — preprocessing is about latency and predictability, not cost reduction.

**Sharp pipeline for vision input:**
```typescript
const processed = await sharp(buffer)
  .resize(768, 1366, { fit: 'inside', withoutEnlargement: true }) // 9:16 aware, max 1 tile per dim
  .jpeg({ quality: 85, mozjpeg: true })
  .toBuffer()
// → ~1 tile per image → 258 tokens flat → predictable cost
```

**Cache key:** `sha256(originalBytes + 'v2.13-style-extract-v1')` — store on the `style_specs` row so re-uploading the same images returns the cached spec without a second Gemini call. (Mirror the `treated_image_cache` pattern from v2.9.)

---

## Integration with Existing Gemini Emit Pipeline

The existing emit pipeline (`src/lib/ai/generate-slides.ts`) takes `{ topic, template, ... }` and emits slides. v2.13 changes the contract to: `{ topic, template OR styleSpec, ... }`.

**Two integration paths:**

1. **Full emit path** (user types new topic, references uploaded → AI generates copy in extracted style):
   - Run vision extraction → produce `StyleSpec`
   - Pass `styleSpec` to `generate-slides.ts`. Inside the generator:
     - Use `styleSpec.palette`, `styleSpec.fontPair`, `styleSpec.decorationLanguage` to override `template` defaults at the prompt-building stage
     - Continue to use the existing v2.12 `decorations[]` emit path — `styleSpec.decorationLanguage` becomes the prompt addendum
     - The output Slide schema does not change; only the `template_id_override` + `style_overrides.derived_palette` + `decorations[]` fields are populated from the spec
   - **No new renderer work.** Spec → existing schema → existing renderers.

2. **Apply-style-only path** (user pastes their own copy, references uploaded → AI re-styles their copy without re-writing):
   - Run vision extraction → produce `StyleSpec`
   - New, narrower function `apply-style-spec.ts` that takes `{ userSlides, styleSpec }` and only runs the prompt-builder + decoration-emit half of `generate-slides.ts`
   - Skips the hook/body generation entirely — user's text is canonical

Both paths produce slides that pass through the same v2.11/v2.12 editor flow. No changes to the editor itself for v2.13.

---

## Alternatives Considered

| Recommended | Alternative | Why not the alternative |
|---|---|---|
| `gemini-2.5-flash` | `gemini-2.5-pro` | Pro is ~10× more expensive ($1.25 / $10 vs $0.30 / $2.50 per 1M). Style extraction is a vision-pattern-matching task, not a deep-reasoning task — Flash is more than capable. Pro also has higher latency. Match the model the rest of the app uses. |
| `gemini-2.5-flash` | `gemini-3-flash-preview` | Preview status. The app does not run preview models in production. Re-evaluate after Gemini 3 Flash hits stable. |
| `gemini-2.5-flash` | Claude Sonnet 4.5 vision / GPT-4o vision | Adding a second vision provider means: second SDK, second API key in env, second rate limit to manage, second billing surface, second prompt-tuning loop. Memory: project explicitly chose Gemini over Claude for cost. No reason to revisit. |
| `sharp` server-side | Browser canvas downscale | HEIC support + determinism + reuse of existing v2.9 pipeline. Browser path adds complexity for zero benefit at the volumes we're targeting (single-user uploads, not bulk ingest). |
| Supabase signed-URL upload | Direct base64 POST to a server action | Server actions on Vercel have a 4MB request body cap (default) and a 60s timeout. Multi-image uploads at 5MB each would breach both. Signed-URL upload puts the bytes directly in Storage; server only reads them after upload. Same pattern as logo-upload. |
| `responseSchema` (in use) | `responseJsonSchema` (newer SDK API) | Both work and produce identical results. Existing app uses `responseSchema` in 5 places. Consistency wins. Migrate later if the SDK deprecates the older form. |
| Persist StyleSpec in `style_specs` table | Persist inside the project's `style_overrides` jsonb | StyleSpec is upstream of any project (a reference set may produce many projects). It needs its own row + retention lifecycle + RLS. Embedding in `style_overrides` couples extraction lifetime to project lifetime, which is wrong. |
| `node-vibrant` cross-check | Trust Gemini's palette unconditionally | Gemini may name a near-black as "deep navy" or vice-versa. Vibrant gives us ground truth on RGB values; Gemini gives us role labels. Combining both is more accurate than either alone. Vibrant is already installed; ~50ms server-side. |

---

## What NOT to Add (Project-Specific Anti-List)

These look attractive but should be skipped for v2.13:

| Avoid | Why | What to do instead |
|---|---|---|
| **A separate vision provider** (Anthropic / OpenAI / Replicate vision models) | Gemini 2.5 Flash already handles this. Adding a second provider doubles operational surface (auth, rate limits, billing, error handling, prompt drift). Memory: project chose Gemini for cost. | Stay on `gemini-2.5-flash`. |
| **`gemini-3-flash-preview`** | Preview models are not allowed in production paths. App-wide policy (no preview models in prod). | Re-evaluate when GA. |
| **A dedicated image-feature-extraction microservice** (e.g., a Python FastAPI sidecar with PIL / OpenCV / CLIP embeddings) | Massively over-engineered. The app is a Next.js + Supabase monolith. Adding a second runtime/deployment doubles infra cost for a feature whose entire compute fits in one Gemini call. | One server action that calls `sharp` then `ai.models.generateContent`. |
| **A dedicated CV library on the server** (`opencv4nodejs`, `@tensorflow/tfjs-node`, ONNX runtime) | Same reasoning. Gemini's vision IS the CV. We don't need to bolt on classical CV for a "what does this slide look like" task. | Trust the LLM. |
| **An embeddings-based style search** (CLIP / `@xenova/transformers` / Pinecone / Supabase pgvector for "find similar templates") | This is a *style transfer* feature, not a *style search* feature. We're extracting from the user's references, not retrieving similar references from a corpus. Embedding store is a different product. | Skip entirely until/unless the explicit feature shifts. |
| **Server-side "render template" for Gemini to compare against** (re-render existing templates, send both ref + render to Gemini, ask "which is closest?") | Sounds clever; in practice it's a 30s round trip and Gemini can already infer the design language directly from the references. | Direct extraction. |
| **A new Storage bucket per user** | RLS-on-folder pattern is what the app already uses. Per-user buckets create a Supabase quota problem. | One `slide-references` bucket, per-user folders, folder-prefix RLS. |
| **Files API (Gemini)** for ref uploads | Files API caps and lifecycle (48-hour TTL) introduce a second source of truth alongside Supabase Storage. We already have private storage with signed URLs and RLS. Inline base64 (post-sharp downscale ~50KB/image) is well under the 20MB inline limit and far simpler. | Inline `inlineData` after sharp downscale. |
| **A queue / background worker for style extraction** (Inngest, Vercel Cron, BullMQ, etc.) | A single Gemini vision call returns in under 10s. The user is sitting at the page waiting. Pre-existing pattern: server action + 10s timeout. | Synchronous server action + spinner UI. Reuse `Promise.race` timeout pattern from `match-photos-to-slides.ts`. |
| **Image upload via Server Action with `formData`** | 4MB body limit + 60s timeout on Vercel. Multi-slide uploads will hit the cap. | Signed-URL upload pattern from `brand-kit/logo-upload-url/route.ts`. |
| **A "style version control" feature** (StyleSpec history, diffs, branches) | Pre-PMF wedge. We don't even know yet if users want a single style extracted once. | Single `style_specs` row per `ref_set_id`. Replace, don't version. |
| **`zod-to-json-schema`** library to auto-derive Gemini's `responseSchema` from a Zod schema | Adds a dep and a build-time transform for negligible value — Gemini's schema subset doesn't 1:1 match Zod (no unions, no transforms, no refinements). Hand-write the Gemini schema next to the Zod schema; tests guard parity. | Hand-author both. |
| **Streaming response** (`ai.models.generateContentStream`) | Style extraction is a single structured JSON blob. Streaming a JSON blob you can't use until it's complete adds complexity for zero UX gain. | Plain `generateContent`. |

---

## Installation

**Nothing to install.** All required packages are already in `package.json`:

```bash
# Already present — verified 2026-05-10
@google/genai@^1.46.0
@supabase/supabase-js@^2.99.3
sharp@^0.33.5
node-vibrant@^4.0.4
zod  # (already in use across schemas)
```

**Migrations required (Phase plan should author):**
- New Supabase Storage bucket `slide-references` (private, owner RLS)
- New table `public.style_specs` (RLS owner-only)
- New `pg_cron` job: `delete_old_style_references` (30-day retention)
- New credit-event type: `gemini_vision_extract_style` (charge-then-refund-on-failure pattern from v2.9)

---

## Version Compatibility

| Package | Status | Notes |
|---|---|---|
| `@google/genai@^1.46.0` | OK | Vision API stable on this line. `responseSchema` syntax stable. No bump needed. |
| `sharp@^0.33.5` | OK | Stable for HEIC + JPEG; same version powering v2.9 photo treatment. |
| `@supabase/supabase-js@^2.99.3` | OK | `createSignedUploadUrl` stable. |
| Vercel runtime | Node 20+ | Sharp + Gemini SDK both Node 20+. App is on Node 20 (verified by deploy logs). |

---

## Phase Implications for Roadmapper

This stack analysis suggests the milestone splits cleanly into 3–4 phases:

1. **Phase A — Reference Upload + Storage:** New `slide-references` bucket + `style_specs` table + signed-URL upload server action + retention cron. Mirrors the v2.4 `hero-thumbnails` and v2.9 `slide-backgrounds-treated` storage patterns. No AI work. Smallest, lowest-risk phase.

2. **Phase B — Vision Extraction Service:** `src/lib/ai/extract-style-spec.ts` + StyleSpec Zod schema + Gemini `responseSchema` + sharp preprocessing pipeline + caching layer + credit ledger event. Mirrors the `match-photos-to-slides.ts` shape exactly (same SDK call shape, same timeout pattern, same charge-then-refund). Heaviest phase, but every primitive is well-trodden.

3. **Phase C — Apply Style to New Content:** Wire StyleSpec into `generate-slides.ts` (full emit path) + new `apply-style-spec.ts` (apply-only path). Both produce slides that pass through the existing v2.11/v2.12 editor unchanged.

4. **Phase D — UI + Editor Handoff:** Reference-upload UI on the new-project flow; "Style applied" indicator in the editor right rail; manual QA. UI-only phase.

**No phase needs deeper research** — every dependency is verified-in-production. The Phase B research surface is the StyleSpec schema design itself, which is a domain question (FEATURES.md scope), not a stack question.

---

## Sources

| Source | URL / ID | Date verified | Confidence | Used for |
|---|---|---|---|---|
| Gemini image understanding docs | https://ai.google.dev/gemini-api/docs/image-understanding | 2026-05-10 (page cited "Last updated 2026-05-07 UTC") | HIGH | Image limits, MIME types, token math, `media_resolution` |
| Gemini pricing | https://ai.google.dev/gemini-api/docs/pricing | 2026-05-10 | HIGH | $0.30 / $0.30 / $2.50 per 1M for `gemini-2.5-flash` |
| Gemini structured output | https://ai.google.dev/gemini-api/docs/structured-output | 2026-05-10 | HIGH | `responseSchema` support on `gemini-2.5-flash`, schema constraints |
| Gemini models overview | https://ai.google.dev/gemini-api/docs/models | 2026-05-10 | HIGH | `gemini-2.5-flash` stable; `gemini-3-flash-preview` preview-only |
| `@google/genai` SDK reference | Context7 `/googleapis/js-genai` v2.0.1 | 2026-05-10 | HIGH | `inlineData` + `responseMimeType` + `responseSchema` SDK shape |
| Existing app code | `/src/lib/ai/match-photos-to-slides.ts` | 2026-05-10 (read directly) | HIGH | Confirmed app already does multi-image input + JSON schema response with same SDK; pattern to mirror |
| Existing app code | `/src/app/api/v1/me/brand-kit/logo-upload-url/route.ts` | 2026-05-10 (read directly) | HIGH | Confirmed `createSignedUploadUrl` is the in-house upload pattern |
| Project memory | `.claude/.../MEMORY.md` (Gemini cost decision) | 2026-05-10 | HIGH | Reaffirms Gemini-over-Claude policy |
| `package.json` | `/package.json` | 2026-05-10 (read directly) | HIGH | Confirmed `@google/genai@^1.46.0`, `sharp@^0.33.5`, `node-vibrant@^4.0.4`, `@supabase/supabase-js@^2.99.3` all present |

---

*Stack research for: vision-based style extraction (v2.13)*
*Researched: 2026-05-10*
*Confidence: HIGH*
