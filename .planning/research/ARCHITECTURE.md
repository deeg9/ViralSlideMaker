# Architecture Research: v2.9 Viral Visual Quality Integration

**Domain:** Visual-quality upgrades to an existing Satori + React dual-renderer carousel pipeline
**Researched:** 2026-05-01
**Confidence:** HIGH for the parity invariant and Satori-CSS-via-resvg constraints (Context7 + GitHub issue verified). MEDIUM for build-order — the FEATURES.md research is running in parallel, so the exact set of treatments isn't final yet, but the integration shape below holds for any reasonable subset.

> **Verdict up front:** The existing pipeline can absorb every viral pattern under consideration WITHOUT redesign. The 9-layer DOM stack already has the right shape; the schema-shape (`overlays[]`, `backgroundMode`, `text_boxes[]`, `style_overrides`) already has the right joints. What's missing is a **server-side photo-treatment stage** between "background URL acquired" and "background URL persisted on the slide." Add that one stage and almost every visual treatment becomes a template-config change. The two parked experiments (`match-photos-to-slides`, `stylize-image`) both fit cleanly — but stylize-image conflicts with the deterministic photo-treatment stage and should be reframed as a one-shot user action, not a build-block.

---

## Standard Architecture

### System Overview — current pipeline + v2.9 insertions

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          AI GENERATION (server)                             │
│                                                                              │
│  generate-slides.ts ──► Gemini 2.5 Flash ──► Zod parse ──► legacyToTextBoxes│
│   (system prompt +      (responseSchema)      (validate-     (Phase 51       │
│    aiVoiceNote per                            slides.ts +     adapter at     │
│    template)                                  typo gate)      ingest         │
│                                                              boundary)       │
│                          ▲                                                   │
│                          │  topic, slideCount, templateId                    │
└──────────────────────────┼───────────────────────────────────────────────────┘
                           │ slide.image_query (per slide)
                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                       BACKGROUND ACQUISITION (server)                       │
│                                                                              │
│   Pexels.search(image_query)         OR  Imagen 4.0-fast    OR  user upload │
│           │                               (generate-image.ts)        │       │
│           ▼                                       ▼                  ▼       │
│      pexels URL                          Supabase Storage URL                │
│                                                                              │
│   ◄═════════════════════════ NEW v2.9 INSERTION ═══════════════════════════►│
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │   src/lib/photo-treatment/treat.ts (NEW)                              │ │
│   │   Deterministic, idempotent transform pipeline:                       │ │
│   │   1. fetch(sourceUrl) → Buffer                                        │ │
│   │   2. sharp() ─► resize 1080×1920 cover                                │ │
│   │           ─► optional: greyscale() | duotone(LUT) | linear(...)       │ │
│   │           ─► optional: extractDominantColor() (sharp.stats / Vibrant) │ │
│   │   3. cacheKey = SHA-256(sourceUrl + treatmentSpec)                    │ │
│   │   4. Storage: slide-backgrounds-treated/<userId>/<cacheKey>.png       │ │
│   │   5. Return { treatedUrl, dominantHexes[5], treatmentApplied }        │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│           │                                                                  │
│           ▼                                                                  │
│      slide.background_url ← treatedUrl   (replaces raw URL)                 │
│      slide.style_overrides.derived_palette ← dominantHexes (NEW field)      │
│      slide.style_overrides.treatment_applied ← spec hash (NEW field)        │
└────────────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    DUAL RENDERER (parity-locked)                            │
│                                                                              │
│   src/lib/render/resolve-overlay.ts  ◄══ SINGLE SOURCE OF TRUTH ══►         │
│            ▲                                              ▲                  │
│            │                                              │                  │
│   render-slide-satori.tsx                       slide-preview.tsx           │
│   (Server, Satori → SVG → resvg-js → PNG)       (Client, React DOM)         │
│            │                                              │                  │
│            └─────────── 9-layer DOM stack ────────────────┘                  │
│              1. photo (full-bleed <img>)                                     │
│              2. tint overlay (overlayColor × overlayOpacity)                 │
│              3. bottom-card (image-with-bottom-card mode only)               │
│              4. template overlays[] (chip / counter / mid pill / free)       │
│              5. hook text                                                    │
│              6. body text                                                    │
│              7. custom_images[]                                              │
│              8. brand watermark                                              │
│              9. forced free-tier watermark                                   │
│                                                                              │
│   ◄═════════════════════════ NEW v2.9 LAYERS ══════════════════════════════►│
│              1.5  grain/noise overlay (template.grainMode, NEW)              │
│              2.5  vignette / radial darken (template.vignette, NEW)          │
│              4.5  type-as-image hero treatment (extends overlays[])          │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status | Touched in v2.9? |
|-----------|----------------|--------|------------------|
| `src/lib/ai/generate-slides.ts` | Gemini text gen + adapter | Existing | YES — extend prompts only when FEATURES research demands |
| `src/lib/ai/match-photos-to-slides.ts` | Vision-based photo→slide assignment | **Parked** | KEEP (commit + wire into upload flow) |
| `src/lib/imagen/generate-image.ts` | Imagen 4.0-fast prompt-to-image | Existing | Possibly swap model (config-only) |
| `src/lib/imagen/stylize-image.ts` | Photo restyle via gemini-2.5-flash-image-preview | **Parked** | DEFER (see §9 Verdict) |
| `src/lib/photo-treatment/treat.ts` | **NEW** — sharp-based B&W/duotone/contrast + dominant-color extract | **NEW** | YES — primary v2.9 component |
| `src/lib/render/templates/index.ts` | Template registry + schema | Existing | YES — extend `SlideTemplate` schema |
| `src/lib/render/templates/validate.ts` | Fail-fast registry validator | Existing | YES — add new-field validators |
| `src/lib/render/resolve-overlay.ts` | **PARITY-CRITICAL** shared resolver | Existing | YES — extend with new layer renderers |
| `src/lib/render/render-slide-satori.tsx` | Server Satori path | Existing | YES — consume new layers from resolver |
| `src/components/slides/slide-preview.tsx` | Client React preview | Existing | YES — mirror new layers from resolver |
| `src/lib/render/load-font.ts` | Font buffer loader (Google Fonts TTF) | Existing | YES — extend catalog for new typography |
| `src/lib/types/slide.ts` | Slide / TextBox types | Existing | Additive: `style_overrides.derived_palette`, `treatment_applied` |
| `supabase/migrations/v29_*.sql` | **NEW** — `slide-backgrounds-treated` bucket + (optional) `photo_treatments` cache table | **NEW** | YES |

