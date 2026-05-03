# Phase 66: Power-User Differentiators + Polish — Context

**Gathered:** 2026-05-02
**Mode:** Auto-generated (autonomous --auto; final phase of v2.11)

<domain>
## Phase Boundary

Final v2.11 phase. Ship the two power-user differentiators (Alt-drag duplicate, Cmd+D smart offset), complete the keyboard surface (arrow nudge 1px / 10px), add tooltip shortcuts to alignment toolbar + layer chips, and run a final keyboard sweep for `e.preventDefault()` consistency, isEditing guard coverage, and modifier-state-resets-on-blur completeness.

**REQ-IDs covered:**
- DIFF-01: Alt+drag duplicate (Figma pattern; replaces ~50% of Cmd+D usage)
- DIFF-02: Cmd+D smart offset (matches direction + magnitude of last move; falls back to ~20px offset on first use)
- KBD-05: Arrow key (no modifier) nudges selection 1 reference px in arrow direction
- KBD-06: Shift+Arrow nudges selection 10 reference px
- KBD-08: Keyboard shortcut hints appear in tooltips on alignment toolbar buttons + layer-chip controls

**Out of scope:**
- Layers panel drag-to-reorder (deferred v2.12)
- Multi-select rotation (blocked on ROTATE-01)
- Right-click context menu
- Copy/paste style
- Cross-slide paste
</domain>

<decisions>
## Locked Decisions

### DIFF-01: Alt+drag duplicate
- New behavior: holding Alt during element drag produces a copy at the new position (Figma model)
- Implementation in slide-preview.tsx onDragStart handlers:
  - Read `e.altKey` (or use useModifierState ref)
  - If true: dispatch new reducer action `DUPLICATE_ELEMENTS_AT { slideIndex, ids[], deltaX, deltaY }` on dragStop
  - Original elements stay at their start positions; copies appear at drag end position with new ids
- New reducer action `DUPLICATE_ELEMENTS_AT { slideIndex, ids[], deltaX, deltaY }`:
  - For each id, create a copy with new id (matching v2.8 id-generation pattern)
  - Apply delta to copy's position
  - Single pushHistory
  - applyDualWrite for text_boxes
