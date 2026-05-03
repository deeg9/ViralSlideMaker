# Phase 60: Multi-Select Foundation + Watermark Schema Lift — Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 13 new + 7 modified
**Analogs found:** 19 / 20 (one new file — `useModifierState` — has no perfect in-codebase analog; closest is `useAlignmentGuides` shape)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| **NEW** `src/lib/editor/use-selection-model.ts` | hook | event-driven (selection state outside reducer) | `src/lib/editor/use-slide-editor.ts:24-66` | exact (extends same pattern) |
| **NEW** `src/lib/editor/use-modifier-state.ts` | hook | event-driven (window keyup/blur listeners) | `src/hooks/use-alignment-guides.ts:67-100` | role-match (custom hook with internal state + memoized API) |
| **NEW** `src/lib/editor/watermark-adapter.ts` | adapter (pure module) | transform (legacy↔unified round-trip) | `src/lib/editor/text-box-adapter.ts` | exact (mirror byte-for-byte structure) |
| **NEW** `src/lib/editor/transforms/selection-bounds.ts` | utility (pure) | transform (compute union AABB) | `src/hooks/use-alignment-guides.ts:73-78` (edge math) | role-match (pure geometry helper) |
| **NEW** `src/components/editor/multi-select-type-bar.tsx` | component | request-response (bulk dispatch) | `src/components/editor/text-rail/LayerStrip.tsx` (chip strip) + `src/components/editor/watermark-controls.tsx` (panel shell) | role-match (right-rail panel shown conditionally) |
| **NEW** `src/lib/editor/__tests__/watermark-adapter.test.ts` | test | — | `src/lib/editor/__tests__/text-box-adapter.test.ts` | exact (same fixture + round-trip pattern) |
| **NEW** `src/lib/editor/__tests__/use-selection-model.test.ts` | test | — | `src/lib/editor/__tests__/editor-reducer.test.ts` | role-match (hook test via `renderHook`) |
| **NEW** `src/lib/editor/__tests__/selection-bounds.test.ts` | test | — | `src/lib/editor/__tests__/text-box-adapter.test.ts` (pure-fn unit pattern) | role-match |
| **MODIFIED** `src/lib/types/slide.ts` | model (interfaces) | — | existing `TextBox` interface (lines 90-103) for additive optional fields | exact |
| **MODIFIED** `src/lib/editor/editor-actions.ts` | action types | — | existing `ADD_TEXT_BOX`/`REMOVE_TEXT_BOX` action shape (lines 26-36) | exact |
| **MODIFIED** `src/lib/editor/editor-reducer.ts` | reducer | event-driven | `UPDATE_TEXT_BOX` case at lines 271-280 + `applyDualWrite` at 22-55 | exact |
| **MODIFIED** `src/lib/editor/use-slide-editor.ts` | hook | event-driven | self (line 29 + comment 27-28) | exact (replace single-id slot with Selection) |
| **MODIFIED** `src/components/editor/slide-editor.tsx` | component | request-response (keyboard dispatch) | self (lines 340-393 keydown handler) | exact (migrate to tinykeys, preserve `isEditing` guard 344-348) |
| **MODIFIED** `src/components/slides/slide-preview.tsx` | component | request-response (canvas pointer + selection ring) | self (lines 877-886 ring vars; 952-960 canvas onClick; 1062-1071 wrapper onMouseDown) | exact (extend to multi-id; add union-AABB ring) |
| **MODIFIED** `src/lib/render/render-slide-satori.tsx` | renderer | transform (slide → JSX) | self (lines 273-275 + 463-476 watermark consumption) | exact (read from new path with legacy fallback) |
| **MODIFIED** `src/lib/render/__tests__/parity.test.tsx` | test | — | self (lines 28-99 — extend with watermark fixtures) | exact |
| **MODIFIED** `src/lib/render/__tests__/no-css-filter.test.ts` | test | — | self (lines 26-51 grep-style scan) | exact (add `*selection*` / `*marquee*` / `*guide*` regex) |

---

## Pattern Assignments

### `src/lib/editor/use-selection-model.ts` (hook, event-driven)

**Analog:** `src/lib/editor/use-slide-editor.ts` (entire file — selection lives outside reducer)

**Why this analog:** v2.8 already established the canonical "selection state in React state, NEVER in reducer history" rule with the comment at lines 27-28. v2.11 just generalizes from single-id `string | null` to `Selection { ids: string[]; primary: string | null }`. The shape changes; the placement does not.

**Comment-as-contract** (`use-slide-editor.ts:27-28`):
```typescript
// Phase 49: selection state for the new TextBox-driven right rail (Phase 50 consumes this).
// Stored OUTSIDE the editor history — selection changes never push undo/redo.
const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
```

