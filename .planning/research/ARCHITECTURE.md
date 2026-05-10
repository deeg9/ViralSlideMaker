# Architecture Patterns — v2.13 Style-from-Reference Generation

**Domain:** Vision-extracted "style spec" from N reference slideshow images, fed into the existing Gemini emit pipeline (or a new style-only transform endpoint) to produce a `Slide[]` carousel that mimics the reference's full design template (palette, type, layout, decoration patterns, slide-to-slide structure) with user-supplied or AI-generated content.
**Researched:** 2026-05-10
**Overall confidence:** HIGH (codebase inspection of `src/lib/types/slide.ts`, `src/lib/ai/generate-slides.ts`, `src/lib/ai/schemas.ts`, `src/lib/services/carousel.ts`, `src/lib/render/templates/{magazine-bold,validate}.ts`, `src/lib/storage/upload-image.ts`, `supabase/migrations/20260504_fork_strip_decoration_locked.sql`. Every integration point enumerated against the actual files.)

---

## TL;DR (the 5 decisions)

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | **Style spec shape** | **(b) Separate `StyleSpec` type** — independent of `Slide`. Captures palette / typography / layout-rhythm / decoration-language / surface-treatment / per-slot copy-density. Renders **into** `Slide[]` via the emit pipeline; never IS a `Slide`. |
| 2 | **Storage** | **(a) `style_spec` JSONB column on `projects`** — same row as `slide_data`. + `reference_assets jsonb` co-located (URLs only). NO separate `style_specs` table — pre-PMF, shareability comes for free via the existing publish/fork pipeline. |
| 3 | **Emit integration** | **NEW endpoint pair under `src/lib/ai/`** — `extract-style-spec.ts` (vision call, idempotent) + `generate-from-style-spec.ts` (text-only call, replaces `generateSlideContent` callsite when a spec is present). Existing `generateSlideContent` left untouched. Single new orchestration entry: `generateCarouselFromReferences()` in `src/lib/services/carousel.ts`. |
| 4 | **Style-only path** | **Same emit pipeline, different content-source flag.** `generate-from-style-spec.ts` accepts `mode: 'ai-copy' \| 'user-copy'`; when `'user-copy'`, the user-supplied lines are passed as `slides[].hook_text/body_text` and Gemini is asked to **structure** them (segments, bold runs, role assignment, layout/decoration mapping) but not to invent copy. |
| 5 | **Reference uploads** | **Persisted via the existing `slide-backgrounds` bucket** (public, per-user folder), URLs stored in `projects.reference_assets`. Re-extraction is cheap (vision call), so persistence is for **provenance + remix**, not caching. |

**Build order:** Schema/migration → Vision-extraction endpoint → Emit-integration → UI → Remix/Fork. (Five phases; details in §Phase Sequence.)

---

## Recommended Architecture

### High-level picture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CLIENT (Next.js editor)                                                 │
│                                                                          │
│   1. New "Style from reference" launcher                                 │
│      ↓                                                                   │
│   2. Upload 1..N reference PNG/JPG  ─┐                                   │
│   3. (optional) Paste user copy      │  Server Action                    │
│   4. Submit                          │  generateCarouselFromReferences() │
└──────────────────────────────────────┴───────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  SERVER (services + ai layers)                                           │
│                                                                          │
│  src/lib/services/carousel.ts                                            │
│   └─ generateCarouselFromReferences(supabase, userId, input)             │
│        │                                                                 │
│        ├─ uploadReferenceAssets()       ── Supabase Storage              │
│        │     reference-images bucket → returns { url, sha256 }[]         │
│        │                                                                 │
│        ├─ extract-style-spec.ts         ── Gemini 2.5 Flash (vision)     │
│        │     extractStyleSpec(urls[])  → StyleSpec                       │
│        │     • triple-layer silent-drop (mirror v2.12 AI ingest)         │
│        │     • returns canonical Zod-validated StyleSpec                 │
│        │                                                                 │
│        ├─ persist:  projects.reference_assets + projects.style_spec      │
│        │                                                                 │
│        ├─ generate-from-style-spec.ts   ── Gemini 2.5 Flash (text)       │
│        │     generateFromStyleSpec(spec, contentSource) → Carousel       │
│        │     • spec-driven prompt scaffolding                            │
│        │     • mode: 'ai-copy'   → AI invents hook/body                  │
│        │     • mode: 'user-copy' → AI structures user lines              │
│        │                                                                 │
│        ├─ image fetch (existing) ── Pexels OR Imagen OR none             │
│        │     • spec.imagery.treatmentPreset hints duotone/bw upstream    │
│        │                                                                 │
│        └─ persist slide_data + style_spec_id pointer back to projects    │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  RENDERER (unchanged)                                                    │
│   • Both renderers consume Slide[] exactly as they do today              │
│   • style_spec is NEVER read by the renderer — it's emit-side only       │
│   • TPLREND-05 invariant: zero new fields on Slide                       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key principle:** the StyleSpec is a **pre-emit contract** — it lives between vision and text generation, never touches the renderer. Once `slide_data` is populated, the spec is metadata (provenance) — every slide is fully self-describing via the existing v2.12 schema.

---

## Q1 — Style Spec Schema (chosen: (b) separate `StyleSpec` type)

### Decision

Define a new TypeScript type `StyleSpec` in `src/lib/types/style-spec.ts`. It is **NOT a `Slide`**, **NOT a discriminator on `Slide`**, **NOT** an extended `SlideTemplate`. It is a separate emit-side artifact whose fields map onto Slide fields via the `generate-from-style-spec.ts` projector.

### Why not (a) snapshot of a fully-realized first slide?

