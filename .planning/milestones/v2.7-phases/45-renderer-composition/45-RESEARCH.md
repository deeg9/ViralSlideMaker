# Phase 45: Renderer Composition - Research

**Researched:** 2026-04-29
**Domain:** Renderer parity (Satori PNG export ↔ React DOM preview) for overlay zones, page counters, and per-segment highlight pills
**Confidence:** HIGH (codebase fully verified — all callsites, types, tests, and integration points read directly)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Slot Layout & Pixel Anchors (Area 1)
- Each named slot has a fixed pixel anchor in a `SLOT_GEOMETRY` constant shared between Satori and React preview:
  - `top-left`: `(60, 60)` inset from top-left corner.
  - `top-right`: uses CSS `right: 60, top: 60` (NOT computed `left: W-60`) so Satori absolute positioning works.
  - `mid`: horizontally centered, `y ≈ 55%` of canvas height.
  - `bottom-card`: spans full width × `~38%` height, anchored at bottom (Murphy reference matches).
  - `free`: no auto-positioning — overlay's own `offset.{x,y}` becomes absolute pixel coordinates.
- When `backgroundMode === 'image-with-bottom-card'`, hook/body text falls back to a card-aware preset (left-aligned, padding 80px, bottom-anchored INSIDE the card). User-supplied `style_overrides.text_position`, `hook_position`, `body_position` still win.
- DOM order (Satori has no z-index) for image modes:
  1. Background photo (full-bleed cover)
  2. Tint overlay (`template.overlayColor` × `overlayOpacity`)
  3. Bottom card (when `image-with-bottom-card`)
  4. Overlays (chip, counter, mid pill) — above tint, BELOW main hook
  5. Hook text (with mint pills as inline spans)
  6. Body text
  7. `custom_images`
  8. Brand watermark
  9. Forced free-tier watermark
- Overlay `style` block accepts the same CSS subset already declared in `TemplateOverlay.style`.

#### Per-Word Highlight Pill Rendering (Area 2)
- Each `TextSegment` with `highlightColor` → inline `<span>`:
  - `backgroundColor: highlightColor`
  - `padding: '4px 12px'` (pill) / `'4px 8px'` (block)
  - `borderRadius: '8px'` (pill) / `'0'` (block)
  - `marginRight: '8px'` after the segment
- Multi-line wrap breaks at line boundaries (no `box-decoration-break: clone` — even in React).
- React preview uses identical span markup with identical inline styles. Document the parity gotcha as a comment in `slide-preview.tsx`.
- Spacing between consecutive segments preserved by existing `renderSegmentChildren` separator (`' '`); pill `marginRight: 8px` adds breathing room beyond the space.

#### Background Composition Modes (Area 3)
- `image-bleed`: photo full-bleed (1080×1920 cover, top:0 left:0). Tint paints above using `template.overlayColor` + `overlayOpacity` (kept).
- `image-with-bottom-card`: same full-bleed photo + tint + bottom card:
  - Height: 38% of canvas (≈730px on 1920).
  - Color: `template.backgroundColor` with alpha `0.85` default (rgba unless template provides 8-digit hex).
  - Padding: 80px.
  - Card sits ABOVE tint, BELOW overlays/text.
- `style_overrides.layout: 'cover'/'body'` (NEWS_LAYOUT) and new `template.backgroundMode` are **mutually exclusive**. Resolution order: `style_overrides.layout` → NEWS_LAYOUT path; else `template.backgroundMode` → new path; else current flat-color behavior.
- Bottom-card text overflow: hook+body share the card. Hook uses existing `news-hook-fit.ts` (extended/wrapped if needed). Body uses `overflow: hidden`.

#### Render Context & Preview/Export Parity (Area 4)
- New optional `ctx` param on Satori `buildSlideElement(slide, template, brandKit, tier, origin, ctx?)`:
  - `ctx = { slideIndex: number; totalSlides: number; topic?: string }`
- Callers omitting `ctx` render counter as `1/1` and resolve `slide-field` to empty string — graceful degradation, no thrown errors.
- New props on `<SlidePreview>`: `slideIndex?: number = 0`, `totalSlides?: number = 1`. Editor callsites pass the array index and length.
- New shared resolver `src/lib/render/resolve-overlay.ts`:
  ```ts
  export function resolveOverlayContent(
    content: OverlayContent,
    ctx: { slideIndex: number; totalSlides: number; topic?: string; slide: Slide }
  ): string
  ```
- Test strategy:
  - `src/lib/render/resolve-overlay.test.ts` — unit tests for all three discriminator branches and missing-ctx fallback.
  - Satori snapshot tests in `src/__tests__/render/render-slide-satori.test.tsx` for each new combo.
  - DOM render test in `src/__tests__/components/slide-preview.test.tsx` — assert same overlay text + span signatures.
  - **No pixel-diff** (defer to v3.0+).

### Claude's Discretion
- Exact Satori snapshot file naming convention (follow whatever pattern the existing render-slide-satori tests use).
- Whether `SLOT_GEOMETRY` lives in `resolve-overlay.ts` or a new `slot-geometry.ts` (recommend colocating with resolver for now).
- Where to put the bottom-card style helper — likely `resolve-overlay.ts` or a small `compose-background.ts`.
- Whether to extract a `<HighlightSpan>` React component or inline the span builder in both renderers — judge by code size after first wire-up.