**Stale-id reconciliation pattern to follow** (mirror this `useEffect`-keyed-on-removal idea, currently inlined into `removeTextBox` at `use-slide-editor.ts:42-45`):
```typescript
const removeTextBox = useCallback((slideIndex: number, textBoxId: string) => {
  dispatch({ type: 'REMOVE_TEXT_BOX', slideIndex, textBoxId })
  setSelectedTextBoxId((current) => (current === textBoxId ? null : current))
}, [])
```

**v2.11 generalization (planner copies this idea):** the equivalent reconciliation for multi-select must run as a `useEffect` keyed on `state.present` (the slide content) rather than inline in each remove handler — there are too many removal paths (`REMOVE_TEXT_BOX`, `REMOVE_CUSTOM_IMAGE`, `REMOVE_CUSTOM_TEXT`, `DUPLICATE_SLIDE` ID regen, `UNDO`/`REDO`, slide switch). One effect that filters `selection.ids` against the union of currently-existing element ids covers all of them.

**API surface to mirror** (drop `selectedTextBoxId` + `setSelectedTextBoxId` from the returned object at `use-slide-editor.ts:60-61`; replace with `selection` + `setSelection` + helpers `addToSelection`/`removeFromSelection`/`replaceSelection`/`selectAll`/`clearSelection`).

---

### `src/lib/editor/use-modifier-state.ts` (hook, event-driven)

**Analog:** `src/hooks/use-alignment-guides.ts:67-100` — closest example of a custom hook that listens to events and exposes a stable `useCallback`-wrapped API.

**Why this analog:** No existing hook listens to `window.blur` / `document.visibilitychange` reset cycles, so this is fresh ground. `useAlignmentGuides` is the right structural template: returns `{ activeGuides, calculateSnap, clearGuides }` with internal state + memoized callbacks.

**Shape to mirror** (`use-alignment-guides.ts:67-71`):
```typescript
export function useAlignmentGuides() {
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([])

  const calculateSnap = useCallback(
    (dragging: TextBox, others: TextBox[]): SnapResult => {
      // ...
```

**v2.11 implementation contract** (per CONTEXT.md decisions):
- Internal `useRef<{shift:boolean; cmd:boolean; alt:boolean}>` (NOT `useState`) so consumers don't re-render every keypress.
- `useEffect` mounts `keydown` + `keyup` + `blur` + `visibilitychange` listeners on `window` / `document`.
- Returns `{ getModifiers: () => Modifiers }` ref-stable getter — callers read on demand inside drag handlers.
- Reset path: any `blur` or `visibilitychange` event clears all three modifier bits.

---

### `src/lib/editor/watermark-adapter.ts` (adapter, transform)

**Analog:** `src/lib/editor/text-box-adapter.ts` — **mirror byte-for-byte structure**.

**Why this analog:** CONTEXT.md decision §3 states "mirrors v2.8 `legacyToTextBoxes` pattern at slide load." This adapter is a near-exact clone: lift a config-blob field into an addressable element + provide an inverse for save-time round-trip + retain legacy field for one milestone for back-compat.

**Two-function API to mirror** (`text-box-adapter.ts:91-134` + `184-292`):
```typescript
// Forward: legacy → unified
export function legacyToTextBoxes(slide: Slide): TextBox[] { /* ... */ }

// Inverse: unified → legacy slice (caller deep-merges)
export function textBoxesToLegacy(boxes: TextBox[]): LegacySlice { /* ... */ }
```

**v2.11 watermark adapter shape:**
```typescript
// Forward: read from slide.style_overrides.watermark, synthesize Watermark element with stable id
export function legacyWatermarkToElement(slide: Slide): Watermark | null

// Inverse: pull Watermark back into the legacy style_overrides.watermark blob
export function elementToLegacyWatermark(wm: Watermark): NonNullable<SlideStyleOverrides['watermark']>
```

**LegacySlice shape to mirror** (`text-box-adapter.ts:140-152`):
```typescript
export interface LegacySlice {
  hook_text: string
  body_text: string
  hook_segments?: TextSegment[]
  body_segments?: TextSegment[]
  custom_texts?: CustomText[]
  /** Partial style overrides ... Caller deep-merges into the existing
      `slide.style_overrides` to preserve non-text-box fields ... */
  style_overrides_patch: Partial<SlideStyleOverrides>
}
```

**Deterministic-id pattern (CONTEXT.md §specifics line 121):** unlike `legacyToTextBoxes` which uses `crypto.randomUUID()` (line 96), `legacyWatermarkToElement` MUST generate a deterministic id (e.g. `w_${slide_uid_hash}`) so undo/redo doesn't churn the id across renders. This is the **one place the watermark adapter intentionally diverges from the text-box-adapter pattern.**

**Optional-field spread style to mirror exactly** (`text-box-adapter.ts:99-106`):
```typescript
...(slide.hook_segments !== undefined ? { segments: slide.hook_segments } : {}),
...(overrides?.hook_font_family !== undefined ? { font_family: overrides.hook_font_family } : {}),
```
This style keeps interfaces' optional fields properly absent (vs. `: undefined`) — required for clean round-trip equality in tests.

