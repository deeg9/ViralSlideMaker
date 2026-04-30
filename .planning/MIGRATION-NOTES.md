# v2.8 → v2.9 Migration Notes

## Status

v2.8 ships with **dual schema** — both `text_boxes[]` and legacy `hook_text` / `body_text` / `hook_segments` / `body_segments` / `custom_texts` populated on every save. This lets older clients, Satori PNG export, and any cron jobs continue reading legacy fields unchanged. The two shapes are kept in sync via:

1. **Eager migration on load** (`useSlideEditor` lazy initializer, Phase 49): when a slide arrives without `text_boxes`, derive via `legacyToTextBoxes()`.
2. **Reducer write-through** (`applyDualWrite`, Phase 50): every `ADD_TEXT_BOX` / `UPDATE_TEXT_BOX` / `REMOVE_TEXT_BOX` action also derives a fresh `textBoxesToLegacy()` slice and merges into legacy fields synchronously.
3. **AI ingest boundary** (`generate-slides.ts`, Phase 51): AI-generated slides have `text_boxes` populated server-side at the post-Zod-parse boundary.

Phase 53 closes out the migration tier with three integration tests in `src/lib/editor/__tests__/text-box-adapter.integration.test.ts` exercising the full lifecycle: load → edit → UNDO → REDO → save → reload across the legacy↔text_boxes boundary, including the news-template fixture with hook/body segments.

## Deferrals

### MIG-01 (Supabase backfill) — optional

The eager-migration on load handles all existing rows transparently. A one-time SQL backfill is **not correctness-required** but may be performance-relevant if eager-migration adds noticeable load time. Monitor production after v2.8 ships:

- If p95 slide load time increases by >50ms vs v2.7 baseline, run the backfill below
- Otherwise, let it stay lazy until v2.9 sunset (when backfill becomes mandatory)

```sql
-- Optional v2.8 backfill: populate text_boxes for existing rows.
-- Run via mcp__supabase__apply_migration only if needed.
-- The simpler path (recommended): deserialize the slide_data JSONB array in TypeScript,
-- run legacyToTextBoxes() on each slide, re-serialize. Build the script when needed.
UPDATE projects
SET slide_data = (
  SELECT jsonb_agg(
    slide || jsonb_build_object('text_boxes', /* derive from legacy */)
  )
  FROM jsonb_array_elements(slide_data) AS slide
)
WHERE NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(slide_data) AS s
  WHERE s ? 'text_boxes'
);
```

### MIG-02 (`text_boxes_v2_read` feature flag) — superseded

The original spec called for a flag gating the renderer's read path between legacy and `text_boxes`. After Phase 50's `applyDualWrite` pattern landed, both shapes are always in sync — the flag is unnecessary. The Phase 50 panel-level flag `NEXT_PUBLIC_NEW_TEXT_RAIL` is the only fallback users need:

- ON (default v2.8): new panel writes via `applyDualWrite` → both shapes synced → renderer reads legacy → consistent
- OFF (rollback): legacy panel writes legacy directly → renderer reads legacy → consistent (text_boxes may go stale but unused on read path)

## v2.9 Sunset Checklist

When ready to remove the dual schema:

1. **[migration]** Run mandatory Supabase backfill so every row has `text_boxes` populated (idempotent — safe to re-run). Use the TypeScript path: read slide_data → run `legacyToTextBoxes` per slide → write back.
2. **[renderer]** Rewrite `slide-preview.tsx` to read from `slide.text_boxes` exclusively. Update Satori export path. Verify PNG byte-identical against v2.8 baseline for all 8 templates.
3. **[reducer]** Remove `applyDualWrite` from `editor-reducer.ts`. UPDATE_TEXT_BOX / ADD_TEXT_BOX / REMOVE_TEXT_BOX write only to `text_boxes`. Remove the legacy-derivation in `doSave` (`saveDualWrite` helper).
4. **[adapter]** Delete `src/lib/editor/text-box-adapter.ts` and its tests. Eager migration in `useSlideEditor` becomes a no-op (or remove entirely; all rows have text_boxes after the v2.9 backfill).
5. **[types]** Remove `@deprecated` fields from the `Slide` interface (`hook_text`, `body_text`, `hook_segments`, `body_segments`, `custom_texts`). Run `npx tsc --noEmit`; fix all callers.
6. **[AI]** Rewrite Gemini's `CarouselSchema` in `src/lib/ai/schemas.ts` to emit `text_boxes: TextBox[]` directly per slide. Update prompts, `validateAndRepair`, voice notes. Re-verify v2.7's 19 premium-tier requirements against the new schema. **(This closes AIGEN-01, currently deferred.)**
7. **[OpenAPI]** Update `src/lib/api/openapi.ts` `Slide` schema. Bump REST API version if breaking change for external consumers.
8. **[panel]** Delete `src/components/editor/text-editor-panel-legacy.tsx`. Remove the `NEXT_PUBLIC_NEW_TEXT_RAIL` flag and its branching in `slide-editor.tsx`.
9. **[tests]** Remove adapter test files (`src/lib/editor/__tests__/text-box-adapter.test.ts`, `src/lib/editor/__tests__/text-box-adapter.integration.test.ts`); rebuild reducer tests to match the simplified surface.
10. **[docs]** Update `.planning/PROJECT.md` Active section to retire dual-schema Active items; add v2.8 to Latest Shipped.

## Verification commands for v2.9 work

```bash
# Find every legacy-field reference (everything in this list must be deleted in v2.9):
rg "hook_text|body_text|hook_segments|body_segments|custom_texts" --type ts --type tsx

# Run the full test suite:
npx vitest run

# Type-check:
npx tsc --noEmit

# Build:
npm run build

# Verify byte-identical PNG output (after renderer rewrite):
npm run thumbs && diff -r public/templates v2.8-baseline-templates/
```

## Estimated v2.9 lift

3-5 phases. Lowest-risk ordering: backfill → renderer rewrite → reducer simplification → AI rewrite → cleanup.
