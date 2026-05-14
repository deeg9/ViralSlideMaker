---
phase: 80-composition-aware-style-extraction-replace-flat-stylespec-ta
plan: 03
subsystem: extractor
tags: [v2.13, phase-80, gemini, extractor, two-phase-firewall, response-schema]
requires:
  - "Plan 80-01 (src/lib/types/style-spec-archetypes.ts canonical archetype tuples + StyleSpec v2 type)"
  - "Plan 80-02 (parseStyleSpecSafe with z.discriminatedUnion + schema_version_rejected branch)"
  - "Phase 75 extractor baseline (src/lib/ai/extract-style-spec.ts two-phase firewall + 10s timeout)"
provides:
  - "Gemini responseSchema declares slideArchetype (type:STRING per branching-limit workaround) + caption {heightFraction, background} + split {direction, ratio}"
  - "System prompt archetype-classification preamble: directs Gemini to classify the slide composition into one of 8 archetypes FIRST, then fill slot params"
  - "schema_version description bumped 'Always 1.' → 'Always 2.' (matches Plan 01's STYLE_SPEC_VERSION = 2)"
  - "Two-phase firewall preserved by construction (only schema constant + prompt text + import modified; orchestrator body untouched)"
  - "10s EXTRACTION_TIMEOUT_MS preserved; single Gemini Vision call; no new round-trips"
affects:
  - "Plan 80-04 (style-spec-projector.ts) — projector can now consume spec.slideArchetype (populated by the extractor) to emit template_id_override"
  - "Plan 80-05 (generate-from-style-spec.ts) — generation prompt receives archetype + slot params on every extracted spec going forward"
  - "Plan 80-06 (supabase migration) — extractor now produces v2 specs only; v1 cache rows remain stale until purged by the migration"
tech-stack:
  added: []
  patterns:
    - "Gemini responseSchema branching-limit workaround: type:STRING with no enum at the wire when Phase B Zod (parseStyleSpecSafe) enforces the closed enum. Mirrors decorations.preferredLucide precedent."
    - "System-prompt archetype-classification preamble: enumerated archetype taxonomy + per-archetype slot-fill instructions (or OMIT directives). Composition is classified BEFORE other fields so Gemini frames the rest of the response around the archetype."
    - "Closed-enum imports from canonical archetypes module (PARITY-05) — CAPTION_BACKGROUNDS, SPLIT_DIRECTIONS, SPLIT_RATIOS feed responseSchema enums; CAPTION_HEIGHT_FRACTIONS is numeric and uses Type.NUMBER without enum (Phase B Zod enforces [0.30, 0.40, 0.50])."
key-files:
  created: []
  modified:
    - "src/lib/ai/extract-style-spec.ts"
decisions:
  - "slideArchetype is sent as Type.STRING without enum at the Gemini wire (mirrors the 100-icon decorations.preferredLucide workaround at line 196-209 — Gemini's responseSchema branching limit becomes a risk as per-archetype slot discriminations expand). Phase B Zod (Plan 02 z.discriminatedUnion('slideArchetype', ...)) enforces the closed 8-value enum and emits archetype_fallback counter events when Gemini returns an out-of-allowlist value."
  - "caption + split are top-level OPTIONAL properties (not nested under slideArchetype). The schema does not enforce per-archetype slot validity; that lives in Plan 02 Zod (archetype_slot_mismatch silent-drop). Per the plan: matches Phase 74 silent-drop discipline and keeps the responseSchema flat for Gemini."
  - "caption.heightFraction is Type.NUMBER without enum at the wire (Gemini accepts NUMBER without enum here). The closed-enum constraint [0.30, 0.40, 0.50] is enforced at Phase B."
  - "CAPTION_BACKGROUNDS, SPLIT_DIRECTIONS, SPLIT_RATIOS DO use enum at the wire because they are 3-, 2-, and 3-value tuples — well within Gemini's branching limit. Belt-and-suspenders with Phase B Zod."
  - "System prompt enumerates the 8 archetypes inline as readable text (matching the plan's exact preamble wording) rather than templating from the SLIDE_ARCHETYPES tuple. Rationale: prompt clarity for Gemini outweighs source-of-truth coupling; the tuple-defined order from style-spec-archetypes.ts (Plan 01) is mirrored manually in the prompt."
  - "SLIDE_ARCHETYPES is imported (per plan AC) but currently unused in code (eslint warns at line 74 — not an error). Acceptable: import documents the linkage from the extractor to the canonical archetypes module, AC requires the import to exist, and tsconfig has no noUnusedLocals enforcement. Same status as the pre-existing LUCIDE_DECORATION_ALLOWLIST import (line 64) which was a warning before this plan."