### Deferred Ideas (OUT OF SCOPE)
- Pixel-diff visual regression with playwright/image-diff — defer to v3.0+.
- `box-decoration-break: clone` in React preview — explicitly rejected.
- Multi-line measurement for bottom-card overflow — defer.
- Custom resolver hooks on `slide-field` (uppercase, slug, etc.) — defer.
- Per-overlay z-index escape hatch — defer.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TPLREND-01 | Satori renderer composes overlay zones declared in `template.overlays` respecting position, padding, z-order | `buildSlideElement` JSX tree must insert overlay layer after tint and before hook (verified at render-slide-satori.tsx:239-249 — current overlay tint inserted at the right anchor point) |
| TPLREND-02 | `backgroundMode === 'image-bleed'` / `'image-with-bottom-card'` paint photo full-bleed | Satori currently special-cases `newsZone` (line 159-161 / 230-237). New branches added before that mutex check, gated by `template.backgroundMode != null && !newsZone` |
| TPLREND-03 | Page-counter overlay renders dynamically from slide index in BOTH paths | Shared `resolveOverlayContent(content, ctx)` is the single source — both Satori `buildSlideElement` and React `<SlidePreview>` import it (RESEARCH key insight: NEW file `src/lib/render/resolve-overlay.ts`) |
| TPLREND-04 | Per-word highlight pills render in both Satori PNG export and React preview | `renderSegmentChildren` (Satori, render-slide-satori.tsx:32) and `renderSegments` (React, slide-preview.tsx:33) both extended in same commit to honor `seg.highlightColor` / `seg.highlightStyle` |
| TPLREND-05 | React preview matches Satori for overlay zones, page counter, highlight pills (NO drift) | Two-renderer parity guaranteed by (1) shared `resolveOverlayContent` resolver, (2) shared `SLOT_GEOMETRY` constant, (3) identical inline-style objects on `<span>` pill markup. Test contract: snapshot + DOM-signature match. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` does not exist in this repo — no project-level directives to honor beyond what STATE.md / CONTEXT.md / UI-SPEC.md already lock. Cleared.

## Summary

Phase 45 is **renderer wiring**, not new architecture. Phase 44 already shipped the data shapes (`OverlayContent`, `TemplateOverlay`, `SlideTemplate.overlays`, `SlideTemplate.backgroundMode`, `TextSegment.highlightColor / highlightStyle`) plus a module-load validator. None of those types need edits.

The work is mechanical and threads through six well-known surfaces:

1. **One new shared file** — `src/lib/render/resolve-overlay.ts` — exporting `resolveOverlayContent(content, ctx)` and a `SLOT_GEOMETRY` constant. This is the single source of truth that prevents preview/export drift (TPLREND-05).
2. **Satori renderer** (`render-slide-satori.tsx`) — extend `buildSlideElement` with optional `ctx?`, branch on `template.backgroundMode` (mutually exclusive with `newsZone`), insert overlay JSX in correct DOM-order slot, extend `renderSegmentChildren` for highlight pills.
3. **React preview** (`slide-preview.tsx`) — accept `slideIndex` / `totalSlides` props, extend `renderSegments` for highlight pills, mirror background-mode + overlay JSX. Both editable AND non-editable branches must mirror.
4. **Five Satori callsites** — all pass `ctx` from data they already have.
5. **Five React preview callsites** — pass `slideIndex` and `totalSlides` from arrays they already iterate.
6. **Three test files** — unit (resolver), Satori React-element snapshot, React preview DOM signature.

**Primary recommendation:** Three sequential plans — P01 = shared resolver + types + slot geometry (foundation, no callsite churn); P02 = Satori extension + all server-side callsites + Satori snapshot tests; P03 = React preview extension + all editor callsites + DOM signature tests. P02 and P03 share the resolver from P01 but otherwise touch disjoint files, so their parallel execution is safe IF P01 is committed first.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve overlay content (page-counter format string, slide-field lookup, literal passthrough) | Shared lib (browser + server isomorphic) | — | Pure function with no DOM/Node deps. Imported by both Satori (server) and React preview (browser). MUST be tier-neutral. |
| Slot geometry constants (top-left, top-right, mid, bottom-card, free) | Shared lib | — | Pure data. Single source prevents drift. |
| Compose Satori element tree (DOM order, inline styles, JSX) | API / Backend (Satori → next/og → ImageResponse) | — | Server-only — runs inside `/api/render`, `/api/v1/projects/[id]/download`, publish actions, seed-explore. Uses node-only `next/og` `ImageResponse`. |
| Compose React preview DOM (live editor canvas, picker thumbnails, public slideshow) | Browser / Client | — | Client component (`'use client'`); uses `useState`/`useEffect`/`useRef`/`Rnd`. Cannot run on server. |
| Plumb `ctx` from request handler to `buildSlideElement` | API / Backend | — | All five callsites are server entry points; each already loads `Project` (incl. `topic`) and the slide array. |
| Plumb `slideIndex` + `totalSlides` to `<SlidePreview>` | Frontend Server (RSC) → Browser | Browser | Editor pages already pass `slides` arrays as props from server components; `<SlideCanvas>`/`<SlideList>`/`<SortableSlide>` are client components that own the index state. |
| Auto-shrink hook in bottom-card mode | Shared lib (`news-hook-fit.ts`) | — | Existing helper is pure (chars-in → font-px-out). Bottom-card mode reuses or extends it. |

## Standard Stack

### Core (already installed — no new deps required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` (provides `next/og` ImageResponse) | 15.5.13 | Satori-backed PNG export | Already the project's render pipeline. `[VERIFIED: package.json line 35]` |
| `react` | 19.1.0 | React preview | Already the project's UI runtime. `[VERIFIED: package.json line 41]` |
| `vitest` | ^4.1.0 | Test runner | Already the project's test runner. Invoked via `npx vitest`. `[VERIFIED: package.json devDeps + npx vitest --version returned 4.1.0]` |
| `@testing-library/react` | ^16.3.2 | DOM render assertions for React preview tests | Already used (slide-preview.test.tsx:2). `[VERIFIED: package.json devDeps]` |
| `jsdom` | ^29.0.0 | DOM polyfill for vitest (configured `environment: 'jsdom'`) | Already the test environment. `[VERIFIED: vitest.config.ts:8]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitejs/plugin-react` | ^6.0.1 | JSX transform for vitest | Already in vitest.config.ts:6 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-tree React-element snapshot via `JSON.stringify` of `buildSlideElement(...)` output | Render through `ImageResponse` and compare PNG bytes | PNG-byte comparison is pixel-diff, explicitly out of scope (deferred to v3.0+). React-element snapshot tests structure + style props without invoking the full Satori pipeline — fast + deterministic. |
| Snapshot via vitest's `toMatchInlineSnapshot` on the React element tree | Vitest's external `toMatchSnapshot` (writes `.snap` files) | External snap files are easier to diff in code review. Recommend external snap files (vitest default for `toMatchSnapshot`). |

**Installation:** None required.

**Version verification:**
- vitest 4.1.0 — `[VERIFIED: npx vitest --version → vitest/4.1.0 darwin-arm64 node-v24.7.0]`
- next 15.5.13 — `[VERIFIED: package.json line 35]`
- React 19.1.0 — `[VERIFIED: package.json line 41]`