- A first-slide snapshot conflates **content-bearing** fields (`hook_text`, `body_text`, `image_query`) with **style-bearing** fields (palette, fonts, decorations). The vision LLM should NOT be returning topic-specific copy — that's the job of the downstream text generator.
- Multi-slide reference uploads (1..N) need to capture **slide-to-slide rhythm** (cover/reframe/support/pivot/close cadence), which a single-slide snapshot can't represent.
- A snapshot would require pattern-matching at consumer time — fragile, hard to test.

### Why not (c) direct override on `Slide`?

- Violates **TPLREND-05 byte-identity**: any new style field on `Slide` must be readable by both renderers, and would need byte-identity test coverage. The whole point of the spec is to be **upstream of the renderer**.
- Bloats every slide row in storage with redundant style data (palette repeated N times per project).
- Forking a slide would carry style baggage that the new template might re-resolve.

### Why (b)?

- **Single source of truth** for the design template, rendered once into N slides at emit time.
- **Renderer-agnostic** — survives v2.13+ template additions without schema migrations on `Slide`.
- **Composable** with v2.12 decorations + v2.9 palette extraction + v2.7 premium overlays without re-touching any of those modules.
- **Testable**: you can unit-test the projector (`StyleSpec → Slide[]`) independently of vision extraction.

### Concrete shape (proposed)

```ts
// src/lib/types/style-spec.ts
//
// v2.13: Vision-extracted "style spec" from 1..N reference images.
// Lives in projects.style_spec (JSONB), populated by extract-style-spec.ts,
// consumed by generate-from-style-spec.ts, never read by either renderer.
// Shape mirrors existing concepts (closed enums where possible) so the
// projector can map fields 1:1 to Slide / SlideStyleOverrides / Decoration.

export type StyleSpecVersion = 1  // bump on breaking shape change

export interface StyleSpec {
  spec_version: StyleSpecVersion
  // Provenance — useful for "why does my carousel look like this?" debugging
  source: {
    reference_image_urls: string[]   // Supabase Storage URLs (provenance only)
    extracted_at: string             // ISO timestamp
    model: string                    // 'gemini-2.5-flash'
    sha256: string                   // hash of (sorted urls + spec_version) — re-extract cache key
  }

  // ─── 1. Palette ─────────────────────────────────────────────────────
  palette: {
    background: string               // hex; primary surface color
    text_primary: string             // hex; main text on background
    text_secondary?: string          // hex; muted body text
    accent: string                   // hex; the "pop" color (replaces template.accentColor)
    surface?: string                 // hex; secondary card/chip background
    extracted_dominant?: string[]    // hex[]; up to 6 dominant colors (mirror node-vibrant)
  }

  // ─── 2. Typography ──────────────────────────────────────────────────
  // Closed-enum from existing font catalog (src/lib/fonts/) — vision LLM
  // emits the named token, server resolves to the nearest available family.
  typography: {
    hook: {
      font_family: string            // resolved family name (e.g. 'Anton' / 'Plus Jakarta Sans')
      font_weight: number            // 400..900
      case: 'upper' | 'normal' | 'title'
      size_band: 'sm' | 'md' | 'lg' | 'xl'   // resolves to px in projector
    }
    body: {
      font_family: string
      font_weight: number
      size_band: 'sm' | 'md' | 'lg'
    }
    pairing_strategy: 'mono-display' | 'serif-sans' | 'sans-sans-contrast' | 'ransom-note'
  }

  // ─── 3. Layout / structure ──────────────────────────────────────────
  layout: {
    aspect: '9:16' | '4:5' | '1:1'   // we always emit 9:16; this is observed-not-mandated
    hook_position: 'top' | 'center' | 'bottom' | 'overlap'
    body_position: 'top' | 'center' | 'bottom' | 'paired-with-hook'
    text_align: 'left' | 'center' | 'right'
    body_density: 'sparse' | 'medium' | 'dense'   // ≤8 / ≤20 / ≤40 words
    hook_word_cap: number            // 1..15 — per-slide hook length cap
    body_word_cap: number            // 0..50 — 0 = hook-only slides
    has_page_counter: boolean
    has_topic_chip: boolean
  }

  // ─── 4. Imagery treatment ───────────────────────────────────────────
  imagery: {
    mode: 'photo-bleed' | 'photo-card' | 'no-photos' | 'mixed'
    treatment_preset?: 'bw' | 'duotone-cream' | 'duotone-cobalt' | 'contrast-bump' | 'none'
    grain_intensity?: 'off' | 'subtle' | 'medium' | 'heavy'
    vignette: boolean
  }

  // ─── 5. Decoration language ─────────────────────────────────────────
  // Hints — the projector wires these into Phase 71's decoration emit path.
  decorations: {
    density: 'none' | 'minimal' | 'moderate' | 'heavy'  // 0 / 0-1 / 1-2 / 2-3 per slide
    style: 'geometric' | 'organic' | 'editorial-tag' | 'sticker'
    preferred_lucide: string[]       // up to 8 names from AI_LUCIDE_ALLOWLIST
    preferred_shapes: ('rect' | 'circle' | 'star' | 'arrow')[]
    palette_role: 'accent' | 'palette-vibrant' | 'on-light' | 'on-dark'  // AI_COLOR_TOKENS
  }

  // ─── 6. Slide-to-slide rhythm ───────────────────────────────────────
  // Observed cadence across the N reference slides; consumed by the role
  // assignment in generate-from-style-spec.ts. Lifts v2.9 AIROLE-01 to
  // a per-spec contract instead of a per-template default.
  rhythm: {
    suggested_slide_count: number    // 3..10; clamp to that range
    role_sequence?: ('cover' | 'reframe' | 'support' | 'pivot' | 'close')[]
    // e.g. ['cover', 'support', 'support', 'pivot', 'close']
    layout_per_role?: Record<
      'cover' | 'reframe' | 'support' | 'pivot' | 'close',
      'photo-bleed' | 'photo-card' | 'no-photos'
    >
  }

  // ─── 7. Free-form notes (for AI prompt steering) ───────────────────
  // Vision LLM emits a 1-3 sentence "design vibe" string the text generator
  // gets in the system prompt verbatim. NOT a structured field — just a
  // tone-and-voice carrier (mirrors template.aiVoiceNote pattern from v2.7).
  voice_note: string
}
```

