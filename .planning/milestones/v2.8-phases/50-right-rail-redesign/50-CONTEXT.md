# Phase 50: Right-Rail Redesign (Selection-Driven Panel) - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** Auto-resolved (`--auto`) — design contract locked during milestone planning, codified here

<domain>
## Phase Boundary

Replace `text-editor-panel.tsx` with a selection-driven panel: the right rail mirrors ONLY the active text box's properties, switched via a layer strip (chip row) or by canvas selection. Effects (Shadow / Outline / Highlight) become independent toggle rows with sliders revealed inline. Active text box gets a visually distinct darker editable surface. Slide-level controls (Overlay opacity, News Layout) move to a separate "Slide settings" section.

In scope: component architecture (LayerStrip, ActiveTextBoxCard, EffectRow, AccentWordsDisclosure, SlideSettings), new TextEditorPanel composition, visual styling (Tailwind classes), wiring `selectedTextBoxId` from `useSlideEditor`.

Out of scope: canvas selection ring (Phase 52), keyboard shortcuts (Phase 52), AI prompt changes (Phase 51), schema changes (Phase 49 — done).

</domain>

<decisions>
## Implementation Decisions

### Panel architecture (locked from milestone planning, 2026-04-30)

- **D-01: Selection-only panel model** — chosen over stack-of-accordion-cards. Matches Figma, Canva (post-Glow Up), CapCut, VEED. Single text box's properties shown at a time; layer strip switches between boxes.
- **D-02: Layer strip placement** — horizontal chip row at top of the right rail. Each chip = role icon + first ~16 chars of text + active-state styling. Trailing "+ Add Text Box" chip. Click → updates `selectedTextBoxId`.
- **D-03: Active-box card** — single bordered card with `bg-white border-2 border-[#3d0000]/20 focus-within:border-[#3d0000]` framing so the editable surface visually pops from the cream `#fff0f0` panel background.
- **D-04: Section ordering inside card** — top-to-bottom: textarea → Font / Size / Color / Align (always-visible labeled rows, NO accordions per NN/g for design tools) → "Effects" subhead → 3 effect rows (Shadow / Outline / Highlight).
- **D-05: Effects as independent toggle rows** — chosen over mutually-exclusive presets (Canva model) and over sub-accordions. Each row = label + Switch (`@radix-ui/react-switch` already a dep). Switch on → sliders + color swatches reveal inline beneath. Switch off → controls collapse. All three can be on simultaneously.
- **D-06: Accent Words placement** — moves INSIDE the active-box card, collapsed under a "Highlight words" disclosure (caret + "N highlighted" badge). Chip wall only renders when expanded. Uses `@base-ui/react` Collapsible (already a dep).
- **D-07: Slide-level controls separation** — Overlay opacity, News Layout cover/body, Watermark toggle move OUT of the per-text-box card into a "Slide Settings" section below. They are NOT per-text-box.
- **D-08: Bottom toolbar preserved** — undo/redo, Privacy dropdown, Export, Generate Captions, Save Changes — wired to existing entry points unchanged.

### Component decomposition

- **D-09: New components** (under `src/components/editor/text-rail/`):
  - `LayerStrip.tsx` — chip row with active state, "+ Add" trailing chip
  - `ActiveTextBoxCard.tsx` — bordered card containing textarea + style sections + effects
  - `EffectRow.tsx` — generic toggle row that takes title + Switch + reveals children when on (used 3× for Shadow/Outline/Highlight)
  - `AccentWordsDisclosure.tsx` — Collapsible-wrapped chip wall with count badge
  - `SlideSettings.tsx` — Overlay/News Layout/Watermark controls
- **D-10: TextEditorPanel becomes a composition shell** — reads `slide`, `selectedTextBoxId`, dispatches via `onUpdate` (existing prop) + new `onTextBoxAction` prop (calls `dispatch({ type: 'UPDATE_TEXT_BOX', ... })`). Composes: `<LayerStrip /> <ActiveTextBoxCard /> <SlideSettings />` plus the existing watermark + custom-text editor sections (preserved as-is).