metrics:
  duration_minutes: 4
  completed: "2026-05-14"
  tasks_completed: 1
  files_created: 0
  files_modified: 1
  commits: 1
---

# Phase 80 Plan 03: Composition-Aware Extractor — Update Gemini ResponseSchema + System Prompt — Summary

Updated the Phase 75 vision-extraction orchestrator at `src/lib/ai/extract-style-spec.ts` so the Gemini responseSchema declares the new `slideArchetype` field + per-archetype slot params (`caption` for caption-bar archetypes; `split` for photo-collage-2up), the system prompt directs Gemini to classify the slide composition FIRST before filling other fields, and the schema-version description matches the v2 bump landed in Plan 01. The two-phase firewall (Test 15 source-grep gate) and the 10s `EXTRACTION_TIMEOUT_MS` are preserved by construction — changes are confined to the responseSchema constant + the system-prompt text + a single import line; the orchestrator body that holds the firewall ordering is untouched.

## ResponseSchema Additions

Three new top-level properties added to `STYLE_SPEC_RESPONSE_SCHEMA`:

### 1. `slideArchetype` (required)

Added to `required` array. Sent as `Type.STRING` with no `enum` (Gemini branching-limit workaround — same precedent as `decorations.preferredLucide` at line 196-209). The Phase B Zod validator (Plan 02 `z.discriminatedUnion('slideArchetype', ...)`) enforces the closed 8-value enum; out-of-allowlist values emit `archetype_fallback` silent-drop counter events.

```ts
slideArchetype: {
  type: Type.STRING,
  description:
    'Composition archetype. MUST be one of: full-bleed-text-overlay, caption-bar-bottom, caption-bar-top, photo-collage-2up, photo-collage-grid, flat-color-background, editorial-serif, notes-sticker. Classify the slide composition FIRST, before filling other fields; any value outside this allowlist is silently dropped by post-processing.',
}
```

### 2. `caption` (optional)

Top-level optional object — applies ONLY when `slideArchetype` is `caption-bar-bottom` or `caption-bar-top`. Plan 02 validator silent-drops the field via `archetype_slot_mismatch` if the archetype does not declare it.

```ts
caption: {
  type: Type.OBJECT,
  description: "Slot params for caption-bar-bottom and caption-bar-top archetypes ONLY. Omit if slideArchetype is anything else.",
  properties: {
    heightFraction: { type: Type.NUMBER, description: 'Caption block height as fraction of slide height. MUST be 0.30, 0.40, or 0.50.' },
    background: { type: Type.STRING, enum: [...CAPTION_BACKGROUNDS] as string[], description: "Caption block background style." },
  },
}
```

- `heightFraction`: `Type.NUMBER` without enum at the wire (Gemini accepts NUMBER without enum here). Phase B Zod rejects values outside `[0.30, 0.40, 0.50]`.
- `background`: `Type.STRING` with `enum: [...CAPTION_BACKGROUNDS]` — 3-value tuple `['solid', 'gradient-dark', 'translucent']` imported from `style-spec-archetypes`.

### 3. `split` (optional)

Top-level optional object — applies ONLY when `slideArchetype` is `photo-collage-2up`. Plan 02 validator silent-drops the field via `archetype_slot_mismatch` if the archetype does not declare it.

```ts
split: {
  type: Type.OBJECT,
  description: "Slot params for photo-collage-2up archetype ONLY. Omit if slideArchetype is anything else.",
  properties: {
    direction: { type: Type.STRING, enum: [...SPLIT_DIRECTIONS] as string[], description: 'Split axis direction.' },
    ratio: { type: Type.STRING, enum: [...SPLIT_RATIOS] as string[], description: 'Split ratio between the two photos.' },
  },
}
```

