# Architecture Patterns — v2.12 Shapes & Icons (Decoration Primitives)

**Domain:** Slide-element decorations (`kind: 'icon' | 'shape'`) as first-class peers of `text_boxes[]` / `custom_images[]` / `watermark` in the v2.11 multi-element editor.
**Researched:** 2026-05-03
**Overall confidence:** HIGH (codebase inspection of every named v2.11 surface; integration points enumerated by reading reducer + both renderers + selection model + layers panel + AI ingest + fork RPC).

---

## Recommended Architecture

### High-level Picture

`decorations[]` is a **fourth scope** on `Slide`, structurally symmetric to the existing three (`text_boxes[]`, `custom_images[]`, `watermark`). Every v2.11 reducer action that already routes per-scope gets a fourth branch; both renderers (Satori + React preview) gain one new iteration site each; the selection model's id-based contract is **unchanged**. The schema lift is **purely additive** — when `slide.decorations` is `undefined`, every renderer site short-circuits and TPLREND-05 byte-identity is preserved on legacy 11 templates.

### Discriminated Union: shared base + per-kind delta

```ts
// Phase 67 (working name; numbers TBD per /gsd-new-milestone)
export interface DecorationBase {
  id: string                         // crypto.randomUUID()
  kind: 'icon' | 'shape'             // discriminator
  position: { x: number; y: number; width: number; height: number }  // % 0-100, mirrors CustomImage
  rotation?: number                  // degrees; Satori SUPPORTS transform: rotate (verified: resolve-overlay.ts:471)
  opacity?: number                   // 0-100, default 100; mirrors CustomImage
  effects?: { shadow?: TextShadowEffect }  // ONLY shadow (NOT outline/highlight — text-only); see DEC-EFFECT below

  // v2.11 multi-select fields — IDENTICAL surface to TextBox + CustomImage
  groupId?: string
  locked?: boolean
  hidden?: boolean
  name?: string                      // optional layers-panel rename override
}

export interface IconDecoration extends DecorationBase {
  kind: 'icon'
  lucideName: string                 // closed enum (validated against lucide-react export keys at module load)
  color: string                      // hex; renderer applies via SVG `color` (currentColor strokes)
  strokeWidth: number                // 0.5 - 4 (lucide native scale)
}

export interface ShapeDecoration extends DecorationBase {
  kind: 'shape'
  shapeKind: 'rect' | 'circle' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'star' | 'polygon'
  fill: string                       // 8-digit hex (alpha supported); 'none' for outlined-only
  stroke?: string                    // hex
  strokeWidth?: number               // px
  borderRadius?: number              // rect only; px (Satori SUPPORTS borderRadius)
  // shape-specific extras
  polygonSides?: number              // polygon (3-12) / star (3-12 points)
  arrowHeadStyle?: 'triangle' | 'open'
}

export type Decoration = IconDecoration | ShapeDecoration
```

**Why `position: { x, y, width, height }` (not the TextBox `TextBoxPosition` discriminator)?** Decorations are **always freeform** — they have no `top/center/bottom` semantic anchor. Mirroring `CustomImage` (4-tuple of % numbers) keeps the snap/marquee/align math identical (`element-rect-intersect.ts:64-79`, `selection-bounds.ts`, `align.ts`) — no extra anchor branch needed.

**Why `effects?` carries `shadow` only?** `TextOutlineEffect` is `WebkitTextStroke` (text-glyph stroke, meaningless on shapes — they already have `stroke`). `TextHighlightEffect` is a per-segment background pill (no segments on shapes). Reusing **only** `TextShadowEffect` keeps the renderer style helper (`satoriEffectStyles` in `render-slide-satori.tsx:70-79`) reusable but specialized.

### Slide schema lift

```ts
// src/lib/types/slide.ts — additive only
export interface Slide {
  // ... existing fields unchanged ...
  /** v2.12 (DEC-01): icons + shapes as first-class addressable elements.
      Optional. When undefined, both renderers short-circuit before any DOM
      emission — TPLREND-05 byte-identity preserved across legacy 11 templates. */
  decorations?: Decoration[]
}
```

The **idempotent absence guarantee** is critical. Every iteration site uses `(slide.decorations ?? []).filter(...)` — when the array is missing, the filter is a no-op and the JSX subtree emits zero nodes. Same defensive pattern as `slide.text_boxes ?? []` and `slide.custom_images ?? []`.

---

