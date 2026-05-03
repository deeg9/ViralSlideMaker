# Phase 64: Lock / Hide + Z-Order — Context

**Gathered:** 2026-05-02
**Mode:** Auto-generated (autonomous --auto)

<domain>
## Phase Boundary

Land `locked?` + `hidden?` SEMANTICS (fields declared in Plan 60-01) and z-order array-splice operations.

**LOCK / HIDE (8 reqs):**
- LOCK-01, LOCK-02: Field declarations confirmed (already in Plan 60-01)
- LOCK-03: Cmd+Shift+L tinykeys binding toggles lock on selection
- LOCK-04: Locked element selectable but blocks drag/resize/delete/edit (Figma model — selectable so user can unlock)
- LOCK-05: Locked element excluded from marquee selection (Figma + Canva model)
- LOCK-06: Locked element wrapper sets `pointer-events: none` so marquee passes through stacked locked overlays
- LOCK-07: Hidden element (`hidden=true`) skipped by BOTH renderers (editor preview AND Satori PNG); excluded from alignment bounds
- LOCK-08: Fork RPC strips `locked` flag on copy (forker takes ownership)

**Z-ORDER (7 reqs):**
- ZORDER-01: Cmd+] bring forward (array splice +1, clamp at array length)
- ZORDER-02: Cmd+[ send backward (array splice -1, clamp at 0)
- ZORDER-03: Cmd+Alt+] bring to front (move to end of array)
- ZORDER-04: Cmd+Alt+[ send to back (move to index 0)
- ZORDER-05: Z-order operations use array splice — NEVER CSS z-index (Satori parity invariant)
- ZORDER-06: Z-order on multi-selection iterates each selected element +1/-1 individually with array-bound clamping (Figma model)
- ZORDER-07: Operates within each element-type array independently (text_boxes / custom_images / watermarks). Cross-array reorder deferred to v3.0+

**Out of scope:**
- Layers panel UI for lock/hide toggles (Phase 65)
- Drag-to-reorder in layers panel (Phase 65 deferred)
- Cross-array z-order (v3.0+)
</domain>

<decisions>
## Locked Decisions

### LOCK behavior wiring
- New reducer action `SET_LOCKED { slideIndex, ids[], locked: boolean }` — toggles `locked` on each id; single pushHistory; applyDualWrite for text_boxes
- New tinykeys binding `$mod+Shift+l` → toggle SET_LOCKED on current selection (toggles based on majority/all-locked state)
- Locked drag prevention: in slide-preview.tsx onDragStart handlers — if element.locked === true, return early (don't initiate drag). For react-rnd, use `disableDragging={element.locked === true}`. For multi-element / group drag, locked members already filtered by Plan 60-03 BULK_TRANSLATE skip-locked logic.
- Locked resize prevention: `enableResizing={element.locked === true ? false : enableResizingMap}` (multiplexed object).
- Locked delete prevention: `removeTextBox` / `removeCustomImage` reducer cases — if any selected id is locked, no-op + log warning.
- Locked element click-to-select STILL WORKS — read-only handler exception.
- Locked element wrapper sets `pointer-events: none` ONLY when marquee is active (LOCK-06). Default state: `pointer-events: auto` so click-to-select works.
  - Cleanest implementation: pass `marqueeActive: boolean` prop to slide-preview; wrapper applies `style={{ pointerEvents: marqueeActive && element.locked ? 'none' : 'auto' }}`.
- Visual: subtle lock icon overlay on locked element (top-right corner, 12×12, semi-transparent).

### Marquee skip-locked (LOCK-05)
- `elementsInRect` pure helper (Plan 61-01 `element-rect-intersect.ts`) — add filter to skip elements with `locked === true`.
- Watermark already skipped (Plan 60 deferred).

### HIDDEN behavior wiring
- New reducer action `SET_HIDDEN { slideIndex, ids[], hidden: boolean }` — toggles `hidden`; single pushHistory; applyDualWrite for text_boxes
- Both renderers (React preview + Satori PNG) filter `hidden === true` elements before rendering — add filter at the top of element iteration in `slide-preview.tsx` and `render-slide-satori.tsx`
- `selection-bounds.ts` excludes hidden elements (LOCK-07)
- Toggle UX: NO Cmd+Shift+H binding in Phase 64 (research recommended hidden as "field exists but user-facing toggle deferred"). Visibility lives in layers panel (Phase 65).

### Fork RPC strip locked (LOCK-08)
- `fork_published_carousel` Supabase RPC — add line that clears `locked` field on every text_box / custom_image / watermark on insert into the new owner's project (mirrors v2.4 brand_kit_id strip pattern).
- One-line addition.

### Z-ORDER reducer actions
- New reducer actions:
  - `BRING_FORWARD { slideIndex, ids[], scope: 'text_boxes' | 'custom_images' | 'watermarks' }` — array splice each id +1, clamp
  - `SEND_BACKWARD { slideIndex, ids[], scope }` — array splice each id -1, clamp
  - `BRING_TO_FRONT { slideIndex, ids[], scope }` — move each id to end of array
  - `SEND_TO_BACK { slideIndex, ids[], scope }` — move each id to index 0
- Multi-selection: iterate each selected element, apply +1/-1 individually with clamp (Figma model — ZORDER-06)
- Within-array only — `scope` parameter selects which array (ZORDER-07). For multi-selection across types, group by type first then dispatch per type (single pushHistory wrapper around all dispatches via batch helper, OR sequential dispatches accepting multi-undo for cross-type).
  - **Decision:** Single dispatch per gesture even for cross-type multi-selection. New `Z_ORDER { slideIndex, ids[], op: 'forward'|'backward'|'front'|'back' }` action — reducer routes per-type internally, single pushHistory.
- Single pushHistory per gesture (KBD-09 carry-forward)

### Z-ORDER tinykeys bindings
- `$mod+]` → bring forward
- `$mod+[` → send backward
- `$mod+Alt+]` → bring to front
- `$mod+Alt+[` → send to back
- All respect isEditingTarget guard + preventDefault
- All dispatch single Z_ORDER action

### Z-ORDER algorithm (single Z_ORDER action)
- Input: `{ slideIndex, ids[], op }`
- For each scope (text_boxes, custom_images, watermarks):
  - Filter `ids` to those in this scope's array
  - Sort by current index DESCENDING for 'forward' / 'front' (move higher first to avoid clobbering)
  - Sort by current index ASCENDING for 'backward' / 'back'
  - Apply op iteratively with clamp
- Result: each element-type array is the only mutated structure; renderer order preserved

### Both renderers honor `hidden`
- `slide-preview.tsx`: filter at top of `text_boxes`/`custom_images`/watermark iteration
- `render-slide-satori.tsx`: same filter at same iteration sites
- TPLREND-05 byte-identity preserved — both renderers identical filter logic

### Selection-bounds skip hidden
- `selection-bounds.ts` (Plan 60-05 + Plan 63-01 lift): add `if (el.hidden === true) continue;`
- Phase 63's locked-include-but-skip-move logic separate from this — locked still included in bounds; hidden NOT included.

### Decomposition target
3 plans:
- Plan 64-01: LOCK reducer + locked drag/resize/delete prevention + marquee skip-locked (LOCK-01..06; LOCK-07 hidden in renderers; LOCK-08 fork RPC)
- Plan 64-02: HIDDEN reducer + both renderer filters + selection-bounds skip (LOCK-07)
  - Combine 01 and 02 if scope allows — they share the SET_LOCKED/SET_HIDDEN reducer pattern
- Plan 64-03: Z-ORDER reducer action + 4 tinykeys bindings + within-array splice + multi-selection iteration

OR collapse to 2 plans (LOCK+HIDDEN combined; Z-ORDER separate).

</decisions>

<canonical_refs>
- `.planning/REQUIREMENTS.md` — Phase 64: LOCK-01..08, ZORDER-01..07
- `.planning/research/PITFALLS.md` — Categories 6 (z-order), 8 (lock/hide)
- `.planning/research/ARCHITECTURE.md` — section 7 (z-order = array splice)
- `.planning/research/FEATURES.md` — H45..47 (lock/hide), E32..35 (z-order)
- `.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-01-SUMMARY.md` — locked? + hidden? fields declared
- `.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-03-SUMMARY.md` — BULK_TRANSLATE already skips locked
- `.planning/phases/63-alignment-distribute-smart-guides/63-01-SUMMARY.md` — alignElements already filters locked from move + skips hidden from bounds (verify)
- `src/lib/editor/transforms/element-rect-intersect.ts` — Plan 61-01; add LOCK-05 skip-locked filter
- `src/lib/editor/transforms/selection-bounds.ts` — Plan 60-05 + Plan 63-01; add hidden-skip
- `src/components/slides/slide-preview.tsx` — element iteration sites; add hidden filter; locked drag/resize prevention
- `src/lib/render/render-slide-satori.tsx` — Satori element iteration; add hidden filter
- `supabase/migrations/` — fork_published_carousel RPC (LOCK-08)
</canonical_refs>

<phase_dependencies>
- **Depends on:** Phase 60 (locked/hidden fields), Phase 61 (marquee — LOCK-05), Phase 63 (alignElements + selection-bounds infrastructure)
- **Unblocks:** Phase 65 (layers panel surfaces lock/hide/z-order toggles)
</phase_dependencies>

<success_criteria_recap>
1. Cmd+Shift+L toggles lock on selection; locked element selectable but blocks drag/resize/delete/edit; marquee skips locked
2. Locked element wrapper `pointer-events: none` only when marquee active; click-to-select still works in normal mode
3. Hidden element (`hidden=true`) skipped by BOTH renderers + excluded from alignment/selection bounds
4. Fork RPC strips `locked` flag on copy (forker takes ownership)
5. Cmd+] / Cmd+[ / Cmd+Alt+] / Cmd+Alt+[ z-order operations dispatch single action; array splice within owning array; multi-selection iterates +1/-1 individually with clamp; cross-type selection routes per-type internally; ZERO CSS z-index
</success_criteria_recap>