- Locked / hidden / structural-anchor elements skipped (carry-forward Plan 60-03 / 64-01)
- Group selection: copies preserve groupId association (new groupId for the duplicate set so they're a new group)

### DIFF-02: Cmd+D smart offset
- Existing behavior: Cmd+D duplicates active element with fixed offset (Plan 60-04 binding)
- New behavior: smart offset matches direction + magnitude of last MOVE (drag or arrow nudge)
- New module-level state `lastMoveDelta: { x: number; y: number } | null` — updated after every BULK_TRANSLATE / arrow-nudge dispatch
- On Cmd+D:
  - If lastMoveDelta exists: offset by lastMoveDelta
  - Else: offset by ~20px in default direction (e.g., 20px right + 20px down — matches Figma fallback)
- Single dispatch per gesture (KBD-09)
- Implementation: extend existing Cmd+D binding's handler in slide-editor.tsx

### KBD-05: Arrow nudge 1px
- New tinykeys bindings:
  - `ArrowUp` → BULK_TRANSLATE { deltaY: -1 }
  - `ArrowDown` → BULK_TRANSLATE { deltaY: +1 }
  - `ArrowLeft` → BULK_TRANSLATE { deltaX: -1 }
  - `ArrowRight` → BULK_TRANSLATE { deltaX: +1 }
- All respect isEditingTarget guard (CRITICAL — arrow keys in text input must move cursor, not nudge element; PITFALL-9.2)
- Single pushHistory per nudge
- Updates `lastMoveDelta` so DIFF-02 smart-offset works after nudge

### KBD-06: Shift+Arrow nudge 10px
- 4 more tinykeys bindings:
  - `Shift+ArrowUp` → BULK_TRANSLATE { deltaY: -10 }
  - `Shift+ArrowDown` → BULK_TRANSLATE { deltaY: +10 }
  - `Shift+ArrowLeft` → BULK_TRANSLATE { deltaX: -10 }
  - `Shift+ArrowRight` → BULK_TRANSLATE { deltaX: +10 }
- Same isEditingTarget guard
- Same pushHistory + lastMoveDelta update

### KBD-08: Tooltip shortcuts
- Alignment toolbar buttons: add `title` attribute showing shortcut (e.g., "Align Left (Alt+A)")
- Layer chip controls: add `title` to lock toggle ("Lock Element (Cmd+Shift+L)"), visibility toggle ("Toggle Visibility"), reorder buttons ("Bring Forward (Cmd+])" / "Send Backward (Cmd+[)")
- Pure additive — no behavior changes; just CSS-stylable tooltips via title

### Keyboard sweep (housekeeping)
- Final isEditingTarget grep count: was 29 (after Phase 64). Phase 66 adds 8 arrow bindings + 1 (already-existing Cmd+D extended; not new). New count: 29+8 = 37.
- All bindings preventDefault — none of arrow nudge bindings need preventDefault unless input is unfocused (handled by isEditing guard early return)
- modifier-state-blur-reset already wired (Plan 60-04)

### Tests
- DIFF-01 reducer test: DUPLICATE_ELEMENTS_AT creates new ids; original positions unchanged; group preserved with new groupId
- DIFF-02 smart offset test: lastMoveDelta updates after BULK_TRANSLATE / arrow-nudge; Cmd+D uses delta; falls back to 20px when null
- KBD-05/06 binding tests: arrow nudge dispatches with correct deltas; isEditing guard skips when input focused; Shift modifier scales 10×
- KBD-08 tooltip tests: title attributes present on alignment toolbar buttons + layer chip controls

### Decomposition target
2 plans:
- Plan 66-01: Arrow nudge bindings (KBD-05, KBD-06) + lastMoveDelta tracking + Cmd+D smart offset (DIFF-02)
- Plan 66-02: Alt-drag duplicate (DIFF-01) + tooltip shortcuts (KBD-08) + final keyboard sweep verification

</decisions>

<canonical_refs>
- `.planning/REQUIREMENTS.md` — Phase 66: DIFF-01, DIFF-02, KBD-05, KBD-06, KBD-08
- `.planning/research/PITFALLS.md` — Category 9 (keyboard handling pitfalls — especially 9.1 + 9.2 arrow-in-input)
- `.planning/research/FEATURES.md` — F36..F41 (nudge), G41..G42 (duplicate)
- `.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-{03,04}-SUMMARY.md` (BULK_TRANSLATE; tinykeys map)
- `.planning/phases/63-alignment-distribute-smart-guides/63-02-SUMMARY.md` (alignment toolbar — add tooltips)
- `.planning/phases/65-layers-panel-tplrend-audit/65-{01,02}-SUMMARY.md` (layer chip controls — add tooltips)
- `src/components/editor/slide-editor.tsx` — tinykeys map; extend
- `src/components/editor/floating-alignment-toolbar.tsx` — Plan 63-02; add tooltip prop pass-through
- `src/components/editor/layers-panel/layer-chip.tsx` — Plan 65-02; add tooltips
- `src/lib/editor/editor-actions.ts` — DUPLICATE_ELEMENTS_AT new variant
- `src/lib/editor/editor-reducer.ts` — DUPLICATE_ELEMENTS_AT case
</canonical_refs>

<phase_dependencies>
- **Depends on:** Phase 60 (BULK_TRANSLATE + tinykeys + useModifierState), Phase 63 (alignment toolbar to tooltip), Phase 65 (layer chips to tooltip)
- **Unblocks:** Milestone close — gsd-audit-milestone → gsd-complete-milestone
</phase_dependencies>

<success_criteria_recap>
1. Arrow keys nudge selection 1px (no mod) / 10px (Shift); isEditing guard skips nudge when input focused; updates lastMoveDelta
2. Cmd+D uses smart offset (last drag/nudge direction + magnitude); falls back to 20px when no last move
3. Alt+drag duplicates selection at drop position (single pushHistory; new ids; group preserved with new groupId)
4. Tooltips on alignment toolbar buttons + layer chip controls show keyboard shortcut hints
5. Keyboard sweep complete: ~37 isEditingTarget guards across all bindings; modifier-state-blur-reset wired
</success_criteria_recap>