- `direction`: enum `['horizontal', 'vertical']` imported from `style-spec-archetypes`.
- `ratio`: enum `['50-50', '60-40', '70-30']` imported from `style-spec-archetypes`.

### 4. `schema_version` description bump

`schema_version: { type: Type.INTEGER, description: 'Always 1.' }` → `description: 'Always 2.'` — matches `STYLE_SPEC_VERSION = 2` bumped by Plan 01.

### 5. `required` array

`required: ['schema_version', 'palette', 'typography', 'layout', 'imagery', 'decorations', 'rhythm']` → `[..., 'slideArchetype']`. `caption` + `split` stay OPTIONAL (per-archetype only).

## System Prompt Preamble (verbatim)

Inserted DIRECTLY AFTER the existing "Output ONLY the responseSchema-conformant JSON. Output NO other fields." line in `buildVisionParts`:

```
BEFORE filling any other field, classify the slide composition into ONE of these 8 archetypes (the slideArchetype field):
- 'caption-bar-bottom': photo (or solid color) on top + a solid/translucent caption block at the bottom that holds the text.
- 'caption-bar-top': caption block at the top, photo or color below.
- 'full-bleed-text-overlay': single full-bleed photo with text floating over it (no caption container).
- 'photo-collage-2up': two photos split horizontally or vertically.
- 'photo-collage-grid': 2x2 photo grid.
- 'flat-color-background': flat solid color background, no photo.
- 'editorial-serif': editorial/magazine layout featuring large serif typography.
- 'notes-sticker': iOS Notes / sticker / paper-aesthetic note.

For 'caption-bar-bottom' and 'caption-bar-top': also fill `caption.heightFraction` (one of 0.30, 0.40, 0.50) and `caption.background` (solid | gradient-dark | translucent).
For 'photo-collage-2up': also fill `split.direction` (horizontal | vertical) and `split.ratio` (50-50 | 60-40 | 70-30).
For other archetypes: OMIT the `caption` and `split` fields entirely.
```

Plus the appended one-line field-intents entry: `- slideArchetype: one of the 8 archetype names (see preamble).`

## Two-Phase Firewall + 10s Timeout — Preserved By Construction

This plan modifies only:
- The `STYLE_SPEC_RESPONSE_SCHEMA` constant (line ~134-303)
- The `buildVisionParts` system-prompt text (line ~286)
- One import statement (line ~68-79)

The orchestrator body (`extractStyleSpec` function, lines ~433-627 → now ~508-702 after the edit shifted line numbers) is UNTOUCHED. The two-phase firewall ordering is preserved by construction:

```
Last rawGemini / rawObject code reference: line 641  (mergePaletteIntoRaw(rawObject, merged))
parseStyleSpecSafe(...) call line:         line 647
```

Constraint: every `rawGemini` / `rawObject` code reference ≤ parseStyleSpecSafe call line. **Holds** (641 ≤ 647).

`EXTRACTION_TIMEOUT_MS` constant at line 92 is unchanged at `10_000`. The single Gemini Vision call is still wrapped in `withSingleRetry(() => callGeminiVisionWithTimeout(prepared))` (line 582) — no new round-trips.

## Verification

| Check                                                                                  | Result   |
| -------------------------------------------------------------------------------------- | -------- |
| `grep -c "slideArchetype:" src/lib/ai/extract-style-spec.ts` (>= 2 expected)           | `2` ✓   |
| `grep -F -c "from '@/lib/types/style-spec-archetypes'" src/lib/ai/extract-style-spec.ts` (== 1) | `1` ✓ |
| `grep -c "'Always 2\\.'" src/lib/ai/extract-style-spec.ts` (== 1)                      | `1` ✓   |
| `grep -c "'Always 1\\.'" src/lib/ai/extract-style-spec.ts` (== 0)                      | `0` ✓   |
| 8 archetype literals enumerated in file (>= 8)                                         | `13` ✓  |
| `grep -c "caption:" src/lib/ai/extract-style-spec.ts` (>= 1)                           | `1` ✓   |
| `grep -c "split:" src/lib/ai/extract-style-spec.ts` (>= 1)                             | `1` ✓   |
| PARITY-05 forbidden tokens (non-comment) count                                         | `0` ✓   |
| `bash scripts/grep-gates/closed-enum-styleSpec.sh`                                     | PASS ✓  |
| Test 15 source-grep firewall (`npx vitest run -t "source-grep firewall"`)              | PASS ✓  |
| `EXTRACTION_TIMEOUT_MS = 10_000` unchanged                                             | ✓       |
| `required` array contains `slideArchetype`                                             | ✓       |
| 8 distinct archetype names appear in the file                                          | ✓       |

