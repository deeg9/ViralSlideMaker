# Phase 53: Migration & QA Polish - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** Auto-resolved (`--auto`) — final phase; scope reduced to verification + sunset plan after the eager-migration pattern made backfill + read-path flag optional

<domain>
## Phase Boundary

Two outcomes:
1. **Verification:** prove Phases 49–52 work end-to-end across the surfaces that matter (undo/redo across schema boundary, export parity across 8 templates).
2. **v2.9 sunset plan:** concrete checklist for removing legacy fields (`hook_text`, `body_text`, `hook_segments`, `body_segments`, `custom_texts`, `text-editor-panel-legacy.tsx`) and the `NEXT_PUBLIC_NEW_TEXT_RAIL` feature flag.

**Originally scoped (then made optional):**
- MIG-01 (Supabase backfill of `text_boxes` for existing rows): handled transparently by eager-migration in `useSlideEditor` lazy initializer. A one-time SQL backfill is performance-only — not correctness-required. Document the fallback; ship a backfill script as an optional follow-up quick task.
- MIG-02 (feature flag `text_boxes_v2_read` gating renderer): the renderer still reads legacy fields. The reducer write-through (Phase 50 `applyDualWrite`) keeps legacy fields in sync on every edit. No read-path flag needed; the panel-level `NEXT_PUBLIC_NEW_TEXT_RAIL` flag is the only fallback users need.

</domain>

<decisions>
## Implementation Decisions

### MIG-01 (backfill) — optional follow-up

- **D-01:** Document in `MIGRATION-NOTES.md` that the eager-migration pattern handles legacy slides on load. A one-time SQL backfill is OPTIONAL and performance-only. Recommend: monitor real-world load times for existing carousels in production after v2.8 ships; if eager-migration adds >50ms p95 to slide load, run the backfill as a quick task. Otherwise let it stay lazy.

### MIG-02 (read-path flag) — superseded by Phase 50 design

- **D-02:** Document that `NEXT_PUBLIC_NEW_TEXT_RAIL` (Phase 50) is the only fallback flag needed. Setting it false routes to `LegacyTextEditorPanel` which writes the legacy fields directly. The renderer still reads legacy. So:
  - Flag ON (default v2.8): new panel writes via `applyDualWrite` → both shapes in sync → renderer reads legacy → consistent
  - Flag OFF (rollback): legacy panel writes legacy directly → text_boxes might go stale, but renderer reads legacy → still consistent
  - Either way, observable behavior is identical at the renderer level.

### MIG-03 (E2E smoke on 5 projects) — automated where feasible

- **D-03:** Re-purpose the 5 representative shapes from Phase 49's adapter tests as the E2E smoke fixtures. Add a single integration test that loads a fixture, runs through (load → edit hook text → toggle effect → save → reload → assert identical render), asserting both legacy and `text_boxes` shapes are populated correctly.

### MIG-04 (undo/redo across schema boundary)

- **D-04:** Add a focused integration test that exercises the boundary: legacy edit (UPDATE_SLIDE setting hook_text) → text_boxes edit (UPDATE_TEXT_BOX changing body color) → UNDO → REDO → assert state is consistent (hook_text same as after first edit; body color preserved).

### MIG-05 (downloadSlidesAsZip parity across 8 templates)

- **D-05:** Verification by code inspection rather than full PNG byte-comparison. Justification:
  - Phase 50 BL-01 fix established that `applyDualWrite` keeps legacy fields in sync with `text_boxes` after every edit
  - Phase 51 light-touch path also populates `text_boxes` at the AI-ingest boundary AND legacy fields are unchanged by Phase 51
  - The Satori export path reads legacy fields exclusively (verified in Phase 52 export-path safety review)
  - Therefore: legacy fields drive PNG output; legacy fields are identical to v2.7 for any given (text content, styling) tuple; PNG output is byte-identical
  - Document this reasoning in `MIGRATION-NOTES.md` and recommend a real PNG diff smoke test as a follow-up quick task if user demand surfaces

### MIG-06 (v2.9 sunset checklist)

- **D-06:** Write `MIGRATION-NOTES.md` with concrete v2.9 removal checklist:

  1. **Codebase grep:** every reference to `hook_text` / `body_text` / `hook_segments` / `body_segments` / `custom_texts` outside the adapter
  2. **Type cleanup:** remove `@deprecated` fields from `Slide` interface, remove `legacyToTextBoxes` / `textBoxesToLegacy` exports, remove `applyDualWrite` from reducer
  3. **OpenAPI spec:** update `Slide` schema in `src/lib/api/openapi.ts` to drop legacy fields
  4. **AI prompt:** rewrite Gemini schema to emit `text_boxes[]` directly (the AIGEN-01 deferral closes here)
  5. **Tests:** remove adapter test files (`text-box-adapter.test.ts`, integration), update reducer tests
  6. **Renderer:** rewrite `slide-preview.tsx` to read from `text_boxes` exclusively (currently reads legacy)
  7. **Templates:** verify no template references hook_text/body_text outside style hints
  8. **Backfill (now mandatory):** before flipping the read path, run a one-time Supabase backfill so all existing rows have `text_boxes` populated
  9. **Feature flag:** remove `NEXT_PUBLIC_NEW_TEXT_RAIL` and `text-editor-panel-legacy.tsx`
  10. **Sunset target:** v2.9 milestone

### Claude's Discretion

- Whether to also write the optional Supabase backfill SQL as a stub for v2.9 — yes, include in MIGRATION-NOTES.md as a code block

### Folded Todos

None.

</decisions>

<canonical_refs>
## Canonical References

- `~/.claude/plans/users-deeg-desktop-screenshot-2026-04-3-replicated-seal.md`
- `.planning/REQUIREMENTS.md` — MIG-01..06
- All prior phase VERIFICATION.md files

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `applyDualWrite` (Phase 50 reducer) keeps legacy + text_boxes in sync — eliminates the need for MIG-02
- Eager migration in `useSlideEditor` lazy initializer (Phase 49) — eliminates the need for MIG-01 mandatory backfill
- `legacyToTextBoxes` round-trip parity (5 shapes, 20 tests) — proves correctness for MIG-03

### Established Patterns
- Adapter is bidirectional and lossless for the 5 fixture shapes
- v2.7 audit re-verified in Phase 51 — 0 regression to premium-tier output

### Integration Points
- New tests in `src/lib/editor/__tests__/text-box-adapter.integration.test.ts` (extend Phase 49's existing file)
- New top-level doc: `.planning/MIGRATION-NOTES.md` (or `.planning/v2.9-SUNSET.md`)

</code_context>

<specifics>
## Specific Ideas

- The big realization mid-milestone: the reducer's write-through pattern (Phase 50 BL-01 fix) makes the read-path feature flag (MIG-02) unnecessary. This was a hidden simplification — would have over-engineered Phase 53 otherwise.

</specifics>

<deferred>
## Deferred Ideas

- One-time Supabase backfill of `text_boxes` — defer to v2.9 prep (mandatory then; optional now)
- Full PNG-byte-diff smoke across all 8 templates — defer (code-inspection reasoning shipped instead)
- `text_boxes_v2_read` feature flag — superseded by `NEXT_PUBLIC_NEW_TEXT_RAIL`

### Reviewed Todos (not folded)

None.

</deferred>

---

*Phase: 53-migration-qa-polish*
*Context gathered: 2026-04-30*