### Data flow

- **D-11: TextBox edits route through `UPDATE_TEXT_BOX`** — when the user changes font/size/color/align/effects on the active text box, dispatch `{ type: 'UPDATE_TEXT_BOX', slideIndex, textBoxId, updates }`. The Phase 49 dual-write ensures legacy fields stay in sync at save time.
- **D-12: Selection driven by canvas + layer strip** — clicking a chip → `setSelectedTextBoxId(id)`. Phase 52 will add canvas-side click-to-select; Phase 50 only wires the strip and selection state.
- **D-13: Hook/body role mapping** — when `selectedTextBoxId` resolves to a TextBox with `role='hook'`, the textarea label reads "HOOK TEXT" (preserves familiar nomenclature) — but the underlying state edits the TextBox. Same for body. Custom roles show "TEXT BOX 3", "TEXT BOX 4", etc.

### Visual / brand contract (existing tokens preserved)

- **D-14: Color tokens** — keep existing palette (`#3d0000` primary, `#fadbdb` light, `#fff0f0` panel bg, `#7d6161` muted). Active-card framing uses `#3d0000` at 20% then 100% opacity. Active chip = `bg-[#3d0000] text-white`. Inactive chip = `bg-[#fadbdb] text-[#3d0000]`.
- **D-15: Typography** — keep existing label style: `text-[10px] font-bold uppercase tracking-widest text-[#7d6161]`. Card sections use the same.
- **D-16: Spacing** — sections separated by `space-y-4` (slightly denser than current `space-y-6`) to compensate for the new card framing's visual weight.
- **D-17: Effect row reveal animation** — instant (no Framer Motion). The browser's natural `display: none → block` transition is enough at this density. Avoids new dependencies and keeps perf clean.

### Migration safety

- **D-18: Backward compat preserved** — existing prop signature for `TextEditorPanel` extended (not broken). `selectedCustomTextId`, `customTexts`, `onCustomTextUpdate`, `onCustomTextRemove`, `brandKit` props unchanged. New required prop: `selectedTextBoxId: string | null`. New optional prop: `onTextBoxAction: (action: EditorAction) => void`.
- **D-19: Rollback strategy** — keep the OLD `text-editor-panel.tsx` available as `text-editor-panel-legacy.tsx` for one milestone (sunset v2.9). A feature flag `NEXT_PUBLIC_NEW_TEXT_RAIL` (default true) routes `<SlideEditor>` to the new or legacy component. Manual rollback = flip env var, no rebuild needed.

### Test strategy

- **D-20: Component tests** — each new component gets a minimal Vitest + Testing Library test (mount, fire user event, assert DOM signature). Skip E2E (Phase 53 owns full carousel render parity).
- **D-21: Visual regression** — render snapshots (text-only DOM signature, NOT pixel-perfect) for the 5 representative slide shapes from Phase 49 + the new "all 3 effects on" case + the "AccentWords expanded" case + the "5 text boxes via custom_texts" case = 8 snapshots.

### Claude's Discretion

- Internal Tailwind class composition for each component
- Specific chip width, padding values
- Whether to extract `ColorSwatchPicker` as its own component (likely yes; reused 2-3×)
- File layout: components under `src/components/editor/text-rail/` vs flat `src/components/editor/`

### Folded Todos

None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan & spec
- `~/.claude/plans/users-deeg-desktop-screenshot-2026-04-3-replicated-seal.md` — milestone-level plan with full Phase 50 design rationale + competitive research (Figma, Canva, CapCut, VEED, NN/g)
- `.planning/REQUIREMENTS.md` — REQ-IDs TEDIT-01..10 with acceptance criteria
- `.planning/ROADMAP.md` — Phase 50 entry with goal + success criteria
- `.planning/phases/49-schema-unification-migration/49-VERIFICATION.md` — Phase 49 closed; TextBox + selectedTextBoxId state available

