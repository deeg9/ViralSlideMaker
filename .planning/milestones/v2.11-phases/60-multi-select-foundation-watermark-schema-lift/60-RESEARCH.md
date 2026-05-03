# Phase 60: Multi-Select Foundation + Watermark Schema Lift — Research

**Researched:** 2026-05-02
**Domain:** v2.11 multi-select foundation — selection state model + 3 schema fields + watermark unification + keyboard firewall (tinykeys)
**Confidence:** HIGH for stack/version pins (Context7 + npm view verified). HIGH on architectural patterns (CONTEXT.md decisions are locked + codebase audited). MEDIUM on precise component-mount choices that depend on existing right-rail TextEditorPanel layout (recommendation given; planner can adjust).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Selection state shape & location:**
- Type: `Selection { ids: string[]; primary: string | null }` — insertion-ordered array, never `Set`. Ref-stable update via `[...prev, id]` spread.
- Location: New hook `useSelectionModel()` at `src/lib/editor/use-selection-model.ts` (or extend `useSlideEditor.ts:29`). Lives in React state OUTSIDE reducer history.
- Per-slide scoping: clears on `selectedIndex` change via `useEffect` keyed on slide index.
- Stale-id reconciliation: `useEffect` keyed on `state.present` filters dropped ids on every reducer action that removes elements (`REMOVE_TEXT_BOX`, `REMOVE_CUSTOM_IMAGE`, `REMOVE_CUSTOM_TEXT`, `REMOVE_SLIDE`, `DUPLICATE_SLIDE`).

**Schema field placement:**
- Add `groupId?: string`, `locked?: boolean`, `hidden?: boolean` to `TextBox`, `CustomImage`, and a new `Watermark` interface.
- NO behavior on these fields yet — Phase 60 declares only.

**Watermark unification approach:**
- Add `Slide.watermark?: Watermark` (additive optional field).
- Slide load: `legacyToWatermark(slide)` runs in `useReducer` lazy initializer; deterministic stable id when `slide.watermark` absent and `slide.style_overrides?.watermark` present.
- Slide save: `watermarkToLegacy(watermark)` mirrors back to `style_overrides.watermark` for back-compat.
- Both renderers consume `slide.watermark` first, fall back to `slide.style_overrides.watermark`.
- TPLREND-05: zero schema diff visible in Satori output. Verified via `parity.test.tsx` extension.

**Right-rail multi-select UX:**
- TYPE BAR shown only when N≥2. All-text → text ops. All-image → image ops. Mixed → universal ops only.
- Differing-value properties show "Mixed" placeholder.
- NO "primary" key-object UX — Illustrator trap.

**Selection ring (canvas):**
- Single dashed `#3d0000` ring around union AABB when N≥2. `editable={true}` gated. Empty → no ring. N=1 → existing per-element ring (unchanged).

**Keyboard firewall:**
- Install `tinykeys@3.0.0`. Replace switch at `slide-editor.tsx:340-385`.
- Every binding wraps with isEditing guard at `slide-editor.tsx:344-348` then calls `e.preventDefault()`.
- Phase 60 shortcuts: `$mod+a` (select all current slide), `Escape` (group-aware double-press, single press exits group [Phase 62] / clears in Phase 60). Existing `$mod+1/2/3`, `$mod+d`, `Delete`/`Backspace` migrate without behavior change.
- New hook `useModifierState()` listens to `keydown`/`keyup` AND `window.blur` + `document.visibilitychange`.

**Multi-drag dispatch (PERF-01):**
- New action `BULK_TRANSLATE { slideIndex; ids; deltaX; deltaY }` — single dispatch, single `pushHistory`. Phase 60 wires the action shape but does NOT trigger from drag handlers.

**Click-empty-canvas-to-clear:**
- Pointer-down on canvas root where `e.target === e.currentTarget` AND no marquee dragging → REPLACE_SELECTION([]).

### Claude's Discretion
- Exact deterministic-id strategy for legacy watermark (recommendation given in Q2; verify on plan).
- Whether `useSelectionModel` is a separate hook or extension to `useSlideEditor` (recommendation: separate hook, see Q3).
- Whether `useModifierState` returns refs or React state (recommendation: refs + getter, see Q4).
- Exact TYPE BAR component placement in right-rail tree (recommendation given in Q5).
- Whether selection-ring union AABB is one outer ring vs N stacked rings (recommendation: one outer ring, see Q6).
- Whether `BULK_TRANSLATE` skip-locked logic is in-reducer or pre-dispatch (recommendation: in-reducer, see Q7).
- Whether reducer prune logic lives inside reducer cases or as a useEffect on `state.present` (recommendation: hybrid, see Q9).