### Example StyleSpec (Murphy Campbell magazine reference)

```json
{
  "spec_version": 1,
  "source": {
    "reference_image_urls": [
      "https://<project>.supabase.co/storage/v1/object/public/reference-images/u_xx/2026-05/abc.png"
    ],
    "extracted_at": "2026-05-10T15:24:00Z",
    "model": "gemini-2.5-flash",
    "sha256": "ab12..."
  },
  "palette": {
    "background": "#000000",
    "text_primary": "#FFFFFF",
    "text_secondary": "#CCCCCC",
    "accent": "#A8E0B0",
    "surface": "rgba(0,0,0,0.6)",
    "extracted_dominant": ["#000000", "#FFFFFF", "#A8E0B0", "#444444"]
  },
  "typography": {
    "hook": { "font_family": "Anton", "font_weight": 400, "case": "upper", "size_band": "xl" },
    "body": { "font_family": "Plus Jakarta Sans", "font_weight": 500, "size_band": "md" },
    "pairing_strategy": "mono-display"
  },
  "layout": {
    "aspect": "9:16",
    "hook_position": "bottom",
    "body_position": "paired-with-hook",
    "text_align": "left",
    "body_density": "medium",
    "hook_word_cap": 12,
    "body_word_cap": 35,
    "has_page_counter": true,
    "has_topic_chip": true
  },
  "imagery": {
    "mode": "photo-bleed",
    "treatment_preset": "bw",
    "grain_intensity": "subtle",
    "vignette": false
  },
  "decorations": {
    "density": "minimal",
    "style": "editorial-tag",
    "preferred_lucide": [],
    "preferred_shapes": ["rect"],
    "palette_role": "accent"
  },
  "rhythm": {
    "suggested_slide_count": 5,
    "role_sequence": ["cover", "support", "support", "pivot", "close"],
    "layout_per_role": {
      "cover": "photo-bleed",
      "reframe": "photo-bleed",
      "support": "photo-bleed",
      "pivot": "photo-bleed",
      "close": "photo-bleed"
    }
  },
  "voice_note": "Tabloid-pitched magazine headlines. Statistics over adjectives. Urgent and confident voice. Mint highlight pills on key phrases."
}
```

### Projector contract (`StyleSpec → Slide[]`)

The projector lives in `generate-from-style-spec.ts` and maps spec → emit-side state. Critically, it **does not invent fields the renderer doesn't already understand** — every output landing on a Slide flows through the existing `Slide` schema, `SlideStyleOverrides`, `Decoration`, and `text_boxes[]`.

| StyleSpec field | Projector output |
|-----------------|------------------|
| `palette.background` | `style_overrides.derived_palette[0]` + Imagen prompt steering |
| `palette.accent` | Maps to a synthetic `template_id_override` resolution — see Q3 |
| `typography.hook.font_family` | `style_overrides.hook_font_family` per slide |
| `typography.body.font_family` | `style_overrides.body_font_family` per slide |
| `typography.hook.case` | Hook text uppercased before insertion (case='upper') |
| `layout.hook_position` | `style_overrides.text_position` (closed enum match) |
| `layout.text_align` | `style_overrides.text_align` |
| `layout.body_density` → caps | Length validation in `validate-slides.ts` (Phase 58 hook_word_cap layered) |
| `imagery.treatment_preset` | Drives sharp pre-bake in `photo-treatment/treat.ts` (existing v2.9 path) |
| `imagery.grain_intensity` | `style_overrides.grain_intensity` |
| `decorations.preferred_lucide` | Restricts Phase 71 `AI_LUCIDE_ALLOWLIST` to the spec subset |
| `decorations.preferred_shapes` | Same — restricts Phase 71 shape enum |
| `decorations.density` | Sets `decorations.maxItems` per slide (0..3) |
| `decorations.palette_role` | Pins Phase 71 `AI_COLOR_TOKENS` choice |
| `rhythm.suggested_slide_count` | Clamps slideCount input (3..10) |
| `rhythm.role_sequence` | Pre-fills `slide.role` so AI can skip role assignment |
| `voice_note` | Verbatim into Gemini system prompt (mirror `template.aiVoiceNote`) |

---

## Q2 — Storage (chosen: (a) JSONB column on `projects`)

### Decision

Two new columns on `public.projects`:

```sql
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS style_spec       jsonb,
  ADD COLUMN IF NOT EXISTS reference_assets jsonb;  -- [{ url, sha256, uploaded_at }]
```

NO separate `style_specs` table. NO ephemeral re-extraction.

### Trade-off matrix

| Option | Cost of re-extraction | Remix support | Shareability | Schema cost |
|--------|----------------------|---------------|--------------|-------------|
| **(a) JSONB on projects** ✓ chosen | Zero — stored once | Native (forks copy spec via RPC) | First-class via `published_carousels` snapshot | 1 column add, no FK, no JOIN |
| (b) Separate `style_specs` table | Zero | Requires JOIN + cascade | First-class as table row | New table + FK + RLS + cascade-delete |
| (c) Ephemeral on request | ~$0.001/extraction × N requests | Impossible (spec lost on save) | Impossible | Zero, but blocks v2.4 fork |

### Why (a) wins for v2.13