## Component Boundaries (1-line each)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `decoration-renderer.tsx` (NEW) | Pure JSX emitter for ONE Decoration; consumed by both renderers | resolve-overlay.ts, render-slide-satori.tsx, slide-preview.tsx |
| `lucide-registry.ts` (NEW) | Closed-enum registry of supported Lucide names + on-demand SVG path resolver | lucide-react |
| `shape-renderer.tsx` (NEW) | Pure SVG/div emitter per shapeKind (rect → `<div>`, others → `<svg>`) | (none — leaf module) |
| `decoration-card.tsx` (NEW, in `text-rail/`) | Right-rail Inspector: fill/stroke/size/effects | editor-actions.ts |
| `lucide-picker.tsx` (NEW) | Modal/popover with virtualized 1,500-icon grid + fuzzy search | lucide-registry |
| `editor-reducer.ts` (MODIFIED) | + `ADD_DECORATION` / `UPDATE_DECORATION` / `REMOVE_DECORATION`; extend 9 multi-select cases | All reducer call sites |
| `text-box-adapter.ts` (UNCHANGED) | Legacy text-box round-trip — decorations DO NOT touch text legacy fields | (no change) |
| `decoration-adapter.ts` (NEW, optional) | AI-ingest boundary normalization (mirrors `legacyToTextBoxes` pattern) | generate-slides.ts |

**Why no `legacy*` adapter equivalent?** Decorations are **net-new** in v2.12 — no legacy field to mirror. `applyDualWrite` only exists because v2.8 added a unified `text_boxes[]` ON TOP of pre-v2.8 `hook_text` / `body_text` / `custom_texts`. v2.12 `decorations[]` is greenfield: write straight to `decorations[]`, no dual-write needed. (This is a major scope reducer vs. v2.8.)

---

## Data Flow

```
1. AI generation (generate-slides.ts)
   → Gemini emits slide.decorations[]  (NEW Phase 71 — schema lift in responseSchema)
   → validateAndRepair() strips invalid lucideName / shapeKind values (NEVER throws)
   → CarouselSchema.parse() (Zod) confirms shape
   → light-touch adapter (optional): decorationsAdapter() validates per-element bounds
   → Supabase write

2. Slide load (use-slide-editor.ts createInitialState)
   → eager mirror via legacyWatermarkToElement is UNCHANGED (only watermark mirror)
   → decorations[] flows through verbatim (no migration needed — additive field)

3. Editor mutation (any v2.11 reducer action)
   → SET_LOCKED / SET_HIDDEN / GROUP / UNGROUP / Z_ORDER / ALIGN / DISTRIBUTE /
     BULK_TRANSLATE / BULK_DELETE / DUPLICATE_ELEMENTS_AT
   → reducer extends fourth branch on slide.decorations[]
   → pushHistory() unchanged (single dispatch per gesture; PERF-01 carry-forward)

4. Render — React preview (slide-preview.tsx)
   → DecorationLayer component iterates (slide.decorations ?? []).filter(d => d.hidden !== true)
   → Each decoration wrapped in <Rnd> when editable={true} (mirrors CustomImage Rnd wrapper at line ~2347)
   → Click → onDecorationSelect → selection.replaceWith([id])

5. Render — Satori PNG export (render-slide-satori.tsx)
   → Same iteration, same filter, NO Rnd wrapper, NO selection chrome
   → Uses shared <DecorationRenderer> primitive from resolve-overlay.ts (TPLREND-05)

6. Publish/Fork (Supabase RPCs)
   → publish: snapshot pattern (slide_data jsonb) carries decorations[] verbatim
   → fork: _strip_decoration_locked() helper mirrors v2.4 brand_kit_id strip pattern
```

---

## Patterns to Follow

### Pattern 1: Per-scope reducer routing (v2.11 norm)

**What:** Every multi-select reducer action walks each addressable scope (`text_boxes`, `custom_images`, `watermark`) independently and merges results.
**When:** Any new reducer case touching multi-select state.
**Example (extending BULK_TRANSLATE):**

```ts
case 'BULK_TRANSLATE': {
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    const idSet = new Set(action.ids)

    // ... existing text_boxes branch (unchanged) ...
    // ... existing custom_images branch (unchanged) ...

    // NEW: decorations branch — mirrors custom_images shape exactly
    let nextDecorations = slide.decorations
    if (slide.decorations) {
      nextDecorations = slide.decorations.map((d) => {
        if (!idSet.has(d.id)) return d
        if (d.locked === true) return d                 // Phase 64 honor
        return { ...d, position: {
          ...d.position,
          x: d.position.x + action.deltaX,
          y: d.position.y + action.deltaY,
        }}
      })
    }

    let next: Slide = slide
    if (nextTextBoxes !== slide.text_boxes && nextTextBoxes !== undefined) {
      next = applyDualWrite(next, nextTextBoxes)
    }
    if (nextCustomImages !== slide.custom_images) next = { ...next, custom_images: nextCustomImages }
    if (nextDecorations !== slide.decorations) next = { ...next, decorations: nextDecorations }
    return next
  })
  return pushHistory(state, slides)  // PERF-01: still exactly one pushHistory
}
```

### Pattern 2: Idempotent absence (TPLREND-05 invariant)

**What:** Every iteration site uses `(slide.decorations ?? [])` — when undefined, the filter/map produces an empty array → no DOM nodes → identical to pre-v2.12 output.
**When:** ALL render sites + transform sites that read `slide.decorations`.
**Why:** Legacy 11 templates never emit decorations; new templates may opt in. Byte-identity is preserved on every project that pre-dates v2.12.