### Code references (to extend, not break)
- `src/components/editor/text-editor-panel.tsx` — current 725-line panel; rewrite target
- `src/components/editor/text-effects-controls.tsx` — existing inline-toggle pattern that informs EffectRow design (data shape correct, presentation framing changes)
- `src/components/editor/font-picker.tsx` — reuse as-is inside ActiveTextBoxCard
- `src/components/editor/slide-editor.tsx:386` — where TextEditorPanel mounts; consume new component here
- `src/lib/editor/use-slide-editor.ts` — `selectedTextBoxId` + `setSelectedTextBoxId` (Phase 49) consumed here
- `src/lib/editor/editor-actions.ts` — `ADD_TEXT_BOX` / `UPDATE_TEXT_BOX` / `REMOVE_TEXT_BOX` available (Phase 49)
- `src/lib/types/slide.ts:70-99` — `TextBox`, `TextBoxRole`, `TextBoxAnchor`, `TextBoxPosition`, `TextEffects`

### Design system
- Existing Tailwind tokens — no new colors, no new typography
- `@base-ui/react` Collapsible — for AccentWordsDisclosure
- `@radix-ui/react-switch` — for EffectRow toggle
- `lucide-react` icons via `src/components/ui/icon.tsx` — for layer-strip role icons + "+" affordance

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `text-effects-controls.tsx` — its inline-reveal-on-toggle pattern is exactly what EffectRow needs; can be salvaged as the body of each EffectRow with minor refactoring (`children` instead of inline JSX for sliders)
- `font-picker.tsx` — drop-in inside ActiveTextBoxCard
- `colorSwatches` constant in current panel — extract to `src/components/editor/text-rail/color-swatches.ts`
- `splitToSegments` utility — move to `src/lib/editor/text-segments.ts` (also used in Phase 49 if not already migrated)

### Established Patterns
- Existing panel uses `data-testid` for E2E hooks. Preserve `data-testid="text-editor-panel"` on the root, add `data-testid="layer-strip"`, `data-testid="active-text-box-card"`, etc.
- Existing components are functional with prop-typed interfaces — no class components, no hooks in components beyond useState/useEffect/useCallback
- Tailwind-only styling, no CSS modules, no styled-components

### Integration Points
- `src/components/editor/slide-editor.tsx:386` — mount point. Pass `selectedTextBoxId` from useSlideEditor; pass `onTextBoxAction` that wraps dispatch
- Save/undo/export bottom toolbar (current panel lines 412-479) — preserve outside the new component (it's already at the slide-editor level, not inside text-editor-panel)
- Existing `text-editor-panel.tsx` — preserve as `text-editor-panel-legacy.tsx` behind a feature flag (D-19)

</code_context>

<specifics>
## Specific Ideas

- The user explicitly said: "make the text box or the text editing darker than the rest of the page so people know that they can type there. It's easy to mess." → D-03 (white card on cream panel) directly addresses this.
- The user said: "shouldn't we just highlight words? Why is it all spaced out like that?" → D-06 (collapse the chip wall behind a disclosure) directly addresses this — it's hidden by default, expandable when needed.
- The user explicitly named Canva, Figma, Word, Google Docs, Photoshop. The research synthesis ranked Canva and CapCut as closest analogs. D-01/D-05 are direct copies of those proven patterns.

</specifics>

<deferred>
## Deferred Ideas

- Drag-to-reorder layer strip chips — defer until user demand
- Multi-select editing (edit shared properties of 2+ text boxes) — out of scope for v2.8
- Right-rail tabs (Style / Animate / Effects) — premature, only Style + Effects content exists today
- Animation timeline per text box — out of scope for v2.8 entirely
- Per-text-box z-index field for layer reordering — defer to v2.9+

### Reviewed Todos (not folded)

None.

</deferred>

---

*Phase: 50-right-rail-redesign*
*Context gathered: 2026-04-30*