- **Pre-PMF discipline.** A separate table is a forward bet on "users want to share style specs as standalone artifacts." Zero validated demand. Defer.
- **Fork RPC compatibility.** v2.4's `fork_published_carousel` already does a deep-copy of `slide_data`. Adding `style_spec + reference_assets` to the JSONB-copy list is a one-line change. A separate `style_specs` table would require RPC redesign (FK rewrite, cascade across published+private snapshots).
- **`published_carousels` snapshot pattern (v2.4) makes shareability free.** When a carousel is published, the snapshot copies `slide_data`; we extend it to copy `style_spec` too. Anyone who forks a published carousel gets the spec in their projects row. Zero new infra.
- **Re-extraction is cheap** (Gemini 2.5 Flash vision call, ~$0.0005). Caching via JSONB persistence is a nice-to-have, not a savings argument.

### Storage shape on projects

```sql
-- Migration: 20260510_add_style_spec.sql (proposed)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS style_spec       jsonb,
  ADD COLUMN IF NOT EXISTS reference_assets jsonb;

-- Legacy projects (pre-v2.13) have NULL — safe (consumers null-check)
-- No backfill, no migration data — additive only (same pattern as v2.12 decorations)

CREATE INDEX IF NOT EXISTS projects_has_style_spec_idx
  ON public.projects ((style_spec IS NOT NULL))
  WHERE style_spec IS NOT NULL;
-- Optional: enables fast filter "show me my style-from-reference projects"
```

### Reference assets bucket

Use a NEW bucket: `reference-images` (parallel to `slide-backgrounds` and `slide-backgrounds-treated`).

```sql
-- Migration: 20260510_reference_images_bucket.sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('reference-images', 'reference-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: per-user folder, mirror slide-backgrounds policies
CREATE POLICY "Users can upload reference images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reference-images');

CREATE POLICY "Public read access for reference images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'reference-images');

CREATE POLICY "Users can delete own reference images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'reference-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

**Public bucket** (not signed-URL) — same as `slide-backgrounds`. Reference images need to be readable by the vision LLM (which calls fetch from Google's side); signed URLs would either need 24h TTL extensions or expose a public-but-obscure path. Public-bucket-with-uuid-folder is the simpler model the codebase already uses.

**No retention cron** in v2.13 — references are provenance, not ephemeral cache. If storage costs balloon post-PMF, add a cron mirroring `20260501_treated_backgrounds_retention_cron.sql`.

---

## Q3 — Emit Integration (chosen: NEW endpoint pair, not modify `generateSlideContent`)

### Decision

Add two new modules under `src/lib/ai/`, leave `generate-slides.ts` untouched:

1. **`src/lib/ai/extract-style-spec.ts`** — vision call, takes `imageUrls[]`, returns `StyleSpec`. Triple-layer silent-drop pattern (mirror v2.12 decorations ingest).
2. **`src/lib/ai/generate-from-style-spec.ts`** — text call, takes `(spec, contentSource)`, returns `CarouselWithTextBoxes` (same return type as `generateSlideContent`).

Add ONE new orchestrator entry in `src/lib/services/carousel.ts`:

3. **`generateCarouselFromReferences(supabase, userId, input)`** — sibling of existing `generateCarousel()`.

### Why NOT extend `generateSlideContent`

- **Conditional-branching anti-pattern.** Adding `if (styleSpec) { ... } else { ... }` to a 331-line module that's already doing 4 things (Gemini call → role distribution → decorations resolution → legacy-to-textboxes adapter) is a maintainability nightmare.
- **Different prompt scaffolding.** Style-spec generation needs the spec inlined as a system-prompt template ("respect this palette / use this voice / restrict decorations to this subset"), which is structurally distinct from the topic-driven prompt in `prompts.ts:buildSystemPrompt`.
- **Different test surface.** `generateSlideContent` is byte-locked by ~50 tests. A spec-aware variant has different failure modes (spec→slide projector errors, palette-mapping errors) that deserve their own test file.
- **Matches v2.9 precedent.** `match-photos-to-slides.ts` was added as a sibling rather than collapsed into `generate-slides.ts` for the same reason — separable concern, separable testability.

### Why a NEW orchestrator (`generateCarouselFromReferences`)

- `generateCarousel()` in `carousel.ts` is the sole creator-of-projects path today. Forking it to a sibling preserves the existing one byte-identical, gives the new path room to breathe, and makes phase boundaries clean.
- **Different inputs:** `{ topic, templateId, slideCount, imageSource }` vs `{ referenceImageUrls, contentSource: { mode, topic?, copy? }, slideCount? }`.
- **Different image-fetch strategy.** Spec dictates `imagery.mode`; if spec says `'no-photos'`, skip Pexels/Imagen entirely (mirror existing `wantsNoPhotos` short-circuit at `carousel.ts:80`).

### Pros / cons table

| Approach | Pros | Cons |
|----------|------|------|
| **NEW endpoint** ✓ chosen | Clean separation of concerns; easy to test; no risk to existing `generateSlideContent`; matches v2.9/v2.7 precedent of "new path for new behavior" | Two AI modules; modest code duplication on prompt-building |
| Extend existing endpoint | One module to maintain | Conditional-branching mess; touches v2.12-audit-passed code; harder to test in isolation; risk of regressing v2.12 decorations emit |

### Module layout (proposed)

```
src/lib/ai/
├── extract-style-spec.ts          ← NEW (vision call)
├── generate-from-style-spec.ts    ← NEW (text call, projector)
├── generate-slides.ts             ← UNCHANGED
├── schemas.ts                     ← MODIFIED (add StyleSpecSchema export)
├── prompts.ts                     ← MODIFIED (add buildStyleSpecPrompt + buildFromSpecPrompt)
├── resolve-ai-decoration.ts       ← UNCHANGED
└── ...

src/lib/services/
├── carousel.ts                    ← MODIFIED (add generateCarouselFromReferences)
└── ...

src/lib/types/
├── style-spec.ts                  ← NEW (StyleSpec interface + version)
├── slide.ts                       ← UNCHANGED (TPLREND-05 invariant)
└── ...
```

---

## Q4 — Style-Only Path (chosen: SAME pipeline, `mode` flag in `generate-from-style-spec.ts`)

### Decision

`generate-from-style-spec.ts` accepts a discriminated input:

```ts
export type ContentSource =
  | { mode: 'ai-copy'; topic: string }                    // user provides topic, AI invents copy
  | { mode: 'user-copy'; lines: { hook: string; body?: string }[] }  // user provides copy, AI structures it

