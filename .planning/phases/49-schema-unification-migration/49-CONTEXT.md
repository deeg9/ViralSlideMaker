# Phase 49: Schema Unification & Migration - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** Auto-resolved (`--auto`) — Claude picked recommended defaults for every gray area

<domain>
## Phase Boundary

Slides expose a single unified `text_boxes: TextBox[]` array describing every text element on the slide. Legacy fields (`hook_text`, `body_text`, `hook_segments`, `body_segments`, `custom_texts`) continue to read and write so older clients, exports, and cron jobs keep functioning. A virtual adapter derives `text_boxes` from legacy shape on load when missing. The editor reducer gains text-box-aware actions and uses them through the existing undo/redo machinery.

In scope: type definitions, reducer + actions, adapter (legacy ↔ new), Supabase types regeneration, unit tests for adapter parity, dual-write on save.
Out of scope: panel UI redesign (Phase 50), AI prompt rewrite (Phase 51), canvas selection ring (Phase 52), backfill execution + feature flag rollout (Phase 53).

</domain>

<decisions>
## Implementation Decisions

### Type design

- **D-01: ID strategy** — `nanoid(8)` for `TextBox.id`. Collision-resistant, URL-safe, indexable for keyed React rendering. Reason: per-slide indices are fragile under reorder/insert/delete, full UUIDs are noisy. Reuse the existing nanoid dependency if present; otherwise add `nanoid` (~0.5kb).
- **D-02: Field naming convention** — `text_boxes` (snake_case). Matches existing slide fields (`hook_text`, `body_text`, `custom_texts`, `style_overrides`). Avoids a one-off camelCase outlier.
- **D-03: Effects shape** — Reuse existing `TextEffects` / `TextShadowEffect` / `TextOutlineEffect` / `TextHighlightEffect` from `src/lib/types/slide.ts:44-68` exactly. No new shape; v2.1 design already satisfies independent-toggle requirements (TEDIT-05/06).
- **D-04: Position model** — Reuse the existing pattern `{ anchor: 'top' | 'center' | 'bottom' | 'custom', x?, y?, width? }`. Custom anchors carry x/y/width as percentages 0–100 (consistent with `custom_texts`). Minimum disruption to renderers and existing react-rnd resize plumbing.
- **D-05: Role field** — Keep `role: 'hook' | 'body' | 'custom'` on TextBox. Phase 51 needs it to map AI output back into named slots; template seeding uses it for premium-tier defaults; legacy migration uses it to preserve hook/body identity. Small storage cost, large semantic value.
- **D-06: Segments** — Carry forward existing `TextSegment` shape (`{ text, accent?, highlightColor?, highlightStyle? }`) on each TextBox. No schema change needed.

### Adapter & migration

- **D-07: Adapter location** — Dedicated module `src/lib/editor/text-box-adapter.ts` exporting two pure functions: `legacyToTextBoxes(slide: Slide): TextBox[]` and `textBoxesToLegacy(boxes: TextBox[]): { hook_text, body_text, hook_segments, body_segments, custom_texts }`. Pure, no React/state coupling, easily unit-testable.
- **D-08: Migration timing** — Eager on load. When a slide enters the editor reducer, if `text_boxes` is missing or empty, derive it via `legacyToTextBoxes()` once and stash on the slide. The UI then operates on the new shape only.
- **D-09: Save strategy (dual-write)** — On save, always write BOTH `text_boxes` AND legacy fields by running `textBoxesToLegacy()` to regenerate `hook_text` / `body_text` / segments / `custom_texts` from the canonical TextBox array. Older clients keep reading legacy fields; sunset target is v2.9.
- **D-10: Custom_texts mapping** — Each legacy `CustomText` becomes a TextBox with `role: 'custom'`. The reverse (TextBox with role='custom' → legacy CustomText) is also lossless. Hook/body TextBoxes (with role 'hook' or 'body') map to `hook_text` / `body_text` strings + their segments arrays.
- **D-11: Order preservation** — `text_boxes[0]` is always the hook (role='hook'), `text_boxes[1]` is always the body (role='body'), then custom boxes follow in their existing order. Render order on canvas continues to be controlled by z-index / template overlays — order in the array is for editor enumeration only.
- **D-12: Round-trip parity verification** — Adapter unit tests cover 5 representative legacy shapes per SCHEMA-03: (1) hook+body only, (2) hook+body+1 custom, (3) hook+body+effects (shadow+outline), (4) news template with segments and accent words, (5) magazine-bold with overlays + custom_texts + bottom-card. Each test loads via `legacyToTextBoxes()`, then runs `textBoxesToLegacy()`, and asserts deep-equality against the original (modulo derived fields like generated TextBox ids).