No new dependencies to install for Phase 45.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │         template + slide + project          │
                    │     (incl. project.topic, slides array)     │
                    └─────────────────────────────────────────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  │                                         │
                  ▼                                         ▼
       ┌──────────────────────┐                   ┌──────────────────────┐
       │   SERVER ENTRY        │                   │   CLIENT ENTRY        │
       │  - /api/render        │                   │  <SlideCanvas>        │
       │  - /api/v1/.../dl     │                   │  <SlideList>          │
       │  - publish-actions    │                   │  <SortableSlide>      │
       │  - publish service    │                   │  <CarouselSlideshow>  │
       │  - seed-explore       │                   │  <TemplatePicker>     │
       │                       │                   │  <BrandKitForm>       │
       │  builds ctx:          │                   │  <SlideGrid>          │
       │   { slideIndex,       │                   │                       │
       │     totalSlides,      │                   │  passes:              │
       │     topic }           │                   │   slideIndex,         │
       │                       │                   │   totalSlides,        │
       │                       │                   │   project.topic       │
       └──────────────────────┘                   └──────────────────────┘
                  │                                         │
                  ▼                                         ▼
       ┌──────────────────────┐                   ┌──────────────────────┐
       │ buildSlideElement(    │                   │ <SlidePreview         │
       │   slide, template,    │                   │   slideIndex={i}      │
       │   brandKit, tier,     │                   │   totalSlides={n}     │
       │   origin, ctx?)       │                   │   ... />              │
       └──────────────────────┘                   └──────────────────────┘
                  │                                         │
                  └─────────────────┬───────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │   SHARED RESOLVERS (Phase 45 NEW)     │
                  │                                       │
                  │   resolveOverlayContent(content, ctx) │
                  │   SLOT_GEOMETRY constant              │
                  │   (compose-background helpers)        │
                  └──────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴────────────────────────────┐
        ▼                                                        ▼
┌──────────────────────────┐                     ┌──────────────────────────┐
│  SATORI JSX TREE          │                     │   REACT DOM TREE          │
│  (rendered to SVG → PNG   │                     │   (rendered live in       │
│   via next/og)            │                     │    editor/picker/etc)     │
│                           │                     │                           │
│  DOM layer order:         │                     │  Same DOM layer order,    │
│   1. <img> photo          │                     │  same inline styles for   │
│   2. <div> tint           │                     │  the parity contract.     │
│   3. <div> bottom-card    │                     │                           │
│   4. overlays (chip/cnt)  │                     │                           │
│   5. hook (with pills)    │                     │                           │
│   6. body                 │                     │                           │
│   7. custom_images        │                     │                           │
│   8. brand watermark      │                     │                           │
│   9. forced watermark     │                     │                           │
└──────────────────────────┘                     └──────────────────────────┘
```

Component responsibilities (file-to-implementation mapping):

| Conceptual Component | File(s) |
|----------------------|---------|
| Shared resolver (PHASE 45 NEW) | `src/lib/render/resolve-overlay.ts` |
| Slot geometry (PHASE 45 NEW — recommend colocate) | `src/lib/render/resolve-overlay.ts` (or `slot-geometry.ts`) |
| Satori JSX builder | `src/lib/render/render-slide-satori.tsx` (extend `buildSlideElement` + `renderSegmentChildren`) |
| React preview component | `src/components/slides/slide-preview.tsx` (extend signature + `renderSegments` + add overlay/background-mode JSX) |
| Auto-shrink hook helper | `src/lib/render/news-hook-fit.ts` (extend or wrap) |
| Type definitions (already shipped Phase 44) | `src/lib/render/templates/index.ts`, `src/lib/types/slide.ts`, `src/lib/types/project.ts` |

### Recommended Project Structure

```
src/
├── lib/
│   └── render/
│       ├── resolve-overlay.ts          # NEW — shared resolver + SLOT_GEOMETRY
│       ├── resolve-overlay.test.ts     # NEW — unit tests for resolver
│       ├── render-slide-satori.tsx     # EXTEND — overlay JSX, backgroundMode branches, pill rendering
│       ├── render-slide.ts             # NO CHANGE (legacy HTML path; not in TPLREND scope)
│       ├── news-hook-fit.ts            # POSSIBLY EXTEND for bottom-card mode
│       └── templates/index.ts          # NO CHANGE (Phase 44 schema is final)
├── components/
│   └── slides/
│       └── slide-preview.tsx           # EXTEND — slideIndex/totalSlides props, overlay JSX, backgroundMode, pills
└── __tests__/
    ├── render/
    │   └── render-slide-satori.test.tsx  # NEW — Satori React-element snapshot tests
    └── components/
        └── slide-preview.test.tsx        # EXTEND — DOM signature match, overlay text content
```

### Pattern 1: Shared resolver guarantees parity (the entire Phase 45 thesis)

**What:** A pure function `resolveOverlayContent(content, ctx)` returns a string. Both render paths import and call it identically. There is no other place where the page-counter format string or slide-field lookup is computed.

**When to use:** Any time two renderers need to produce the same dynamic string from the same inputs.

**Example:**
```ts
// Source: derived from CONTEXT.md Area 4 + Phase 44 OverlayContent type
// File: src/lib/render/resolve-overlay.ts
import type { OverlayContent } from './templates'
import type { Slide } from '@/lib/types/slide'

export interface OverlayResolveCtx {
  slideIndex: number
  totalSlides: number
  topic?: string
  slide: Slide
}

const DEFAULT_COUNTER_FORMAT = '{currentSlide}/{totalSlides}'

export function resolveOverlayContent(
  content: OverlayContent,
  ctx: OverlayResolveCtx,
): string {
  switch (content.type) {
    case 'literal':
      return content.text
    case 'page-counter': {
      const fmt = content.format ?? DEFAULT_COUNTER_FORMAT
      return fmt
        .replace('{currentSlide}', String(ctx.slideIndex + 1))
        .replace('{totalSlides}', String(ctx.totalSlides))
    }
    case 'slide-field':
      switch (content.field) {
        case 'topic':     return ctx.topic ?? ''
        case 'hook_text': return ctx.slide.hook_text ?? ''
        case 'body_text': return ctx.slide.body_text ?? ''
      }
  }
}
```

### Pattern 2: Optional `ctx` with safe fallback

**What:** `buildSlideElement(slide, template, brandKit, tier, origin, ctx?)` accepts undefined `ctx`. When undefined, the resolver receives `{ slideIndex: 0, totalSlides: 1, topic: undefined, slide }` so page-counter prints `'1/1'` and slide-field returns empty string.

**When to use:** Adding a new optional parameter to a widely-called function. Avoids breaking five callsites in one commit.

**Example:**
```ts
export function buildSlideElement(
  slide: Slide,
  template: SlideTemplate,
  brandKit?: BrandKit | null,
  tier?: ForcedWatermarkTier | null,
  origin?: string,
  ctx?: { slideIndex: number; totalSlides: number; topic?: string },
): React.ReactElement {
  const resolveCtx = {
    slideIndex: ctx?.slideIndex ?? 0,
    totalSlides: ctx?.totalSlides ?? 1,
    topic: ctx?.topic,
    slide,
  }
  // …existing code…
  // when emitting overlays:
  for (const overlay of template.overlays ?? []) {
    const text = resolveOverlayContent(overlay.content, resolveCtx)
    // …emit JSX with text + style…
  }
}
```

### Pattern 3: Mutual-exclusion gate for `newsZone` vs `backgroundMode`

**What:** Existing `newsZone` (set when `style_overrides.layout` is present) and new `backgroundMode` are mutually exclusive. The condition for the new path is: `!newsZone && template.backgroundMode != null && template.backgroundMode !== 'color'`.

**When to use:** Adding a new code path to a renderer that already has a special case. Preserves the legacy contract for the 5 existing templates (which leave `backgroundMode` undefined).

**Example (Satori, conceptual):**
```ts
const newsZone = overrides.layout ? NEWS_LAYOUT[overrides.layout] : null
const useBgMode = !newsZone
  && template.backgroundMode != null
  && template.backgroundMode !== 'color'