export async function generateFromStyleSpec(
  spec: StyleSpec,
  content: ContentSource,
  slideCount?: number,   // overrides spec.rhythm.suggested_slide_count
): Promise<CarouselWithTextBoxes>
```

**Both modes use the same Gemini call**, just with different system-prompt scaffolding.

### Why same pipeline (not separate `applyStyleSpec` endpoint)

- **Same output contract** (`CarouselWithTextBoxes`). Same downstream wiring (image fetch, save, render).
- **Same v2.12 decorations ingest** — both modes need the resolved decoration emit path; duplicating it means risking divergence.
- **Same `legacyToTextBoxes` adapter** at the boundary.
- **Mode is a prompt-shape concern, not an architectural concern.** `'ai-copy'` says *"invent copy in this style"*; `'user-copy'` says *"keep my copy verbatim, just structure it (segments, role, decoration choice, layout)"*. The Zod-validated response shape is identical.

### Prompt skeleton (illustrative)

```
SYSTEM:
You are styling a TikTok carousel from a provided style spec.

STYLE SPEC:
- Palette: bg=#000 / text=#FFF / accent=#A8E0B0
- Typography: hook=Anton uppercase / body=Plus Jakarta Sans
- Layout: text bottom-aligned, 5 slides, role sequence cover→support→support→pivot→close
- Decorations: minimal density, editorial-tag style, preferred shapes [rect]
- Voice: Tabloid magazine headlines. Statistics over adjectives.

[mode='ai-copy']
USER: Generate 5 slides about: ${topic}

[mode='user-copy']
USER: Structure these 5 lines into slides (do NOT change wording):
1. HOOK="..." BODY="..."
2. HOOK="..."
...
For each, choose: role (from sequence above), text segments (mark accent words for highlight pills),
optional decoration (max 1 from preferred enums), layout slot.
```

### Why NOT a separate `transform` endpoint

- A `transform({style_spec, user_copy[]}) → Slide[]` endpoint that bypasses Gemini entirely would mean **manual structuring** of segments / role / decorations in TS code. That's a worse outcome — Gemini's structuring is the value-add here (it picks which words to highlight, which slide gets the decoration, etc.).
- A second endpoint doubles the prompt-engineering surface; future spec fields would need to be threaded through both.
- The mode flag is the lightweight choice — one Zod input variant, one branch in prompt-building.

---

## Q5 — Upload Pipeline

### Decision

**1..N reference images uploaded via the existing public-bucket pattern**, persisted to `projects.reference_assets` JSONB at carousel-creation time.

### Flow

```
1. Client picks N files (1..N, recommend N≤4 — vision call cost grows linearly)
2. For each file:
     a. Client calls a NEW server action: getReferenceUploadUrl()
        → returns { uploadUrl, publicUrl, path }
     b. Client uploads directly to Supabase Storage (slide-backgrounds bucket-style PUT)
     c. Client computes SHA-256 (or server does on receipt)
3. Client calls generateCarouselFromReferences({ referenceImageUrls: [...], contentSource })
4. Server:
     a. Validates user owns all URLs (path prefix check — userId/.../filename)
     b. Calls extractStyleSpec(urls)
     c. Persists projects row with:
          reference_assets = [{url, sha256, uploaded_at}, ...]
          style_spec = <extracted spec>
          slide_data = <generated carousel>
