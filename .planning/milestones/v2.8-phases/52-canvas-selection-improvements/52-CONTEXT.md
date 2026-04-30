# Phase 52: Canvas Selection Improvements - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** Auto-resolved (`--auto`) — scope reduced to minimum-viable to avoid risk to slide-preview.tsx (also Satori export path)

<domain>
## Phase Boundary

Wire the canvas to the new selection state from Phase 49. Click a text box on canvas → `selectedTextBoxId` updates → right rail mirrors. Active text box shows a visible selection ring (canvas-only — no impact on PNG export). Keyboard shortcuts switch / duplicate / remove text boxes.

In scope:
- Click handlers on hook/body text elements in slide-preview.tsx → call new `onTextBoxSelect(id)` prop → updates `selectedTextBoxId`
- Selection ring overlay (visible only in editable mode, NOT in Satori export — gated by `editable={true}` prop)
- Keyboard shortcuts (`⌘1`/`⌘2`/`⌘3` switch, `⌘D` duplicate, `Delete` remove) — listen at `slide-editor.tsx` level

Out of scope:
- CANVAS-03 (Layers mini-list for overlapping text boxes) — defer to v2.9. Most slides have 2-3 text boxes that don't overlap; this is a secondary nice-to-have.
- New drag handles for hook/body — existing react-rnd plumbing from v1.3 already works (CANVAS-05 preserved).

</domain>

<decisions>
## Implementation Decisions

### Click-to-select

- **D-01: New prop on SlidePreview** — `onTextBoxSelect?: (textBoxId: string) => void`. Only fires in editable mode. The hook/body wrapper elements (and custom_text wrappers) get an `onClick` that:
  1. Reads the slide's `text_boxes[]`
  2. Finds the matching TextBox by role: hook click → role='hook' box, body click → role='body' box, custom click → matches by id
  3. Calls `onTextBoxSelect(matchedBox.id)`
- **D-02: Backward compat** — if `onTextBoxSelect` is omitted (e.g., older callers), fall back to existing onCustomTextSelect path. No breakage.

### Selection ring

- **D-03: Selection ring visual** — `outline-2 outline-dashed outline-[#3d0000] outline-offset-2` on the active text box's wrapper. Pure CSS, no JavaScript animation, no impact on Satori PNG export (Satori ignores `outline`).
- **D-04: Active determination** — wrapper component checks `selectedTextBoxId` against the TextBox associated with this DOM element. Renders the outline className conditionally.
- **D-05: Editable-only** — the ring only renders when `editable={true}` AND `selectedTextBoxId !== null`. PNG export path always uses `editable={false}` so no ring leaks into exported images.

### Keyboard shortcuts

- **D-06: Listener placement** — `slide-editor.tsx` adds a `useEffect` that subscribes to `window.addEventListener('keydown', handler)` on mount, unsubscribes on unmount. Handler:
  - **Skip if** `document.activeElement` is a textarea, input, or contenteditable (so typing isn't hijacked)
  - **`Cmd/Ctrl+1`/`2`/`3`** → `setSelectedTextBoxId(slide.text_boxes[0|1|2]?.id ?? null)`
  - **`Cmd/Ctrl+D`** → if active box exists, dispatch `ADD_TEXT_BOX` with role='custom' and pre-generated id, then setSelectedTextBoxId(newId). Mirrors the Layer Strip "+ Add" behavior. (True duplicate would require a deep-clone helper; defer to v2.9.)
  - **`Delete`/`Backspace`** → if active box has role='custom' (don't allow deleting hook/body — they're structural), call `removeTextBox(selectedIndex, selectedTextBoxId)` from `useSlideEditor`
- **D-07: Cmd/Ctrl detection** — use `e.metaKey || e.ctrlKey` for cross-platform.
- **D-08: Tests** — fire keydown events via `fireEvent.keyDown(window, ...)` in a regression test, assert `selectedTextBoxId` updates.

### Deferred (CANVAS-03)

- **D-09: Layers mini-list deferred to v2.9** — document in REQUIREMENTS.md alongside AIGEN-01. Rationale: 90% of slides have ≤3 text boxes that don't overlap. The Layer Strip (Phase 50) already provides a chip-based list. A floating Layers panel is genuine polish but adds risk to slide-canvas.tsx during this milestone. Resurface if user complaint surfaces post-ship.

### Claude's Discretion

- Specific keydown matching (lowercase 'd' vs 'D', any modifier specifics)
- Whether to add a small useKeyboardShortcuts hook or inline the useEffect
- Whether to also wire ⌘D from canvas to also work when LayerStrip is focused

### Folded Todos

None.

</decisions>

<canonical_refs>
## Canonical References

- `~/.claude/plans/users-deeg-desktop-screenshot-2026-04-3-replicated-seal.md` — Phase 52 milestone scope
- `.planning/REQUIREMENTS.md` — CANVAS-01..05 (CANVAS-03 will be marked deferred per D-09)
- `.planning/phases/49-..-VERIFICATION.md` and `50-..-VERIFICATION.md` — confirm useSlideEditor exposes selectedTextBoxId, setSelectedTextBoxId, removeTextBox

### Code references
- `src/components/editor/slide-canvas.tsx` (123 lines) — thin wrapper, may need 1 new prop forwarding
- `src/components/slides/slide-preview.tsx` (1297 lines) — where click handlers and selection ring conditionals land
- `src/components/editor/slide-editor.tsx` — where the keyboard listener lives, props pass-through
- `src/lib/editor/use-slide-editor.ts` — exposes selectedTextBoxId, setSelectedTextBoxId, removeTextBox

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `selectedCustomTextId` / `onCustomTextSelect` already exist as props on SlidePreview — selection-ring logic for custom_texts already exists; extend it to hook/body
- react-rnd resize for hook/body (v1.3) — already works via `style_overrides.{hook,body}_position` + `_width`. Phase 50's reducer write-through ensures these stay synced with `text_boxes`.

### Established Patterns
- `editable={true}` boolean prop gates all editor UI off the rendering path. Satori exports always pass `editable={false}`.
- Per-slide click handlers are inside SlidePreview, NOT slide-canvas (canvas is a wrapper).

### Integration Points
- `slide-preview.tsx` — existing element wrappers for hook + body need onClick + outline className additions
- `slide-editor.tsx` — listener for keyboard shortcuts; pass `onTextBoxSelect` prop down through SlideCanvas → SlidePreview
- `slide-canvas.tsx` — propagate the new `onTextBoxSelect` prop through (1-line addition)

</code_context>

<specifics>
## Specific Ideas

- The user's mental model: "click a text box on canvas → its properties show in the right rail". This is the Figma/Canva pattern and matches Phase 50's selection-driven panel.
- Keyboard shortcuts are convenience — most carousel users don't reach for them. ⌘D for duplicate is the most-asked-for; ⌘1-3 are nice for power users.

</specifics>

<deferred>
## Deferred Ideas

- **CANVAS-03 Layers mini-list** — defer to v2.9 (rationale in D-09)
- True deep-clone "duplicate" via ⌘D (currently maps to "Add new text box at canvas position") — defer until users ask
- Right-click context menu on text boxes — not in scope; Phase 50 + LayerStrip provide all CRUD via right rail
- Multi-select via shift-click — out of scope for v2.8

### Reviewed Todos (not folded)

None.

</deferred>

---

*Phase: 52-canvas-selection-improvements*
*Context gathered: 2026-04-30*