### Deferred Ideas (OUT OF SCOPE for Phase 60)
- Marquee selection (Phase 61) — `selecto@1.26.3`, Shift-additive, rect normalization.
- Group/Ungroup behavior (Phase 62) — Cmd+G / Cmd+Shift+G; only `groupId?` field lands in 60.
- Lock/Hide behavior (Phase 64) — only `locked?` / `hidden?` fields land in 60.
- Z-order operations (Phase 64) — Cmd+] / Cmd+[ / Cmd+Alt+] / Cmd+Alt+[.
- Alignment / Distribute / Smart Guides (Phase 63).
- Layers panel (Phase 65), `react-arborist`.
- Power-user differentiators (Phase 66) — Alt-drag duplicate, Cmd+D smart offset, equal-spacing guide.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEL-01 | Click an element to select it (single-select preserved) | Q3, Q6 — existing single-select pattern preserved; new model is additive |
| SEL-02 | Shift+click adds to selection | Q3 — `addToSelection` op; pointer handler reads `e.shiftKey` |
| SEL-03 | Shift+click on selected element removes from selection | Q3 — `toggleInSelection` op |
| SEL-04 | Cmd+click deep-selects through groups (no-op in Phase 60 — no groups exist) | Q3 — handler reads modifier state; Phase 62 wires real behavior |
| SEL-07 | Cmd+A selects all elements on current slide (slide-scoped) | Q1 — `$mod+a` tinykeys binding; calls `selectAll()` |
| SEL-08 | Esc clears selection (Phase 60: single press clears; group double-press wires in Phase 62) | Q1 — `Escape` tinykeys binding; calls `clear()` |
| SEL-09 | Click empty canvas clears selection | Q6 — `e.target === e.currentTarget` guard on canvas root pointerdown |
| SEL-10 | Selection clears on slide switch | Q3 — `useEffect` keyed on `selectedIndex` |
| SEL-11 | Selection survives undo/redo with stale IDs reconciled | Q9 — prune useEffect keyed on `state.present` |
| SEL-12 | Right-rail TYPE BAR for multi-select with "Mixed" placeholder; no "primary" concept | Q5 — `MultiSelectTypeBar` component, replaces single-element panel |
| SEL-13 | Selection ring around union AABB when N≥2; `editable={true}` gated | Q6 — `selectionBounds` pure helper + outer dashed ring |
| SEL-15 | Selection state shape `{ ids: string[]; primary: string \| null }` outside reducer history | Q3 — matches existing v2.8 pattern |
| WMARK-01 | Watermark lifted to addressable element with stable `id` + `groupId?`/`locked?`/`hidden?` | Q2 — `Watermark` interface + adapter |
| WMARK-02 | Watermark participates in multi-select identically | Q2, Q5, Q6 — TYPE BAR + selection ring honor watermark |
| WMARK-03 | `legacyWatermarkToElement` runs at slide-load boundary (mirrors v2.8 `legacyToTextBoxes`) | Q2 — adapter signature + integration in lazy initializer |
| WMARK-04 | Both renderers consume from unified path with byte-identical output | Q2, Q8 — fallback chain + parity test extension |
| WMARK-05 | All 53+ existing projects render byte-identically pre/post unification | Q2, Q8 — parity test |
| KBD-01 | `tinykeys@3.0.0` replaces hand-rolled keydown switch at `slide-editor.tsx:340-385` | Q1 — full migration map |
| KBD-02 | All shortcuts respect `isEditing` guard | Q1 — wrap every handler |
| KBD-03 | All shortcuts call `e.preventDefault()` | Q1 — pattern in tinykeys callbacks |
| KBD-04 | Modifier state resets on `window.blur` + `document.visibilitychange` | Q4 — `useModifierState` hook |
| PARITY-01 | Selection rings + multi-select chrome render only when `editable={true}` | Q6, Q8 — render branch gate; regression scan |
| PERF-01 | Multi-drag uses single `BULK_TRANSLATE` on `onDragStop` only | Q7 — action shape; no per-tick dispatch |
</phase_requirements>

---

## Summary

Phase 60 is the architectural keystone of v2.11: every other phase requires the selection model, schema fields, watermark unification, and keyboard firewall this phase ships. **The work is additive across the board** — no existing reducer action is rewritten, no existing schema field is renamed, no existing renderer behavior changes. The risk surface is dominated by three things: (1) watermark byte-identity across 53+ projects through the new adapter, (2) selection-state ergonomics under `useEffect`-driven prune-on-undo, and (3) tinykeys's `$mod` modifier behaving correctly for the existing `Cmd/Ctrl+1/2/3` and `Cmd/Ctrl+D` shortcuts after migration.

**Primary recommendation:** Build the watermark adapter first (highest TPLREND-05 risk → biggest test surface). Build `useSelectionModel` and `useModifierState` next as pure ref-driven hooks (cheap, mockable). Wire tinykeys into a fresh `useEffect` that replaces lines 340-385 of `slide-editor.tsx` wholesale, with the existing isEditing guard hoisted into a small helper `isEditingTarget(target)` so every binding can call it identically. Keep the `BULK_TRANSLATE` action declared but not triggered — Phase 60 ships the contract, Phase 62 (groups) wires the call site.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Selection state | Browser / Client (React state) | — | Selection is transient UI state; never persisted; matches v2.8 pattern at `use-slide-editor.ts:29` |
| Schema field declarations (`groupId?`/`locked?`/`hidden?`) | Stored data (TypeScript types) | Database (Supabase JSONB column already accepts arbitrary additive fields) | Additive nullable fields; no migration |
| Watermark schema lift (adapter) | Browser / Client (slide-load lazy initializer) | Stored data | Mirrors v2.8 `legacyToTextBoxes` at `use-slide-editor.ts:14-18` |
| Watermark render | Frontend Server (Satori) + Browser (React preview) | — | Both renderers consume from same source; TPLREND-05 invariant |
| Keyboard shortcuts (tinykeys) | Browser / Client | — | All shortcuts edit React state; no API calls |
| Modifier state tracking | Browser / Client (refs + DOM events) | — | `keydown`/`keyup`/`blur`/`visibilitychange` are all browser events |
| `BULK_TRANSLATE` reducer action | Browser / Client (reducer) | — | Pure state mutation; no API call |
| Selection ring around union AABB | Browser / Client (editable=true branch only) | — | Editor-only chrome; never reaches Satori |
| TYPE BAR (multi-select right rail) | Browser / Client | — | UI composition only |

---

## Standard Stack

### Core (KEEP)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-rnd | 10.5.3 (current) | Per-element drag/resize — unchanged in Phase 60 | v2.10 corner-handle path verified; 4 working call-sites |
| react | 19.1.0 | UI runtime | Already shipped |
| Next.js | 15.5.13 | App Router | Already shipped |

### NEW for Phase 60
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **tinykeys** | **3.0.0** | Keyboard shortcut handling | `$mod` cross-platform modifier; ~650 B gzipped; explicit `unsubscribe()` for `useEffect` cleanup; React 19 compatible (vanilla DOM library, no React peer dep) |

`[VERIFIED: npm view tinykeys version → 3.0.0; published 2024-08-20]` — the version pin in STACK.md is current.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tinykeys | react-hotkeys-hook@5.3.0 | 5× larger bundle (~3.5 KB gz vs 650 B); more re-renders due to hook-driven model; declarative `useHotkeys('mod+s', cb)` syntax may feel cleaner but doesn't return clean unsubscribe |
| tinykeys | hand-rolled keydown switch | What we have today at `slide-editor.tsx:340-385`. Doesn't scale to v2.11's 12+ shortcuts; no `$mod` cross-platform handling; no sequence support for future Cmd+G/G; v2.10 already a dead-end |

**Installation:**
```bash
npm install tinykeys@3.0.0
```

That's it. Phase 60 adds exactly ONE package. `selecto` (Phase 61), `react-arborist` (Phase 65) are deferred.

**Version verification:**
```bash
npm view tinykeys version    # → 3.0.0
npm view tinykeys time.3.0.0 # → 2024-08-20T23:21:50.055Z
```

`[VERIFIED: npm registry; version 3.0.0 published 2024-08-20, ~18 months old, stable.]`

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────┐
                          │         SlideEditor (parent)            │
                          │  - useSlideEditor → reducer history     │
                          │  - useSelectionModel → React state      │
                          │  - useModifierState → refs              │
                          │  - tinykeys(window, {...bindings})      │
                          └────────────┬────────────────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────────┐
                ▼                      ▼                          ▼
       ┌──────────────┐      ┌──────────────────┐       ┌──────────────────┐
       │  SlideCanvas │      │  RIGHT RAIL      │       │  KEYBOARD LISTENER│
       │  ↓           │      │  - TYPE BAR      │       │  (tinykeys)       │
       │  SlidePreview│      │    (N≥2)         │       │  - $mod+a, Esc,   │
       │  editable=T  │      │  - TextEditor    │       │    $mod+1/2/3,    │
       │              │      │    Panel (N≤1)   │       │    $mod+d, Del    │
       │  • Per-elem  │      │  - SlideSettings │       │  - all guarded by │
       │    Rnd wrap  │      │    (N=0)         │       │    isEditing()    │
       │  • Outer     │      └──────────────────┘       └──────────────────┘
       │    union     │
       │    AABB ring │
       │    (N≥2)     │
       │  • Click-    │
       │    empty     │
       │    clears    │
       └──────┬───────┘
              │
              ▼
   ┌──────────────────────┐
   │ Slide.watermark      │  ← derived in lazy initializer via legacyToWatermark()
   │ (Watermark element)  │  ← adapter: src/lib/editor/watermark-adapter.ts
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐    ┌──────────────────────┐
   │ React Preview        │    │ Satori PNG export    │
   │ slide-preview.tsx    │    │ render-slide-satori  │
   │  • reads             │    │  • reads             │
   │    slide.watermark   │    │    slide.watermark   │
   │    OR fallback to    │    │    OR fallback to    │
   │    style_overrides.  │    │    style_overrides.  │
   │    watermark         │    │    watermark         │
   └──────────────────────┘    └──────────────────────┘
                                        ↑
                                  TPLREND-05 invariant:
                                  byte-identical PNG pre/post unification
```

### Recommended Project Structure
```
src/
├── lib/editor/
│   ├── use-selection-model.ts       # NEW: { ids, primary } state + ops (Q3)
│   ├── use-modifier-state.ts        # NEW: shift/cmd/alt refs + reset (Q4)
│   ├── watermark-adapter.ts         # NEW: legacyWatermarkToElement / elementToLegacyWatermark (Q2)
│   ├── transforms/
│   │   └── selection-bounds.ts      # NEW: pure unionAABB(slide, ids) (Q6)
│   ├── editor-actions.ts            # EXTEND: add BULK_TRANSLATE (Q7)
│   ├── editor-reducer.ts            # EXTEND: add BULK_TRANSLATE case (Q7), prune in REMOVE_*/DUPLICATE_SLIDE (Q9)
│   └── use-slide-editor.ts          # EXTEND: lazy initializer mints watermarks; expose useSelectionModel
├── lib/types/
│   └── slide.ts                     # EXTEND: add Watermark interface; add 3 fields to TextBox + CustomImage; add slide.watermark (Q2)
├── components/editor/
│   ├── slide-editor.tsx             # EXTEND: replace keydown switch with tinykeys (Q1); wire selection model
│   ├── multi-select-type-bar.tsx    # NEW: TYPE BAR component (Q5)
│   └── text-editor-panel.tsx        # EXTEND: branch on N≥2 → TYPE BAR
└── components/slides/
    └── slide-preview.tsx            # EXTEND: union AABB ring (editable={true} only); pointer-down on canvas root → REPLACE_SELECTION([])
```

### Pattern 1: Selection-state-outside-reducer-history
**What:** React state holds the selection model. Reducer history holds slide content. They are reconciled via `useEffect`, never co-mingled.
**When to use:** v2.11's selection model.
**Example:**
```typescript
// Source: src/lib/editor/use-slide-editor.ts (existing pattern at line 27-29)
// Phase 49: selection state for the new TextBox-driven right rail (Phase 50 consumes this).
// Stored OUTSIDE the editor history — selection changes never push undo/redo.
const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
```

### Pattern 2: Schema-additive-with-lazy-initializer
**What:** When loading a slide that lacks a new field, derive it eagerly in `useReducer`'s lazy initializer.
**When to use:** Adding new derived fields without DB migration. Pioneered for `text_boxes` in v2.8.
**Example:**
```typescript
// Source: src/lib/editor/use-slide-editor.ts:14-18 (existing pattern)
function migrateLegacySlides(slides: Slide[]): Slide[] {
  return slides.map((slide) =>
    slide.text_boxes ? slide : { ...slide, text_boxes: legacyToTextBoxes(slide) }
  )
}
function createInitialState(slides: Slide[]): EditorHistory {
  return { past: [], present: migrateLegacySlides(slides), future: [] }
}
```
Phase 60 mints `slide.watermark` the same way (see Q2).

### Pattern 3: Dual-write on every reducer mutation
**What:** When a reducer touches the canonical shape, also write the legacy shape in the same case.
**When to use:** Bridging old + new schemas during a sunset window.
**Example:**
```typescript
// Source: src/lib/editor/editor-reducer.ts:22 (existing applyDualWrite)
function applyDualWrite(slide: Slide, nextTextBoxes: TextBox[]): Slide {
  const slice = textBoxesToLegacy(nextTextBoxes)
  // ... merges legacy fields back into slide
}
```
Watermark unification mirrors this — when a future phase mutates `slide.watermark`, an `applyWatermarkDualWrite` mirrors back to `slide.style_overrides.watermark`. Phase 60 declares the helper but doesn't have a mutator wired (no UI today writes the new field).

### Anti-Patterns to Avoid
- **Set-based selection state:** Mutating `selectedIds.add(id)` doesn't trigger React re-render (PITFALL-1.4). Always spread: `[...prev, id]`.
- **CSS z-index for selection ring stacking:** Satori ignores z-index (PITFALL-6.1, RESEARCH SUMMARY top risks #3). Selection ring uses CSS `outline` (already the v2.8 pattern at `slide-preview.tsx:884`).
- **Per-tick reducer dispatches during multi-drag:** PITFALL-11.1, PERF-01. `BULK_TRANSLATE` fires on `onDragStop` only.
- **Illustrator key-object UX in TYPE BAR:** PITFALL-1.3, PITFALL-12.3. No "primary clicked first" concept surfaces in the right rail.
- **Hand-rolled `e.metaKey || e.ctrlKey`:** Replaced by tinykeys's `$mod`. Don't keep the old pattern around.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform modifier (Cmd vs Ctrl) | Manual `e.metaKey \|\| e.ctrlKey` checks | tinykeys's `$mod` | Single string token; library handles platform detection from `navigator.platform` |
| Sequence keys (g i, etc.) for future shortcuts | Custom state-machine on `keydown` | tinykeys built-in sequence support | Free with tinykeys; will matter in Phase 62+ |
| Shortcut unsubscribe on component unmount | Manual `removeEventListener` | tinykeys returns `unsubscribe()` | Clean React `useEffect` cleanup pattern; survives StrictMode double-mount |
| Watermark schema migration logic from scratch | Custom slide-by-slide upgrade script | Reuse v2.8 `legacyToTextBoxes` pattern (lazy initializer, idempotent) | Pattern is proven; tested; survives edit/save round-trip |
| Watermark-id collision detection | UUID + collision check loop | Deterministic hash-based id (Q2) | `w_${slide_index}` is sufficient — slide_index is already unique within a project; cross-project collisions don't matter (each project's reducer state is independent) |
| Modifier-state stuck-key recovery | Custom heuristics | `window.blur` + `document.visibilitychange` listeners (PITFALL-9.4, PITFALL-5.5) | Industry-standard pattern; ~5 lines |
| Union AABB selection ring | Per-element ring stack | One outer ring around union AABB (Q6) | Single dashed border is the Figma/Canva pattern; cheaper to render; clearer to read |

**Key insight:** Phase 60's only library install is tinykeys. Everything else is React state + pure helpers built on existing patterns. No marquee library (deferred), no tree library (deferred), no animation library (out of scope).

---

## Common Pitfalls

### Pitfall 1: Watermark adapter not idempotent → undo/redo churn
**What goes wrong:** Each render passes the slide through `legacyToWatermark()` again, generating a new UUID for `Watermark.id`. Selection-by-id breaks, undo creates a new id every snapshot.
**Why it happens:** `crypto.randomUUID()` in the adapter; non-deterministic.
**How to avoid:** Use a deterministic id derivation (Q2). The adapter MUST be idempotent: `legacyToWatermark(slide)` and `legacyToWatermark(legacyToWatermark(slide))` produce equal `id` values.
**Warning signs:** Selection state randomly drops watermark id between renders; watermark "jumps" out of selection on save.

### Pitfall 2: tinykeys binding not registered to `window` → captured shortcuts in input
**What goes wrong:** Bindings registered on a child div fire only when that div has focus. User clicks the right-rail input → Cmd+A selects text in the input AND on the canvas (or only in the input, depending on event capture).
**Why it happens:** Misreading the tinykeys quickstart — many examples show `tinykeys(divRef, {...})`.
**How to avoid:** Always `tinykeys(window, {...})` in `slide-editor.tsx`. The isEditing guard does the focus discrimination. `[CITED: jamiebuilds/tinykeys README — "tinykeys(window, {...})" is the canonical pattern.]`
**Warning signs:** Cmd+A behaves differently when focus is in a text input.

### Pitfall 3: Stale selection ids surviving slide-switch (PITFALL-1.2)
**What goes wrong:** User multi-selects 3 elements on slide 2, switches to slide 3, right-rail still shows slide-2 ids; align/distribute (in later phases) targets ghosts.
**Why it happens:** Selection state lives at SlideEditor level; `selectedIndex` change does not auto-clear it.
**How to avoid:** `useEffect` keyed on `selectedIndex` clears `selection` (mirrors existing single-select behavior at `slide-editor.tsx:267-278`). `[CITED: PITFALLS.md Category 1.2.]`

### Pitfall 4: Stuck modifier after Cmd+Tab (PITFALL-5.5, PITFALL-9.4)
**What goes wrong:** User holds Shift to additive-marquee, Cmd-Tabs away, comes back; modifier state is `{shift: true}` permanently.
**Why it happens:** `keyup` event never fires when window loses focus.
**How to avoid:** `useModifierState` listens to `window.blur` AND `document.visibilitychange`, resets to `{}` on either.
**Warning signs:** Subsequent click "remembers" Shift even though user released it.

### Pitfall 5: Selection ring leaking into Satori output (PARITY-01)
**What goes wrong:** PNG export shows the dashed `#3d0000` selection ring.
**Why it happens:** New union-AABB ring rendered unconditionally instead of behind `editable={true}` branch.
**How to avoid:** Selection ring is rendered ONLY inside the `editable={true}` branch of `slide-preview.tsx` (after line 946 `if (!editable)` check). Verify with extended `parity.test.tsx` walking the `editable={false}` tree for `*selection*`/`*marquee*`/`*guide*` className substrings.
**Warning signs:** PARITY-01 regression test fails.

### Pitfall 6: `BULK_TRANSLATE` skipping locked elements at the wrong layer
**What goes wrong:** Phase 64 ships `locked=true`; Phase 60 declares the action but doesn't filter; later, multi-drag tries to write to locked elements; user sees lock toggle that doesn't actually prevent drag.
**Why it happens:** Skip-locked logic was placed in the dispatch site, not the reducer.
**How to avoid:** Phase 60 reducer case for `BULK_TRANSLATE` already filters out `locked === true`. Even though no element has `locked=true` in Phase 60, the contract is set so Phase 64's lock semantics work without re-touching the reducer.
**Warning signs:** Phase 64 needs to modify `BULK_TRANSLATE` reducer.

### Pitfall 7: Right-rail TYPE BAR replacing single-element panel without restore
**What goes wrong:** User multi-selects → TYPE BAR shows. User narrows selection back to 1 → TYPE BAR stays mounted with stale data.
**Why it happens:** Component branch only switches on `selection.ids.length >= 2` once and doesn't unmount.
**How to avoid:** TextEditorPanel ternary: `selection.ids.length >= 2 ? <MultiSelectTypeBar /> : <ActiveTextBoxCard ... />`. React unmounts the inactive branch automatically.

### Pitfall 8: Forced free-tier watermark logic surviving the schema lift broken
**What goes wrong:** Free-tier user with `watermark.enabled=false` sees the forced watermark disappear after the schema lift (because the new `Watermark` element honors `enabled` while `resolveForcedWatermark` had its own logic).
**Why it happens:** Two competing watermark resolvers in two different files (`resolve-watermark.ts` for brand-kit, `resolve-forced-watermark.ts` for forced free-tier).
**How to avoid:** Phase 60 schema lift produces ONE addressable `Slide.watermark` field, but does NOT delete the existing 2 resolver paths in `resolve-overlay.ts`/`render-slide-satori.tsx`/`slide-preview.tsx`. Both resolvers continue to read the watermark config (legacy path or unified path — see Q10 round-trip). Free-tier forced-watermark logic is preserved verbatim until v2.12+. Round-trip integration test required (see Q10).

---

## Code Examples

### Existing single-select pattern (canonical reference)
```typescript
// Source: src/lib/editor/use-slide-editor.ts:27-44 (read this before writing useSelectionModel)
const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)

const removeTextBox = useCallback((slideIndex: number, textBoxId: string) => {
  dispatch({ type: 'REMOVE_TEXT_BOX', slideIndex, textBoxId })
  setSelectedTextBoxId((current) => (current === textBoxId ? null : current))
}, [])
```

### Existing isEditing guard (canonical reference)
```typescript
// Source: src/components/editor/slide-editor.tsx:340-385
useEffect(() => {
  function handler(e: KeyboardEvent) {
    const target = document.activeElement as HTMLElement | null
    const tag = (target?.tagName ?? '').toLowerCase()
    const isEditing =
      tag === 'input' ||
      tag === 'textarea' ||
      target?.isContentEditable === true
    if (isEditing) return

    const cmd = e.metaKey || e.ctrlKey
    // ... switch-on-key
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [...])
```

### tinykeys + isEditing pattern (Phase 60 target)
```typescript
// Source: jamiebuilds/tinykeys README + slide-editor.tsx:344-348 (combined)
import { tinykeys } from 'tinykeys'

function isEditingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = (el?.tagName ?? '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || el?.isContentEditable === true
}

useEffect(() => {
  const unsubscribe = tinykeys(window, {
    '$mod+a': (e) => {
      if (isEditingTarget(e.target)) return
      e.preventDefault()
      selection.selectAll(currentSlide)
    },
    'Escape': (e) => {
      if (isEditingTarget(e.target)) return
      e.preventDefault()
      selection.clear()
    },
    // ... migrated bindings
  })
  return () => unsubscribe()
}, [currentSlide, selection.selectAll, selection.clear, /* etc */])
```

`[CITED: jamiebuilds/tinykeys via Context7 — `tinykeys(window, {...})` returns explicit unsubscribe; React useEffect pattern documented.]`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled `keydown` switch with `e.metaKey \|\| e.ctrlKey` | tinykeys with `$mod` modifier | Phase 60 | One source of truth for shortcut declarations; sequence support free; cross-platform automatic |
| Single-id selection (`selectedTextBoxId`) | `Selection { ids[]; primary }` insertion-ordered | Phase 60 | Multi-select UX; Mixed-value right-rail; foundational for every later phase |
| Watermark in `style_overrides.watermark` | `Slide.watermark?: Watermark` addressable element + back-compat fallback | Phase 60 | Watermark joins the multi-select party; can be aligned/grouped/locked in later phases |

**Deprecated/outdated (continue to support, do not remove):**
- `slide.style_overrides.watermark` — retained for back-compat; both renderers fall back to it when `slide.watermark` absent. Sunset target: v2.12 at earliest, only after PMF.
- `slide.style_overrides.hide_watermark` (boolean) — older 260427-hut field; current `resolveWatermark` reads it at line 63 of `resolve-watermark.ts`. Adapter should round-trip: `Watermark.hidden=true` ⇒ `style_overrides.hide_watermark=true` (Q2 details).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `slide_index` alone is sufficient as part of the deterministic watermark id (no need for `project_id`) | Q2 | Low — same project's slides cannot collide; cross-project collisions don't matter because each editor session has its own state. If wrong, switch to `w_${slide_index}_${some-stable-slide-uid}` but slides have no stable uid today. |
| A2 | The existing `parity.test.tsx` extends naturally with watermark fixtures by following the `legacyToTextBoxes(slide)` pattern at lines 162/195 | Q8 | Low — pattern is well-established; the new watermark adapter mirrors `legacyToTextBoxes` exactly. |
| A3 | `BULK_TRANSLATE` reducer case can route through the existing `applyDualWrite` for text_boxes only (custom_images don't need dual-write) | Q7 | Low — `applyDualWrite` is text-box-specific; custom_images don't have a legacy back-compat shape. |
| A4 | The CSS-filter regression test (`no-css-filter.test.ts`) provides the right pattern to extend with `*selection*`/`*marquee*`/`*guide*` className regression scan, but planner may decide this scan belongs in a separate file `editor-chrome-leak.test.ts` | Q8 | Low — this is a code-organization decision; both options work. |
| A5 | `useModifierState`'s ref-based getter API is the correct trade-off given Phase 63's `Hold-Cmd-disable-snap` will live on the snap hot path (called at 60Hz during drag) | Q4 | Medium — if planner decides re-render-on-keystroke is acceptable after measuring snap perf at N=30, switch to React state. Defer the perf measurement; ref API is strictly more conservative. |
| A6 | tinykeys's `$mod` correctly maps to `Meta` on macOS and `Control` on Windows/Linux as documented; no manual `navigator.platform` detection is needed in our code | Q1 | Low — verified against tinykeys README/Context7; library has been stable at 3.0.0 since 2024-08-20. |
| A7 | Free-tier forced-watermark behavior round-trips losslessly through the adapter — i.e. the adapter for `enabled` field, paired with the existing `resolveForcedWatermark` logic at line 64 (`if (isFree) renders = true`), preserves the "free tier ignores enabled=false" rule | Q10 | High — must be explicitly tested; assumption depends on the adapter NOT also overriding `resolveForcedWatermark`. Plan must include round-trip test. |

---

## Open Questions

1. **Should the `Watermark` element be rendered through the existing 2 resolvers, or replace them?**
   - What we know: `resolveWatermark` (brand-kit) and `resolveForcedWatermark` (free-tier opt-in) are two independent code paths sharing nothing. Phase 60 introduces a third concept (`Slide.watermark`).
   - What's unclear: Should the new element drive both resolvers, or should it be an additional resolver that runs alongside them?
   - Recommendation: Phase 60 ADDS the element + adapter but does NOT alter the resolvers. The resolvers continue reading `slide.style_overrides.watermark` (which the adapter mirrors back into via `elementToLegacyWatermark`). This minimizes Phase 60 surface area + protects PARITY-01. Phase 62/64 later wire group/lock behavior to also drive a third resolver branch if needed. **Confirm at plan-phase.**

2. **`useSelectionModel` API surface — should it expose primitive setters (`add`, `remove`, `replace`) or higher-level intent ops (`onElementClick`, `onCanvasClick`)?**
   - What we know: Existing `setSelectedTextBoxId` is a primitive setter; consumers compose intent at the call site.
   - What's unclear: Phase 60 has 3 distinct call sites (canvas pointer-down, layer chip click, Cmd+A keyboard). Do we want one primitive per state mutation, or one intent op per UX event?
   - Recommendation: Primitive setters (Q3 spec). Composing intent at the consumer is the existing pattern at `slide-editor.tsx:79-84` (`setSelectedTextBoxId`/`setSelectedCustomTextId`/`setSelectedCustomImageId` are all setter-style). Avoids API churn during Phase 61-66 when new UX events arrive.

3. **Should the prune-stale-ids logic live inside reducer cases (atomic with the mutation) or as a `useEffect` watching `state.present`?**
   - What we know: PITFALLS.md 1.1 + 7.2 both warn about this; the canonical pattern is "atomic with the mutation."
   - What's unclear: Selection state lives outside the reducer history, so the reducer cannot directly mutate `selection.ids`. Options: (a) reducer doesn't touch selection; consumer calls `selection.removeFromSelection(id)` after dispatch — error-prone. (b) reducer mutates a separate selection slice that lives inside history — violates the "selection outside history" rule. (c) `useEffect` keyed on `state.present` runs prune.
   - Recommendation: **Hybrid**. (a) at the few hand-controlled removal call sites (e.g. `removeTextBox` in `use-slide-editor.ts:42-45` already does this for single-select). (c) `useEffect` keyed on `state.present` as a safety net for undo/redo paths and any forgotten call site. Both patterns coexist; the useEffect is "belt and suspenders" the same way `applyDualWrite` is "belt and suspenders" at `slide-editor.tsx:288-310`.

---

## Q&A — Per-Question Deep-Dive

### Q1. tinykeys migration concrete path

**Confidence: HIGH.**

**Existing keydown bindings at `slide-editor.tsx:340-393` (mapped exhaustively):**

| Today (switch-based) | tinykeys equivalent | Behavior |
|----------------------|---------------------|----------|
| `cmd && e.key === '1'` (line 353) | `'$mod+1'` | Select text box index 0 |
| `cmd && e.key === '2'` (line 353) | `'$mod+2'` | Select text box index 1 |
| `cmd && e.key === '3'` (line 353) | `'$mod+3'` | Select text box index 2 |
| `cmd && (e.key === 'd' \|\| 'D')` (line 360) | `'$mod+d'` | Add custom text box, auto-select |
| `(e.key === 'Delete' \|\| 'Backspace') && selectedTextBoxId` (line 373) | `'Delete'` AND `'Backspace'` | Remove selected custom text box (skips hook/body) |
| **NEW (Phase 60)** | `'$mod+a'` | Select all elements on current slide |
| **NEW (Phase 60)** | `'Escape'` | Clear selection (Phase 62 wires group-aware double-press) |
| **Existing (slide-preview.tsx:507-523)** | `'Delete'` AND `'Backspace'` | Remove selected custom text/image — NOTE: this is a SECOND keydown listener inside `<SlidePreview>` separate from the slide-editor one. **Phase 60 should NOT migrate this listener — it is gated on `editable && (selectedCustomTextId \|\| selectedCustomImageId)` and serves the v1.3 single-select model. Migrating it requires Phase 61's marquee work.** |

**`$mod` cross-platform behavior:** `[VERIFIED via Context7 /jamiebuilds/tinykeys]` — tinykeys's `$mod` token resolves to `Meta` on macOS and `Control` on Windows/Linux, matching the existing `e.metaKey || e.ctrlKey` check at `slide-editor.tsx:350`. We do NOT need manual platform detection.

**Before/after structure:**

```typescript
// BEFORE (slide-editor.tsx:340-393, simplified)
useEffect(() => {
  function handler(e: KeyboardEvent) {
    const target = document.activeElement as HTMLElement | null
    const tag = (target?.tagName ?? '').toLowerCase()
    const isEditing = tag === 'input' || tag === 'textarea' || target?.isContentEditable === true
    if (isEditing) return

    const cmd = e.metaKey || e.ctrlKey
    const textBoxes = currentSlide?.text_boxes ?? []

    if (cmd && (e.key === '1' || e.key === '2' || e.key === '3')) {
      const idx = parseInt(e.key, 10) - 1
      const targetBox = textBoxes[idx]
      if (targetBox) {
        e.preventDefault()
        setSelectedTextBoxId(targetBox.id)
      }
    } else if (cmd && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault()
      const newId = crypto.randomUUID()
      dispatch({ type: 'ADD_TEXT_BOX', slideIndex: selectedIndex, role: 'custom', defaults: { id: newId } })
      setSelectedTextBoxId(newId)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTextBoxId) {
      const targetBox = textBoxes.find((tb) => tb.id === selectedTextBoxId)
      if (targetBox?.role === 'custom') {
        e.preventDefault()
        removeTextBox(selectedIndex, selectedTextBoxId)
      }
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [currentSlide, selectedTextBoxId, selectedIndex, setSelectedTextBoxId, removeTextBox, dispatch])
```

```typescript
// AFTER (slide-editor.tsx Phase 60 target)
import { tinykeys } from 'tinykeys'

function isEditingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = (el?.tagName ?? '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || el?.isContentEditable === true
}

useEffect(() => {
  const textBoxes = currentSlide?.text_boxes ?? []

  const selectByIndex = (idx: number) => (e: KeyboardEvent) => {
    if (isEditingTarget(e.target)) return
    const targetBox = textBoxes[idx]
    if (!targetBox) return
    e.preventDefault()
    selection.replaceWith([targetBox.id])
  }

  const unsubscribe = tinykeys(window, {
    '$mod+1': selectByIndex(0),
    '$mod+2': selectByIndex(1),
    '$mod+3': selectByIndex(2),

    '$mod+d': (e) => {
      if (isEditingTarget(e.target)) return
      e.preventDefault()
      const newId = crypto.randomUUID()
      dispatch({ type: 'ADD_TEXT_BOX', slideIndex: selectedIndex, role: 'custom', defaults: { id: newId } })
      selection.replaceWith([newId])
    },

    '$mod+a': (e) => {
      if (isEditingTarget(e.target)) return
      e.preventDefault()
      const allIds = [
        ...(currentSlide?.text_boxes ?? []).map(tb => tb.id),
        ...(currentSlide?.custom_images ?? []).map(ci => ci.id),
        ...(currentSlide?.watermark ? [currentSlide.watermark.id] : []),
      ]
      selection.replaceWith(allIds)
    },

    'Escape': (e) => {
      if (isEditingTarget(e.target)) return
      e.preventDefault()
      // Phase 60: simple clear. Phase 62 will check "inside group" and exit group first.
      selection.clear()
    },

    'Delete': (e) => deleteSelected(e),
    'Backspace': (e) => deleteSelected(e),
  })
  return () => unsubscribe()
}, [currentSlide, selection, selectedIndex, dispatch])

function deleteSelected(e: KeyboardEvent) {
  if (isEditingTarget(e.target)) return
  if (selection.ids.length === 0) return
  // Phase 60: delete only single-selected custom text (preserves existing UX)
  // Multi-select bulk-delete arrives in Phase 64 (lock/hide phase).
  if (selection.ids.length === 1) {
    const id = selection.ids[0]
    const targetBox = (currentSlide?.text_boxes ?? []).find(tb => tb.id === id)
    if (targetBox?.role === 'custom') {
      e.preventDefault()
      removeTextBox(selectedIndex, id)
    }
  }
}
```

**Bindings tinykeys version:** `tinykeys@3.0.0` — confirmed by `npm view tinykeys version → 3.0.0` and STACK.md.

**Recommendation:** Use the `tinykeys()` direct call (NOT `createKeybindingsHandler`) because the direct call returns an `unsubscribe()` function for clean React cleanup, and registers + tears down the listener for us. Confirmed pattern at `[CITED: github.com/jamiebuilds/tinykeys#integrate-tinykeys-with-react-hooks]`.

---

### Q2. Watermark adapter spec

**Confidence: HIGH on signature and round-trip mechanics. MEDIUM on the deterministic-id strategy (recommendation given; planner can pick).**

**Adapter file:** `src/lib/editor/watermark-adapter.ts` (mirrors `text-box-adapter.ts`).

**New schema in `src/lib/types/slide.ts`:**

```typescript
export interface Watermark {
  id: string                      // stable, generated on first load — see id strategy below
  // Existing watermark config fields (mirrored from style_overrides.watermark)
  enabled?: boolean
  customLogoUrl?: string
  customText?: string
  position?: 'top-left' | 'bottom-left' | 'bottom-right'
  // Phase 60 additive fields (matches TextBox + CustomImage)
  groupId?: string
  locked?: boolean
  hidden?: boolean
}

// Add to Slide interface:
export interface Slide {
  // ...existing...
  /** Phase 60: Unified watermark element. When absent, derived from
      style_overrides.watermark on slide load. Both renderers consume
      from this field when present, fall back to style_overrides.watermark
      when absent. Sunset target: v2.12 (after PMF). */
  watermark?: Watermark
}
```

**Adapter signatures (mirrors `text-box-adapter.ts`):**

```typescript
/**
 * Phase 60: Adapter between the legacy SlideStyleOverrides.watermark slot and
 * the unified Watermark element on Slide.
 *
 * Two pure functions — symmetric with text-box-adapter:
 *   - legacyWatermarkToElement(slide): derive a Watermark | null from a legacy slide
 *   - elementToLegacyWatermark(watermark, prevOverrides): produce the legacy slice that,
 *     when shallow-merged onto the original slide.style_overrides, reconstructs identical
 *     shape (modulo Watermark.id which is editor-only, not persisted in the legacy slot).
 *
 * Used by:
 *   - eager migration on slide load (use-slide-editor.ts createInitialState)
 *   - dual-write on save (legacy slot kept populated for back-compat)
 *
 * Idempotence guarantee: legacyWatermarkToElement(legacyWatermarkToElement(slide))
 *   produces equal id values across both calls (deterministic id derivation below).
 */

import type { Slide, SlideStyleOverrides, Watermark } from '@/lib/types/slide'

/**
 * Derive a Watermark element from a legacy slide.
 *
 * Returns null when the slide has no watermark configuration AND the slide
 * isn't a free-tier candidate. (Free-tier forced-watermark logic lives in
 * resolveForcedWatermark.ts and is NOT subsumed by this adapter — see Q10.)
 *
 * Returns a Watermark element when:
 *   - slide.style_overrides.watermark exists (any field), OR
 *   - the slide-level hide_watermark flag exists (we mint an element so it has
 *     somewhere to attach hidden=true)
 *
 * The id is deterministic: `w_${slideIndex}` — see id strategy below.
 */
export function legacyWatermarkToElement(
  slide: Slide,
  slideIndex: number,    // required because slides have no stable uid; index is the only deterministic key
): Watermark | null {
  const wm = slide.style_overrides?.watermark
  const hideWm = slide.style_overrides?.hide_watermark

  // No watermark config at all → return null. Forced-watermark resolver still
  // handles free-tier rendering at render time; this adapter does not replace it.
  if (!wm && !hideWm) return null

  return {
    id: `w_${slideIndex}`,
    ...(wm?.enabled !== undefined ? { enabled: wm.enabled } : {}),
    ...(wm?.customLogoUrl !== undefined ? { customLogoUrl: wm.customLogoUrl } : {}),
    ...(wm?.customText !== undefined ? { customText: wm.customText } : {}),
    ...(wm?.position !== undefined ? { position: wm.position } : {}),
    // Phase 60: hidden field absorbs the hide_watermark legacy flag.
    ...(hideWm === true ? { hidden: true } : {}),
    // groupId, locked are not derivable from legacy (Phase 60 only declares).
  }
}

/**
 * Inverse of legacyWatermarkToElement.
 *
 * Returns the patch to merge into slide.style_overrides. Caller deep-merges
 * the patch into the existing style_overrides to preserve unrelated fields
 * (overlay_opacity, layout, derived_palette, etc.).
 *
 * Edge cases:
 *   - watermark is null → patch sets `watermark: undefined` (caller may delete the field)
 *   - watermark.hidden=true → patch sets hide_watermark=true (preserves legacy contract)
 *   - watermark.locked or .groupId → patch ignores (these don't exist in legacy)
 */
export interface WatermarkLegacySlice {
  watermark_patch: Partial<NonNullable<SlideStyleOverrides['watermark']>> | undefined
  hide_watermark_patch: boolean | undefined
}

export function elementToLegacyWatermark(
  watermark: Watermark | null,
): WatermarkLegacySlice {
  if (!watermark) {
    return { watermark_patch: undefined, hide_watermark_patch: undefined }
  }
  const patch: WatermarkLegacySlice['watermark_patch'] = {}
  if (watermark.enabled !== undefined) patch.enabled = watermark.enabled
  if (watermark.customLogoUrl !== undefined) patch.customLogoUrl = watermark.customLogoUrl
  if (watermark.customText !== undefined) patch.customText = watermark.customText
  if (watermark.position !== undefined) patch.position = watermark.position
  return {
    watermark_patch: Object.keys(patch).length > 0 ? patch : undefined,
    hide_watermark_patch: watermark.hidden === true ? true : undefined,
  }
}
```

**Deterministic id strategy:**

User asked about hash collision risk at scale of 53+ projects × 50 slides ≈ 2,650 watermarks. **Recommendation: `w_${slideIndex}` per project (NOT including project_id in the id).** Rationale:

1. Watermark elements live within a single slide (they don't migrate between slides). Cross-project collisions cannot happen because each project loads its own reducer history.
2. The id only needs to be stable across renders WITHIN A SINGLE EDIT SESSION. Save/reload begins a new session that re-derives the id (since `slide.watermark` field hasn't been persisted in legacy projects).
3. Once a slide is saved with `slide.watermark.id = w_3` (assuming slide index 3), future loads regenerate the same id deterministically when the legacy adapter runs again. **Idempotent by construction.**
4. NO hash function needed. NO collision risk to compute.

**Alternative (more conservative):** `w_${slideIndex}_${slide.background_url ? hash(slide.background_url) : 'default'}`. This adds resilience if slide reorder ever happens between saves (though it doesn't today). Recommendation: keep simple `w_${slideIndex}` for Phase 60. If Phase 65 (layers panel) or any later phase introduces slide reorder that breaks the id assumption, evolve then.

`[ASSUMED]` Slide reorder doesn't change watermark identity assumption — verified by reading `editor-reducer.ts:134-138 (REORDER_SLIDES)` — moves slides via splice but doesn't reset their watermark adapter state, BUT since the adapter takes `slideIndex` and the index changes after reorder, the id WOULD change after reorder. **For Phase 60, this is acceptable** because reorder + persist regenerates the id from the new slide_index, and selection state already clears on slide-switch. **Plan-phase note: confirm with user that watermark selection across slide-reorder isn't a desired feature.**

**Edge cases addressed:**
- Idempotence: `legacyWatermarkToElement(slide, i)` always produces `id = "w_${i}"` for a given slideIndex. Second call returns identical element. ✓
- Null/undefined: Returns null when no legacy config AND no hide_watermark flag. Caller's lazy initializer handles null. ✓
- Free-tier vs paid-tier behavior: Adapter does NOT subsume `resolveForcedWatermark`. Free-tier `enabled: false` is still ignored at render time by the existing forced resolver. The adapter only round-trips the persisted config. (See Q10 for round-trip integration test.)
- Back-compat with `slide.style_overrides.hide_watermark`: hide_watermark is mirrored to `Watermark.hidden`. Inverse: `Watermark.hidden=true` writes `hide_watermark: true` to the legacy slot.

**Integration in lazy initializer (parallel to `migrateLegacySlides` at `use-slide-editor.ts:14-18`):**

```typescript
function migrateLegacySlides(slides: Slide[]): Slide[] {
  return slides.map((slide, slideIndex) => {
    const next: Slide = slide.text_boxes
      ? slide
      : { ...slide, text_boxes: legacyToTextBoxes(slide) }
    if (!next.watermark) {
      const wm = legacyWatermarkToElement(next, slideIndex)
      if (wm) next.watermark = wm
    }
    return next
  })
}
```

**Hash collision risk at scale:** **None** — the id is deterministic per-slide and never crosses projects.

---

### Q3. `useSelectionModel` shape

**Confidence: HIGH.**

**Recommendation:** Separate hook file `src/lib/editor/use-selection-model.ts`. Reasoning: (a) keeps `use-slide-editor.ts` focused on reducer history (its existing concern); (b) selection model has independent test surface; (c) symmetric with the proposed `useModifierState` hook (Q4) — both are React-state-only, both reset on `window.blur` (selection doesn't, but slide-switch is its analog).

**Per-slide map vs single state cleared on slide change:** Single state cleared on slide change (matches v2.8 single-select pattern at `slide-editor.tsx:267-278`). Reasoning: (a) per-slide map adds O(N_slides) memory for selection state most of which is empty; (b) Figma's per-page selection model is the reference (PITFALLS.md 1.2); (c) slide switch is the natural moment to clear. **Caveat:** if user feedback in Phase 61 reveals "I lose my selection too easily when scrubbing the slide list", reconsider — but ship single-state for Phase 60.

**API:**

```typescript
// src/lib/editor/use-selection-model.ts

import { useState, useCallback, useEffect } from 'react'
import type { Slide } from '@/lib/types/slide'

export interface Selection {
  /** Insertion-ordered list of selected element ids. Order matters for
      Phase 63 distribute-edge math; do NOT replace with Set. */
  ids: string[]
  /** The most-recently-added id, OR null when empty. Drives "primary"
      visual indicator in the layer chip. NOTE: NOT exposed to the right
      rail — there is NO key-object UX (PITFALL-12.3). */
  primary: string | null
}

export interface SelectionModel {
  ids: string[]
  primary: string | null
  /** Replace selection wholesale. Used by single-click, marquee end (Phase 61). */
  replaceWith(ids: string[]): void
  /** Add an id to the selection, no-op if already present. Used by Shift+click. */
  addToSelection(id: string): void
  /** Remove an id from the selection, no-op if absent. Used by Shift+click on selected. */
  removeFromSelection(id: string): void
  /** Toggle id presence. Used by Shift+click handler that branches based on current state. */
  toggleInSelection(id: string): void
  /** Clear all selection. Used by Esc, click-empty, slide-switch. */
  clear(): void
  /** Select every element on a slide. Used by Cmd+A. Caller passes the slide
      so we don't double-traverse. */
  selectAll(slide: Slide): void
}

export function useSelectionModel(opts: {
  slideIndex: number
  presentSlides: Slide[]
}): SelectionModel {
  const [ids, setIds] = useState<string[]>([])
  const [primary, setPrimary] = useState<string | null>(null)

  // SEL-10: clear on slide switch (mirrors slide-editor.tsx:267-278 pattern).
  useEffect(() => {
    setIds([])
    setPrimary(null)
  }, [opts.slideIndex])

  // SEL-11: prune stale ids when reducer history mutates (undo/redo or any removal).
  useEffect(() => {
    const slide = opts.presentSlides[opts.slideIndex]
    if (!slide) {
      setIds([])
      setPrimary(null)
      return
    }
    const validIds = new Set([
      ...(slide.text_boxes ?? []).map(tb => tb.id),
      ...(slide.custom_images ?? []).map(ci => ci.id),
      ...(slide.watermark ? [slide.watermark.id] : []),
    ])
    setIds(prev => {
      const filtered = prev.filter(id => validIds.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
    setPrimary(prev => (prev && validIds.has(prev) ? prev : null))
  }, [opts.presentSlides, opts.slideIndex])

  const replaceWith = useCallback((next: string[]) => {
    setIds(next)
    setPrimary(next.length > 0 ? next[next.length - 1] : null)
  }, [])

  const addToSelection = useCallback((id: string) => {
    setIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    setPrimary(id)
  }, [])

  const removeFromSelection = useCallback((id: string) => {
    setIds(prev => prev.filter(x => x !== id))
    setPrimary(prev => (prev === id ? null : prev))
  }, [])

  const toggleInSelection = useCallback((id: string) => {
    setIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    setPrimary(prev => (prev === id ? null : id))
  }, [])

  const clear = useCallback(() => {
    setIds([])
    setPrimary(null)
  }, [])

  const selectAll = useCallback((slide: Slide) => {
    const all = [
      ...(slide.text_boxes ?? []).map(tb => tb.id),
      ...(slide.custom_images ?? []).map(ci => ci.id),
      ...(slide.watermark ? [slide.watermark.id] : []),
    ]
    setIds(all)
    setPrimary(all.length > 0 ? all[all.length - 1] : null)
  }, [])

  return { ids, primary, replaceWith, addToSelection, removeFromSelection, toggleInSelection, clear, selectAll }
}
```

**Where it lives:** Separate hook file. Imported by `slide-editor.tsx` (top-level) and threaded through props to `<SlideCanvas>`, `<SlidePreview>`, `<TextEditorPanel>`, future `<MultiSelectTypeBar>`.

**Recommendation given existing pattern:** Follow `useSlideEditor` structure — hook returns a stable object via `useMemo`. The above example doesn't `useMemo` the return value but should:

```typescript
return useMemo(
  () => ({ ids, primary, replaceWith, addToSelection, removeFromSelection, toggleInSelection, clear, selectAll }),
  [ids, primary, replaceWith, addToSelection, removeFromSelection, toggleInSelection, clear, selectAll]
)
```

Mirrors `use-slide-editor.ts:51-65`.

**Migration path for legacy 3-slot selection state (`selectedTextBoxId`, `selectedCustomTextId`, `selectedCustomImageId`):**

Phase 60 ADDS the new model alongside the legacy slots; Phase 66 removes the legacy slots. During Phase 60, derived getters keep existing components working:

```typescript
// In slide-editor.tsx (Phase 60 transitional layer)
const selection = useSelectionModel({ slideIndex: selectedIndex, presentSlides: slides })

// Legacy compat — derive single-id slots from the new model.
const selectedTextBoxId = selection.ids.length === 1 && currentSlide?.text_boxes?.find(tb => tb.id === selection.ids[0])
  ? selection.ids[0]
  : null
const setSelectedTextBoxId = (id: string | null) => selection.replaceWith(id ? [id] : [])
// Similarly for selectedCustomTextId, selectedCustomImageId — but these can stay as-is
// in Phase 60 since their consumers (slide-preview.tsx) only deal with single-select.
```

`[CITED: ARCHITECTURE.md §2 lines 224-232 — exact migration playbook recommended.]`

---

### Q4. `useModifierState` hook spec

**Confidence: MEDIUM-HIGH on the shape; HIGH on the reset triggers.**

**Recommendation: Ref-based getters.** Reasoning:

- Phase 63's hold-Cmd-disable-snap runs at 60Hz on `onDrag` (PERF-01 envelope `<2ms per pointer-move`). React state would force re-render the `<Rnd>` at 60Hz on every modifier change which hits PITFALL-11.2.
- Marquee (Phase 61) reads `e.shiftKey` directly off the marquee pointer event, NOT from `useModifierState` — it doesn't need this hook at all.
- The only Phase 60 consumer is the future `BULK_TRANSLATE` orchestration; ref-based suffices.
- Trade-off: refs don't trigger re-render, so a UI element that wants to highlight "Shift held" would need a separate state mechanism. **Phase 60 has no such consumer**; defer concern to Phase 63 if it arises.

**API:**

```typescript
// src/lib/editor/use-modifier-state.ts

import { useEffect, useRef, useCallback } from 'react'

export interface ModifierState {
  shift: boolean
  cmd: boolean   // metaKey on Mac, ctrlKey on Windows/Linux (ALWAYS uses $mod equivalent)
  alt: boolean
}

export interface ModifierStateApi {
  /** Returns the current modifier state. Stable reference. */
  get(): ModifierState
}

export function useModifierState(): ModifierStateApi {
  const stateRef = useRef<ModifierState>({ shift: false, cmd: false, alt: false })

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      stateRef.current = {
        shift: e.shiftKey,
        cmd: e.metaKey || e.ctrlKey,
        alt: e.altKey,
      }
    }
    function handleReset() {
      stateRef.current = { shift: false, cmd: false, alt: false }
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)
    window.addEventListener('blur', handleReset)
    document.addEventListener('visibilitychange', handleReset)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
      window.removeEventListener('blur', handleReset)
      document.removeEventListener('visibilitychange', handleReset)
    }
  }, [])

  const get = useCallback(() => stateRef.current, [])
  return { get }
}
```

**Usage:**
```typescript
const modifiers = useModifierState()
// in a 60Hz onDrag handler:
const { shift, cmd } = modifiers.get()
if (cmd) skipSnap()
```

**Trade-off explicitly addressed:** Ref-stable getters mean consumers don't re-render on every keystroke. Phase 63 hold-Cmd-disable-snap lives in a perf-critical path (PERF-01 envelope) — re-renders here would cascade through `<Rnd>` and `<SlidePreview>` which is unacceptable. If a future UI component wants to react visually to modifier-down events, that component can subscribe via `useState`+`useEffect` separately; this hook is the perf-conservative default.

`[CITED: PITFALLS.md 5.5 — "On window.blur or document.visibilitychange, reset all modifier-key tracking state to false."]`
`[CITED: PITFALLS.md 11.2 — Smart guides perf rules apply to anything that touches the drag hot path.]`

---

### Q5. TYPE BAR component scope

**Confidence: MEDIUM-HIGH on operations matrix; MEDIUM on exact mount location (existing right-rail layout requires planner verification).**

**Read the right-rail tree:** `src/components/editor/text-editor-panel.tsx` is the orchestrator; its tree is approximately:
```
TextEditorPanel
├── LayerStrip (single-select chip list)
├── ActiveTextBoxCard (per-element editor — when 1 selected)
├── SlideSettings (when 0 selected)
├── PhotoTreatmentControls (always visible at bottom)
└── WatermarkControls (always visible at bottom)
```

`[CITED: src/components/editor/text-editor-panel.tsx:7-14 imports.]`

**Candidate TYPE BAR ops by selection composition:**

| Selection composition | Universal ops (always shown) | Type-specific ops |
|----------------------|-----------------------------|-------------------|
| All-text (N≥2 text_boxes only) | Delete; (Phase 64) Lock toggle; (Phase 62) Group | Font family; Color (Mixed if differ); Text align (Mixed if differ); Text effects (collapsed accordion) |
| All-image (N≥2 custom_images only) | Delete; (Phase 64) Lock toggle; (Phase 62) Group | Pexels swap (only when N=1 — disabled for multi); Treatment preset (Mixed if differ); Opacity slider (Mixed if differ); Border radius (Mixed if differ) |
| Mixed (text + image, OR includes watermark) | Delete; (Phase 64) Lock toggle; (Phase 62) Group | NONE — only universal ops |
| Includes watermark | Delete; (Phase 64) Lock toggle | Watermark-specific ops live in WatermarkControls (always visible) — TYPE BAR doesn't duplicate |

**Phase 60 scope is narrower than the full matrix** because:
- Group is Phase 62 — show button stub (disabled, tooltip "Group — Phase 62") OR omit entirely. Recommendation: omit; add in Phase 62.
- Lock toggle is Phase 64 — same recommendation: omit; add in Phase 64.
- "Mixed" placeholder for differing values requires actually wiring property fields. Phase 60's TYPE BAR is mostly **a Delete button + a "Mixed selection: N items" header**. Property surface lands in Phase 63+ as alignment ops are added.

**Phase 60 TYPE BAR minimal viable content:**
```
┌─────────────────────────────────────┐
│  N elements selected                │
│                                     │
│  Type breakdown:                    │
│    • 2 text boxes                   │
│    • 1 image                        │
│                                     │
│  [ Delete N elements ]              │
└─────────────────────────────────────┘
```

That's it for Phase 60. Property fields arrive as later phases add the actual ops.

**Mount location:** New file `src/components/editor/multi-select-type-bar.tsx`. Mounts in `text-editor-panel.tsx` as a SIBLING to `<ActiveTextBoxCard />`, gated on `selection.ids.length >= 2`. The existing `<ActiveTextBoxCard>` continues to handle N=1; `<SlideSettings>` continues to handle N=0. Replaces or sits alongside `TextEditorPanel`? **Sits inside it** — TextEditorPanel becomes the dispatcher:

```tsx
// text-editor-panel.tsx (Phase 60 modification, simplified)
{selection.ids.length >= 2 ? (
  <MultiSelectTypeBar selection={selection} slide={slide} onDelete={...} />
) : selection.ids.length === 1 ? (
  <ActiveTextBoxCard ... />
) : (
  <SlideSettings ... />
)}
```

**Recommendation:** Build the bare-minimum N≥2 component for Phase 60. Resist the urge to wire property fields (font/color/align) until Phase 63 needs them.

---

### Q6. Selection ring around union AABB

**Confidence: HIGH.**

**Existing single-select ring at `slide-preview.tsx:884`:**
```typescript
const selectionRingClass = 'outline outline-2 outline-dashed outline-[#3d0000] outline-offset-2 rounded-sm'
```
`[CITED: src/components/slides/slide-preview.tsx:884.]`

This is a Tailwind class. The ring uses CSS `outline` (not `border`) because outline doesn't affect layout AND Satori ignores the property. `[CITED: slide-preview.tsx:879-881 comment.]`

**CSS approach — one outer ring vs N stacked rings:**

**Recommendation: ONE outer ring around the union AABB.** Reasoning:
- Figma's pattern is one outer dashed ring around the multi-selection bounding box — not per-element rings.
- N stacked rings is visually noisy when elements overlap.
- Single ring is cheaper to render (one absolutely-positioned `<div>` vs N).
- The existing per-element ring still appears for N=1 (existing v2.8 behavior preserved).

**Implementation:**

```typescript
// New file: src/lib/editor/transforms/selection-bounds.ts

import type { Slide, TextBox, CustomImage, Watermark } from '@/lib/types/slide'

export interface AABB {
  x: number       // % of canvas width
  y: number       // % of canvas height
  width: number   // % of canvas width
  height: number  // % of canvas height
}

/**
 * Compute the union AABB of N elements on a slide. All coordinates are in
 * percentage of the 1080×1920 reference canvas (matches the schema).
 *
 * Pure — no DOM, no React. Returns null when no ids match (e.g. all stale).
 */
export function unionAABB(slide: Slide, ids: string[]): AABB | null {
  if (ids.length === 0) return null

  const idSet = new Set(ids)
  const rects: AABB[] = []

  for (const tb of slide.text_boxes ?? []) {
    if (!idSet.has(tb.id)) continue
    // text_boxes have implicit height (auto-fit). For Phase 60, use width-only AABB
    // approximation — height comes from rendered DOM via the existing ref pattern
    // at slide-preview.tsx:597-599. Plan-phase: planner can lift the rendered-height
    // observer from `buildOthersForSnap` (slide-preview.tsx:589-637) into a shared
    // helper. For now: leave height undefined for text_boxes; selection ring renders
    // around x/width with a vertical extent that wraps the rendered content.
    if (tb.position.anchor === 'custom') {
      rects.push({
        x: tb.position.x ?? 0,
        y: tb.position.y ?? 0,
        width: tb.position.width ?? 60,
        height: 0, // TODO Phase 60: ref-based height resolution
      })
    } else {
      // Pre-set anchors (top/center/bottom) — translate to % via SAFE_ZONE constants.
      // Implementation detail: see slide-preview.tsx:457-468 for the math.
    }
  }

  for (const ci of slide.custom_images ?? []) {
    if (!idSet.has(ci.id)) continue
    rects.push({ x: ci.x, y: ci.y, width: ci.width, height: ci.height })
  }

  if (slide.watermark && idSet.has(slide.watermark.id)) {
    // Watermark size is computed by resolveWatermark/resolveForcedWatermark — for AABB
    // purposes we use the resolved px values then convert back to %. Phase 60 plan-task
    // can either reuse those resolvers or hard-code based on watermark.position.
  }

  if (rects.length === 0) return null

  const minX = Math.min(...rects.map(r => r.x))
  const minY = Math.min(...rects.map(r => r.y))
  const maxX = Math.max(...rects.map(r => r.x + r.width))
  const maxY = Math.max(...rects.map(r => r.y + r.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
```

**Render in `slide-preview.tsx` (editable={true} branch only):**

```tsx
{/* Phase 60: union-AABB selection ring. Editable-only. */}
{editable && selection.ids.length >= 2 && (() => {
  const aabb = unionAABB(slide, selection.ids)
  if (!aabb) return null
  return (
    <div
      data-testid="multi-selection-ring"
      style={{
        position: 'absolute',
        left: `${aabb.x}%`,
        top: `${aabb.y}%`,
        width: `${aabb.width}%`,
        height: `${aabb.height}%`,
        outline: '2px dashed #3d0000',
        outlineOffset: 4,
        pointerEvents: 'none',
        zIndex: 50, // above text/images, below resize handles
      }}
    />
  )
})()}
```

**Z-position:** Above text/images (which use zIndex 10/12/15 — see `slide-preview.tsx:692/712/741/830`) but below editor-only resize handles. `zIndex: 50` is safe. Crucially `pointerEvents: 'none'` so the ring doesn't intercept clicks (PITFALL-2.1 — pointer events going to wrong element).

**Editable-true gate enforcement:** This block lives strictly inside `slide-preview.tsx`'s editable branch (after line 946). The non-editable branch (line 651-872) does not import `unionAABB` and doesn't reference `selection`. **Verify in Phase 60 by extending the Phase 59 PARITY-02 test pattern at parity.test.tsx:152-184** (asserts `editable={false}` renders zero `<Rnd>` DOM) to also assert no `[data-testid="multi-selection-ring"]` element.

**Empty selection:** No ring (handled by `selection.ids.length >= 2` gate).
**Single selection:** Per-element ring (existing behavior, unchanged).

---

### Q7. `BULK_TRANSLATE` action shape

**Confidence: HIGH.**

**Action shape (extension to `editor-actions.ts`):**

```typescript
// Add to EditorAction union in src/lib/editor/editor-actions.ts

export type EditorAction =
  | ... existing
  | {
      type: 'BULK_TRANSLATE'
      slideIndex: number
      ids: string[]      // element ids (text_boxes OR custom_images OR watermark)
      deltaX: number     // % of canvas width
      deltaY: number     // % of canvas height
    }
```

**Reducer case (extension to `editor-reducer.ts`):**

```typescript
case 'BULK_TRANSLATE': {
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    const idSet = new Set(action.ids)

    // Update text_boxes
    let nextTextBoxes = slide.text_boxes
    if (slide.text_boxes) {
      nextTextBoxes = slide.text_boxes.map(tb => {
        if (!idSet.has(tb.id)) return tb
        // Phase 64: skip locked. Phase 60 honors the contract by checking
        // the field even though no element has it yet.
        if (tb.locked === true) return tb
        // Only 'custom' anchor boxes can be freely translated. Hook/body
        // with structural anchors (top/center/bottom) need to either flip
        // anchor to 'custom' or skip — Phase 60 conservative choice: SKIP
        // structural-anchor boxes. Multi-drag UX in Phase 62 will revisit.
        if (tb.position.anchor !== 'custom') return tb
        return {
          ...tb,
          position: {
            ...tb.position,
            x: (tb.position.x ?? 0) + action.deltaX,
            y: (tb.position.y ?? 0) + action.deltaY,
          },
        }
      })
    }

    // Update custom_images
    let nextCustomImages = slide.custom_images
    if (slide.custom_images) {
      nextCustomImages = slide.custom_images.map(ci => {
        if (!idSet.has(ci.id)) return ci
        if (ci.locked === true) return ci  // Phase 64 honor
        return { ...ci, x: ci.x + action.deltaX, y: ci.y + action.deltaY }
      })
    }

    // Update watermark — Phase 60 declares the contract; the watermark's `position`
    // field is enum-only ('top-left' | 'bottom-left' | 'bottom-right'), so freeform
    // translation requires a future schema extension. SKIP watermark in Phase 60
    // BULK_TRANSLATE — Phase 62 (groups) or Phase 63 (alignment) will introduce
    // freeform watermark positioning.
    // (Plan-phase note: this is a known gap; document with a TODO.)

    let next: Slide = slide
    if (nextTextBoxes !== slide.text_boxes) {
      next = applyDualWrite(next, nextTextBoxes!)
    }
    if (nextCustomImages !== slide.custom_images) {
      next = { ...next, custom_images: nextCustomImages }
    }
    return next
  })
  return pushHistory(state, slides)
}
```

**Edge cases:**
- **id not found in slide:** Silently skipped (set lookup returns false). No error. Matches the existing pattern at `editor-reducer.ts:185-187` (`UPDATE_CUSTOM_TEXT` — silent miss).
- **Watermark in selection:** SKIPPED in Phase 60. Watermark `.position` is enum-only; freeform translation requires schema extension or new translation strategy. **This is a known gap; planner should document and defer to Phase 62 or 63.**
- **Locked elements:** Skipped via `locked === true` check. Phase 60 has no UI to set `locked=true`, but the contract is set so Phase 64 doesn't need to re-touch this reducer.
- **Hook/body text_boxes with structural anchors:** Skipped (anchor !== 'custom'). Same Phase 62 deferral as watermark.
- **Single `pushHistory` call:** Yes — the entire mutation runs inside one `pushHistory` invocation. **One undo entry per gesture.** Mirrors `editor-reducer.ts:104` (`ADD_SLIDE` returns `pushHistory(state, slides)` — single call).

**Today's drag-on-watermark behavior:** Watermark today is rendered at `slide-preview.tsx:746-768` via `resolveWatermark` and is `pointerEvents: 'none'` — **NOT draggable**. Phase 60 schema lift does NOT change this. The watermark element is selectable (Phase 60 Cmd+A puts it in selection) but freeform-draggable behavior comes only when a future phase wires the position field.

**Routes through `applyDualWrite` for text_boxes only:** Yes (line `next = applyDualWrite(next, nextTextBoxes)`) — matches the `UPDATE_TEXT_BOX` pattern at `editor-reducer.ts:277`. Custom images don't have a dual-write requirement (no legacy back-compat shape).

---

### Q8. Parity test extension shape

**Confidence: HIGH.**

**Existing `parity.test.tsx` fixtures (read at lines 28-100, 109-210):**

The test file currently covers:
- Phase 58 PARITY-01/PARITY-02: renderer parity for new templates (renderGrain singleton check, template registration, etc.) — lines 28-100.
- Phase 59 PARITY-01/PARITY-02: corner-resize parity invariants — lines 109-210. Uses `legacyToTextBoxes(slide)` to mint `text_boxes` for the fixture slide.

**Phase 60 watermark parity test extension (proposed addition):**

```typescript
// Phase 60 (PARITY-01, WMARK-04, WMARK-05): watermark unification preserves byte-identical
// output across both renderers regardless of which path (legacy slot vs unified element)
// supplied the configuration.

describe('Phase 60 (PARITY-01, WMARK-04, WMARK-05): watermark schema-lift parity', () => {
  it('legacy slot AND unified element produce identical render', () => {
    // Fixture A: legacy-only (style_overrides.watermark, no slide.watermark)
    const slideA: Slide = {
      hook_text: 'Test',
      body_text: 'Body',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: {
        watermark: { enabled: true, customText: 'Brand', position: 'bottom-right' },
      },
    }
    slideA.text_boxes = legacyToTextBoxes(slideA)

    // Fixture B: unified-only (slide.watermark, NO style_overrides.watermark)
    const slideB: Slide = {
      ...slideA,
      style_overrides: { ...slideA.style_overrides, watermark: undefined },
      watermark: { id: 'w_0', enabled: true, customText: 'Brand', position: 'bottom-right' },
    }

    // Both renderers should produce identical resolved watermark output.
    // (Test compares either rendered HTML or the resolveForcedWatermark/resolveWatermark
    // return values.)
    const resolvedA = resolveForcedWatermark('plus', { width: 1080, height: 1920 }, slideA)
    const resolvedB = resolveForcedWatermark('plus', { width: 1080, height: 1920 }, slideB)
    expect(resolvedA).toEqual(resolvedB)
  })

  it('adapter is idempotent: legacyWatermarkToElement(legacyWatermarkToElement(slide))', () => {
    const slide: Slide = {
      hook_text: 'X',
      body_text: 'Y',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { watermark: { enabled: false }, hide_watermark: true },
    }
    const wm1 = legacyWatermarkToElement(slide, 0)
    expect(wm1?.id).toBe('w_0')
    expect(wm1?.hidden).toBe(true)

    // Apply once
    const slide2: Slide = { ...slide, watermark: wm1 ?? undefined }
    const wm2 = legacyWatermarkToElement(slide2, 0)
    expect(wm2?.id).toBe(wm1?.id)
    expect(wm2).toEqual(wm1)
  })

  it('round-trip: element → legacy → element preserves all fields', () => {
    const wm: Watermark = {
      id: 'w_0',
      enabled: true,
      customLogoUrl: 'https://example.com/logo.png',
      customText: 'Brand',
      position: 'bottom-left',
      hidden: false,
    }
    const slice = elementToLegacyWatermark(wm)
    expect(slice.watermark_patch).toEqual({
      enabled: true,
      customLogoUrl: 'https://example.com/logo.png',
      customText: 'Brand',
      position: 'bottom-left',
    })
    expect(slice.hide_watermark_patch).toBeUndefined()

    // Reconstruct slide + run adapter again
    const slide: Slide = {
      hook_text: '', body_text: '', image_query: '', is_cta: false,
      background_url: null, pexels_photo_id: null,
      style_overrides: {
        watermark: slice.watermark_patch,
        hide_watermark: slice.hide_watermark_patch,
      },
    }
    const wm2 = legacyWatermarkToElement(slide, 0)
    expect(wm2?.enabled).toBe(wm.enabled)
    expect(wm2?.customLogoUrl).toBe(wm.customLogoUrl)
    expect(wm2?.customText).toBe(wm.customText)
    expect(wm2?.position).toBe(wm.position)
  })

  it('PARITY-01: SlidePreview editable={false} renders zero multi-selection chrome', () => {
    const slide: Slide = { /* ... */ }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview slide={slide} template={getTemplate('highlight-bar')} index={0} editable={false} />,
    )
    const html = container.innerHTML
    // No multi-selection ring testid in non-editable branch.
    expect(html).not.toMatch(/multi-selection-ring/)
    // Stricter: no className containing 'selection'/'marquee'/'guide' (regression scan).
    expect(html).not.toMatch(/class="[^"]*\bselection\b[^"]*"/)
    expect(html).not.toMatch(/class="[^"]*\bmarquee\b[^"]*"/)
    expect(html).not.toMatch(/class="[^"]*\bguide\b[^"]*"/)
  })
})
```

**Where the className regression scan lives:**

- **Recommendation: extend `parity.test.tsx`** with the `*selection*`/`*marquee*`/`*guide*` className regression block (as shown above). Reasoning:
  - `parity.test.tsx` is already the canonical "render-tree parity" test. Adding the className scan to it keeps related concerns together.
  - `no-css-filter.test.ts` is **specifically about banned CSS properties in source files** (it greps source code, NOT rendered output). Different concern; different mechanism.
  - The PITFALLS.md / SUMMARY.md `*selection*`/`*marquee*`/`*guide*` scan is about **rendered DOM**, which lives naturally in parity.test.tsx alongside the existing PARITY-02 DOM-walking pattern at lines 152-184.

- **Alternative (defer to Phase 65/67 audit):** Create a new `editor-chrome-leak.test.ts` next to parity.test.tsx. Acceptable but unnecessary for Phase 60.

**Phase 60 ships the FIRST seed of this regression scan** — `multi-selection-ring` testid only. Phase 61 adds `marquee-rect`. Phase 63 adds `smart-guide-line`. Phase 65 adds `layer-overlay`. By Phase 67 the scan covers the whole v2.11 chrome surface.

---

### Q9. Reducer action types affected by stale-id pruning

**Confidence: HIGH.**

**Reducer actions that can leave stale ids in selection:**

| Action | Today (line) | Stale-id risk | Pruning strategy |
|--------|-------------|--------------|------------------|
| `REMOVE_TEXT_BOX` | 282-291 | The removed `textBoxId` may still be in `selection.ids` | **In-reducer single-select clear** already exists at `use-slide-editor.ts:42-45` for legacy `selectedTextBoxId`. Extend to multi: caller calls `selection.removeFromSelection(id)` after dispatch. |
| `REMOVE_CUSTOM_IMAGE` | 236-245 | Same | Same — caller wraps in a `removeCustomImage` helper that clears selection. |
| `REMOVE_CUSTOM_TEXT` | 193-202 | Same | Same. |
| `REMOVE_SLIDE` | 107-111 | Removes ALL elements on a slide — selection.ids may all become stale (if user removes a non-active slide, no impact; if removes the active slide, selectedIndex shifts and selection clears via slide-switch effect anyway) | The `useEffect` keyed on `selectedIndex` already clears (Q3). Belt-and-suspenders: also `useEffect` keyed on `state.present` to filter stale ids (covers undo/redo). |
| `DUPLICATE_SLIDE` | 113-132 | Regenerates ids on cloned slide (lines 121-128). The original slide's selection.ids should remain valid; cloned slide has all-new ids that are not in selection. | No stale-id risk for the original slide. New slide loads with empty selection (slide-switch effect clears). |
| `UNDO`/`REDO` | 293-313 | An undo can remove an element that was just added; the just-added id is in selection but no longer in slide | **`useEffect` keyed on `state.present`** prunes stale ids. This is the canonical pattern (PITFALLS.md 1.1). |

**Recommendation: hybrid approach (matches existing `applyDualWrite` philosophy):**

1. **In-reducer-adjacent helpers** (high-traffic actions): Wrap `removeTextBox`, `removeCustomImage`, `removeCustomText` in `useSlideEditor`-style hooks that call `dispatch` AND `selection.removeFromSelection(id)` atomically. The `removeTextBox` callback at `use-slide-editor.ts:42-45` is the existing template:

   ```typescript
   const removeTextBox = useCallback((slideIndex: number, textBoxId: string) => {
     dispatch({ type: 'REMOVE_TEXT_BOX', slideIndex, textBoxId })
     selection.removeFromSelection(textBoxId)  // NEW for multi-select
   }, [dispatch, selection])
   ```

2. **`useEffect` keyed on `state.present`** (safety net): Inside `useSelectionModel` (Q3 spec already includes this). Filters any selection.ids that no longer exist in the active slide. Covers undo/redo and any forgotten call site.

**Why hybrid:**
- The in-reducer-adjacent helper is faster (no intermediate render with stale id visible in the layer panel).
- The useEffect catches everything else (undo/redo, future call sites, bugs).

**`applyDualWrite` analogy:** `applyDualWrite` exists in two places — inside the reducer (for live preview) AND at save time (`slide-editor.tsx:280-319`) as belt-and-suspenders. `[CITED: editor-reducer.ts:7-21 BL-01 comment.]` Selection pruning follows the same pattern.

**Implementation: planner can keep this exclusively in `useSelectionModel`'s useEffect (Q3)** if the reducer-adjacent helper feels like over-engineering for Phase 60. The useEffect alone covers all 6 actions correctly; the only cost is one render frame of stale id visible (typically imperceptible). Recommended: **start with useEffect-only**, add reducer-adjacent helpers later if user reports flicker.

---

### Q10. Free-tier watermark forced-show logic

**Confidence: HIGH.**

**Current free-tier forced-show logic (read `resolve-forced-watermark.ts:64-69`):**

```typescript
let renders = false
if (isFree) {
  renders = true                  // Free tier: always renders, IGNORING enabled: false
} else if (isPaid) {
  renders = wmConfig?.enabled === true || !!wmConfig?.customLogoUrl
}
if (!renders) return null
```

**Locked rule:** Free-tier `enabled: false` is **ignored** — the forced ViralSlideMaker watermark renders unconditionally. Tested at `resolve-forced-watermark.test.ts:111` (`'free tier WITH enabled=false STILL renders (free opt-out is locked)'`).

**Does the unification preserve this?** YES — by design. Phase 60's adapter does NOT subsume `resolveForcedWatermark`. The two coexist:

1. **Adapter (Phase 60):** Reads `slide.style_overrides.watermark` → mints `slide.watermark` element. Round-trips back via `elementToLegacyWatermark`.

2. **Forced-watermark resolver (existing, untouched):** Reads `slide.style_overrides.watermark.enabled` AT RENDER TIME — which the adapter has populated by mirroring back. The free-tier `enabled: false` ignore-rule lives inside `resolveForcedWatermark`, not in the adapter.

**Round-trip integration test (REQUIRED in Phase 60 plan):**

```typescript
it('Phase 60 (WMARK-04, WMARK-05): free-tier enabled=false STILL renders post-unification', () => {
  // BEFORE: slide with style_overrides.watermark.enabled = false
  const slide: Slide = {
    hook_text: '', body_text: '', image_query: '', is_cta: false,
    background_url: null, pexels_photo_id: null,
    style_overrides: { watermark: { enabled: false } },
  }

  // Phase 60 adapter mints slide.watermark
  slide.watermark = legacyWatermarkToElement(slide, 0) ?? undefined
  expect(slide.watermark?.enabled).toBe(false)

  // Free-tier rendering ignores .enabled === false (CONTRACT FROM resolve-forced-watermark.test.ts:111)
  const forced = resolveForcedWatermark('free', { width: 1080, height: 1920 }, slide)
  expect(forced).not.toBeNull()
  expect(forced?.text).toBe('ViralSlideMaker.com')
})
```

**Round-trip via adapter:**

```typescript
it('Phase 60: round-trip preserves enabled=false on style_overrides.watermark', () => {
  const wm: Watermark = { id: 'w_0', enabled: false }
  const slice = elementToLegacyWatermark(wm)
  expect(slice.watermark_patch).toEqual({ enabled: false })

  // Reconstruct + re-derive
  const slide: Slide = {
    hook_text: '', body_text: '', image_query: '', is_cta: false,
    background_url: null, pexels_photo_id: null,
    style_overrides: { watermark: slice.watermark_patch },
  }
  const wm2 = legacyWatermarkToElement(slide, 0)
  expect(wm2?.enabled).toBe(false)

  // Free-tier still renders
  const forced = resolveForcedWatermark('free', { width: 1080, height: 1920 }, slide)
  expect(forced).not.toBeNull()
})
```

**Confirmation:** The constraint round-trips losslessly because (a) the adapter mirrors `enabled` field both ways, (b) `resolveForcedWatermark` reads from the legacy slot which the adapter has written to. **Free-tier opt-out remains locked across the schema lift.**

**Edge case to verify in plan:** When the adapter mints `slide.watermark` element, `slide.style_overrides.watermark` MAY OR MAY NOT also be populated. Renderers in Phase 60 should **prefer `slide.watermark` when present, fall back to `slide.style_overrides.watermark` when absent.** For free-tier rendering specifically, `resolveForcedWatermark` already reads from `slide.style_overrides.watermark` — so the existing function continues to work as long as the adapter mirrors back. **Plan must verify that the lazy-initializer code path leaves `style_overrides.watermark` populated when `slide.watermark` is minted from it.**

`[VERIFIED via codebase: resolve-forced-watermark.ts:57 reads `slide?.style_overrides?.watermark` — adapter MUST keep this slot populated for back-compat.]`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest@4.1.0 |
| Config file | (no `vitest.config.ts` found at root — verify in plan; may use `vite.config.ts` or default config) |
| Quick run command | `npx vitest run --reporter=basic <pattern>` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEL-15 | `Selection { ids, primary }` shape with insertion order | unit | `npx vitest run src/lib/editor/__tests__/use-selection-model.test.ts` | ❌ Wave 0 (NEW file) |
| SEL-01..04 | Click + Shift+click + Cmd+click selection ops | integration | `npx vitest run src/lib/editor/__tests__/use-selection-model.test.ts` | ❌ Wave 0 |
| SEL-07 | Cmd+A select all (slide-scoped) | unit (selectAll method) + manual | `npx vitest run src/lib/editor/__tests__/use-selection-model.test.ts` | ❌ Wave 0 |
| SEL-08 | Esc clears | unit (clear method) | `npx vitest run src/lib/editor/__tests__/use-selection-model.test.ts` | ❌ Wave 0 |
| SEL-09 | Click empty canvas clears | manual-only | (manual smoke test) | — |
| SEL-10 | Selection clears on slide switch | unit (useEffect) | `npx vitest run src/lib/editor/__tests__/use-selection-model.test.ts` | ❌ Wave 0 |
| SEL-11 | Stale IDs pruned post-undo/redo | unit | `npx vitest run src/lib/editor/__tests__/use-selection-model.test.ts` | ❌ Wave 0 |
| SEL-12 | TYPE BAR for N≥2 with Mixed placeholder | component test | `npx vitest run src/components/editor/__tests__/multi-select-type-bar.test.tsx` | ❌ Wave 0 |
| SEL-13 | Union AABB ring `editable={true}` only | component test | `npx vitest run src/lib/render/__tests__/parity.test.tsx` (extension) | ✅ Extends existing |
| WMARK-01..03 | Adapter shape + round-trip | unit | `npx vitest run src/lib/editor/__tests__/watermark-adapter.test.ts` | ❌ Wave 0 |
| WMARK-04..05 | Both renderers byte-identical pre/post unification | integration | `npx vitest run src/lib/render/__tests__/parity.test.tsx` (extension) | ✅ Extends existing |
| KBD-01 | tinykeys replaces switch | grep test | `npx vitest run src/lib/render/__tests__/no-css-filter.test.ts` (extension scans slide-editor.tsx for absence of e.metaKey) | ✅ Extends existing |
| KBD-02 | isEditing guard on every binding | grep test (assert handler bodies call `isEditingTarget`) | (new test or grep on source) | — |
| KBD-03 | preventDefault on every binding | grep test | (new test) | — |
| KBD-04 | Modifier reset on blur/visibilitychange | unit | `npx vitest run src/lib/editor/__tests__/use-modifier-state.test.ts` | ❌ Wave 0 |
| PARITY-01 | Editor chrome behind editable=true | component test | `npx vitest run src/lib/render/__tests__/parity.test.tsx` (extension) | ✅ Extends existing |
| PERF-01 | BULK_TRANSLATE single dispatch | unit | `npx vitest run src/lib/editor/__tests__/editor-reducer.test.ts` (extension) | ✅ Extends existing |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/editor/ src/lib/render/__tests__/parity.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/editor/__tests__/use-selection-model.test.ts` — covers SEL-01..04, SEL-07..11, SEL-15
- [ ] `src/lib/editor/__tests__/use-modifier-state.test.ts` — covers KBD-04
- [ ] `src/lib/editor/__tests__/watermark-adapter.test.ts` — covers WMARK-01..03 + Q10 free-tier round-trip
- [ ] `src/components/editor/__tests__/multi-select-type-bar.test.tsx` — covers SEL-12
- [ ] Extend `src/lib/render/__tests__/parity.test.tsx` with watermark fixtures (WMARK-04..05) + multi-selection ring leak scan (PARITY-01)
- [ ] Extend `src/lib/editor/__tests__/editor-reducer.test.ts` with BULK_TRANSLATE single-dispatch test (PERF-01)

---

## Sources

### Primary (HIGH confidence)
- Context7 `/jamiebuilds/tinykeys` — `tinykeys(window, {...})` API; `$mod` modifier; React useEffect cleanup pattern. Verified via Bash CLI fallback (`ctx7 docs`).
- npm registry — `tinykeys@3.0.0` published 2024-08-20. `[VERIFIED: npm view tinykeys version + npm view tinykeys time]`
- `src/lib/editor/use-slide-editor.ts` — existing selection-state-outside-history pattern (line 27-29 + comment).
- `src/lib/editor/text-box-adapter.ts` — canonical adapter pattern; mirror for watermark adapter.
- `src/lib/editor/editor-reducer.ts` — `applyDualWrite`, `pushHistory`, `MAX_HISTORY` patterns.
- `src/lib/render/__tests__/parity.test.tsx` — existing parity test fixture pattern.
- `src/lib/render/resolve-forced-watermark.ts` + test — free-tier `enabled: false` ignore-rule.
- `src/components/slides/slide-preview.tsx` — `editable={true}` gate at line 304/946; selection ring style at 884; `pointerEvents: 'none'` watermark at 763.
- `src/components/editor/slide-editor.tsx:340-393` — current keydown handler with isEditing guard.

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — top-risks list; locked architectural decisions converged across 4 docs.
- `.planning/research/STACK.md` — version pin verification; library tradeoff matrices.
- `.planning/research/ARCHITECTURE.md` — multi-select state model spec; build-order decomposition.
- `.planning/research/PITFALLS.md` — Categories 1, 9, 10, 12 directly cited.

### Tertiary (LOW confidence — flagged in Assumptions Log)
- A1: Watermark id strategy `w_${slideIndex}` correctness across slide-reorder — assumption based on read of REORDER_SLIDES at editor-reducer.ts:134-138; user confirmation recommended.
- A4: Whether the chrome-leak regression scan goes in `parity.test.tsx` vs new file — code-organization preference.
- A7: Free-tier round-trip losslessness through adapter — depends on adapter NOT replacing `resolveForcedWatermark`; explicitly tested in plan.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tinykeys version + API verified via npm + Context7.
- Architecture: HIGH — patterns are existing-codebase mirrors (text-box-adapter, applyDualWrite, useSelectionModel ≈ existing `selectedTextBoxId`).
- Pitfalls: HIGH — sourced from PITFALLS.md categories with real GitHub-issue evidence; verified each pitfall maps to a Phase 60 prevention rule.
- TPLREND-05 verification: MEDIUM — requires Phase 60 to actually extend `parity.test.tsx`; planner must include test extension as a wave 0 task.

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (30 days for stable; tinykeys is mature, codebase patterns won't shift, watermark resolvers are unlikely to change)