```

### Why public bucket + URLs (vs base64 inline to Gemini)

- **Vision LLM input.** Gemini 2.5 Flash accepts both base64 and URL — URL is cheaper (no double-upload, smaller request bodies).
- **Provenance.** Persisted URL is the ONLY way to support remix-by-reference (Q7) and "regenerate this carousel" UX.
- **Cost.** Reference images are typically ≤500KB each; the existing `slide-backgrounds` bucket already handles user uploads of similar size.
- **Existing pattern.** `src/lib/storage/upload-image.ts` already implements the per-user-folder bucket pattern. Mirror it in a new `src/lib/storage/upload-reference.ts`.

### Why persist (not ephemeral)

- **Remix UX requires it.** v2.4 Explore + Remix lets one user fork another's carousel. If the original user's references vanish on save, the forker can't see what inspired the design.
- **Re-extraction UX.** "I tweaked the references — regenerate" requires the URLs to still exist.
- **Cost is negligible.** N ≤ 4 images × ~500KB × current user count is rounding-error storage spend.
- **Right-of-publicity guard.** v2.9 deferred `stylize-image.ts` for face-stylize legal risk. Style-from-reference is materially different — we're extracting **palette/typography/layout**, NOT pixel-stylizing the user's face. Persisting the reference does not introduce new legal risk because we never republish the reference (it lives in the user's private project view).

### `reference_assets` JSONB shape

```json
[
  { "url": "https://...supabase.co/.../u_xx/2026-05/abc.png", "sha256": "ab12...", "uploaded_at": "2026-05-10T15:24:00Z" },
  { "url": "https://...supabase.co/.../u_xx/2026-05/def.png", "sha256": "cd34...", "uploaded_at": "2026-05-10T15:24:01Z" }
]
```

Stored as a sibling to `style_spec` so re-extraction can read it without parsing the spec.

---

## Q6 — TPLREND-05 Implications

### Decision

**ZERO new fields on `Slide`.** The style spec is consumed entirely server-side at emit time and only emits values that already round-trip through both renderers.

### Why this is the right call

The v2.12 PTF16 idempotent-absence baseline (73 tests / 48 snapshots across 12 templates × 6 renderer families) was hard-won. Every new field on `Slide` requires:

1. Null-safe iteration in BOTH `render-slide.ts` (React preview) AND `render-slide-satori.tsx` (PNG export)
2. Byte-identity test coverage (PTF-series fingerprint snapshots)
3. Chrome-leak grep gate (PCL-series)
4. Schema-source-grep symmetry gate (PRA-series)
5. Cross-scope isolation regression suite (PRS-series)

**The style spec avoids all of this by being upstream.** The projector (`StyleSpec → Slide[]`) emits values into the existing fields:

| Spec field | Emits into existing Slide field |
|-----------|----------------------------------|
| `palette.accent` | `style_overrides.derived_palette[]` (v2.9 — already covered) |
| `typography.hook.font_family` | `style_overrides.hook_font_family` (v1.3 — already covered) |
| `typography.body.font_family` | `style_overrides.body_font_family` (v1.3 — already covered) |
| `layout.hook_position` | `style_overrides.text_position` (v1.0 — already covered) |
| `layout.text_align` | `style_overrides.text_align` (v1.0 — already covered) |
| `imagery.treatment_preset` | Pre-bake on `background_url` via existing `photo-treatment/treat.ts` (v2.9 — already covered) |
| `imagery.grain_intensity` | `style_overrides.grain_intensity` (v2.9 — already covered) |
| `decorations.preferred_*` | `slide.decorations[]` (v2.12 — already covered) |
| `rhythm.role_sequence` | `slide.role` (v2.9 — already covered, advisory only) |
| `voice_note` | NEVER lands on a Slide; consumed by Gemini system prompt only |

### What about a `template_id_override` for spec-derived templates?

Two options:

**Option A** — Fit the spec to an existing template (e.g. spec maps to `magazine-bold` because palette is dark + accent is mint + hook is Anton uppercase). Use `template_id_override`. **Recommended for v2.13** because zero new template registry work.

**Option B** — Synthesize a new ad-hoc template at emit time. Requires `SlideTemplate` to be runtime-constructable (not just registry-static). Adds significant validator complexity. **Defer to v2.14+** if A proves insufficient.

For v2.13, the projector picks the **closest matching registered template** via a similarity score (palette + font-family + layout dimensions), then layers the spec's `style_overrides` on top per-slide. The template choice is deterministic given the spec.

### TPLREND-05 audit hook

Add **ONE new test** to the PTF-series in v2.13: PTF19 — spec-projection determinism. Given a fixed StyleSpec input, the projector emits a `Slide[]` with deterministic ordering of overrides; render output is byte-identical across two runs. This guards against spec→slide drift WITHOUT touching the renderer-side parity gates.

---

## Q7 — Remix / Fork Flow (chosen: (b) inherit the persisted style spec — DEFAULT, with re-extract option)

### Decision

When a user remixes a published style-from-reference carousel:

- **Default path:** Forker inherits `slide_data` AND `style_spec` AND `reference_assets` (provenance preserved). NO re-extraction. Forker can immediately edit slides, OR optionally click "regenerate from references" to invoke `generateCarouselFromReferences()` again with the same references.
- **Why not (a) re-extract:** Vision calls cost money + add latency to fork. Spec is deterministic from references + model version, so re-extracting on every fork is waste.
- **Why not (c) inherit only slides (no spec carryover):** Loses the ability to "regenerate / iterate" the spec — and that's the killer feature of style-from-reference vs. the existing template flow.

### Fork RPC migration

The existing `_strip_locked_from_slide_data` walks 4 array fields; for v2.13 we need a SECOND helper:

```sql
-- Migration: 20260510_fork_includes_style_spec.sql (proposed)
--
-- v2.13: extend fork_published_carousel + publish_carousel to copy
-- style_spec + reference_assets alongside slide_data.

-- 1. publish_carousel: snapshot style_spec + reference_assets into
--    published_carousels (requires schema change to that table — same pattern
--    as the original snapshot)
ALTER TABLE public.published_carousels
  ADD COLUMN IF NOT EXISTS style_spec       jsonb,
  ADD COLUMN IF NOT EXISTS reference_assets jsonb;

-- 2. CREATE OR REPLACE the publish + fork RPCs to read/write the new columns
--    (one-line additions to existing INSERT...SELECT)

