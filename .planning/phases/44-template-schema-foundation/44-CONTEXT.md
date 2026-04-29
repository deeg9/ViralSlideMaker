# Phase 44: Template Schema Foundation - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch table)

<domain>
## Phase Boundary

Extend the `SlideTemplate` and `TextSegment` type system in `src/lib/render/templates/index.ts` and `src/lib/types/slide.ts` so a single template config can declare overlay zones (chip, counter, mid pill, bottom card), a background composition mode (`color | image-bleed | image-with-bottom-card`), and per-segment highlight pills. Ship a startup-time registry validator that fails fast when a template is misconfigured. Type changes only — no renderer wiring (Phase 45) and no new templates (Phase 46).

What is in scope:
- New optional fields on `SlideTemplate`: `overlays?: TemplateOverlay[]` and `backgroundMode?: 'color' | 'image-bleed' | 'image-with-bottom-card'`
- New `TemplateOverlay` type and `OverlayContent` discriminated union
- New optional fields on `TextSegment`: `highlightColor?: string` and `highlightStyle?: 'pill' | 'block'`
- A `validateTemplateRegistry()` function and a top-level call in `templates/index.ts`
- Tests covering: type narrowing on the discriminated union, validator failure messages, backwards-compat of the 5 existing templates

What is NOT in scope:
- Any renderer changes (Satori or React preview) — Phase 45
- Any new template definitions — Phase 46
- AI prompt changes — Phase 47
- Template thumbnails or picker UI — Phase 48
- Modifying the 5 existing template bodies (highlight-bar, news-drop, news-cyan, y2k-pop, bold-yellow)

</domain>

<decisions>
## Implementation Decisions

### Overlay Position Model (Area 1)
- Positions use **named slots** (`'top-left' | 'top-right' | 'mid' | 'bottom-card' | 'free'`) with an optional `offset: { x: number; y: number }` for fine-tuning. Renderer (Phase 45) maps each slot to a fixed CSS layout class.
- Overlay styling is an **inline `style` block** that mirrors a CSS subset already used by template body styling: `background?`, `color?`, `padding?`, `borderRadius?`, `fontSize?`, `fontWeight?`, `textTransform?`. No separate "style preset" registry.
- Phase 44 ships **types only** — neither Satori nor React preview is wired to overlays in this phase. Phase 45 owns the renderer adapter.

### Content-Source Discrimination (Area 2)
- `OverlayContent` is a **discriminated union** keyed by `type: 'literal' | 'page-counter' | 'slide-field'`:
  - `{ type: 'literal'; text: string }`
  - `{ type: 'page-counter'; format?: string }` (default `'{current}/{total}'`)
  - `{ type: 'slide-field'; field: 'topic' | 'hook_text' | 'body_text' }`
- Slide-field references are restricted to a **closed enum**: `'topic' | 'hook_text' | 'body_text'`. No open `keyof Slide`.
- `topic` reads from `project.topic` (already optional on `Project` in `src/lib/types/project.ts:10`). Phase 45 will pass `project.topic` through the existing render context alongside `slide` and `slideIndex` — no schema migration needed.

### Registry Validation & Backwards Compat (Area 3)
- `validateTemplateRegistry()` is exported from `src/lib/render/templates/index.ts` and **invoked at module load** (top-level call). Throws on misconfiguration → fails fast in dev, `npm run build`, vitest, and the first prod request that imports the module.
- Validator checks:
  - Each overlay's `position` is in the named slot enum
  - For `type: 'slide-field'`, `field` is in the closed enum
  - `type: 'page-counter'` carries no extraneous fields
  - No two overlays share the same non-`'free'` slot in one template
- Error messages include both `templateId` and `overlayIndex` so the failure is actionable (e.g., `Template 'magazine-bold' overlay[0]: slot 'top-left' duplicated`).
- `TextSegment.highlightStyle` enum: **`'pill' | 'block'`** (pill = rounded mint chip per Murphy reference; block = sharp rectangle).
- **No edits to the 5 existing templates.** All new fields are optional; defaults preserve current behavior. The only change to `templates/index.ts` is adding the `validateTemplateRegistry()` call.

### Claude's Discretion
- Exact field ordering inside the new types
- Whether to colocate the validator in `index.ts` or split into `validate.ts` (recommend split for testability)
- Whether the validator uses zod or a hand-rolled function — pick whichever has lower friction with the existing codebase (no zod dependency on `SlideTemplate` today; hand-rolled is likely cleaner)
- Test file location (likely `src/lib/render/templates/validate.test.ts` and a backwards-compat assertion in the existing `src/__tests__/render/templates.test.ts`)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/render/templates/index.ts` — current `SlideTemplate` interface (~30 lines). Already exports `templates: SlideTemplate[]` and `getTemplate(id)`.
- `src/lib/types/slide.ts:8` — current `TextSegment { text: string; accent?: boolean }`. Add optional `highlightColor` and `highlightStyle`; do not remove `accent` (used by existing two-color news templates).
- `src/lib/types/slide.ts:53` — existing `TextHighlightEffect { style: 'tight' | 'full' }` is a sibling concept (per-text-effect highlight); the new `highlightStyle` on segments is intentionally distinct (per-word) and uses different value names (`'pill' | 'block'`) to avoid confusion.
- `src/lib/types/project.ts:10` — `topic?: string` already exists on `Project`. Phase 45 will thread it through render context.

### Established Patterns
- Templates are plain TS modules under `src/lib/render/templates/*.ts` exporting a `SlideTemplate` constant; the central `index.ts` aggregates them into the registry array.
- Type-only changes follow the convention of adding optional fields with comments noting the introducing phase ("Phase 19: Text effects", "260427-bkt", etc.).
- Tests for template registry live in `src/__tests__/render/templates.test.ts`.

### Integration Points
- Schema additions are consumed downstream by:
  - Phase 45 (renderer composition) — Satori PNG export + React editor preview
  - Phase 46 (template authoring) — `magazine-bold`, `tr3nding-news`, `documentary` will populate `overlays` and `backgroundMode`
  - Phase 47 (AI prompt tuning) — generated `hook_segments` / `body_segments` will set `highlightColor` per template accent
  - Phase 48 (thumbnails & picker) — picker reads `sample` data which already exists; no Phase 44 change needed for picker integration

</code_context>

<specifics>
## Specific Ideas

- Murphy reference at `/Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_*.png` is the visual target. Phase 44 schema must express: B&W full-bleed photo (`backgroundMode: 'image-with-bottom-card'`), top-left topic chip, top-right page counter (`{current}/{total}`), mint pill highlights on accent words (`highlightColor: <mint hex>; highlightStyle: 'pill'`), bottom semi-opaque text card.
- Validator error format suggestion: `[template-registry] Template '${id}' overlay[${i}]: ${reason}` so a developer can grep their failing template config quickly.
- Page-counter format string is parsed by Phase 45's renderer, not the validator — Phase 44 only checks the type discriminator.

</specifics>

<deferred>
## Deferred Ideas

- Theme-aware highlight colors (template declares an accent palette and segments reference by name) — defer, hex codes are sufficient for v2.7.
- Per-overlay z-index and stacking — defer; named slots already imply a z-order convention enforceable by the renderer in Phase 45.
- Custom resolver functions on `slide-field` (e.g. uppercase, slug) — defer; AI prompt tuning in Phase 47 owns content shape.
- zod runtime schemas for `SlideTemplate` — defer until a phase actually needs serialized template config (none of v2.7 does).

</deferred>