### Pattern 3: Shared decoration primitive (TPLREND-05 parity)

**What:** A single pure module `decoration-renderer.tsx` exports `<DecorationRenderer decoration={d} origin={...} />` consumed by **both** Satori and React preview.
**When:** ANY visual property of a decoration (icon SVG path, shape geometry, shadow, opacity, rotation, fill color).
**Why:** Same reason `resolve-overlay.ts` exists. Two duplicated implementations drift; one shared module cannot.

```tsx
// src/lib/render/decoration-renderer.tsx (NEW)
export function renderDecoration(d: Decoration, origin?: string): React.ReactNode {
  if (d.kind === 'icon') return renderIconDecoration(d, origin)
  return renderShapeDecoration(d)
}
```

Both renderers import and call this. Like `renderGrain` / `renderVignette` / `renderDecorativeOverlay`, the helper uses `React.createElement` so the file can stay `.ts` if needed (or `.tsx` — both renderers already JSX-compile).

### Pattern 4: Lucide registry (closed enum)

**What:** A static array of supported Lucide names, validated at module load via `validateRegistry`. Renderer reads `import * as Lucide from 'lucide-react'` and resolves SVG path data; falls back to a sentinel when the name is unknown.
**When:** Validating `IconDecoration.lucideName` at AI ingest, render time, and editor commit.
**Why:** Lucide ships ~1,500 icons; bundling the entire surface as the React-component ESM tree would inflate the editor bundle by ~600KB. **Use `lucide-react/dynamicIconImports`** (verified shipped pattern) — pulls the SVG path on demand for the picker, lazy-loaded; the renderer pulls the same path at render. Confirm via Context7 lookup before committing — see Pitfall 3.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: CSS filter for icon coloring