---

### `src/lib/editor/transforms/selection-bounds.ts` (utility, transform)

**Analog:** `src/hooks/use-alignment-guides.ts:73-78` — edge-min/max math on draggable bounding boxes.

**Why this analog:** Existing edge-extraction pattern that walks element rectangles; selection-union AABB math is the same primitive plus aggregation.

**Math primitive to copy** (`use-alignment-guides.ts:73-78`):
```typescript
const dLeft = dragging.x
const dRight = dragging.x + dragging.width
const dCenterX = dragging.x + dragging.width / 2
const dTop = dragging.y
const dBottom = dragging.y + dragging.height
const dCenterY = dragging.y + dragging.height / 2
```

**v2.11 union-AABB shape:**
```typescript
export interface SelectionBounds {
  x: number; y: number; width: number; height: number  // % of canvas (1080×1920 reference)
}

// Pure — no React, no DOM. Mirrors `text-box-adapter.ts` pure-module convention (line 14-15).
export function computeSelectionBounds(slide: Slide, ids: string[]): SelectionBounds | null
```

Returns `null` when ids is empty or all referenced elements are missing — matches the "graceful null fallback" pattern at `resolve-watermark.ts:51-65` (multiple short-circuit gates returning `null`).

---

### `src/components/editor/multi-select-type-bar.tsx` (component, request-response)

**Analog:** Combination of two existing right-rail components.

**Primary structural analog:** `src/components/editor/watermark-controls.tsx` — full panel shell with `Props` interface + tier/state-conditional rendering + dispatch callback.

**Visual analog (chip-row layout for member preview):** `src/components/editor/text-rail/LayerStrip.tsx` — horizontal scrollable chip strip with role icons + active state.

**Why these analogs:** TYPE BAR sits in the right rail, conditionally replaces the single-element panel when N≥2, dispatches bulk ops via callback (Watermark pattern). The "shows shared ops + Mixed placeholder" visual presentation matches LayerStrip's chip-array iteration.

**Props interface to mirror** (`watermark-controls.tsx:27-39`):
```typescript
export interface WatermarkControlsProps {
  slide: Slide
  userTier: 'free' | 'plus' | 'pro'
  isPending: boolean
  onWatermarkChange?: (patch: WatermarkSpec) => void
  // ...
}
```

**v2.11 TYPE BAR props (per CONTEXT.md §decisions right-rail multi-select UX):**
```typescript
export interface MultiSelectTypeBarProps {
  slide: Slide
  selection: Selection                          // from useSelectionModel
  onBulkDispatch: (action: BulkAction) => void  // routes to BULK_TRANSLATE etc.
  // Phase 60 only declares — bulk-edit handlers wire in Phase 62/64.
}
```

**Mount-conditional pattern to mirror** (`text-editor-panel.tsx:88-93`):
```typescript
const textBoxes = slide.text_boxes ?? []
const activeTextBox =
  textBoxes.find((tb) => tb.id === selectedTextBoxId) ?? textBoxes[0] ?? null
```
Equivalent v2.11 gate: render `<MultiSelectTypeBar>` only when `selection.ids.length >= 2`; on narrowing back to N=1, restore the existing `<ActiveTextBoxCard>` + `<SlideSettings>` panel.

**Mixed-value placeholder pattern (no in-codebase analog):** new pattern. CONTEXT.md §decisions line 56 specifies "Property fields with differing values across selection show 'Mixed' placeholder (no input value; on edit, applies to all)." Planner: render a literal `<MixedValuePlaceholder>` chip when values differ; emit `onBulkDispatch` on edit.

---

### `src/lib/types/slide.ts` (additive interface fields)

**Analog:** existing `TextBox` interface at lines 90-103 — additive optional-field convention.

**Why this analog:** v2.8 already added optional fields (`segments?`, `effects?`) without breaking back-compat; same pattern applies to `groupId?` / `locked?` / `hidden?`.

**Existing additive optional-field excerpt** (`slide.ts:90-103`):
```typescript
export interface TextBox {
  id: string                    // crypto.randomUUID()
  role: TextBoxRole
  text: string
  segments?: TextSegment[]
  font_family?: string
  // ... all subsequent fields are optional ...
  position: TextBoxPosition
}
```

**v2.11 additions land at:**
- `TextBox` (line 103, before `position`): add `groupId?: string`, `locked?: boolean`, `hidden?: boolean`
- `CustomImage` (line 48, after `border_radius?`): add same three fields
- New top-level `Watermark` interface (place after `CustomImage` at line 49 or after `SlideStyleOverrides`):
  ```typescript
  export interface Watermark {
    id: string
    enabled?: boolean
    customLogoUrl?: string
    customText?: string
    position?: 'top-left' | 'bottom-left' | 'bottom-right'
    groupId?: string
    locked?: boolean
    hidden?: boolean
  }
  ```
- `Slide` (line 178, after `text_boxes?`): add `watermark?: Watermark`