-- 3. NO new locked-stripping needed — style_spec/reference_assets are inert
--    metadata, no per-element ownership flags
```

### Locked stripping NOT required for spec/references

`style_spec` is inert metadata (no `locked` / `groupId` / `hidden` semantics). `reference_assets` is just URLs + sha256 + timestamps. The forker takes ownership trivially — no v2.11/v2.12-style stripping logic needed.

### Reference image URL ownership

When a fork happens:

- Original references stay in the **original user's** Storage folder (`reference-images/u_<original>/...`).
- Forker's `projects.reference_assets` carries the **original URLs** (cross-user reads work because the bucket is public).
- If the forker wants to "re-extract from references they own," they re-upload first, getting URLs in their own folder.
- If the original user deletes their references, the fork's `reference_assets` URLs 404 — but `style_spec` is preserved, so the carousel still renders. Acceptable degradation.

---

## Q8 — Build Order

### Phase sequence (5 phases, dependency-ordered)

| Phase | Name | Deliverable sentence | Touches |
|-------|------|---------------------|---------|
| **1** | **Schema + Storage Foundation** | `StyleSpec` interface defined; `projects.style_spec` + `projects.reference_assets` columns added; `reference-images` bucket created with RLS; legacy projects unaffected (NULL = invisible to v2.13 codepath). | NEW: `src/lib/types/style-spec.ts`. NEW migrations: `20260510_add_style_spec.sql`, `20260510_reference_images_bucket.sql`. NEW Zod: `StyleSpecSchema` in `src/lib/ai/schemas.ts`. |
| **2** | **Vision Extraction Endpoint** | `extractStyleSpec(urls[])` callable from a server action; takes 1..N reference URLs, returns canonical Zod-validated `StyleSpec`; triple-layer silent-drop on malformed Gemini output. | NEW: `src/lib/ai/extract-style-spec.ts`. NEW: `src/lib/storage/upload-reference.ts`. NEW: `src/lib/ai/prompts.ts:buildStyleSpecPrompt()`. Tests: `extract-style-spec.test.ts` with fixture images + mocked Gemini response. |
| **3** | **Emit Integration (Projector + Generator)** | `generateFromStyleSpec(spec, content)` returns `CarouselWithTextBoxes` indistinguishable in shape from `generateSlideContent`; `generateCarouselFromReferences()` orchestrator wires extract → persist → emit → fetch images → save. | NEW: `src/lib/ai/generate-from-style-spec.ts` (projector + Gemini call). MODIFIED: `src/lib/services/carousel.ts` (sibling orchestrator). MODIFIED: `src/lib/ai/prompts.ts:buildFromSpecPrompt()`. Tests: projector unit tests + end-to-end mock generation. |
| **4** | **UI (Editor Entry + Reference Picker)** | New "Style from reference" entry point on `/dashboard` (or generation form); 1..N image picker; optional copy paste; submit invokes `generateCarouselFromReferences()` server action; result navigates to existing `/project/[id]` editor. | NEW: `src/components/generate/style-from-reference-form.tsx`. MODIFIED: `src/app/(dashboard)/dashboard/page.tsx` or `actions.ts` (wire new form). Tests: form interaction + happy-path Playwright. |
| **5** | **Remix / Fork Flow + Publish Snapshot** | Fork RPC carries `style_spec + reference_assets`; published carousels snapshot the spec; "Regenerate from references" button on forked projects re-invokes the extract → emit pipeline. | MODIFIED migration: `20260510_fork_includes_style_spec.sql` (extends v2.4 publish + fork RPCs + adds columns to `published_carousels`). MODIFIED: `src/components/explore/...` for showing reference images on detail page. NEW: server action `regenerateFromReferences(projectId)`. |

### Phase dependency graph

```
Phase 1 (schema/storage) ──┐
                           ├──► Phase 2 (vision extract) ──┐
                           │                                 ├──► Phase 3 (emit integration) ──┐
                           │                                 │                                    ├──► Phase 4 (UI)
                           │                                 │                                    └──► Phase 5 (remix)
                           └─────────────────────────────────┘
```

Phase 1 unblocks Phases 2+3+5 (they all touch the new schema). Phase 2 unblocks Phase 3 (projector needs spec shape locked). Phase 3 unblocks Phases 4+5 (UI and remix both invoke the orchestrator). Phases 4 and 5 are independent and can ship in parallel.

### Phase boundary cleanliness check

| Phase | New files | Modified files | Migration files |
|-------|-----------|----------------|-----------------|
| 1 | `src/lib/types/style-spec.ts` | `src/lib/ai/schemas.ts` (add export) | `20260510_add_style_spec.sql`, `20260510_reference_images_bucket.sql` |
| 2 | `src/lib/ai/extract-style-spec.ts`, `src/lib/storage/upload-reference.ts`, `src/lib/ai/__tests__/extract-style-spec.test.ts` | `src/lib/ai/prompts.ts` | — |
| 3 | `src/lib/ai/generate-from-style-spec.ts`, `src/lib/ai/__tests__/generate-from-style-spec.test.ts`, `src/lib/services/__tests__/carousel-from-references.test.ts` | `src/lib/services/carousel.ts`, `src/lib/ai/prompts.ts` | — |
| 4 | `src/components/generate/style-from-reference-form.tsx`, server action wiring | `src/app/(dashboard)/dashboard/page.tsx` (or new launcher card) | — |
| 5 | `src/components/explore/...` updates, server action `regenerateFromReferences()` | Existing fork+publish components if surfacing references | `20260510_fork_includes_style_spec.sql` |

**Each phase has a single concern and a single integration point with the next.** Roadmapper should treat phases 4 and 5 as parallelizable (after phase 3 lands).

---

## Patterns to Follow

### Pattern 1: Triple-Layer Silent-Drop at Vision Ingest

**What:** Mirror v2.12 Phase 71's `DecorationEmitSchema → resolveAIDecoration → DecorationSchema → max-N clamp` pipeline for the StyleSpec extraction.

**When:** In `extract-style-spec.ts`, the Gemini vision response is loosely typed at the wire (Gemini structured output is best-effort). Validate with:

1. `StyleSpecEmitSchema.safeParse()` — closed-enum gate on token-style fields (font names, presets, palette roles)
2. Resolver `resolveStyleSpecDefaults()` wrapped in try/catch — fills in safe defaults for any missing-but-required field
3. Final `StyleSpecSchema.safeParse()` — canonical-shape gate

If steps 1+2+3 ALL fail, throw a typed error that the orchestrator surfaces as a user-facing "couldn't extract style — try a different reference" message. **Never persist a half-baked spec.**

**Example:**
```ts
const rawJson = JSON.parse(geminiResponse.text)
const emitParse = StyleSpecEmitSchema.safeParse(rawJson)
if (!emitParse.success) throw new StyleExtractionError('emit-shape')
let resolved: StyleSpec
try {
  resolved = resolveStyleSpecDefaults(emitParse.data)
} catch (e) {
  throw new StyleExtractionError('resolver', e)
}
const finalParse = StyleSpecSchema.safeParse(resolved)
if (!finalParse.success) throw new StyleExtractionError('canonical-shape')
return finalParse.data
```

### Pattern 2: Closed-Enum Vision Tokens

**What:** Vision LLM emits **named tokens**, not raw values, for fonts / presets / palette roles. Server-side resolver maps tokens → registered values.

**When:** In `extract-style-spec.ts` Gemini schema:
- Font family → enum of registered fonts in `src/lib/fonts/` catalog (NOT free-form string — prevents "nearest match" headaches at render time)
- `treatment_preset` → enum of `bw / duotone-cream / duotone-cobalt / contrast-bump / none` (mirror existing `photo-treatment/treat.ts` presets)
- `pairing_strategy` → closed enum of 4 pairing names

**Why:** Gemini will hallucinate font names if free-form (`"Helvetica Neue Bold Condensed"` for a brand we don't ship). Closed-enum forces it to pick the nearest registered family, producing renderable output.

### Pattern 3: Spec-Driven Decoration Subset

**What:** When the projector calls into the Phase 71 decoration emit path, it **restricts** `AI_LUCIDE_ALLOWLIST` to `spec.decorations.preferred_lucide`.

**When:** In `generate-from-style-spec.ts`, before the Gemini text call, build a per-call allowlist:
```ts
const allowedLucide = spec.decorations.preferred_lucide.length > 0
  ? spec.decorations.preferred_lucide
  : AI_LUCIDE_ALLOWLIST  // fallback to full set if spec is silent