### Reducer & actions

- **D-13: Action surface** — Add four new discrete actions alongside (not replacing) `UPDATE_SLIDE`:
  - `ADD_TEXT_BOX` — `{ slideIndex, role, defaults? }`
  - `REMOVE_TEXT_BOX` — `{ slideIndex, textBoxId }`
  - `UPDATE_TEXT_BOX` — `{ slideIndex, textBoxId, patch: Partial<TextBox> }`
  - `SET_ACTIVE_TEXT_BOX_ID` — `{ slideIndex, textBoxId | null }` — sets editor-wide selection
- **D-14: UPDATE_SLIDE preserved** — Slides have non-text-box state (background, template, custom_images, slide-level style_overrides like overlay opacity) that isn't migrating. Keep `UPDATE_SLIDE` for those; route text-box edits through the new actions.
- **D-15: History semantics** — All four new actions push to history via the existing `pushHistory()` so undo/redo Just Works. `SET_ACTIVE_TEXT_BOX_ID` is a special case — selection changes do NOT push history (matches Figma/Canva behavior where you don't undo a selection change).
- **D-16: Selected-text-box-id storage** — Store `selectedTextBoxId: string | null` in the editor history's `present` shape (alongside the slides array). Phase 50 reads it to drive the right-rail panel; Phase 52 reads it to draw the canvas selection ring.

### Tests & verification

- **D-17: Test scope** — Adapter unit tests (5 shapes per D-12) + reducer unit tests for the 4 new actions + 1 integration test that loads a real legacy fixture, runs the full editor history through (load → ADD → UPDATE → UNDO → REDO → save), and asserts dual-write produces both shapes correctly. No Playwright / E2E in this phase — Phase 53 owns the cross-template QA.
- **D-18: Type regeneration cadence** — Run `mcp__supabase__generate_typescript_types` once Phase 49 schema lands. Hand-extend `src/lib/types/slide.ts` with the `TextBox` interface and the new `Slide.text_boxes` field; the generated Supabase types stay agnostic of the JSONB internal shape.

### Claude's Discretion

- File-level layout: whether to colocate the adapter with `editor-reducer.ts` or in a sibling file is Claude's call; current decision (D-07) is sibling for testability.
- Specific nanoid alphabet/length: 8 chars is the recommended starting point. If collision rate becomes a concern in practice (>10⁹ text boxes per project, unlikely), bump to 10.
- Internal shape of `legacyToTextBoxes()` vs. `textBoxesToLegacy()`: implementation detail. The contract is "round-trip parity for the 5 shapes in D-12."

### Folded Todos

None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan & spec
- `~/.claude/plans/users-deeg-desktop-screenshot-2026-04-3-replicated-seal.md` — milestone-level plan with full Phase 49 scope rationale and dual-write migration strategy
- `.planning/REQUIREMENTS.md` — REQ-IDs SCHEMA-01..06 with acceptance criteria
- `.planning/ROADMAP.md` — Phase 49 entry with goal + success criteria

### Code references (existing types and patterns to reuse exactly)
- `src/lib/types/slide.ts:10-15` — `TextSegment` shape (carry forward unchanged)
- `src/lib/types/slide.ts:18-31` — `CustomText` shape (maps to TextBox with role='custom')
- `src/lib/types/slide.ts:44-68` — `TextShadowEffect` / `TextOutlineEffect` / `TextHighlightEffect` / `TextEffects` (reuse exactly)
- `src/lib/types/slide.ts:70-99` — `SlideStyleOverrides` (where hook_text_effects / body_text_effects currently live; TextBox.effects subsumes these on a per-box basis)
- `src/lib/types/slide.ts:101-113` — `Slide` interface (the file to extend with `text_boxes?: TextBox[]`)
- `src/lib/editor/editor-reducer.ts:6-10` — `EditorHistory` (past/present/future); the `present` shape extends to include `selectedTextBoxId`
- `src/lib/editor/editor-actions.ts:3-17` — existing action types to extend with the 4 new actions
- `src/components/editor/text-editor-panel.tsx:31-725` — current panel that reads hook_text/body_text directly (Phase 50 will rewrite using TextBox shape; Phase 49 must not break it)

### Patterns
- v2.7 Phase 44 validator pattern (`src/lib/templates/validate.ts`) — module-load fail-fast for schema validation; consider mirroring for TextBox shape validation if a registry is needed
- v2.5 service-extraction pattern (`src/lib/services/`) — adapter is pure utility, not a service, but tests live next to the source per project convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`TextEffects` shape** (`src/lib/types/slide.ts:44-68`): correctly models independent shadow/outline/highlight toggles + sliders. Reuse as-is on `TextBox.effects`.
- **`TextSegment` shape** (`src/lib/types/slide.ts:10`): correctly models accent-word + per-word pill highlighting. Reuse as-is on `TextBox.segments`.
- **`pushHistory()` machinery** (`src/lib/editor/editor-reducer.ts:27`): all reducer actions funnel through this; new TextBox actions get undo/redo for free without explicit wiring.
- **react-rnd resize plumbing** (v1.3 Phase 13): existing custom-text drag/resize works against `{ x, y, width }` percentages — TextBox.position uses identical shape so the same plumbing works on hook/body once migrated.
- **`@base-ui/react` Collapsible** — already a dep; available for any progressive-disclosure UI in Phase 50, no new package needed.

### Established Patterns
- **Snake_case JSON keys** for slide-data fields (`hook_text`, `body_text`, `custom_texts`, `style_overrides`). New `text_boxes` field follows.
- **JSONB column `slide_data`** in Supabase `public.projects` — slides are an array within JSONB; no column migration needed for the new field.
- **`@deprecated` JSDoc tag** on legacy fields — sunset path is documented in code, not just in commit messages.
- **Pure utility modules under `src/lib/`** with sibling `__tests__/*.test.ts` — adapter follows this pattern.

### Integration Points
- `src/lib/editor/editor-reducer.ts` — gains 4 new action handlers
- `src/lib/editor/editor-actions.ts` — gains 4 new action creators
- `src/lib/types/slide.ts` — gains TextBox interface, Slide gains `text_boxes?: TextBox[]`, legacy fields marked `@deprecated`
- `src/lib/editor/text-box-adapter.ts` (NEW) — exports `legacyToTextBoxes` and `textBoxesToLegacy`
- `src/components/editor/slide-editor.tsx` — initialization path applies adapter on load (eager migration per D-08)
- Save action (`saveSlideData(projectId, slides)` per slide-editor.tsx:86) — runs `textBoxesToLegacy()` before persisting to keep legacy fields populated

</code_context>

<specifics>
## Specific Ideas

- The user explicitly likened the redesign to Figma/Canva/CapCut/VEED — schema must support N text boxes per slide, not just two. Phase 49 enables that data structure even though the UI to add/remove text boxes ships in Phase 50.
- Dual-write must be **lossless**: a slide saved by v2.7 client and read by v2.8 client must render identically; a slide saved by v2.8 (both shapes) and read by v2.7 must also render identically (v2.7 reads legacy).

</specifics>

<deferred>
## Deferred Ideas

- **Schema field rename to `text_elements` or `layers`** — broader rename for forward compatibility with images/shapes. Defer to v2.9+ when canvas elements unify.
- **Per-text-box z-index field** — useful for Photoshop-style layer reordering, but Phase 49 keeps render order template-driven. Add when user demand surfaces.
- **Animation timeline per text box** — out of scope for v2.8 entirely (CapCut has it; we don't need it for static carousels).
- **Multi-select editing** — selecting 2+ text boxes to edit shared properties. Defer.

### Reviewed Todos (not folded)

None — no matching todos found by `gsd-sdk query todo.match-phase 49`.

</deferred>

---

*Phase: 49-schema-unification-migration*
*Context gathered: 2026-04-30*