**Comment style to follow** (`slide.ts:177` — Phase reference + intent):
```typescript
/** Phase 49: Unified text-box array. When absent, derived from legacy fields on load. */
```
Watermark equivalent: `/** Phase 60 (WMARK-01): Unified watermark element. When absent, synthesized from style_overrides.watermark via legacyWatermarkToElement on load. */`

---

### `src/lib/editor/editor-actions.ts` (new action variants)

**Analog:** existing `ADD_TEXT_BOX` / `UPDATE_TEXT_BOX` / `REMOVE_TEXT_BOX` shapes at lines 26-36.

**Why this analog:** Phase 60 needs `BULK_TRANSLATE` (multi-element delta dispatch) following the same `slideIndex + ids[]` shape used everywhere else.

**Existing action shape to mirror** (`editor-actions.ts:35`):
```typescript
| { type: 'UPDATE_TEXT_BOX'; slideIndex: number; textBoxId: string; updates: Partial<TextBox> }
```

**v2.11 BULK_TRANSLATE shape (per CONTEXT.md §decisions multi-drag dispatch):**
```typescript
| { type: 'BULK_TRANSLATE'; slideIndex: number; ids: string[]; deltaX: number; deltaY: number }
```

**Comment-as-rationale style to mirror** (`editor-actions.ts:25`):
```typescript
// Phase 49: text-box actions (route through pushHistory; selectedTextBoxId lives outside reducer)
```
v2.11 equivalent: `// Phase 60 (PERF-01): bulk multi-element translate. Single dispatch on onDragStop only — never per-tick onDrag (carry-forward of v2.10 onResizeStop precedent).`

---

### `src/lib/editor/editor-reducer.ts` (new reducer case)

**Analog:** existing `UPDATE_TEXT_BOX` case at lines 271-280 + `applyDualWrite` helper at lines 22-55.

**Why this analog:** BULK_TRANSLATE is a multi-element extension of UPDATE_TEXT_BOX. Same per-slide map; same pushHistory contract. Must preserve `applyDualWrite` for any text_boxes mutation per BL-01.

**Single-action multi-element pattern to follow** (`editor-reducer.ts:271-280`):
```typescript
case 'UPDATE_TEXT_BOX': {
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    const nextTextBoxes = (slide.text_boxes ?? []).map((tb) =>
      tb.id === action.textBoxId ? { ...tb, ...action.updates } : tb
    )
    return applyDualWrite(slide, nextTextBoxes)
  })
  return pushHistory(state, slides)
}
```

**`pushHistory` single-call contract** (`editor-reducer.ts:91-97`):
```typescript
function pushHistory(state: EditorHistory, newPresent: Slide[]): EditorHistory {
  const past = [...state.past, state.present]
  if (past.length > MAX_HISTORY) {
    past.shift()
  }
  return { past, present: newPresent, future: [] }
}
```

**v2.11 BULK_TRANSLATE case shape:**
```typescript
case 'BULK_TRANSLATE': {
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    const idSet = new Set(action.ids)
    // Update text_boxes in-place; route through applyDualWrite per BL-01
    const nextTextBoxes = (slide.text_boxes ?? []).map((tb) =>
      idSet.has(tb.id)
        ? { ...tb, position: { ...tb.position, x: (tb.position.x ?? 0) + action.deltaX, y: (tb.position.y ?? 0) + action.deltaY } }
        : tb
    )
    // Update custom_images in-place (separate array)
    const nextCustomImages = (slide.custom_images ?? []).map((ci) =>
      idSet.has(ci.id) ? { ...ci, x: ci.x + action.deltaX, y: ci.y + action.deltaY } : ci
    )
    // Update watermark if its id is in the set (Phase 60 unified path)
    const nextWatermark = slide.watermark && idSet.has(slide.watermark.id)
      ? { ...slide.watermark /* coords on Watermark land in later phases */ }
      : slide.watermark
    const dual = applyDualWrite(slide, nextTextBoxes)
    return { ...dual, custom_images: nextCustomImages, watermark: nextWatermark }
  })
  return pushHistory(state, slides)
}
```

**Critical BL-01 dual-write contract** (`editor-reducer.ts:7-21` comment) — every text_boxes mutation MUST call `applyDualWrite`. The bulk action follows this rule.

---

### `src/lib/editor/use-slide-editor.ts` (replace single-id selection slot)

**Analog:** self at line 29.

**v2.8 baseline** (`use-slide-editor.ts:29`):
```typescript
const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
```

**v2.11 replacement (Phase 60):**
```typescript
const [selection, setSelection] = useState<Selection>({ ids: [], primary: null })
```

**Per-slide reset useEffect to add** (mirrors the inline pattern in `removeTextBox` at line 44):
```typescript
// Phase 60 SEL-10: clear selection on slide switch; mirrors v2.8 pattern (line 44)
// where removeTextBox cleared selectedTextBoxId on element delete.
useEffect(() => {
  setSelection({ ids: [], primary: null })
}, [selectedIndex])
```