---

## Recommended Project Structure (additions only)

```
src/
├── lib/
│   ├── photo-treatment/          # NEW — visual asset transforms
│   │   ├── treat.ts              # Public entry: treatPhoto(url, spec) → { treatedUrl, palette }
│   │   ├── transforms.ts         # Pure sharp pipelines: greyscale, duotone, contrast-bump
│   │   ├── palette.ts            # Dominant-color extraction (sharp.stats + LUT mapping)
│   │   ├── cache.ts              # SHA-256 cache key + Storage probe (HEAD before transform)
│   │   └── treat.test.ts         # Pure-pipeline tests with fixture buffers
│   ├── render/
│   │   ├── resolve-overlay.ts    # Existing — extended with renderGrain, renderVignette, renderTypeAsImage
│   │   └── templates/
│   │       ├── index.ts          # SlideTemplate extended: grainMode?, vignette?, photoTreatment?, paletteMode?
│   │       └── <new-templates>.ts# 1-3 new templates per FEATURES research
│   ├── ai/
│   │   ├── generate-slides.ts    # Existing — possibly extend prompts per template aiVoiceNote
│   │   └── match-photos-to-slides.ts  # KEEP (commit), wire into upload flow
│   └── imagen/
│       ├── generate-image.ts     # Existing — model upgrade is a string change
│       └── stylize-image.ts      # KEEP file, DO NOT wire into v2.9 default path (§9)
├── app/
│   └── (dashboard)/project/[id]/
│       ├── actions.ts            # Existing — add server action: treatBackground (per-slide)
│       └── editor-actions.ts     # Existing — extend regenerateBackground to pipe through treat()
└── components/
    └── editor/
        └── photo-treatment-controls.tsx  # NEW — opt-in B&W toggle, contrast slider per slide
```

### Structure Rationale

- **`src/lib/photo-treatment/`:** New top-level lib because it's used by **three** call paths (initial generation, "regenerate background," manual user toggle in the editor). Putting it under `imagen/` would tie it to AI image gen specifically; it should also process Pexels and user uploads.
- **No new `src/lib/render/` files for grain/vignette layers:** They're cheap CSS-only effects (radial-gradient masks, repeating PNG noise tile). Add them as new exported render helpers within `resolve-overlay.ts` so the parity invariant stays automatic — both renderers import from the same module.
- **`treat.test.ts` not template-render tests:** Photo-treatment is pure (Buffer-in, Buffer-out). Render parity is covered separately (§8).

---

## Architectural Patterns

### Pattern 1: Pre-Bake at Storage, Not at Render

**What:** Photo treatments (B&W, duotone, contrast bump) execute server-side via `sharp` BEFORE the URL is written to `slide.background_url`. Renderers see only the already-treated URL and treat it as opaque pixels.

**When to use:** Any treatment that can't round-trip identically through both Satori and React DOM. This is most of them — see §2.