// Background image branches:
const bgImageNode =
  newsZone && slide.background_url
    ? (/* existing news <img> at zone */)
    : useBgMode && slide.background_url
      ? (/* full-bleed photo at top:0 left:0 width:1080 height:1920 */)
      : null
```

### Pattern 4: Highlight pill via inline `<span>` style

**What:** A `TextSegment` with `highlightColor` becomes an inline `<span>` carrying `backgroundColor + padding + borderRadius + marginRight`. No `box-decoration-break: clone`. Same markup in Satori and React.

**When to use:** Per-segment styling that must be byte-identical between two renderers.

**Example:**
```ts
// Used in BOTH renderSegmentChildren (Satori) and renderSegments (React).
function highlightSpanStyle(seg: TextSegment, color: string): React.CSSProperties | undefined {
  if (!seg.highlightColor) return undefined
  const isPill = (seg.highlightStyle ?? 'pill') === 'pill'
  return {
    color,
    backgroundColor: seg.highlightColor,
    padding: isPill ? '4px 12px' : '4px 8px',
    borderRadius: isPill ? '8px' : '0',
    marginRight: '8px',
    // NO box-decoration-break — parity contract with Satori (TPLREND-05).
  }
}
```

### Anti-Patterns to Avoid

- **Computing `currentSlide`/`totalSlides` substitution inline at the renderer:** breaks the parity contract — both renderers must call the SAME resolver. Always go through `resolveOverlayContent`.
- **Using `box-decoration-break: clone` in React preview:** Satori does not support it. Browsers do. Using it makes preview look "nicer" but creates the exact preview/export drift TPLREND-05 forbids. Document this explicitly in `slide-preview.tsx` as a comment.
- **Hardcoding pixel anchors per renderer:** if Satori uses `60` and React uses `'60px'` and one drifts, the parity contract silently breaks. Use a single shared `SLOT_GEOMETRY` constant.
- **Re-using `TextHighlightEffect` (per-text-effect highlight) for the per-segment pill:** they operate on different layers. The text-effect highlight wraps the WHOLE hook/body text in a colored band; the per-segment pill wraps a single span. Phase 45 is per-segment only; existing `TextHighlightEffect` paths stay untouched.
- **Forgetting the React preview's two render branches:** `slide-preview.tsx` has BOTH a non-editable mode (line ~325–527) AND an editable mode (line ~558–1093). Both render hook/body and custom_texts. Both must mirror the new background-mode + overlay layers. Missing one breaks parity in either editor or picker thumbnails.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page-counter substitution | A custom mini-template engine | Two `String.prototype.replace` calls in the resolver | The format is `{currentSlide}/{totalSlides}` — exactly two tokens, both validated by Phase 44 to be parseable. No need for a template engine. |
| Slot positioning | A new layout primitive (e.g. CSS grid + named areas) | A flat `SLOT_GEOMETRY` constant + absolute positioning per slot | Satori only supports flexbox + absolute positioning. CSS grid is rejected by Satori — would create an export-only failure. |
| Auto-shrink hook for bottom-card mode | A new char-count scaler | Reuse `getNewsHookFontSize(hookText, baseSize)` from `news-hook-fit.ts` (or wrap) | The function is already pure and char-count based. Adapt by calling it with the bottom-card's `hookFontSize`. |
| Snapshot file format | Custom serialization of React element trees | `vitest`'s built-in `toMatchSnapshot` on the React element returned by `buildSlideElement(...)` | Satori snapshots can serialize the JSX tree directly without rendering through `ImageResponse`. Vitest writes `.snap` files in `__snapshots__/` next to the test. |
| Validating `OverlayContent` discriminator at render time | Re-validate with another zod schema | Phase 44 `validateTemplateRegistry` already runs at module load and throws on bad shapes | Defensive re-validation at render time would be dead code — by render time, the registry is already known-valid. |
| 8-digit hex → rgba for bottom-card alpha | A new color parser | A small inline helper: if `template.backgroundColor.length === 9` (`#RRGGBBAA`), pass through; else compose `rgba(r, g, b, 0.85)` with a tiny hex→rgb step | Existing codebase has no central color helper. The logic is 6 lines. |

**Key insight:** Phase 45 has very few hand-rolling temptations because Phase 44 already shipped the schema + validator. The discipline is "thread the needle" not "design the solution."

## Common Pitfalls

### Pitfall 1: Editor passes wrong `slideIndex` after reordering

**What goes wrong:** `<SortableSlide>` reorders the slides array via dnd-kit, but if the `index` prop is bound to the array position at render time (which it is — see slide-list.tsx:67-78), the reorder-driven re-render produces the right index. Risk: a stale `selectedIndex` after reorder.

**Why it happens:** Reorder mutates the array but `selectedIndex` is held in `slide-editor.tsx`'s local state, not propagated.

**How to avoid:** `<SlideList>` already passes `index` from `slides.map((_, index) => ...)` so the page-counter for the picker thumbnails will be correct. The selected-slide path goes through `<SlideCanvas>` which uses `selectedIndex`. Both already exist; Phase 45 just adds `totalSlides={slides.length}`.

**Warning signs:** Manual smoke test — drag slide 3 to position 1, confirm the live page-counter on the canvas updates from "3/5" to "1/5".

### Pitfall 2: React preview's TWO render branches diverge

**What goes wrong:** `<SlidePreview>` has a non-editable branch (template picker thumbnails, BrandKit form preview, public slideshow) and an editable branch (live editor canvas). Adding overlay/background-mode JSX to only one creates inconsistency between picker thumbnails and the live canvas.