**What:** Using `filter: invert()` or `filter: hue-rotate()` to recolor a Lucide SVG.
**Why bad:** Satori silently drops `filter` (vercel/satori#573 — already burned us in v2.9 photo treatment, see PROJECT.md "CSS filters silently break Satori"). Preview would show colored icon; PNG export would show black icon. Silent TPLREND-05 break.
**Instead:** Use Lucide's native `color` prop (sets `currentColor`; works in both renderers) OR for paths use `fill={d.color}` directly on `<path>`.

### Anti-Pattern 2: SVG `<defs>` / `<symbol>` / `<use>` reuse

**What:** Single `<defs>` block + `<use href="#icon-id">` for repeated icons.
**Why bad:** Satori (per vercel/satori#41 / #162) does not honor `<use>` references — it inlines `<defs>` but does not resolve `<use>` to the referenced node. PNG would emit empty bounding boxes for every reused icon.
**Instead:** Inline the full SVG path data per decoration. Bundle cost is negligible at ≤30 elements/slide (Lucide path strings average ~200 bytes).

### Anti-Pattern 3: CSS z-index for decoration layering

**What:** `style={{ zIndex: d.zOrder }}` on each decoration.
**Why bad:** Satori has no z-index support (verified throughout codebase: see `render-slide-satori.tsx:96-97 "No z-index support; layer order = DOM order"`). PNG would render decorations in array order; React preview would respect z-index. Drift.
**Instead:** Decorations follow array order (same as `custom_images`). Z-order reordering uses the v2.11 `Z_ORDER` reducer action via array splice (zero CSS — `applyZOrderToArray` already does this).

### Anti-Pattern 4: SVG `mask` / `clip-path`

**What:** Star/polygon shapes implemented via `clip-path: polygon(...)` on a `<div>`.
**Why bad:** Same Satori-CSS-subset problem — `clip-path` not in supported list.
**Instead:** Render polygons / stars as inline `<svg>` with computed `<polygon points="..."/>` strings.

### Anti-Pattern 5: Decoration as a TextBox subtype

**What:** Encoding shapes as `TextBox` with `role: 'shape'` and zero text.
**Why bad:** TextBox carries `text`, `segments`, `font_*`, `text_align`, `list_*` — none meaningful for shapes. Adapter (`text-box-adapter.ts`) round-trips through legacy fields; a "shape TextBox" would corrupt the legacy `custom_texts` mirror. Coupling without payoff.
**Instead:** First-class `Decoration` discriminated union. The peer cost (one new schema field, one new reducer branch per action) is lower than the coupling cost.

---

## Integration Point Enumeration (the EVERY-CASE quality gate)

### A. Reducer cases requiring a `decorations` branch

Read sequentially from `editor-reducer.ts`. **Every** case below needs work:

| # | Case | Current scopes touched | Decoration extension |
|---|------|------------------------|----------------------|
| 1 | `ADD_SLIDE` | (creates blank slide) | `blankSlide()` should NOT initialize `decorations` (left undefined → byte-identity) |
| 2 | `REMOVE_SLIDE` | (no element walk) | No change |
| 3 | `DUPLICATE_SLIDE` | text_boxes, custom_texts, custom_images | **+ regenerate decoration ids on clone** (lines 196-204 pattern) |
| 4 | `REORDER_SLIDES` | (no element walk) | No change |
| 5 | `UPDATE_SLIDE` | (whole-slide merge) | No change (decorations field flows through `...action.updates`) |
| 6 | `SET_SLIDES` | (full replace) | No change |
| 7 | `ADD_CUSTOM_TEXT` / `UPDATE_CUSTOM_TEXT` / `REMOVE_CUSTOM_TEXT` | custom_texts | No change (different scope) |
| 8 | `ADD_CUSTOM_IMAGE` / `UPDATE_CUSTOM_IMAGE` / `REMOVE_CUSTOM_IMAGE` | custom_images | No change (different scope) |
| 9 | `ADD_TEXT_BOX` / `UPDATE_TEXT_BOX` / `REMOVE_TEXT_BOX` | text_boxes | No change (different scope) |
| 10 | **NEW: `ADD_DECORATION`** | — | **NEW** — append to decorations[] with crypto.randomUUID; pushHistory once |
| 11 | **NEW: `UPDATE_DECORATION`** | — | **NEW** — id-keyed merge; honor `locked === true` short-circuit (mirrors REMOVE_TEXT_BOX gate at lines 366-372) |
| 12 | **NEW: `REMOVE_DECORATION`** | — | **NEW** — id-keyed filter; honor locked short-circuit |
| 13 | **`BULK_TRANSLATE`** | text_boxes (custom anchor + unlocked), custom_images (unlocked) | **+ decorations branch** (lines 396-441; mirror custom_images skip-locked logic) |
| 14 | **`BULK_DELETE`** | text_boxes (custom role + unlocked), custom_images (unlocked) | **+ decorations branch** (lines 463-496) |
| 15 | **`DUPLICATE_ELEMENTS_AT`** | text_boxes, custom_images | **+ decorations branch** (lines 509-579) — deep-copy with new id + position delta + optional newGroupId |
| 16 | **`GROUP`** | text_boxes, custom_images, watermark | **+ decorations branch** (lines 593-683) — assign action.groupId; participate in subset-dissolve cascade |
| 17 | **`UNGROUP`** | text_boxes, custom_images, watermark | **+ decorations branch** (lines 694-759) — clear groupId on listed ids |
| 18 | **`SET_LOCKED`** | text_boxes, custom_images, watermark | **+ decorations branch** (lines 775-836) — toggle `locked` on listed ids |
| 19 | **`SET_HIDDEN`** | text_boxes, custom_images, watermark | **+ decorations branch** (lines 852-913) — toggle `hidden` on listed ids |
| 20 | **`ALIGN`** | (via `applyAlignPatches` → text_boxes custom-anchor + custom_images unlocked) | **+ extend `applyAlignPatches`** (lines 111-164) to walk decorations; also extend pure `align.ts` to include decorations in the alignment-target footprint computation |
| 21 | **`DISTRIBUTE`** | (via `distributeElements` → same scope as ALIGN) | **+ extend `distributeElements`** in `align.ts` |
| 22 | **`Z_ORDER`** | text_boxes (via applyZOrderToArray), custom_images (via applyZOrderToArray), watermark (single-slot no-op) | **+ apply `applyZOrderToArray` to decorations[]** (lines 972-1022); same single-action dispatch shape |
| 23 | `UNDO` / `REDO` | (history pointer) | No change |

**Result: 13 of 22 reducer cases need a fourth `decorations` branch** (cases #3 + #10–#22).

**Symmetry check — is a single helper enough?** Cases #13/#14/#15/#16/#17/#18/#19/#22 all share the shape `iterate-array → filter-by-idSet → map-with-locked-skip`. A helper like `applyToScope<T>(arr, idSet, fn)` would compress ~80 LOC. **Recommendation: still write each case explicitly** — the per-scope detail differs (subset-dissolve cascade, structural-anchor skip, applyDualWrite call site) and the v2.11 codebase has been audited at this verbosity. Stay congruent with the existing pattern; do not micro-refactor mid-milestone.

### B. Selection model surface (no schema change required)

`Selection { ids: string[]; primary: string | null }` is **id-only** — it's already scope-agnostic. Decoration ids drop in transparently.

| Surface | Current behavior | Decoration extension |
|---------|------------------|----------------------|
| `useSelectionModel.selectAll(slide)` | `ids = text_boxes ∪ custom_images ∪ watermark` | **+ ∪ decorations** |
| `replaceWith / addToSelection / toggleInSelection / clear` | id-only ops | No change |
| Stale-id prune effect (SEL-11) | clears ids not present on current slide | **+ scan decorations** when computing valid-id set |
| `enterGroup(elementId, slide)` | walks all 3 scopes for `groupId` lookup | **+ walk decorations** |

**ID strategy: pure UUID** (`crypto.randomUUID()`). No `d_${slideIndex}` namespacing — mirrors `text_boxes[].id` and `custom_images[].id`. The watermark uses `w_${slideIndex}` because there's exactly one watermark per slide and the deterministic id makes legacyWatermarkToElement idempotent. Decorations are unbounded N — UUIDs match the precedent.

### C. Renderer integration — DOM-order placement

#### Current Satori layer order (`render-slide-satori.tsx`)

```
0   Background fill / image                      (line 313)
1.0 backgroundMode bottom-card                   (line 349)
1.5 renderGrain                                  (line 329)
2.0 Overlay color tint                           (line 331)
2.5 renderVignette                               (line 343)
3.0 template.overlays.map (decorative + slot)    (line 374)
4.0 Hook + body text                             (lines 449-474)
5.0 Custom images                                (line 477)
6.0 Watermark (brand)                            (line 495)
7.0 Custom text boxes                            (line 511)
8.0 Forced free-tier watermark                   (line 545)
```

**Recommended decoration insertion: layer 5.5** — between custom_images (5.0) and watermark (6.0). User-z-orderable WITHIN the decorations array via `Z_ORDER` (already plumbed); cross-array ordering (decoration above watermark, etc.) is OUT OF SCOPE for v2.12 (mirrors v2.11 Z_ORDER scope-internal contract).

```tsx
{/* v2.12 (DEC-RENDER-01): decorations layer — between custom_images (5.0)
    and watermark (6.0). Filter hidden===true (LOCK-07 carry-forward).
    TPLREND-05 byte-identity preserved when decorations === undefined. */}
{(slide.decorations ?? []).filter((d) => d.hidden !== true).map((d) => (
  <React.Fragment key={d.id}>{renderDecoration(d, origin)}</React.Fragment>
))}
```

#### React preview (`slide-preview.tsx`)

Two render branches:
1. **Non-editable** (`editable={false}` — published carousel display): insert mirror Fragment at the same DOM-order position. Lines ~1037-1066 area.
2. **Editable** (`editable={true}` — editor canvas): each decoration wrapped in `<Rnd>` with selection click + drag/resize/locked/hidden gates. Mirrors `custom_images` editable branch starting around line 2347.

Both branches MUST use the same shared `<DecorationRenderer>` for the visual node. Editor chrome (selection ring, drag handles, lock icon) is layered ON TOP via the existing v2.11 patterns — already proven structurally gated by the `editable={true}` early return.

### D. Layers panel — `synthesizeRows()` extension

`layers-panel.tsx:90-160` walks `text_boxes ∪ custom_images ∪ watermark`. Extension:

```ts
// types.ts: extend the discriminated union
export type LayerElementType = 'text' | 'image' | 'watermark' | 'decoration'

// layers-panel.tsx: add a fourth walk between custom_images and watermark
for (const d of slide.decorations ?? []) {
  elements.push({
    id: d.id,
    groupId: d.groupId,
    locked: d.locked === true,
    hidden: d.hidden === true,
    type: 'decoration',
    label: decorationLabel(d),  // NEW: "Star", "Heart icon", or d.name
  })
}
```

`getGroupMembers` (`group-membership.ts`) already walks all scopes — extend to include decorations. `decorationLabel` is a new helper mirroring `textBoxLabel` / `customImageLabel`.

### E. AI ingest boundary (`generate-slides.ts`)

```ts
// Phase 71-AI: extend Gemini schema
const decorationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    kind: { type: Type.STRING, enum: ['icon', 'shape'] },
    lucideName: { type: Type.STRING, description: '(icon only) Closed enum from registry — invalid silently stripped' },
    shapeKind: { type: Type.STRING, enum: ['rect', 'circle', 'ellipse', 'triangle', 'line', 'arrow', 'star', 'polygon'] },
    color: { type: Type.STRING },
    fill: { type: Type.STRING },
    stroke: { type: Type.STRING },
    strokeWidth: { type: Type.NUMBER },
    position: { /* x, y, width, height */ },
    // ... etc
  },
}

// Append to slide schema
slides.items.properties.decorations = { type: Type.ARRAY, items: decorationSchema }

// Validation — mirror legacyToTextBoxes pattern at line 184-188
const slidesWithTextBoxes: SlideContentWithTextBoxes[] = parsedCarousel.slides.map((slide) => ({
  ...slide,
  text_boxes: legacyToTextBoxes(slide as unknown as Slide),
  decorations: validateDecorations(slide.decorations ?? []),  // NEW — strips invalid lucideName / shapeKind
}))
```

**Advisory monoculture gate:** mirrors v2.9's `hookOpeningTrigram` advisory in `validateAndRepair`. Trigger: across N slides, if `>50%` share the same `lucideName` OR same `shapeKind`, emit a warning to the retry-once gate. Does NOT fail CI in v2.12 (advisory-only, same posture as v2.9).

### F. Forking + RPC + Storage

`supabase/migrations/20260502_fork_strip_locked.sql` ships a `_strip_locked_from_slide_data(jsonb)` helper called from `fork_published_carousel`. The helper walks `text_boxes`, `custom_images`, and `watermark` to strip `locked`. **NEW migration required:**

```sql
-- 20260YYY_fork_strip_decoration_locked.sql
CREATE OR REPLACE FUNCTION public._strip_locked_from_slide_data(p_slide_data jsonb)
RETURNS jsonb AS $$
  -- ... existing text_boxes / custom_images / watermark walks unchanged ...
  -- NEW: decorations walk
  IF jsonb_typeof(p_slide_data->'decorations') = 'array' THEN
    UPDATE ... -- strip locked from each decorations[] element
  END IF;
$$
```

No additional Storage bucket needed — Lucide SVG paths inline; shape geometries are pure CSS/SVG. No equivalent of `slide-backgrounds-treated`.

### G. Right-rail panel — `DecorationCard`

Mirrors `ActiveTextBoxCard.tsx` shell pattern. Mounted in `TextEditorPanel` composition (NOT `text-editor-panel-legacy.tsx`). Selection routing:

```ts
// In TextEditorPanel — branch on selection.primary's element type:
const primary = selection.primary
const primaryType = resolveElementType(slide, primary)  // 'text' | 'image' | 'watermark' | 'decoration' | null
return (
  <>
    {primaryType === 'text' && <ActiveTextBoxCard ... />}
    {primaryType === 'decoration' && <DecorationCard ... />}
    {/* ... etc */}
    <SlideSettings ... />
  </>
)
```

`DecorationCard` rows:
- **Fill** (shape only) — color picker + alpha slider
- **Stroke** (shape only) — color + width slider
- **Color + strokeWidth** (icon only) — color picker + 0.5–4 stepper
- **Size + Position** — w/h/x/y numeric inputs (mirrors existing patterns)
- **Effects** — single `EffectRow` for Shadow (reused from `text-rail/EffectRow.tsx`)
- **Opacity** — slider 0-100

**Insert entry point** lives in `editor-toolbar.tsx`. Two new buttons:
- "Insert icon" → opens `<LucidePicker>` modal/popover
- "Insert shape" → opens a tiny popover with 8 shape primitives

Selecting from the picker dispatches `ADD_DECORATION` with sane defaults (`position: { x: 40, y: 40, width: 20, height: 20 }`), then sets selection to the new id.

### H. Lucide picker placement

**Recommended: Modal** (matches `publish-modal.tsx` precedent). NOT a right-rail tab (steals space from Inspector); NOT a slide-out drawer (no other drawer in current UI).

Inside the modal:
- Search input (autoFocus; debounced 100ms)
- Virtualized grid via `react-virtuoso` (verified shipped in node_modules transitively for layers panel decision; OR use `react-window` — confirm availability via Context7 / `package.json` before committing)
- Fuzzy match via `fuse.js` OR a simple `name.includes(query.toLowerCase())` (the latter is sufficient for 1,500 entries — no extra dependency)
- Keyboard nav: arrow keys move focus, Enter inserts, Esc closes (matches the v2.11 keyboard contract codified in SWEEP-1..4)

---

## Could-Silently-Break-TPLREND-05 Surfaces (HIGH FLAG)

These are the integration points where decorations could break byte-identity on legacy 11 templates if not gated by parity tests. **Each MUST get a PCL/PTF/PRS-style audit test** mirroring Plan 65-03's `parity.template-fingerprint.test.tsx` patterns.

| # | Surface | Silent-break risk | Mitigation |
|---|---------|-------------------|------------|
| **R1** | `render-slide-satori.tsx` decorations layer 5.5 insertion | If iteration emits an empty Fragment when decorations=undefined (instead of nothing), Satori may add a zero-height `<div>` that shifts subsequent absolute positioning by 0px (currently — but a future Satori upgrade could break this). | **Test:** PTF — render every legacy template with `slide.decorations === undefined` → assert PNG fingerprint identical to pre-v2.12 baseline. Use `(slide.decorations ?? []).map(...)` (no Fragment wrapper) to emit nothing when array missing. |
| **R2** | `slide-preview.tsx` non-editable branch decoration insertion | Same as R1 — a stray `<></>` could shift DOM order or trigger React reconciliation. | **Test:** PTF runtime + source-grep dual gate (PCL pattern from Plan 65-03). |
| **R3** | `synthesizeRows()` walk order change | If decorations are walked BEFORE custom_images instead of between custom_images and watermark, layers panel order shifts → snapshot tests break and users see regression. | **Test:** Pin walk order in 2-3 layers-panel snapshot tests (LP1/LP2 patterns). Lock decoration position to "after custom_images, before watermark" (mirrors render-DOM order). |
| **R4** | `selection.selectAll(slide)` extension | If the `ids[]` order changes after adding decorations to the union, downstream tests asserting `selectAll` order break. | **Test:** Pin order: `text_boxes ∪ custom_images ∪ decorations ∪ watermark`. |
| **R5** | `applyZOrderToArray(slide.decorations, ...)` | New scope; if decoration-internal z-order accidentally bleeds into custom_images array (e.g. dispatcher routes to wrong scope), legacy custom-image z-ordering breaks. | **Test:** Cross-scope z-order isolation test — dispatch Z_ORDER on a decoration id and assert custom_images array is ref-equal pre/post. |
| **R6** | `BULK_TRANSLATE` decoration branch | If the locked-skip is forgotten, locked decorations move on Cmd+Drag. | **Test:** Mirror BL-LOCK test pattern from Phase 64 reducer suite (1 case). |
| **R7** | Fork RPC `_strip_locked_from_slide_data` | If the SQL helper doesn't recurse into decorations[], locked flags survive a fork → forker inherits creator's locks. | **Test:** Migration-level Vitest covering the JSONB walk. Same pattern as `20260502_fork_strip_locked.sql` test. |
| **R8** | Lucide bundle weight / dynamic import | If the editor accidentally imports the entire `lucide-react` package instead of the dynamic-icon path, editor bundle inflates ~600KB → no break in correctness, but PERF regression. | **Test:** Bundle-size gate in CI (existing `.next/analyze` step). Acceptable threshold: +20KB editor, +0KB renderer. |
| **R9** | `align.ts` extension to include decorations in target footprint | If decorations are walked in the alignment-target AABB but not pre-filtered for locked === true, "align to selection" produces wrong target. | **Test:** ALIGN-LOCK test (1 case mirroring AR7b lock-exclusion test). |
| **R10** | `element-rect-intersect.ts` (marquee) extension | If decoration's locked flag is not honored, marquee selects locked decorations. | **Test:** Mirror Plan 64 LOCK-05 marquee test (1 case). |

**Rollup test count estimate:** 10-15 new parity/regression tests + 30-40 new reducer-case tests + 8-10 renderer fingerprint tests. Total: ~50-60 tests for the milestone (smaller than v2.11's +200; v2.12 inherits the v2.11 test infrastructure).

---

## Suggested Build Order — 5 Phases

Phase numbering picks up at **67** (v2.11 ended at 66). Five phases is the right size — v2.11 was 7 phases over 12 categories; v2.12 has fewer categories (no marquee/group/lock/z-order to BUILD — those just need to LEARN the new scope).

### Phase 67 — Schema lift + null-decoration TPLREND-05 audit

**Output:** `decorations?: Decoration[]` lands on `Slide`. Both renderers gain a `(slide.decorations ?? []).map(...)` no-op site at layer 5.5 / mirror branch. **Zero rendering** (no UI to insert one yet). PARITY-XX test suite proves byte-identity on legacy 11 templates with `decorations === undefined`.

- Discriminated-union types + Zod schema + Lucide registry stub
- Renderer null-iteration insertion (Satori + React preview both branches)
- `synthesizeRows` extension (no decoration data yet → no rows added)
- 10-12 PTF/PCL audit tests pinning byte-identity baseline

**Deps:** None.
**Risk:** Lowest. The whole phase is "type plumbing + idempotent null branches." Locks the parity invariant before any feature lands.

### Phase 68 — Reducer extensions + selection model walk

**Output:** Every multi-select reducer action knows about decorations. ADD/UPDATE/REMOVE_DECORATION cases. Selection model walks the new scope. NO UI — reducer-level tests prove correctness.

- 13 reducer cases extended (table A above)
- 3 new actions (`ADD_DECORATION`, `UPDATE_DECORATION`, `REMOVE_DECORATION`) routed through pushHistory
- `align.ts` / `selection-bounds.ts` / `element-rect-intersect.ts` / `group-membership.ts` extensions (5 pure modules)
- `useSelectionModel.selectAll` + stale-id prune effect + enterGroup walks
- ~30-40 reducer tests (mirrors Phase 64's 33-test suite)

**Deps:** Phase 67 schema.
**Risk:** Medium. Per-scope routing is well-trodden; the temptation to over-helper-ize is real (resist).

### Phase 69 — Renderers + DecorationRenderer primitive + first hand-injected decoration

**Output:** Decorations actually render. Hand-crafted seed decoration in a test fixture proves both renderers emit byte-identical PNG/DOM. NO editor UI yet — fixture drives via `SET_SLIDES`.

- `decoration-renderer.tsx` shared primitive
- Lucide on-demand SVG path resolver
- Shape SVG emitters for all 8 shapeKinds
- Editable-branch Rnd wrapping (mirror custom_images pattern at line ~2347)
- Selection click → onDecorationSelect wiring
- ~15-20 renderer tests (PTF dual-renderer fingerprint for icon + each shapeKind = 9 baseline snapshots)

**Deps:** Phase 67 (schema), Phase 68 (selection routing for click handler).
**Risk:** HIGH for TPLREND-05 — this is where Satori-CSS-subset gotchas could silently break parity. Verify Satori support for `<svg>`, `<polygon>`, `transform: rotate`, `borderRadius` via Context7 BEFORE writing renderer code.

### Phase 70 — Editor UI: insert + DecorationCard + Layers panel surfacing

**Output:** Users can now actually create and edit decorations. Lucide picker modal + shape picker popover + DecorationCard right-rail Inspector + layers-panel chips for decorations.

- `editor-toolbar.tsx` two new insert buttons
- `<LucidePicker>` modal — virtualized grid, fuzzy search, keyboard nav
- `<ShapePicker>` popover — 8 primitives
- `<DecorationCard>` right-rail composition (mirrors ActiveTextBoxCard shell)
- `DecorationLabel` helper + LayerElementType union extension to 'decoration'
- `synthesizeRows` decoration walk inserts data (only iteration site that previously emitted no rows)
- ~25-30 component tests + 5-8 layers-panel tests

**Deps:** Phases 67, 68, 69.
**Risk:** Medium. Most surface area, but most of it is conventional component composition.

### Phase 71 — AI emit + Fork RPC + comprehensive parity audit

**Output:** Gemini emits decorations natively. Fork strips locked. Final PARITY-XX audit suite covers all 10 silent-break surfaces. Milestone ships.

- Gemini schema extension + light-touch validation adapter
- Advisory monoculture gate (lucideName / shapeKind repetition trigger; advisory-only)
- Supabase migration for `_strip_locked_from_slide_data` decoration walk
- Final R1–R10 audit suite (~20-25 tests)
- Bundle-size gate verification
- Manual ship-gate: render 5 legacy projects → confirm PNG byte-identical pre/post v2.12

**Deps:** All prior phases.
**Risk:** Low — Gemini schema extension is well-trodden; fork RPC migration is a copy-of-copy pattern from v2.4 → v2.11.

---

## Phase Dependency Graph

```
Phase 67 (Schema + Null Audit)  ──►  Phase 68 (Reducer + Selection)  ──►  Phase 69 (Renderers)  ──►  Phase 70 (Editor UI)  ──►  Phase 71 (AI + Fork + Final Audit)
                          │                                                     │
                          └──────────────►  optional parallel: ───────────────────┘
                                            Lucide registry research /
                                            picker UX wireframes
```

---

## Scalability Considerations

| Concern | At 5 decorations/slide | At 30 decorations/slide (v2.11 stated bound) | At 100/slide (post-PMF; defer) |
|---------|------------------------|-----------------------------------------------|--------------------------------|
| Marquee perf | <0.5ms `elementsInRect` | <2ms (Plan 63's perf budget); fine | Profile; consider AABB index |
| Render DOM nodes | +10-15 nodes/slide | +60-90 nodes/slide; well within Satori budget | Profile Satori SVG compile |
| Selection ring AABB compute | <0.2ms `computeSelectionBounds` | <1ms | Memoize via useMemo on selection |
| Layers panel list height | 5 chips | 30 chips (current vanilla list works) | Virtualize (defer per LAYERS-D-01) |
| Lucide bundle weight | Negligible (dynamic import) | Negligible | Negligible |
| Z_ORDER array splice | O(N) on text_boxes scope | O(N) — fine | Profile if user complains |

---

## Sources

**Codebase inspection (primary):**
- `src/lib/types/slide.ts` (full read — all interfaces enumerated)
- `src/lib/render/resolve-overlay.ts` (full read — TPLREND-05 invariant pinned)
- `src/lib/render/render-slide-satori.tsx` (lines 1-550 — layer order pinned)
- `src/components/slides/slide-preview.tsx` (lines 1-275, hidden-filter sites grep)
- `src/lib/editor/editor-reducer.ts` (full read — every reducer case enumerated, 22 cases counted)
- `src/lib/ai/generate-slides.ts` (full read — AI ingest boundary mapped)
- `src/components/editor/layers-panel/layers-panel.tsx` (lines 1-160, synthesizeRows + types)
- `src/components/editor/layers-panel/types.ts` (full read — LayerRow union)
- `src/lib/editor/use-selection-model.ts` (lines 40-140 — Selection contract)
- `src/lib/editor/transforms/{align,selection-bounds,element-rect-intersect,group-membership,snap-index}.ts` (relevant excerpts)
- `src/lib/editor/watermark-adapter.ts` (referenced — the legacy adapter precedent)
- `supabase/migrations/20260502_fork_strip_locked.sql` (lines 1-130 — fork strip pattern)

**Project documents:**
- `.planning/PROJECT.md` (v2.11 retrospective, v2.12 active scope)
- `.planning/MILESTONES.md` (v2.11 phase decomposition reference)

**Verified Satori limitations** (training-data + codebase comments cross-checked):
- vercel/satori#573 — CSS filter dropped silently (referenced throughout v2.9 codebase)
- vercel/satori#41 / #162 — `<defs>`/`<use>` SVG reuse limitations (mentioned in resolve-overlay.ts comments)
- "No z-index support; layer order = DOM order" — verified in `render-slide-satori.tsx:96-97`

**Confidence:** HIGH on every codebase-grounded claim (reducer case enumeration, layer order, integration points). MEDIUM on Lucide-react dynamic-import bundle weight (verify via Context7 lookup before Phase 70). HIGH on Phase ordering rationale (mirrors v2.11's proven 5-phase shape, smaller in scope).