**Stale-id reconciliation useEffect to add** (per CONTEXT.md §decisions stale-id reconciliation):
```typescript
// Phase 60 SEL-11: filter stale ids whenever slide content changes
useEffect(() => {
  const slide = state.present[selectedIndex]
  if (!slide) return
  const currentIds = new Set([
    ...(slide.text_boxes ?? []).map(tb => tb.id),
    ...(slide.custom_images ?? []).map(ci => ci.id),
    ...(slide.watermark ? [slide.watermark.id] : []),
  ])
  setSelection((s) => {
    const filtered = s.ids.filter(id => currentIds.has(id))
    if (filtered.length === s.ids.length) return s
    return { ids: filtered, primary: filtered.includes(s.primary ?? '') ? s.primary : (filtered[0] ?? null) }
  })
}, [state.present, selectedIndex])
```

**Backward-compat shim (one-milestone bridge):** the existing `selectedTextBoxId` getter at line 60 should remain as a derived value `selection.primary` so consumers in `slide-editor.tsx:67` keep working unchanged through Phase 60. Phase 65 cleanup deletes the shim.

---

### `src/components/editor/slide-editor.tsx` (keyboard handler migration)

**Analog:** self — lines 340-393, current hand-rolled `keydown` switch.

**Why this analog:** CONTEXT.md decisions §keyboard firewall states "Replace switch at slide-editor.tsx:340-385 with declarative tinykeys map." The existing handler IS the migration target.

**`isEditing` guard to PRESERVE verbatim** (`slide-editor.tsx:341-348`):
```typescript
function handler(e: KeyboardEvent) {
  const target = document.activeElement as HTMLElement | null
  const tag = (target?.tagName ?? '').toLowerCase()
  const isEditing =
    tag === 'input' ||
    tag === 'textarea' ||
    target?.isContentEditable === true
  if (isEditing) return
```

**Per-binding migration template (planner copies this for every shortcut):**
```typescript
// Before (lines 350-359):
if (cmd && (e.key === '1' || e.key === '2' || e.key === '3')) {
  const idx = parseInt(e.key, 10) - 1
  const targetBox = textBoxes[idx]
  if (targetBox) {
    e.preventDefault()
    setSelectedTextBoxId(targetBox.id)
  }
}

// After (tinykeys map):
'$mod+1': (e) => {
  if (isEditing(document.activeElement)) return
  e.preventDefault()
  const tb = textBoxes[0]
  if (tb) setSelection({ ids: [tb.id], primary: tb.id })
},
```

**Phase 60 new bindings (per CONTEXT.md decisions):**
- `$mod+a` → SELECT_ALL on current slide (slide-scoped)
- `Escape` → ESC handler (clears selection in Phase 60; group-aware double-press in Phase 62)
- Existing `$mod+1/2/3`, `$mod+d`, `Delete/Backspace` migrate without behavior change

**`useEffect` cleanup pattern to mirror** (`slide-editor.tsx:384-385`):
```typescript
window.addEventListener('keydown', handler)
return () => window.removeEventListener('keydown', handler)
```
tinykeys returns its own `unsubscribe()` — call it in cleanup directly.

---

### `src/components/slides/slide-preview.tsx` (selection ring + canvas-clear)

**Analog:** self — multiple line ranges.

**Existing single-element selection ring** (`slide-preview.tsx:877-886`):
```typescript
// Phase 52 (T-02): resolve hook/body TextBox.id once for the dashed selection
// ring. ... The ring is intentionally `outline` (not `border`) because outline
// doesn't affect layout AND Satori ignores the property — but we ALSO gate every
// use site to editable={true} (the entire editable branch), ...
const hookBoxId = slide.text_boxes?.find((tb) => tb.role === 'hook')?.id ?? null
const bodyBoxId = slide.text_boxes?.find((tb) => tb.role === 'body')?.id ?? null
const selectionRingClass = 'outline outline-2 outline-dashed outline-[#3d0000] outline-offset-2 rounded-sm'
const hookSelected = !!selectedTextBoxId && hookBoxId === selectedTextBoxId
const bodySelected = !!selectedTextBoxId && bodyBoxId === selectedTextBoxId
```

**Per-element ring application pattern** (`slide-preview.tsx:1073`, `1175`):
```typescript
className={`hover:outline hover:outline-2 hover:outline-white/50 ${hookSelected ? selectionRingClass : ''}`}
```

**v2.11 union-AABB ring (extends this pattern):** new `<div>` rendered behind/around the multi-selected wrappers, `position: absolute` with `outline` class string identical to `selectionRingClass`. Render only when `selection.ids.length >= 2` AND `editable={true}` (the `editable={true}` branch already gates this — the outer editable check at the parent `<SlidePreview editable={true}>` site is sufficient; planner must NOT add ring rendering to the non-editable branch).