## Deviations from Plan

None — plan executed exactly as written. The exact import block, the exact responseSchema additions (slideArchetype + caption + split), the exact system-prompt preamble text, and the schema_version description bump all match the plan's wording.

### Acceptance Criteria Notes

- **Unused-import warning on `SLIDE_ARCHETYPES`**: eslint warns at line 74 (`@typescript-eslint/no-unused-vars`). This is a WARNING not an ERROR. The plan explicitly mandates this import (`<action>` step 1 lists `SLIDE_ARCHETYPES` in the import block) AND the plan AC requires the import statement to exist. The constant is imported as a documentation linkage from the extractor to the canonical archetypes module; the prompt text enumerates the 8 archetypes inline as readable strings per the plan's verbatim wording. Same status as the pre-existing `LUCIDE_DECORATION_ALLOWLIST` import at line 64 (warning before this plan, warning after). tsconfig has no `noUnusedLocals` enforcement, so typecheck is unaffected.

- **Pre-existing test-file TypeScript errors** in `src/lib/ai/__tests__/extract-style-spec.test.ts` and `extract-style-spec.types.test.ts` were observed (`Type '1' is not assignable to type '2'` from the schema_version literal bump). These are pre-existing from Plan 80-01 (documented in 80-01-SUMMARY.md lines 120-133 as "resolve as Plans 02–06 update each consumer in turn"). They are OUT OF SCOPE for Plan 03 (Plan 03's files_modified is only `src/lib/ai/extract-style-spec.ts`) and remain to be fixed when each test fixture is updated by their owning plan. The firewall test (Test 15) itself does not use the StyleSpec literal and continues to pass.

## Downstream Consumer Ready Signal

- **Plan 80-04 (style-spec-projector.ts)** — The extractor now emits `slideArchetype` on every successfully-validated StyleSpec going forward (when Gemini returns one and Plan 02 Zod accepts it; else `DEFAULT_FALLBACK_ARCHETYPE = 'full-bleed-text-overlay'` is substituted with an `archetype_fallback` counter event). Plan 04 can rely on `spec.slideArchetype` being defined and may proceed to wire `ARCHETYPE_TO_TEMPLATE` mapping → `template_id_override` emission.
- **Plan 80-05 (generate-from-style-spec.ts)** — The validated StyleSpec passed to the generation prompt now carries `slideArchetype` + (where archetype-specific) `caption` / `split` slot params. Plan 05 can consume these directly in the prompt body to direct Gemini's slide generation toward `text_position`, segment highlights, and `custom_images` count consistent with the reference's composition.
- **Plan 80-06 (supabase migration)** — Extractor now produces only v2 specs (`schema_version: 2` is mandated by the responseSchema description AND the Phase B validator's `schema_version_rejected` branch from Plan 02). Existing v1 cache rows produced by the previous extractor remain stale until the migration runs; on read, parseStyleSpecSafe early-rejects them and forces re-extraction (intended cache-hygiene behavior).

## Commits

| Hash      | Message                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| `cdbc42a` | feat(80-03): emit slideArchetype + slot params in extractor responseSchema   |

## Self-Check: PASSED

- `src/lib/ai/extract-style-spec.ts`: FOUND (modified)
- Commit `cdbc42a`: FOUND in `git log` for branch `worktree-agent-ad0a9468a9ac06681`
- Two-phase firewall ordering: 641 (last rawGemini/rawObject code ref) ≤ 647 (parseStyleSpecSafe call) — FIREWALL PRESERVED
- `EXTRACTION_TIMEOUT_MS = 10_000` at line 92: UNCHANGED
- All 8 plan acceptance criteria: PASS