**Why it happens:** The two branches are visually similar but structurally distinct (one wraps text in `<Rnd>`, one doesn't). Easy to fix one and forget the other.

**How to avoid:** During implementation, search `slide-preview.tsx` for `Overlay` (the existing tint `<div>`) — it appears twice (lines 336 and 575-581). Every new layer must also be inserted twice. Suggestion: extract a shared `<BackgroundLayers>` and `<OverlayLayer>` set of internal components or render-helper functions to deduplicate.

**Warning signs:** Picker thumbnails for `magazine-bold` (Phase 46) look different from the editor canvas.

### Pitfall 3: Satori's `<img>` swallows `objectFit` silently when not on root

**What goes wrong:** Satori's CSS subset is partial. `objectFit: 'cover'` works on `<img>` but ONLY when `width` and `height` are explicit numeric pixels (not `'100%'`).

**Why it happens:** Satori enforces `width`/`height` to be numbers in many positions; percentage-strings can render unexpectedly.

**How to avoid:** Existing renderer already passes `width: W` and `height: H` (numeric) for the full-bleed image (line 232-233). Phase 45's new full-bleed path (`backgroundMode === 'image-bleed'`) MUST do the same: `width: 1080, height: 1920`. The React preview can use `width: '100%' height: '100%'` because the parent has `transform: scale(...)`.

**Warning signs:** PNG export shows tiled photo or stretched to wrong aspect ratio.

### Pitfall 4: `topic` is missing on published carousels

**What goes wrong:** Public slideshow at `/explore/[slug]` displays a carousel from `published_carousels`, which only stores `slide_data` and `title` — not `topic`. If a Phase 46 template uses `slide-field` with `field: 'topic'` and the public route doesn't have a topic, the chip renders empty (per the locked spec).

**Why it happens:** `published_carousels` is a snapshot table; it does not denormalize `project.topic`.

**How to avoid:** This IS the locked behavior — empty string is the correct fallback. Document explicitly in `<CarouselSlideshow>` (carousel-slideshow.tsx) that `topic` is intentionally not threaded for published carousels. If Phase 46+ wants the chip filled, that's a separate decision (likely "use template title" or persist topic at publish time).

**Warning signs:** Public slideshow renders empty chip slot. Expected; not a bug.

### Pitfall 5: Validator (Phase 44) doesn't validate `style.padding` shape

**What goes wrong:** `TemplateOverlay.style.padding` is typed as `string` only. A renderer that does `parseInt(style.padding)` silently fails on `"4px 12px"` (returns 4).

**Why it happens:** Phase 44 deliberately keeps the style block as a passthrough CSS subset — no normalization. The renderer applies it as inline CSS and lets the browser/Satori handle it.

**How to avoid:** Apply `overlay.style` as `style={{ ...overlay.style }}` directly. Do NOT parse padding/borderRadius. Satori handles `'4px 12px'` natively.

**Warning signs:** Inline padding renders as 4px on all sides instead of 4/12.

### Pitfall 6: Test snapshot churn from React 19's element-key auto-generation

**What goes wrong:** `react-dom`/`react` 19.x sometimes annotates elements with stable keys; running snapshot tests across React versions produces noise.

**Why it happens:** Snapshot serialization includes auto-generated keys.

**How to avoid:** When emitting overlay arrays in Satori, set explicit keys: `key={`overlay-${i}-${overlay.position}`}`. This makes the snapshot stable regardless of internal React behavior.

**Warning signs:** Snapshot file shows random key strings; test fails on unrelated React patch updates.

## Runtime State Inventory

This phase is renderer wiring (code only). No rename, refactor, or migration. Section omitted.

## Code Examples

Verified patterns — sources cited inline.

### Example 1: Slot geometry as a shared constant

```ts
// Source: derived from 45-CONTEXT.md Area 1 + 45-UI-SPEC.md Slot Geometry table
// File: src/lib/render/resolve-overlay.ts
export const CANVAS = { W: 1080, H: 1920 } as const

export const SLOT_GEOMETRY = {
  'top-left': { left: 60, top: 60 } as const,
  'top-right': { right: 60, top: 60 } as const,         // CSS `right`, NOT computed left
  'mid': { left: '50%', top: '55%', transform: 'translateX(-50%)' } as const,
  'bottom-card': { left: 0, right: 0, bottom: 0, height: '38%', padding: 80 } as const,
  'free': null,                                           // overlay.offset becomes absolute
} as const
```

### Example 2: Extending `renderSegmentChildren` for highlight pills (Satori)

```tsx
// Source: extend src/lib/render/render-slide-satori.tsx:32
function renderSegmentChildren(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  if (!segments || segments.length === 0) return text
  return segments.map((seg, i) => {
    const color = seg.accent ? accentColor : baseColor
    const sep = i < segments.length - 1 ? ' ' : ''
    if (seg.highlightColor) {
      const isPill = (seg.highlightStyle ?? 'pill') === 'pill'
      return (
        <span
          key={i}
          style={{
            color,
            backgroundColor: seg.highlightColor,
            padding: isPill ? '4px 12px' : '4px 8px',
            borderRadius: isPill ? '8px' : '0',
            marginRight: '8px',
          }}
        >
          {seg.text}
          {sep}
        </span>
      )
    }
    return (
      <span key={i} style={{ color }}>
        {seg.text}{sep}
      </span>
    )
  })
}
```

### Example 3: Plumbing `ctx` into a callsite

```ts
// Source: extend src/app/api/render/route.ts:98 — single-slide endpoint
// `index` and `slides.length` are already in scope; project.topic is on Project.
const totalSlides = (p.slide_data ?? []).length
const ctx = { slideIndex: index, totalSlides, topic: p.topic }
const element = buildSlideElement(slide, effectiveTemplate, brandKit, ownerTier, origin, ctx)
```

```ts
// Source: extend src/app/api/v1/projects/[id]/download/route.ts:75 — ZIP loop
const totalSlides = slides.length
for (let i = 0; i < slides.length; i++) {
  const slide = slides[i]
  const ctx = { slideIndex: i, totalSlides, topic: project.topic }
  const element = buildSlideElement(slide, effectiveTemplate, resolvedBrandKit, ownerTier, origin, ctx)
  // …
}
```

### Example 4: Satori snapshot test pattern

```tsx
// Source: NEW file src/__tests__/render/render-slide-satori.test.tsx
// Pattern: import buildSlideElement, render to React element tree, snapshot the structure
// (NOT the PNG bytes — that's deferred pixel-diff scope).
import { describe, it, expect } from 'vitest'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import type { SlideTemplate } from '@/lib/render/templates'
import type { Slide } from '@/lib/types/slide'

const baseSlide: Slide = {
  hook_text: 'FOLK SINGER FIGHTS BACK',
  body_text: 'Murphy Campbell is a folk singer.',
  hook_segments: [
    { text: 'FOLK SINGER' },
    { text: 'FIGHTS BACK', highlightColor: '#9DECC1', highlightStyle: 'pill' },
  ],
  image_query: '',
  is_cta: false,
  background_url: 'https://example.com/folk.jpg',
  pexels_photo_id: null,
}

const baseTemplate: SlideTemplate = {
  id: 'fixture-magazine',
  name: 'Fixture',
  thumbnail: '',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '32px',
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.4,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  backgroundMode: 'image-with-bottom-card',
  overlays: [
    { position: 'top-left',  content: { type: 'literal', text: 'TR3NDING' } },
    { position: 'top-right', content: { type: 'page-counter' } },
  ],
}

describe('buildSlideElement — Phase 45 overlay composition', () => {
  it('matches snapshot for image-with-bottom-card + overlays + mint pill', () => {
    const element = buildSlideElement(
      baseSlide, baseTemplate, null, 'free', 'http://localhost',
      { slideIndex: 0, totalSlides: 5, topic: 'folk-music' },
    )
    expect(element).toMatchSnapshot()
  })

  it('falls back gracefully when ctx is omitted (counter renders 1/1)', () => {
    const element = buildSlideElement(baseSlide, baseTemplate, null, 'free', 'http://localhost')
    // Walk element tree; assert top-right overlay text === '1/1'
    expect(element).toMatchSnapshot()
  })

  it('does NOT add overlay/background-mode layers for legacy templates', () => {
    const legacy: SlideTemplate = { ...baseTemplate, overlays: undefined, backgroundMode: undefined }
    const element = buildSlideElement(baseSlide, legacy, null, 'free', 'http://localhost')
    expect(element).toMatchSnapshot()
  })
})
```

### Example 5: React preview DOM signature test

```tsx
// Source: extend src/__tests__/components/slide-preview.test.tsx
// Pattern: render to jsdom, query overlay elements, assert text + style signatures
// match what Satori would emit.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'

describe('SlidePreview — Phase 45 overlay parity', () => {
  it('renders page-counter overlay text "2/5" when slideIndex=1, totalSlides=5', () => {
    render(<SlidePreview slide={fixtureSlide} template={fixtureTemplate} index={1} slideIndex={1} totalSlides={5} />)
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('renders highlight-pill span with parity-locked inline style for "FIGHTS BACK"', () => {
    render(<SlidePreview slide={fixtureSlide} template={fixtureTemplate} index={0} slideIndex={0} totalSlides={5} />)
    const span = screen.getByText(/FIGHTS BACK/)
    const style = span.getAttribute('style') || ''
    expect(style).toMatch(/background-color:\s*rgb\(157,\s*236,\s*193\)/) // #9DECC1
    expect(style).toMatch(/padding:\s*4px 12px/)
    expect(style).toMatch(/border-radius:\s*8px/)
    expect(style).toMatch(/margin-right:\s*8px/)
    expect(style).not.toMatch(/box-decoration-break/) // parity contract
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Renderer-specific overlay positioning | Single shared `SLOT_GEOMETRY` constant + `resolveOverlayContent` resolver | Phase 45 (this phase) | Both render paths produce byte-equivalent overlay markup |
| `box-decoration-break: clone` for tight highlights in React | Explicit ban — uniform fallback across both renderers | Phase 45 | Eliminates preview/export drift on multi-line pills |
| Per-callsite computation of slide index | `ctx` parameter threaded through `buildSlideElement` | Phase 45 | Single contract for slide-index data; missing-ctx fallback to `'1/1'` is the documented graceful path |
| Phase 44 schema additions un-wired (overlays, backgroundMode, segment.highlightColor) | Wired into both Satori and React renderers in this phase | Phase 45 | Phase 46 can author `magazine-bold` purely as a config object — no renderer code needed |

**Deprecated/outdated:**
- The legacy HTML renderer (`src/lib/render/render-slide.ts` `buildSlideHtml`) is NOT extended for Phase 45 overlay composition. It's a third path used only by the deprecated `node-html-to-image` route (no longer in the live render pipeline). Confirmed: only `render-slide-satori.tsx` and `slide-preview.tsx` are the two render paths under TPLREND-05's parity contract. `[VERIFIED: grep of buildSlideHtml callsites returns only test imports and self-reference]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vitest `toMatchSnapshot` on a React element returned by `buildSlideElement` produces a deterministic, structural snapshot suitable for parity contract testing | Code Examples (Example 4) | Low — vitest 4.x supports element snapshotting via `pretty-format`; if it fails, fall back to JSON-stringifying the element. Confirmed framework: vitest 4.1.0 verified. |
| A2 | The React preview's `objectPosition: 'center'` style behaves identically to Satori's `objectPosition: 'center'` for full-bleed photos | Pattern 3 / Pitfall 3 | Low — both use the same CSS subset; risk is for unusual aspect-ratio source photos which the user can override per-slide via image cropping (out of scope). |
| A3 | The 5 server-side Satori callsites listed in this RESEARCH are the complete set | Architectural Responsibility Map | Low — `grep -rn "buildSlideElement"` returned exactly 5 production callsites + 1 self-reference. Verified via grep at investigation time. |
| A4 | The 7 React `<SlidePreview>` callsites are the complete set | Architectural Responsibility Map | Low — `grep -rn "SlidePreview"` (excluding type-imports and tests) confirmed: slide-canvas, sortable-slide, slide-grid, template-picker (×2 — brand-kit tile + per-template tile), brand-kit-form, carousel-slideshow. |
| A5 | `news-hook-fit.ts` can be reused as-is for bottom-card mode without forking | Pattern / Decisions discretion | Medium — char-count thresholds (22/44/66) were calibrated for news-template's 60-80% Y window; bottom-card has 38% height (≈730px) which may need a slightly different curve. Verify visually after Phase 46 ships `magazine-bold`. Mitigation: start by reusing as-is, adjust thresholds in a follow-up if multi-line headlines spill. |

## Open Questions

1. **Should `SLOT_GEOMETRY` colocate with `resolve-overlay.ts` or live in its own `slot-geometry.ts`?**
   - What we know: CONTEXT.md marks this as Claude's discretion.
   - What's unclear: Phase 46 may want to import only `SLOT_GEOMETRY` (not the resolver) when registering new templates.
   - Recommendation: start colocated in `resolve-overlay.ts`; promote to its own file in Phase 46 if a template config legitimately imports it without the resolver. YAGNI for now.

2. **Does the React preview need `<BackgroundLayers>` / `<OverlayLayer>` extracted helpers, or inline JSX twice?**
   - What we know: `slide-preview.tsx` has two render branches (editable / non-editable) that already duplicate the tint `<div>` (lines ~336 and ~580).
   - What's unclear: extracting helpers reduces duplication risk but adds indirection; inlining keeps the file self-contained.
   - Recommendation: inline first pass. If both branches diverge during implementation, extract.

3. **Should the bottom-card 8-digit hex / rgba-with-0.85 logic live in `resolve-overlay.ts` or a new `compose-background.ts`?**
   - What we know: CONTEXT.md marks this as discretion.
   - What's unclear: it's six lines and has one caller. A whole new file feels heavy.
   - Recommendation: inline it as a private function inside `resolve-overlay.ts` (keeps shared concerns in one place).

4. **`renderSegmentChildren` in Satori vs `renderSegments` in React — extract to shared lib, or duplicate the small extension?**
   - What we know: the two functions are 18 lines each, slightly diverging today (Satori returns `React.ReactNode` for inline `<span>` use; React returns the same — they're actually compatible).
   - What's unclear: extraction would simplify Phase 45's pill change (one place vs two).
   - Recommendation: extract a shared `renderSegments(text, segments, baseColor, accentColor): React.ReactNode` into `resolve-overlay.ts` (or sibling `render-segments.ts`). Both renderers import it. This is a **net code reduction** AND removes a class of "I forgot to update the other one" drift bugs. Strong recommend. Deviation from CONTEXT.md "discretion": this extraction is implementing the locked TPLREND-05 parity contract, not adding scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next dev/build | ✓ | v24.7.0 | — |
| npx | Vitest invocation | ✓ | (npm 10.x with node 24) | — |
| `next` (provides `next/og`) | Satori PNG export | ✓ | 15.5.13 (package.json) | — |
| `vitest` | Test runner | ✓ | 4.1.0 (verified via `npx vitest --version`) | — |
| `@testing-library/react` | DOM render assertions | ✓ | 16.3.2 | — |
| `jsdom` | Vitest DOM env | ✓ | 29.0.0 | — |
| `@vitejs/plugin-react` | JSX transform in vitest | ✓ | 6.0.1 | — |
| `react`, `react-dom` | Both renderers | ✓ | 19.1.0 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Note:** package.json has no `"test"` script — invoke vitest directly via `npx vitest run` or `npx vitest run <pattern>`. This matches the existing test-running convention in the codebase (no test-script-driven CI seen).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 + @vitejs/plugin-react 6.0.1 |
| Config file | `vitest.config.ts` (alias `@` → `./src`, env `jsdom`, setup `./src/__tests__/setup.ts`) |
| Quick run command | `npx vitest run src/lib/render/resolve-overlay.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TPLREND-01 | Satori composes overlay zones at correct slot positions | snapshot (React-element tree) | `npx vitest run src/__tests__/render/render-slide-satori.test.tsx` | ❌ Wave 0 |
| TPLREND-02 | `image-bleed` and `image-with-bottom-card` render full-bleed photo + correct layer stack | snapshot | `npx vitest run src/__tests__/render/render-slide-satori.test.tsx` | ❌ Wave 0 |
| TPLREND-03 | Page-counter resolves dynamically from slideIndex/totalSlides in BOTH paths | unit (resolver) + snapshot (Satori) + DOM (React) | `npx vitest run src/lib/render/resolve-overlay.test.ts && npx vitest run src/__tests__/render/render-slide-satori.test.tsx && npx vitest run src/__tests__/components/slide-preview.test.tsx` | ❌ Wave 0 (resolve-overlay.test.ts NEW; satori NEW; slide-preview.test.tsx EXTEND) |
| TPLREND-04 | Highlight pills render in both Satori PNG path and React preview | snapshot + DOM signature | same as above | ❌ Wave 0 |
| TPLREND-05 | React preview matches Satori for overlay zones, page counter, highlight pills | DOM signature match against Satori snapshot patterns | `npx vitest run src/__tests__/components/slide-preview.test.tsx` | ❌ Wave 0 (extends existing file) |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed-file-or-test>` — typically <1s per file
- **Per wave merge:** `npx vitest run src/__tests__/render src/__tests__/components/slide-preview.test.tsx src/lib/render` — full Phase 45 surface
- **Phase gate:** `npx vitest run` (full suite) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/render/resolve-overlay.test.ts` — NEW; covers TPLREND-03 resolver branches + missing-ctx fallback
- [ ] `src/__tests__/render/render-slide-satori.test.tsx` — NEW; covers TPLREND-01, TPLREND-02, TPLREND-04 (Satori side)
- [ ] `src/__tests__/components/slide-preview.test.tsx` — EXTEND existing 2-test file; covers TPLREND-04 (React side) + TPLREND-05 parity signature
- [ ] No framework install — vitest already configured.

## Security Domain

This phase is renderer composition with NO authenticated surface change, NO new user input parsing, NO new persistence. The data shapes (`OverlayContent`, `TemplateOverlay`, `TextSegment.highlightColor`) come from in-repo template definitions — not user input — and are validated at module load by Phase 44's `validateTemplateRegistry`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged — existing routes (`/api/render`, `/api/v1/projects/[id]/download`) keep their existing auth |
| V3 Session Management | no | unchanged |
| V4 Access Control | no | unchanged — `withApiAuth` HOC and Supabase RLS already enforce ownership on the server callsites |
| V5 Input Validation | yes (boundary) | Phase 44 `validateTemplateRegistry` (already shipped) — overlay schema is validated at module load. Phase 45 trusts the validator's output. |
| V6 Cryptography | no | no new crypto |

### Known Threat Patterns for Satori + React composition

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected XSS via overlay text | Tampering | All overlay text emits as React/Satori children — React's text-node escaping is automatic for both render paths. The HTML path (`render-slide.ts`) uses `escapeHtml` for legacy reasons, but Phase 45 does NOT extend that path. |
| Style-attribute injection via `TemplateOverlay.style` | Tampering | `template.overlays` is in-repo code, not user input. The Phase 44 validator guards the SHAPE of the style block (closed `textTransform` enum); other style values pass through verbatim. Acceptable trust boundary. |
| Color-string injection via `TextSegment.highlightColor` | Tampering | `highlightColor` originates from AI generation (Phase 47) — flows through validated `Slide` shape stored in the project's `slide_data` JSONB. CSS color-parser failure → transparent (browser/Satori default). No injection vector. |

## Sources

### Primary (HIGH confidence — direct file reads)
- `src/lib/render/render-slide-satori.tsx` (366 lines) — Satori renderer; verified `renderSegmentChildren` (line 32), `satoriHighlightStyle` (line 75), `buildSlideElement` (line 94), DOM order in JSX tree (lines 219-365)
- `src/components/slides/slide-preview.tsx` (1094 lines) — React preview; verified `renderSegments` (line 33), props interface (line 63), non-editable branch (lines 325-527), editable branch (lines 558-1093)
- `src/lib/render/templates/index.ts` — Phase 44 schema (`OverlaySlot`, `OverlayContent`, `TemplateOverlay`, `SlideTemplate.overlays`, `SlideTemplate.backgroundMode`); validator wired at module load (line 86)
- `src/lib/render/templates/validate.ts` — Phase 44 validator; verified discriminator branching, allow-list enforcement
- `src/lib/render/templates/validate.test.ts` — Phase 44 test patterns (closures of valid/invalid fixtures, error-message regex assertions)
- `src/lib/render/news-hook-fit.ts` — char-count scaler; pure function, reusable
- `src/lib/types/slide.ts` — `TextSegment.highlightColor` / `highlightStyle` (line 13-14); `Slide` shape
- `src/lib/types/project.ts` — `Project.topic` (line 10) — already optional, already on the type
- `src/__tests__/render/templates.test.ts` — existing template test patterns (vitest, dynamic imports)
- `src/__tests__/components/slide-preview.test.tsx` — existing React preview test pattern (jsdom, @testing-library/react)
- `src/__tests__/setup.ts` — vitest setup (Supabase mocks, next/headers mocks)
- `vitest.config.ts` — test config (jsdom, alias, plugin-react)
- All five Satori callsites: `/api/render/route.ts`, `/api/v1/projects/[id]/download/route.ts`, `(dashboard)/project/[id]/publish-actions.ts`, `lib/services/publish.ts`, `/api/admin/seed-explore/route.ts`
- All seven React preview callsites: `slide-canvas.tsx`, `slide-list.tsx` (via `sortable-slide.tsx`), `slide-grid.tsx`, `template-picker.tsx` (×2), `brand-kit-form.tsx`, `carousel-slideshow.tsx`
- `45-CONTEXT.md` (verbatim user decisions)
- `45-UI-SPEC.md` (visual design contract, locked tokens)
- `REQUIREMENTS.md` (TPLREND-01..05 source-of-truth)
- `STATE.md` (project history)
- `package.json` (verified Next 15.5.13, React 19.1.0, vitest 4.1.0)
- `npx vitest --version` (verified vitest 4.1.0 darwin-arm64 node-v24.7.0)

### Secondary (MEDIUM confidence)
- None. All Phase 45 claims are derived from in-repo evidence; no external library API claims that aren't trivially provable from the existing code.

### Tertiary (LOW confidence)
- None.

## Plan Decomposition Recommendation

**Recommendation: Three sequential plans (P01 → P02 → P03), with P02 and P03 parallelizable after P01 commits.**

| Plan | Scope | Files Touched | Dependencies | Tests |
|------|-------|---------------|--------------|-------|
| **45-01: Shared resolver + slot geometry foundation** | Create `src/lib/render/resolve-overlay.ts` (resolver, `SLOT_GEOMETRY`, optional `renderSegments` helper). Pure module, no callsite churn. | NEW: `src/lib/render/resolve-overlay.ts`, `src/lib/render/resolve-overlay.test.ts` | None. Phase 44 schema is already shipped. | resolve-overlay.test.ts (RED → GREEN, then commit) |
| **45-02: Satori renderer wiring + server callsites** | Extend `buildSlideElement` for overlay JSX, `backgroundMode` branches, highlight pills. Update 5 server callsites to pass `ctx`. | `src/lib/render/render-slide-satori.tsx` (extend); `src/app/api/render/route.ts`, `src/app/api/v1/projects/[id]/download/route.ts`, `src/app/(dashboard)/project/[id]/publish-actions.ts`, `src/lib/services/publish.ts`, `src/app/api/admin/seed-explore/route.ts` (all add `ctx` arg). NEW test file `src/__tests__/render/render-slide-satori.test.tsx`. | depends on 45-01 (`resolve-overlay.ts` exports) | render-slide-satori.test.tsx — Satori React-element snapshots for: legacy template (no change), `image-bleed`, `image-with-bottom-card` + overlays, mint-pill highlights, missing-ctx fallback |
| **45-03: React preview wiring + editor callsites** | Extend `<SlidePreview>` for `slideIndex`/`totalSlides` props, overlay JSX in BOTH branches, `backgroundMode` branches, highlight pills. Update 7 React callsites to pass props. Document the box-decoration-break parity gotcha as a code comment. | `src/components/slides/slide-preview.tsx` (extend both branches); `src/components/editor/slide-canvas.tsx`, `src/components/editor/slide-list.tsx`, `src/components/editor/sortable-slide.tsx`, `src/components/slides/slide-grid.tsx`, `src/components/slides/template-picker.tsx`, `src/components/brand-kit/brand-kit-form.tsx`, `src/app/explore/[slug]/carousel-slideshow.tsx` (all add `slideIndex`/`totalSlides` props or default to defaults). EXTEND `src/__tests__/components/slide-preview.test.tsx`. | depends on 45-01 (`resolve-overlay.ts` exports) | slide-preview.test.tsx — DOM signature tests: page-counter renders correct text at index N of M; highlight-pill `<span>` carries exact inline-style signature matching Satori's; non-editable AND editable branches both render overlays |

### Why three plans (not one, not four):

- **Not one:** A single mega-plan touches 14 files and crosses the server/client boundary. Higher review burden, harder to revert if one renderer regresses, harder to detect parity drift.
- **Not four:** Splitting tests into a separate plan delays Wave 0 (RED tests must precede GREEN code). The TDD pattern from Phase 44 (`test(44-02): RED` then `feat(44-02): GREEN`) is the project's locked workflow — keep tests with their implementation.
- **Three works because:** P01 is a pure foundation any implementer can land first. P02 (server) and P03 (client) share only the import from P01; their file sets are disjoint, so they CAN be authored in parallel after P01 commits — but for `yolo` mode + `parallelization: true` (.planning/config.json:4), running them sequentially is safe and slightly easier to verify. Recommended ordering: P01 → P02 → P03 with `auto_chain` between waves.

### Single-comprehensive-plan alternative (REJECTED but documented):

If the planner prefers a single plan, the dependency chain inside it would be:
1. Wave 0: write failing tests for resolver, Satori, React
2. Wave 1: create `resolve-overlay.ts` (foundation)
3. Wave 2 (parallel): Satori extend + server callsites; React preview extend + editor callsites
4. Wave 3: verify all tests green

This is structurally equivalent to three plans but produces one large commit history. Not recommended given Phase 44 set the precedent of plan-per-logical-unit.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json verified, no new deps required
- Architecture: HIGH — all callsites grep'd and read, all types verified, all integration points traced
- Pitfalls: HIGH — derived from direct reading of existing renderer code; no speculation
- Test patterns: HIGH — vitest config verified, existing test files read as templates
- Plan decomposition: HIGH — file lists are exhaustively enumerated from grep results

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days — codebase is stable; Phase 44 just landed)