**Existing canvas-empty-clear pattern** (`slide-preview.tsx:952-960`):
```typescript
<div
  style={innerStyle}
  onClick={(e) => {
    // Click on canvas background clears selections
    if (e.target === e.currentTarget) {
      onCustomTextSelect?.(null)
      onCustomImageSelect?.(null)
    }
  }}
>
```

**v2.11 extension (SEL-09):** add `onSelectionChange?.({ ids: [], primary: null })` to the same `if (e.target === e.currentTarget)` branch. Phase 61 will replace this `onClick` with `onPointerDown` for marquee-start; Phase 60 keeps `onClick` (no marquee yet).

**Existing per-element click → select pattern** (`slide-preview.tsx:1062-1071`):
```typescript
onMouseDown={(e) => {
  // Phase 52 (T-01): click on hook wrapper → resolve hook TextBox.id and
  // promote it as the active selection. stopPropagation() prevents the
  // canvas-background onClick from immediately clearing the selection.
  e.stopPropagation()
  onCustomTextSelect?.(null)
  onCustomImageSelect?.(null)
  const hookBox = slide.text_boxes?.find((tb) => tb.role === 'hook')
  if (hookBox && onTextBoxSelect) onTextBoxSelect(hookBox.id)
}}
```

**v2.11 Shift/Cmd-click extension (SEL-02, SEL-03, SEL-04):** branch on `e.shiftKey` (add/remove from selection) and `e.metaKey || e.ctrlKey` (deep-select through groups — Phase 62 wires the actual deep-select; Phase 60 just shapes the conditional). Pattern:
```typescript
onMouseDown={(e) => {
  e.stopPropagation()
  if (e.shiftKey) {
    // SEL-02/03: toggle membership
    onSelectionChange?.((s) => s.ids.includes(id)
      ? { ids: s.ids.filter(x => x !== id), primary: ... }
      : { ids: [...s.ids, id], primary: id })
  } else {
    // SEL-01: replace
    onSelectionChange?.({ ids: [id], primary: id })
  }
}}
```

---

### `src/lib/render/render-slide-satori.tsx` (watermark unified read path)

**Analog:** self — lines 273-275 + 463-476.

**Existing watermark consumption** (`render-slide-satori.tsx:273-275`):
```typescript
// Brand watermark layer (260427-hut). Satori has no z-index — placement after
// custom_images in JSX order makes it sit on top.
const watermark = resolveWatermark(brandKit ?? null, slide, { width: W, height: H })
```

**Existing watermark JSX emission** (`render-slide-satori.tsx:463-476`):
```typescript
{/* Brand watermark — rendered after custom_images so it stacks on top in Satori DOM order */}
{watermark && (
  <img
    src={watermark.url}
    style={{
      position: 'absolute',
      left: watermark.x,
      top: watermark.y,
      width: watermark.width,
      height: 'auto',
      opacity: watermark.opacity,
    }}
  />
)}
```

**v2.11 unified read with legacy fallback (per CONTEXT.md decisions watermark unification):**
```typescript
// Phase 60 (WMARK-04): read from unified slide.watermark when present, fall
// back to legacy style_overrides.watermark via the existing resolver. Both
// renderers (this file + slide-preview.tsx) consume from the same path.
const watermarkElement = slide.watermark ?? legacyWatermarkToElement(slide)
const watermark = watermarkElement
  ? resolveWatermarkFromElement(watermarkElement, brandKit, { width: W, height: H })
  : resolveWatermark(brandKit ?? null, slide, { width: W, height: H })
```

**Render path mirror in `slide-preview.tsx:746-768`** — equivalent IIFE wrapper at preview layer must apply the same dual-source lookup. Both renderers MUST use the SAME helper (TPLREND-05; see `no-css-filter.test.ts` and `parity.test.tsx` enforcement).

---

### `src/lib/render/__tests__/parity.test.tsx` (extend with watermark fixtures)

**Analog:** self — existing test file at lines 28-99.

**Existing extension pattern** (`parity.test.tsx:28-50`):
```typescript
describe('Phase 58 (PARITY-01, PARITY-02): renderer parity for new templates', () => {
  it('PARITY-02: renderGrain is the singleton export from resolve-overlay', () => {
    expect(typeof renderGrain).toBe('function')
  })
  // ...
})
```

**v2.11 extension shape:**
```typescript
describe('Phase 60 (WMARK-04, WMARK-05, PARITY-01): watermark unification parity', () => {
  it('WMARK-04: legacyWatermarkToElement is singleton from watermark-adapter', () => {
    expect(typeof legacyWatermarkToElement).toBe('function')
  })

  it('WMARK-05: slide with style_overrides.watermark only renders byte-identically before and after lift', () => {
    // Render via React preview AND Satori; assert identical DOM
    const legacy: Slide = { /* style_overrides.watermark only */ }
    const lifted: Slide = { ...legacy, watermark: legacyWatermarkToElement(legacy) }
    // ... compare rendered output ...
  })
  // ... more fixtures: enabled=false, customLogoUrl, customText, position variants
})
```