**Why:** Verified via Context7 + [vercel/satori#573](https://github.com/vercel/satori/issues/573):
- Satori "supports" CSS `filter` per the README, but **the SVG output of `filter: grayscale(1)` does NOT survive resvg-js rasterization to PNG**. Filter-via-CSS is silently lost on the server path.
- React DOM honors all CSS filters natively.
- Net: if we put `filter: grayscale(1)` on the `<img>` layer, the editor preview would be B&W and the exported PNG would be color — a TPLREND-05 zero-drift parity violation, the exact bug class v2.7 Phase 45 was built to prevent.

**Trade-offs:** Storage cost (one extra PNG per treatment per slide), one-time CPU cost (sharp is ~50ms for a 1080×1920 transform), idempotent so cache makes it free on regeneration. Wins: byte-identical Satori/React parity, instant client render (no client-side wasm or canvas), and treatments work for `<img>` tags whose underlying URLs Satori never inspects.

**Example:**

```typescript
// src/lib/photo-treatment/treat.ts
import sharp from 'sharp'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type TreatmentSpec = {
  mode: 'none' | 'bw' | 'duotone' | 'contrast-bump'
  duotoneShadow?: string  // hex, only when mode === 'duotone'
  duotoneHighlight?: string
  contrastBoost?: number   // 0-50, only when mode === 'contrast-bump'
}

export interface TreatedPhoto {
  treatedUrl: string
  palette: string[]        // top 5 dominant hex colors
  treatmentApplied: string // SHA-256 of (sourceUrl + spec) — idempotency key
}

export async function treatPhoto(
  userId: string,
  sourceUrl: string,
  spec: TreatmentSpec,
): Promise<TreatedPhoto> {
  const cacheKey = createHash('sha256')
    .update(sourceUrl + JSON.stringify(spec))
    .digest('hex')

  const supabase = createAdminClient()
  const path = `${userId}/treated/${cacheKey}.png`

  // 1. HEAD probe: skip work if already cached.
  const { data: existing } = await supabase.storage
    .from('slide-backgrounds-treated')
    .list(`${userId}/treated`, { search: `${cacheKey}.png` })
  if (existing && existing.length > 0) {
    const { data } = supabase.storage
      .from('slide-backgrounds-treated').getPublicUrl(path)
    // Palette still needed — re-extract from cached buffer or store sidecar JSON.
    // Recommend: store palette JSON next to PNG at <cacheKey>.json.
    return { treatedUrl: data.publicUrl, palette: await loadPalette(path), treatmentApplied: cacheKey }
  }

  // 2. Fetch + transform.
  const res = await fetch(sourceUrl)
  let pipeline = sharp(Buffer.from(await res.arrayBuffer()))
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })

  if (spec.mode === 'bw') {
    pipeline = pipeline.greyscale()
  } else if (spec.mode === 'contrast-bump') {
    pipeline = pipeline.linear(1 + (spec.contrastBoost ?? 15) / 100, -((spec.contrastBoost ?? 15) / 2))
  } else if (spec.mode === 'duotone') {
    // Duotone: greyscale → tint(highlight) → tint(shadow) on dark pixels.
    // sharp.tint() applies a single tint; for true duotone use .recomb() with a 3x3 LUT.
    pipeline = pipeline.greyscale().tint({ r: 0xa8, g: 0xe0, b: 0xb0 /* example */ })
  }

  const treated = await pipeline.png({ quality: 90 }).toBuffer()
  const palette = await extractPalette(treated)

  // 3. Upload + sidecar palette.
  await supabase.storage.from('slide-backgrounds-treated').upload(path, treated, { contentType: 'image/png' })
  await supabase.storage.from('slide-backgrounds-treated').upload(
    `${userId}/treated/${cacheKey}.json`,
    Buffer.from(JSON.stringify({ palette })),
    { contentType: 'application/json' },
  )

  const { data: pub } = supabase.storage.from('slide-backgrounds-treated').getPublicUrl(path)
  return { treatedUrl: pub.publicUrl, palette, treatmentApplied: cacheKey }
}
```

### Pattern 2: New Layers Land in `resolve-overlay.ts`, Not in Renderers

**What:** Any new visual layer (grain, vignette, type-as-image hero) is added as an exported helper in `src/lib/render/resolve-overlay.ts`. Both `render-slide-satori.tsx` and `slide-preview.tsx` import that helper and place it in the same DOM order.

**When to use:** Always — this is the TPLREND-05 invariant. v2.7 Phase 45 ratified this pattern; v2.9 must extend it, not bypass it.

**Trade-offs:** None. The cost is one extra exported function per layer; the benefit is automatic parity. The alternative (separate Satori vs React implementations) is the exact failure mode the resolver was built to prevent.

**Example:**

```typescript
// src/lib/render/resolve-overlay.ts (additions)

export function renderGrain(intensity: 'subtle' | 'medium' | 'strong'): React.ReactNode {
  // Tile a static noise PNG (in /public/textures/grain-medium.png) at low opacity.
  // Both Satori and resvg handle <img> with repeated tiling via inline-style background-image
  // OR via an explicit absolutely-positioned <img>. Satori prefers the latter.
  const opacityMap = { subtle: 0.04, medium: 0.08, strong: 0.14 } as const
  return React.createElement('img', {
    src: `/textures/grain-${intensity}.png`,  // Satori needs absolute URL via origin prepend in server
    style: {
      position: 'absolute',
      top: 0, left: 0,
      width: CANVAS.W, height: CANVAS.H,
      objectFit: 'cover',  // Or set to a tile via repeating-linear-gradient as backup
      opacity: opacityMap[intensity],
      pointerEvents: 'none',
    },
  })
}

export function renderVignette(strength: number /* 0-1 */): React.ReactNode {
  // Pure CSS — radial-gradient is supported in BOTH Satori and React DOM.
  // No filter, no backdrop-filter, no mix-blend-mode. Just an absolutely positioned
  // div with a radial-gradient backgroundImage. Verified Satori-supported via Context7.
  return React.createElement('div', {
    style: {
      position: 'absolute',
      top: 0, left: 0,
      width: CANVAS.W, height: CANVAS.H,
      backgroundImage: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: 'none',
    },
  })
}
```

### Pattern 3: Schema-Additive Template Extensions, Not New Fields on Slides

**What:** New visual treatments are **template config**, not slide config. The slide stays simple (text + background URL); the template carries `grainMode`, `vignette`, `photoTreatment`, etc. This means switching templates re-applies the visual treatment automatically.

**When to use:** For treatments that should be template-aesthetic decisions. Per-slide overrides go through `style_overrides` (existing pattern).

**Trade-offs:** Limits per-slide flexibility, but that's intentional — viral carousels read as a *set* with consistent treatment, not as 7 unrelated images. Per-slide override is still possible via `style_overrides.photo_treatment` for power users.

**Example schema extension:**

```typescript
// src/lib/render/templates/index.ts (additions)
export interface SlideTemplate {
  // ... existing fields ...

  /** v2.9: opt-in noise/grain overlay above the photo (layer 1.5). */
  grainMode?: 'none' | 'subtle' | 'medium' | 'strong'

  /** v2.9: radial vignette darkens edges (layer 2.5). 0-1, 0 = off. */
  vignette?: number

  /** v2.9: server-applied photo treatment baked into background_url at gen time. */
  photoTreatment?: TreatmentSpec  // imported from photo-treatment/treat.ts

  /** v2.9: how to derive accent colors. 'fixed' = use accentColor verbatim;
      'palette-dominant' = pick from slide.style_overrides.derived_palette. */
  paletteMode?: 'fixed' | 'palette-dominant'
}
```

### Pattern 4: AI-Driven Layout = Template Selection, Not Per-Slide Composition

**What:** "AI chooses layout per slide" is implemented as **AI chooses `slide.style_overrides.layout`** (existing field for cover/body) and/or **AI chooses `slide.template_id_override`** (new field). The composition layers stay in templates; AI just picks which template-flavored layout each slide uses.

**When to use:** For variation across slides in a single carousel — first slide hook-frame, middle slides body-heavy, CTA slide stripped-down.

**Trade-offs:** Less flexibility than freeform per-slide composition, but **massively** simpler to implement, debug, and parity-test. Freeform per-slide composition would essentially require a third renderer that can interpret arbitrary layout JSON; that's out of scope for pre-PMF.

**Schema addition:**

```typescript
// src/lib/types/slide.ts (additive)
export interface Slide {
  // ... existing fields ...

  /** v2.9: per-slide template override. When present, the renderer
      uses getTemplate(template_id_override) instead of project.template_id.
      Validates against template registry at slide-load. */
  template_id_override?: string
}
```

The AI prompt then emits `template_id_override` as a string from a closed enum. Validation runs at `validateAndRepair` time (existing) — unknown IDs get stripped to `undefined` (graceful fallback to project default).

---

## Data Flow

### Generation flow (with v2.9 photo-treatment stage inserted)

```
User submits topic + template choice
    │
    ▼
generate-slides.ts ──► Gemini ──► validateAndRepair ──► CarouselWithTextBoxes
    │                              (typo gate, length caps, segments)
    ▼
For each slide:
  ┌──► slide.image_query ──► pexels.search() OR Imagen ──► sourceUrl
  │
  ▼
  ◄════ NEW v2.9 ════►
  treatPhoto(userId, sourceUrl, template.photoTreatment)
    │
    ▼
  { treatedUrl, palette, treatmentApplied }
    │
    ├── slide.background_url ← treatedUrl
    ├── slide.style_overrides.derived_palette ← palette
    └── slide.style_overrides.treatment_applied ← treatmentApplied (cache key)

  ▼
Persist to projects.slide_data (Supabase)
```

### Editor edit flow (when user changes treatment)

```
User toggles "Black & White" on slide 3
    │
    ▼
editor-actions.ts: updateSlideTreatment(slideIdx, { mode: 'bw' })
    │
    ▼
treatPhoto(userId, slide.original_source_url, { mode: 'bw' })
    │ ◄── NEW slide field: original_source_url (untreated, stable across treatment changes)
    ▼
{ treatedUrl, palette, treatmentApplied }
    │
    ▼
slide.background_url ← treatedUrl  (saved via existing per-slide PATCH path)
```

> **Critical schema note:** Add `slide.original_source_url` so re-treatment doesn't compound (treating a B&W image again produces nothing new; treating a contrast-bumped image to B&W loses fidelity). Always treat from the original.

### Render flow (unchanged in shape, layers added)

```
ImageResponse({ buildSlideElement(slide, template, brandKit, tier, origin, ctx) })
    │
    ▼
buildSlideElement assembles JSX:
    1.   <img src={slide.background_url}> ← already-treated URL (opaque to renderer)
    1.5  ◄ NEW renderGrain(template.grainMode) if set
    2.   tint <div>
    2.5  ◄ NEW renderVignette(template.vignette) if set
    3.   bottom-card <div> if backgroundMode === 'image-with-bottom-card'
    4.   template.overlays?.map(...)
    4.5  ◄ NEW type-as-image hero (extends overlays via new content-type 'type-hero')
    5.   hook <div>
    6.   body <div>
    7.   slide.custom_images?.map(...)
    8.   brand watermark
    9.   forced free-tier watermark
    │
    ▼
Satori → SVG → @resvg/resvg-js → PNG buffer → ZIP

(React preview path: same JSX shape via slide-preview.tsx, same import from resolve-overlay)
```

---

## Question-by-Question Answers

### 1. New layers in the 9-layer DOM stack

**Add as new layers in `resolve-overlay.ts` exports, not as overlay schema extensions.**

| Visual treatment | Layer slot | Implementation | Satori-safe? |
|------------------|------------|----------------|--------------|
| Grain/noise overlay | **1.5** (above photo, below tint) | Tiled PNG `<img>` at `/public/textures/grain-{intensity}.png`, low opacity | YES — `<img>` + `opacity` are core Satori |
| Vignette / radial darken | **2.5** (above tint, below bottom-card) | `<div>` with `backgroundImage: radial-gradient(...)` | YES — verified via Context7 |
| Type-as-image hero | **4.5** (extends `overlays[]` with new content-type) | New `OverlayContent.type = 'hero-text'` with `fontSize: 240`, fills slot | YES — uses existing overlays infra |
| Per-word color animations | N/A — out of scope (we render PNG, not video) | — | — |
| Halftone / dot pattern | Treat as photo-treatment (Pattern 1), bake server-side | sharp doesn't have halftone built in; use `sharp.composite` with a tile | Bake server-side |
| Inline diagonal text rotation | `transform: rotate(...)` on the hook `<div>` | Existing `transform` support | YES — verified Context7 |

**Schema extensions, in order of risk:**

- **LOW risk (schema-additive):** `template.grainMode`, `template.vignette`, `template.photoTreatment`, `template.paletteMode`. All optional; existing 5 legacy + 3 premium templates leave them undefined → zero behavior change.
- **LOW risk:** Extend `OverlayContent` discriminated union with new variant `{ type: 'hero-text'; field: 'hook_text'; fontSize: number }`. The validator in `validate.ts` gets a new branch; existing templates unaffected.
- **NO** new `backgroundMode` is needed for v2.9. The three existing modes (`color`, `image-bleed`, `image-with-bottom-card`) plus `grainMode` + `vignette` cover the visual surface area. Reserve a 4th mode only if FEATURES research surfaces a layout that's geometrically incompatible with the current three.

### 2. Photo-treatment pipeline

**Decision: Server-side `sharp`, baked into Storage at slide-generation time. Idempotent cache by SHA-256 of `(sourceUrl, treatmentSpec)`.**

**Why not Satori CSS filters:** Verified via [vercel/satori#573](https://github.com/vercel/satori/issues/573) and [Context7 docs](https://context7.com/vercel/satori/llms.txt) — Satori "supports" `filter` syntactically, but the SVG output (using `<feGaussianBlur>`, `<feColorMatrix>`) frequently fails to round-trip through `@resvg/resvg-js` rasterization. **Even if Satori emits the right SVG primitives, resvg-js drops or mis-renders them.** This is the v2.7 Phase 45 issue class — Satori claims support, resvg silently disagrees, and the React preview becomes the source of drift.

**Why not on-demand at render time:** Render is invoked once per slide download (free) but also once per editor preview thumbnail update. Caching the treatment buffer in a server transform is essentially free; recomputing on every render burns CPU and slows the editor.

**Why sharp specifically:**
- Already in the lockfile (transitive dep of `@vercel/og` / Next.js image optimization).
- `greyscale()`, `linear()` for contrast, `recomb()` for duotone, `tint()` for color overlays, `composite()` for halftone tiling, `stats()` for dominant color — all native, all fast, all deterministic.
- Same library Vercel uses internally; well-tested at scale.

**New table or new bucket?**
- **New Storage bucket:** `slide-backgrounds-treated` (public, like `slide-backgrounds`). Path: `{userId}/treated/{sha256}.png` + `{userId}/treated/{sha256}.json` (palette sidecar).
- **No new Postgres table needed for v2.9.** The cache is purely Storage-keyed. If FEATURES research demands cross-slide treatment reuse (e.g. "I treated this Pexels photo for slide 1, slide 4 picked the same Pexels photo, share the treated asset"), then add a `photo_treatments` table with `(source_url, spec_hash, treated_url, palette JSONB)` as a global cache. Defer until needed.
- **Slide schema additions** (additive, optional): `slide.original_source_url`, `slide.style_overrides.derived_palette: string[]`, `slide.style_overrides.treatment_applied: string`. All optional; legacy slides keep working.

### 3. Dominant-color extraction

**Decision: Co-locate extraction with photo treatment. Extract once when transform runs; persist palette as Storage sidecar JSON + on the slide row in `style_overrides.derived_palette`.**

**Where:**
- Inside `treatPhoto()`. After `sharp.png().toBuffer()`, call `sharp(buffer).stats()` (returns per-channel mean/stddev) OR use `node-vibrant` (proper LUT-based palette).
- Recommendation: start with `sharp.stats()` — it's already a dep, returns dominant in ~5ms. Switch to `node-vibrant` only if FEATURES research demands actual perceptual color clustering.

**When:** At generation time (same trip as the transform). If the user uploads a custom photo mid-edit, extraction runs again as part of the same `treatPhoto()` call.

**Storage:** Persisted in two places for two access patterns:
1. `slide.style_overrides.derived_palette: string[]` (5 hex strings) — fast read at render time, no extra fetch.
2. `slide-backgrounds-treated/{userId}/treated/{sha256}.json` — sidecar for cache reuse (when multiple slides share a sourceUrl, the second slide skips re-extraction).

**Consumed at render time** by `template.paletteMode === 'palette-dominant'`: a new resolver helper picks `derived_palette[0]` as the effective `accentColor` (overriding `template.accentColor`). Both Satori and React preview read the same field via the resolver — parity automatic.

### 4. AI-driven layout / composition

**Decision: NOT per-slide freeform composition. Two-tier approach:**

1. **Per-slide template override** (new field `slide.template_id_override`): AI emits this as a closed enum from the template registry. Each slide can pick a different template. Lets AI decide "slide 1 = magazine-bold for hook, slides 2-6 = documentary for body, slide 7 = bold-yellow for CTA."

2. **Per-slide layout variant within a template** (extend existing `slide.style_overrides.layout`): The AI already emits `layout: 'cover' | 'body'` for news templates. Generalize to a closed enum per template (e.g. magazine-bold offers `layout: 'hero' | 'detail' | 'cta'`).

**Why not freeform:**
- A new "composition layer" in the schema means: AI emits arbitrary JSON describing layouts, both renderers must interpret it identically, validation gets exponentially harder, parity tests multiply. That's a v3+ project.
- The two-tier approach delivers ~80% of the perceived variety with ~5% of the engineering cost.

**Implementation:**
- Add `slide.template_id_override?: string` to `Slide`. Validate at `validateAndRepair` against the template registry; unknown IDs stripped (graceful fallback). Renderer: `const effectiveTemplate = getTemplate(slide.template_id_override ?? project.template_id)`.
- Extend the AI response schema with `template_id_override: z.string().optional()`. Add a new `system-prompt` clause: "When the carousel topic suggests a hook-frame style for slide 1 and a calmer pace for body slides, you may emit `template_id_override` to vary slides. Choose from: [enum]."

### 5. Typography upgrades

**Constraints to respect:**
- **Satori font registration is mandatory.** Every font used on the server must be loaded as ArrayBuffer and passed via `ImageResponse.fonts`. Currently done in `loadFontBuffersForSlide()` via the Google Fonts CSS-API trick (User-Agent spoof for TTF instead of woff2).
- **Variable fonts are NOT explicitly supported.** Verified via Context7 — Satori README does not mention variable fonts; community reports say they sometimes work for specific axes but render unreliably for opsz/wght axes simultaneously. **Recommendation: continue treating fonts as discrete weight/style variants. No variable fonts in v2.9.**
- **Custom user-uploaded fonts are out of scope for v2.9.** They'd require a font-storage bucket, MIME validation, license verification, and Storage→ArrayBuffer plumbing. None of that is on the critical path for visual quality. Defer.

**What v2.9 SHOULD do:**
1. **Expand the font catalog** in `src/lib/fonts/font-catalog.ts` with 10-15 hand-picked viral-aesthetic Google Fonts (Anton, Bebas Neue, Archivo Black, Playfair Display, Editorial New, etc.). The catalog is already the source of truth for `loadFontBuffersForSlide()`.
2. **Type-as-image hero treatments** are NOT custom fonts — they're large-fontSize hook text rendered through the existing typography path. Implementation is template config (`hookFontSize: '180px'`) + new layout variant. Zero font-system changes.
3. **Per-segment font variants** (e.g. one word in italic Editorial New, the rest in Anton): existing `TextSegment` schema can be extended with `seg.font?: string`. Loader needs to walk all segment fonts to know what to register. Add this only if FEATURES research demands it.

**Flow through both renderers:**
- React preview: directly uses `fontFamily` CSS — Google Fonts loaded via existing `<link>` tags in the editor shell.
- Satori: `loadFontBuffersForSlide()` walks `template.fontFamily`, `template.headingFontFamily`, `slide.text_boxes[].font_family` (NEW — currently walks only legacy fields), and `seg.font` (if added). All variants fetched from Google Fonts CSS API.

### 6. AI image quality upgrades

**Decision: Model swap is a one-line config change in `generate-image.ts`. Backwards compat is automatic — old slides have URLs to PNGs already in Storage; the model used to generate them is irrelevant to the renderer.**

**Where the swap happens:**
```typescript
// src/lib/imagen/generate-image.ts
const response = await ai.models.generateImages({
  model: 'imagen-4.0-fast-generate-001',  // ← change this string
  // ...
})
```

**Models to consider (FEATURES research will confirm best pick):**
- `imagen-4.0-generate-001` (full-quality, ~2.5x cost of fast — likely worth it for v2.9)
- `imagen-4.0-ultra-generate-001` (top-quality, ~10x cost — only if research shows it materially beats 4.0)
- Alternative: `gemini-2.5-flash-image-preview` (the model `stylize-image.ts` uses — multimodal, can take photo refs)

**Backwards compat:** Zero work. Old slides reference Storage URLs that are immutable. The model identifier is not stored on the slide — only the resulting PNG URL is. If we want to track which model generated which URL for debugging, add `slide.style_overrides.image_model: string` (additive, optional, never read by renderer).

**Coupling with photo-treatment:** Imagen output URLs go through `treatPhoto()` like any other source URL. `imagen-4.0` + `photoTreatment: { mode: 'bw' }` works exactly like `pexels` + `photoTreatment: { mode: 'bw' }`.

### 7. Build order — explicit dependencies

**Critical-path dependencies:**

```
                  ┌──────────────────────────────────────────────┐
                  │ A. Photo-treatment infra (sharp pipeline +    │
                  │    Storage bucket + cache)                    │
                  └──────────────┬───────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
    ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐
    │ B. Schema +     │  │ C. Editor toggle │  │ D. Dominant-   │
    │    template     │  │    (B&W on/off   │  │    color       │
    │    field exts   │  │    per slide)    │  │    extraction  │
    └────────┬────────┘  └──────────────────┘  └───────┬────────┘
             │                                          │
             ▼                                          ▼
    ┌─────────────────┐                        ┌────────────────┐
    │ E. New layers   │                        │ F. paletteMode │
    │    in resolve-  │                        │    consumer in │
    │    overlay.ts   │                        │    resolver    │
    │    (grain,      │                        └───────┬────────┘
    │    vignette,    │                                │
    │    type-hero)   │                                │
    └────────┬────────┘                                │
             │                                         │
             ▼                                         ▼
    ┌─────────────────┐                        ┌────────────────┐
    │ G. New          │ ◄──── depends on E + F ┤                │
    │    templates    │                        │                │
    │    (1-3 per     │                        │                │
    │    FEATURES)    │                        │                │
    └────────┬────────┘                        │                │
             │                                                  │
             ▼                                                  │
    ┌─────────────────┐                                         │
    │ H. AI prompt    │                                         │
    │    addenda      │                                         │
    │    (aiVoiceNote │                                         │
    │    + per-slide  │                                         │
    │    template     │                                         │
    │    override)    │                                         │
    └────────┬────────┘                                         │
             │                                                  │
             ▼                                                  ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ I. Parity tests (snapshot Satori PNG ↔ React DOM markup)    │
    │    Required gate before milestone-complete.                  │
    └─────────────────────────────────────────────────────────────┘
```

**Recommended phase ordering:**

1. **Phase 54 — Photo-Treatment Foundation (A + D):** sharp pipeline, `treat.ts`, Storage bucket migration, palette sidecar, idempotent cache. Pure server-side, zero renderer changes. Tests with fixture buffers. **Gates everything else.**
2. **Phase 55 — Schema + Template Extensions (B):** Extend `SlideTemplate` (`grainMode`, `vignette`, `photoTreatment`, `paletteMode`), `Slide` (`original_source_url`, `style_overrides.derived_palette`, `treatment_applied`, `template_id_override`). Update validators. Generation pipeline writes treated URL + palette. Existing 8 templates pass through unchanged.
3. **Phase 56 — New Render Layers (E + F):** Add `renderGrain`, `renderVignette`, `renderTypeHero`, palette consumer to `resolve-overlay.ts`. Wire into both `render-slide-satori.tsx` and `slide-preview.tsx`. Snapshot tests on the resolver. No new templates yet — verify via existing 8 with feature flags.
4. **Phase 57 — New Templates (G):** 1-3 new templates per FEATURES research. Each template registers in `templates/index.ts` and validates at module load. Thumbnail generation via `npm run thumbs` (existing pipeline).
5. **Phase 58 — Editor Toggle (C):** UI surface for per-slide treatment override. Wires into existing editor-actions PATCH path. Re-treats from `original_source_url` when changed.
6. **Phase 59 — AI Prompt Tuning (H):** `aiVoiceNote` for new templates, `template_id_override` enum in response schema, premium-tier addendum updates if needed.
7. **Phase 60 — Parity QA (I):** Render-grid test (every template × representative slide → both renderers → assert DOM order + key style values match). Manual visual audit per FEATURES checklist.

**Parallelizable:**
- A + B can be done in one phase if scoped tightly.
- D can be folded into A (extract palette inside `treat.ts`).
- C and H are independent of each other.

**Cannot parallelize:**
- Anything that touches `resolve-overlay.ts` MUST land before new templates (G) consume those layers.
- AI prompt updates (H) MUST come after new templates exist (G) — the prompt references template IDs.

### 8. Two-renderer parity testing

**Existing infrastructure we should reuse:**
- `src/lib/render/resolve-overlay.test.ts` — pure-function tests for the resolver (already exists). Extend with new helper tests.
- `src/components/slides/__tests__/slide-preview.selection.test.tsx` — DOM snapshot smoke. Pattern works; extend.
- `src/lib/render/templates/validate.test.ts` — template registry validator. Extend with new field validators.

**New test infra needed:**

1. **`src/lib/render/__tests__/parity.test.tsx` (NEW)** — for each new layer (grain, vignette, type-hero), assert:
   - Resolver helper returns identical React element structure when called with the same args (snapshot).
   - When invoked from both `buildSlideElement` (Satori) and `<SlidePreview editable={false}>` (React) with the same slide+template+ctx, the resulting JSX trees have the same DOM order, same keys, same critical CSS values (`backgroundColor`, `opacity`, `position`, `top/left/right/bottom`, `width/height`).
   - **What we don't snapshot:** computed pixel values that diverge intentionally (Satori uses numeric pixels, React uses percentages). Test against the resolver-computed values, not the renderer-final values.

2. **`scripts/render-parity-grid.ts` (NEW)** — opt-in script (not in CI): renders every template × 3 sample slides through both renderers, pixel-diffs the React DOM screenshot vs the Satori PNG, flags drift > 2px or color delta > 5. Runs locally before milestone audits. Surfaces silent Satori-CSS-not-honored bugs (the v2.7 Phase 45 issue class).

3. **`src/lib/photo-treatment/__tests__/idempotency.test.ts` (NEW)** — for each `TreatmentSpec`, treat the same fixture buffer twice; assert byte-identical output AND identical SHA-256 cache key.

**What NOT to test:**
- Don't snapshot full DOM trees of `slide-preview` — they're too big and brittle. Test the resolver outputs (small, pure) and the renderer's *consumption* of them.
- Don't render PNGs in CI — slow and flaky. Save for the manual `render-parity-grid.ts` invocation.

### 9. Verdict on parked experiments

**`src/lib/ai/match-photos-to-slides.ts` — VERDICT: COMMIT and wire in.**

- Architecture fit: clean. Runs at the upload boundary (user uploads N photos, AI assigns them to slides by content). Output is `(string | null)[]` — a per-slide photo URL or null. Plugs into the existing slide-generation pipeline trivially: assigned URL becomes `sourceUrl` for `treatPhoto()`.
- v2.9 fit: directly improves visual quality (right photo on right slide instead of arbitrary order). Low risk — graceful fallback to index-order if the model fails or returns garbage.
- **Recommended phase:** Fold into Phase 56 or Phase 58. Surfaced via the existing `image-picker-panel.tsx` "auto-match" affordance.

**`src/lib/imagen/stylize-image.ts` — VERDICT: KEEP file, DO NOT promote to default v2.9 path.**

- Architecture conflict: This restyles a USER PHOTO via `gemini-2.5-flash-image-preview`. The output is a brand-new generated image — non-deterministic, non-cacheable by content hash (the same input + prompt produces visually different output run-to-run), and it competes with `treatPhoto()` for the "transform a user's photo" slot.
- **Why deterministic photo treatment beats generative restyling for v2.9:**
  - Cacheable: SHA-256(url + spec) → fixed asset. Stylize: every run is unique, no cache.
  - Predictable: B&W is B&W. Stylize: "make it look like watercolor" can produce 7 wildly different images across 7 slides, breaking visual cohesion.
  - Cheap: sharp local CPU. Stylize: 1 credit + Gemini API latency per call.
  - Reversible: keep `original_source_url`, re-treat. Stylize: original is one of many AI outputs.
- **Architectural conflict:** If both stages run, `treatPhoto(stylized_url)` becomes the slide's `background_url`. But `original_source_url` would point to the stylized output (already AI-modified), so "B&W toggle off" reverts to the stylized image, not the user's actual photo. Confusing; either we add `slide.user_original_url` (truly original) AND `slide.original_source_url` (AI-restyled) AND `slide.background_url` (treated) — three URLs per slide for one image — or we declare these features mutually exclusive.
- **Recommendation:** Defer stylize-image to a post-v2.9 milestone as a one-shot user-invoked action ("✨ Restyle this photo with AI" button), separate from the photo-treatment pipeline. Keep the file in the repo, do not commit it as part of v2.9 default flow, do not run it during initial generation.
- **If FEATURES research surfaces "viral carousels lean heavily on AI-restyled imagery" as a quality blocker:** revisit. The plumbing change is small — feed `stylized_url` as `sourceUrl` to `treatPhoto()` and store `original_source_url = stylized_url`. But this should be an explicit user choice, not a default in the gen pipeline.

---

## Anti-Patterns

### Anti-Pattern 1: CSS Filter on `<img>` for B&W / contrast / duotone

**What people do:** `<img style={{ filter: 'grayscale(1) contrast(1.2)' }}>` to make the editor preview B&W.
**Why it's wrong:** Verified silently fails in the Satori → resvg-js path ([vercel/satori#573](https://github.com/vercel/satori/issues/573)). Editor preview shows B&W; downloaded PNG is full color. This is the EXACT class of bug the TPLREND-05 invariant exists to prevent.
**Do this instead:** Pre-bake the B&W PNG via sharp at upload/generation time. The renderer never sees a "color" image; both renderers see only the already-treated URL.

### Anti-Pattern 2: Per-slide freeform composition JSON

**What people do:** AI emits arbitrary "give me 3 text boxes, an image at 30% width left-anchored, and a colored block at 60% scale rotated 12deg" JSON. Renderer interprets it.
**Why it's wrong:** Effectively requires inventing a Figma-lite layout language. Both renderers must interpret it identically. Validation explodes. Parity testing multiplies. Pre-PMF over-engineering.
**Do this instead:** AI picks from a closed enum of templates and per-template layout variants. Variation comes from template diversity, not freeform composition.

### Anti-Pattern 3: Variable fonts via Satori

**What people do:** Register a single variable-font TTF and let Satori interpolate weights/widths at render time.
**Why it's wrong:** Satori README does not mention variable fonts. Community reports show inconsistent behavior — some axes work, others render at the file's default. The font-catalog system was built to register specific (weight, style) variants because that's what Satori reliably handles.
**Do this instead:** Register discrete variants per (weight, style) pair. Treat each weight as its own font in the catalog. v2.9 typography wins come from font *selection* (Anton, Bebas Neue, Editorial New), not from variable-font interpolation.

### Anti-Pattern 4: Skipping the resolver for "just one quick layer"

**What people do:** Add a grain `<img>` directly inside `render-slide-satori.tsx` without going through `resolve-overlay.ts` because "it's just one layer."
**Why it's wrong:** This is how the v2.7 Phase 45 invariant was broken before being established. The next person adds it to `slide-preview.tsx` slightly differently, opacity drifts, parity is gone.
**Do this instead:** Every new layer is a function exported from `resolve-overlay.ts`. Both renderers import. If a layer is "too dynamic" to live in the resolver, that's a sign it shouldn't exist as a layer — promote it to template config or photo treatment.

### Anti-Pattern 5: Treating Imagen-generated images twice

**What people do:** `imagen.generate()` → `treatPhoto(imagen_url, { mode: 'bw' })`, then user toggles treatment off → fall back to imagen_url, but the new toggle "contrast bump" runs on the raw imagen output AGAIN and we double-bump.
**Why it's wrong:** Re-treatment compounds. B&W of B&W is fine; contrast-bump of contrast-bumped is broken.
**Do this instead:** Always treat from `original_source_url` (immutable across treatment changes). Editor server action: `treatPhoto(slide.original_source_url, newSpec)`, never `treatPhoto(slide.background_url, newSpec)`.

---

## Integration Points

### External Services

| Service | Integration pattern | v2.9 changes |
|---------|---------------------|--------------|
| Pexels | URL fetched → passed to `treatPhoto()` | Same; URL becomes `original_source_url` |
| Imagen 4.0 | URL fetched → passed to `treatPhoto()` | Possible model swap (string change) |
| Gemini 2.5 Flash | Text generation only | `aiVoiceNote` extensions + `template_id_override` schema |
| Gemini 2.5 Flash Image Preview | Restyle (parked) | Defer; not on v2.9 critical path |
| Supabase Storage `slide-backgrounds` | Existing bucket for raw uploads/Imagen | Unchanged |
| Supabase Storage `slide-backgrounds-treated` | **NEW** bucket for treated outputs + palette sidecars | New migration |
| Google Fonts CSS API | Font TTF fetching for Satori | Catalog grows; mechanism unchanged |

### Internal Boundaries

| Boundary | Communication | v2.9 impact |
|----------|---------------|-------------|
| AI gen → background acquisition | `slide.image_query` string | Unchanged |
| Background acquisition → photo treatment | `sourceUrl` string + `template.photoTreatment` spec | **NEW boundary** |
| Photo treatment → renderer | `treatedUrl` string + `palette` array on slide | **NEW write** |
| Resolver → Satori | Same JSX shape, `React.createElement` | Unchanged |
| Resolver → React preview | Same JSX shape, JSX | Unchanged |
| Editor → server action `treatBackground` | Per-slide PATCH with `treatment` field | **NEW** server action |
| Validator → AI response | Zod schema strict-parse | Schema gains `template_id_override` enum |

---

## Scaling Considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| 0-1k carousels treated | Current pattern fine. Cache hit rate is high because templates fix the spec. |
| 1k-10k carousels treated | Storage cost ~5-10x raw photo cost (1 treated PNG per template per Pexels source per user). Add cron to GC orphaned treated buffers monthly. |
| 10k+ carousels treated | Consider promoting `photo_treatments` to a Postgres table keyed by `(source_url_hash, spec_hash)` for cross-user sharing. Pexels URLs are public; treated outputs from a public source can be shared globally. Cuts storage 10-100x. |

### Scaling priorities

1. **First bottleneck:** sharp CPU at generation time. Generation is already bounded by Gemini latency (~5-10s for 7 slides); adding 50ms × 7 = 350ms of sharp work is noise. No action needed pre-PMF.
2. **Second bottleneck:** Storage bandwidth for treated PNGs. Mitigation: aggressive WebP fallback, but only if FEATURES research shows that's a real cost. Defer.
3. **Third bottleneck (long-tail):** The font-loading path fetches 5+ Google Fonts variants per slide render. Already cached in-process. If render volume spikes, add a Storage-backed font cache. Not a v2.9 concern.

---

## Sources

- [Vercel Satori README on GitHub](https://github.com/vercel/satori/blob/main/README.md) — confirmed `filter` listed as supported, but no enumeration of which filter functions; explicit limitations listed include no z-index, no calc, no 3D transforms (HIGH confidence)
- [vercel/satori#573 — `filter: blur(...)` doesn't work as expected with Satori + resvg-js](https://github.com/vercel/satori/issues/573) — confirms filter properties fail in resvg-js rasterization path (HIGH confidence; this is the single most important finding driving Pattern 1 above)
- [Context7: /vercel/satori library docs](https://context7.com/vercel/satori/llms.txt) — flexbox, transforms, gradients (linear+radial), text-shadow, border-radius all confirmed; conic-gradient and backdrop-filter not listed; mask-image listed (HIGH confidence)
- [vercel/satori#41 — Throw an error when CSS property or Tailwind API is not supported](https://github.com/vercel/satori/issues/41) — discussion enumerates many unsupported properties including backdrop-filter (MEDIUM confidence — issue thread, not authoritative)
- [resvg/resvg CHANGELOG](https://github.com/strigeus/resvg_srv/blob/master/CHANGELOG.md) — resvg supports SVG primitives `<feGaussianBlur>` and `<feColorMatrix>` natively; the gap is between Satori's CSS-filter emission and what resvg expects in SVG (MEDIUM confidence)
- Existing codebase inspection (HIGH confidence): `src/lib/render/resolve-overlay.ts` (parity-critical resolver), `src/lib/render/render-slide-satori.tsx` (server path), `src/components/slides/slide-preview.tsx` (client path), `src/lib/render/templates/{index,validate,magazine-bold}.ts`, `src/lib/render/load-font.ts`, `src/lib/types/slide.ts`, `src/lib/ai/{generate-slides,schemas,match-photos-to-slides}.ts`, `src/lib/imagen/{generate-image,stylize-image}.ts`
- [.planning/PROJECT.md](file:///Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/.planning/PROJECT.md) — current state: v2.8 shipped, v2.9 research-driven, parked experiments listed, sunset deferred (HIGH confidence)
- [.planning/research/archive-pre-v2.9/ARCHITECTURE.md](file:///Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/.planning/research/archive-pre-v2.9/ARCHITECTURE.md) — prior MCP-server architecture research; informed the "service layer + adapter" pattern reused above (HIGH confidence)

---
*Architecture research for: v2.9 Viral Visual Quality integration*
*Researched: 2026-05-01*