```
Pass this into the Gemini schema's `enum:` array for the `decorations[].lucideName` field.

**Why:** Reference references "editorial-tag" style with NO icons → AI shouldn't sprinkle in random icons. Spec encodes the constraint; emit honors it.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Putting StyleSpec on `Slide`

**What:** Adding `style_spec?: StyleSpec` to the `Slide` interface so each slide carries its own spec.

**Why bad:**
- Bloats every slide row in storage with redundant data (spec is project-level, not slide-level).
- Breaks TPLREND-05 if the renderer is ever tempted to read it (and the temptation will arrive).
- Makes "edit one slide" semantically ambiguous (does editing a slide override the spec?).

**Instead:** Spec on `projects` row only. Slides are fully self-describing via existing v1.0–v2.12 fields.

### Anti-Pattern 2: Vision LLM Emits Raw Hex Colors

**What:** Gemini vision schema declares `palette.accent: string` and lets the model emit arbitrary `#ABCDEF`.

**Why bad:**
- Cannot be tied back to `style_overrides.derived_palette` (v2.9's named-role palette extraction).
- Can collide with template-incompatible colors (mint accent on a Y2K template is jarring).
- No way to enforce contrast (light text on light accent).

**Instead:** Vision LLM emits raw hex for `extracted_dominant[]` (observational), but `accent` is derived in the resolver as `chooseAccentFromPalette(extracted_dominant, contrast_target)`. Raw hex bypass is reserved for specific cases (e.g. user explicitly typed a hex in a UI tweak).

### Anti-Pattern 3: Re-Extracting on Every Render

**What:** Editor opens a project → server re-extracts spec from references → re-applies → re-renders.

**Why bad:**
- $0.0005 × N edits × per-user = real money pre-PMF.
- Adds latency to every editor open.
- Style would visibly drift if Gemini upgrades model versions mid-session.

**Instead:** Extract once at carousel-creation time, persist to `projects.style_spec`. "Regenerate from references" is an explicit user action, not an implicit one.

### Anti-Pattern 4: Synthesizing Templates at Runtime

**What:** Constructing a new `SlideTemplate` object on the fly from spec values, registering it in `getTemplate()`'s registry mid-request.

**Why bad:**
- Templates are validated at module load (`templates/validate.ts`); runtime registration bypasses the validator.
- Cache invalidation nightmare across server invocations.
- Breaks the closed-enum `template_id_override` (Phase 58 D-08).

**Instead:** Spec maps to an EXISTING template via similarity score; per-slide overrides via `style_overrides`. If template coverage proves insufficient post-launch, register new templates the normal way (add to `templates/index.ts`) — not synthesize them.

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|-------------|-------------|-------------|
| Vision call cost | ~$0.05/day | ~$5/day | ~$500/day — add per-user cap (e.g. 5 spec extractions/day on free tier) |
| `reference-images` bucket size | <1 GB | ~50 GB | Add cron retention (mirror `treated-backgrounds` 7-day pattern) for unpaid users |
| `style_spec` JSONB size | ~2KB/row × 100 = 200KB | 20MB | 2GB — well within Postgres JSONB sweet spot; no concern |
| Fork RPC perf | trivial | trivial | Same as v2.4 fork — adds 2 column copies, negligible |
| Gemini structured-output reliability | 5-10% schema failures expected | Same | Same — silent-drop pipeline already handles this |

---

## Sources

- **Codebase inspection** (HIGH confidence — direct file reads):
  - `src/lib/types/slide.ts` (Slide schema, decoration union, style_overrides)
  - `src/lib/types/decoration.ts` (Decoration discriminated union)
  - `src/lib/types/project.ts` (Project shape)
  - `src/lib/ai/generate-slides.ts` (Gemini emit pipeline + triple-layer silent-drop pattern)
  - `src/lib/ai/schemas.ts` (Zod schemas, AI_LUCIDE_ALLOWLIST, AI_COLOR_TOKENS, AI_POSITION_ANCHORS, DecorationEmitSchema)
  - `src/lib/services/carousel.ts` (orchestration pattern, image fetch branches)
  - `src/lib/render/templates/{magazine-bold,index,validate}.ts` (template registry validator)
  - `src/lib/storage/upload-image.ts` (existing per-user-folder Storage pattern)
  - `supabase/schema.sql` + `supabase/migrations/20260504_fork_strip_decoration_locked.sql` (projects table + fork RPC pattern)

- **Project memory** (HIGH confidence):
  - `.planning/PROJECT.md` (v2.13 milestone goals, v2.12 close-out, TPLREND-05 invariant)
  - `.planning/research/archive-v2.12/ARCHITECTURE.md` (decorations architecture template — stylistic reference)

- **No external sources required** — this is integration architecture for an existing codebase; the question is "how does the new piece slot into the existing patterns," and the existing patterns are fully documented in code.