---

### `src/lib/render/__tests__/no-css-filter.test.ts` (extend with selection/marquee/guide regex)

**Analog:** self — lines 26-51.

**Existing scan shape** (`no-css-filter.test.ts:26-51`):
```typescript
describe('Phase 55 (D-24, D-25, PARITY-04): no CSS filter properties in resolver', () => {
  const resolverPath = resolve(__dirname, '..', 'resolve-overlay.ts')
  const source = readFileSync(resolverPath, 'utf8')
  const stripped = stripComments(source)

  it('resolve-overlay.ts does NOT contain "filter:" property usage', () => {
    expect(stripped).not.toMatch(/(?<!backdrop-)filter\s*:/)
  })
  // ...
})
```

**v2.11 PARITY-01 extension (per CONTEXT.md test infrastructure):**
```typescript
describe('Phase 60 (PARITY-01): editor-only chrome stays out of Satori path', () => {
  // Scan render-slide-satori.tsx for any class string matching *selection*,
  // *marquee*, or *guide* — these are editor chrome and must NEVER appear
  // in the PNG render tree.
  const satoriPath = resolve(__dirname, '..', 'render-slide-satori.tsx')
  const source = readFileSync(satoriPath, 'utf8')
  const stripped = stripComments(source)

  it('render-slide-satori.tsx contains no className matching "selection"', () => {
    expect(stripped).not.toMatch(/selection/)
  })
  it('render-slide-satori.tsx contains no className matching "marquee"', () => {
    expect(stripped).not.toMatch(/marquee/)
  })
  it('render-slide-satori.tsx contains no className matching "guide"', () => {
    expect(stripped).not.toMatch(/guide/)
  })
})
```

---

### `src/lib/editor/__tests__/watermark-adapter.test.ts` (new test file)

**Analog:** `src/lib/editor/__tests__/text-box-adapter.test.ts` — fixture + round-trip pattern.

**Fixture-helper pattern to mirror** (`text-box-adapter.test.ts:18-58`):
```typescript
function applyLegacySlice(original: Slide, slice: LegacySlice): Slide {
  // ... merge slice back onto original to verify round-trip equality ...
}
function stripBoxIds(slide: Slide): Slide { /* ... */ }

function shape1HookBodyOnly(): Slide { /* ... */ }
function shape2HookBodyOneCustom(): Slide { /* ... */ }
function shape3HookBodyEffects(): Slide { /* ... */ }
```

**v2.11 watermark-adapter test fixtures (per CONTEXT.md success criteria item 4):**
```typescript
function shape1NoWatermark(): Slide              // baseline: no watermark, no style_overrides.watermark
function shape2LegacyWatermarkEnabled(): Slide    // style_overrides.watermark.enabled=true
function shape3LegacyWatermarkCustomLogo(): Slide // customLogoUrl set
function shape4LegacyWatermarkPosition(): Slide   // each of 3 position values
function shape5UnifiedWatermarkOnly(): Slide      // slide.watermark already set (post-migration)
function shape6BothPaths(): Slide                 // both fields present (unified wins)
```

**Round-trip equality assertion** (mirror `text-box-adapter.test.ts` pattern): `legacyWatermarkToElement` followed by `elementToLegacyWatermark` must reproduce the original `style_overrides.watermark` blob byte-for-byte (modulo deterministic id, which is a v2.11 addition).

---

## Shared Patterns

### 1. Selection-state-outside-history

**Source:** `src/lib/editor/use-slide-editor.ts:27-29` (canonical comment + state placement).

**Apply to:** `use-selection-model.ts`, every consumer of selection state, all reducer cases that touch slide content (must NOT touch selection — selection lives outside).

**Excerpt:**
```typescript
// Phase 49: selection state for the new TextBox-driven right rail (Phase 50 consumes this).
// Stored OUTSIDE the editor history — selection changes never push undo/redo.
const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
```

---

### 2. `pushHistory` single-call contract

**Source:** `src/lib/editor/editor-reducer.ts:91-97` + `MAX_HISTORY=50` at line 5.

**Apply to:** All new reducer cases (`BULK_TRANSLATE`, future `ALIGN`/`GROUP`/`DISTRIBUTE`). Each gesture = one dispatch = one `pushHistory` call.

**Excerpt:**
```typescript
function pushHistory(state: EditorHistory, newPresent: Slide[]): EditorHistory {
  const past = [...state.past, state.present]
  if (past.length > MAX_HISTORY) {
    past.shift()
  }
  return { past, present: newPresent, future: [] }
}
```

---

### 3. BL-01 dual-write for any text_boxes mutation

**Source:** `src/lib/editor/editor-reducer.ts:7-21` (comment) + `applyDualWrite` impl at lines 22-55.

**Apply to:** `BULK_TRANSLATE` reducer case (when ids set includes any TextBox), and any future reducer case touching `slide.text_boxes`.

**Excerpt:**
```typescript
function applyDualWrite(slide: Slide, nextTextBoxes: TextBox[]): Slide {
  const slice = textBoxesToLegacy(nextTextBoxes)
  const out: Slide = {
    ...slide,
    text_boxes: nextTextBoxes,
    hook_text: slice.hook_text,
    body_text: slice.body_text,
  }
  // ... fields cleanup + style_overrides merge ...
  return out
}
```

---

### 4. `isEditing` keyboard guard

**Source:** `src/components/editor/slide-editor.tsx:341-348`.

**Apply to:** every new tinykeys binding in `slide-editor.tsx`. CONTEXT.md decisions line 67 explicitly states: "Every new binding wraps handler in `if (isEditing(target)) return; e.preventDefault(); ...`".

**Excerpt:**
```typescript
const target = document.activeElement as HTMLElement | null
const tag = (target?.tagName ?? '').toLowerCase()
const isEditing =
  tag === 'input' ||
  tag === 'textarea' ||
  target?.isContentEditable === true
if (isEditing) return
```

**Refactor for tinykeys:** extract this into a `isEditing(target: HTMLElement | null): boolean` pure helper at `src/lib/editor/keyboard-utils.ts` (new file in Phase 60) so every tinykeys binding can call it cleanly. Pure-helper colocation matches the `text-box-adapter.ts` pattern (no React/state coupling).

---

### 5. TPLREND-05 invariant — `editable={true}` gate

**Source:** `src/components/slides/slide-preview.tsx:879-881` (comment) + the editable-branch boundary at `slide-preview.tsx:946`.

**Apply to:** the new union-AABB selection ring + every Phase 60 visual addition.

**Excerpt:**
```typescript
// The ring is intentionally `outline` (not `border`) because outline doesn't
// affect layout AND Satori ignores the property — but we ALSO gate every use
// site to editable={true} (the entire editable branch), so even if a future
// Satori upgrade started honoring outline, the export path still wouldn't see it.
```

**Enforcement test:** `no-css-filter.test.ts` extension (above) scans `render-slide-satori.tsx` for any `selection|marquee|guide` className — Satori path must contain none.

---

### 6. Optional-field spread for round-trip safety

**Source:** `src/lib/editor/text-box-adapter.ts:99-106` (and many sibling spreads throughout the file).

**Apply to:** `watermark-adapter.ts` field copying (so optional fields stay absent rather than `: undefined`, preserving deep-equality in tests).

**Excerpt:**
```typescript
...(slide.hook_segments !== undefined ? { segments: slide.hook_segments } : {}),
...(overrides?.hook_font_family !== undefined ? { font_family: overrides.hook_font_family } : {}),
```

---

### 7. Pure-module convention (no React/state coupling)

**Source:** `src/lib/editor/text-box-adapter.ts:14-15` (header comment) + `src/lib/render/resolve-watermark.ts:1-11` (file header).

**Apply to:** `watermark-adapter.ts`, `selection-bounds.ts`. Both must be importable from any layer (server actions, RPCs, future MCP tools), so NO `'use client'` directive, NO React imports, NO `useState`/`useEffect`.

**Excerpt** (`text-box-adapter.ts:14-15`):
```typescript
/* No React or state coupling; safe to call from any layer. */
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none — every Phase 60 file has at least a role-match analog) | — | — | — |

The `useModifierState` hook is the closest to "no analog" — it adds `window.blur` + `document.visibilitychange` listeners, which no existing hook does. But its overall shape (custom hook with internal state + memoized callbacks + cleanup-effect) matches `useAlignmentGuides` cleanly enough to call it a role-match.

---

## Metadata

**Analog search scope:** `src/lib/editor/`, `src/lib/render/`, `src/components/editor/`, `src/components/slides/`, `src/lib/types/`, `src/hooks/`, `src/lib/editor/__tests__/`, `src/lib/render/__tests__/`

**Files scanned:** 23 (4 in slide.ts/text-box-adapter.ts/use-slide-editor.ts/editor-reducer.ts core; 4 components; 3 renderer files; 4 test files; 8 supporting)

**Pattern extraction date:** 2026-05-02

**Mapper notes:**
- The Phase 60 pattern map is unusually clean because v2.8 already shipped the canonical adapter pattern (`text-box-adapter.ts`) and the canonical selection-outside-history pattern (`use-slide-editor.ts:29`). Phase 60 is "do that again, generalized." Most files have exact analogs in the same module they're modifying.
- The one genuinely new pattern is the union-AABB selection ring — geometry math is novel but trivially extends the existing edge-extraction in `use-alignment-guides.ts:73-78`.
- The TYPE BAR component is the highest-novelty new file. Planner should mount it conditionally inside `text-editor-panel.tsx` (replace `ActiveTextBoxCard` when `selection.ids.length >= 2`); copy the props-interface shape from `watermark-controls.tsx`; copy the chip-iteration shape from `LayerStrip.tsx` for member previews.
