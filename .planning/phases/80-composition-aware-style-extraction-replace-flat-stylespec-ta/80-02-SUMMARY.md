---
phase: 80-composition-aware-style-extraction-replace-flat-stylespec-ta
plan: 02
subsystem: validator
tags: [v2.13, phase-80, zod, validator, discriminated-union, silent-drop, firewall]
requires:
  - "Plan 80-01 (src/lib/types/style-spec-archetypes.ts + StyleSpec v2 type)"
  - "Phase 74 closed-enum Zod validator baseline (src/lib/validators/style-spec.ts)"
  - "Phase 74 silent-drop counter contract (src/lib/validators/silent-drop-counter.ts)"
provides:
  - "z.discriminatedUnion('slideArchetype', [...]) over the 8 archetypes — per-archetype slot validity at the Zod boundary"
  - "parseStyleSpecSafe early-rejects schema_version != 2 with ok:false + counter event (R4)"
  - "Silent-drop counter telemetry for archetype fallback + slot-mismatch (R2)"
  - "SilentDropReason closed union widened with 3 Phase 80 reasons (schema_version_rejected, archetype_fallback, archetype_slot_mismatch)"
affects:
  - "Plan 03 (extract-style-spec.ts) — extractor must emit slideArchetype + matching slot block on the StyleSpec it produces"
  - "Plan 04 (style-spec-projector.ts) — projector reads spec.slideArchetype to emit template_id_override"
  - "Plan 05 (generate-from-style-spec.ts) — generation prompt consumes archetype + slot params"
  - "Plan 06 (supabase migration) — cache purge of schema_version != 2 rows; v1-rejection makes the migration the only bridge"
tech-stack:
  added: []
  patterns:
    - "Zod 4 z.discriminatedUnion keyed on the type-level discriminator (slideArchetype) matching the TypeScript ArchetypeSlots union"
    - "Closed-union widening of SilentDropReason — additive enum extension; existing call sites compile unchanged"
    - "Synthesized ZodError with 'custom' issue code for domain-level early rejections (schema_version mismatch) — distinct from structural Zod failures"
key-files:
  created: []
  modified:
    - "src/lib/validators/style-spec.ts"
    - "src/lib/validators/silent-drop-counter.ts"
    - "src/lib/validators/__tests__/style-spec.test.ts"
    - "src/lib/validators/__tests__/silent-drop-counter.test.ts"
decisions:
  - "Phase 74 silent-coercion of schema_version mismatch (`cleaned.schema_version = STYLE_SPEC_VERSION; counter.increment(unknown_enum_value)`) REMOVED in favor of early ok:false rejection with the new schema_version_rejected reason. Rationale: Phase 80 R4 + Plan 06 cache-purge migration require LOUD rejection so old v1 rows cannot silently coerce into v2 shape."
  - "Discriminated-union catchall is enforced at INNER schemas only (PaletteSchema, TypographySchema, ..., CaptionSlotBlockZ.caption, Collage2upSlotBlockZ.split). Zod 4 does not support `.catchall()` at the union level after `.merge()`; the prevailing belt-and-suspenders pattern is the pre-clean walker (cleanSection + ALLOWED_TOP_LEVEL_KEYS) which strips top-level unknowns BEFORE safeParse runs."
  - "Synthetic ZodError for v1-rejection uses issue code 'custom' (Zod 4 issue-code closed union does not include 'invalid_literal'). The issue path is ['schema_version'] so callers grep the issues array for the field path consistently with structural failures."
  - "ALLOWED_TOP_LEVEL_KEYS unconditionally lists slideArchetype/caption/split because the walker runs BEFORE archetype resolution. Per-archetype slot validity is enforced explicitly downstream in parseStyleSpecSafe (archetype_slot_mismatch counter event) AND at the Zod boundary (discriminated union)."
  - "Plan-02 test file additions document the firewall: P80-1 (all 8 archetypes accepted), P80-2/P80-3 (archetype_fallback on missing/unknown), P80-4 (valid slot for archetype), P80-5/P80-6 (slot-mismatch silent-drop), P80-7 (closed-enum gate at Zod), P80-8 (numeric-literal closed-enum on caption.heightFraction)."
metrics:
  duration_minutes: 12
  completed: "2026-05-14"
  tasks_completed: 1
  files_created: 0
  files_modified: 4
  commits: 1
---

# Phase 80 Plan 02: Discriminated-Union Validator + V1 Rejection + Slot Firewall — Summary

Updated the Phase 74 Zod validator at `src/lib/validators/style-spec.ts` to enforce the Phase 80 composition-aware schema: top-level `z.discriminatedUnion('slideArchetype', [...])` covering all 8 archetypes with per-archetype slot validity; explicit ok:false rejection of `schema_version != 2` payloads (no silent coercion); silent-drop counter events for archetype-fallback and slot-mismatch (per-field telemetry consistent with the Phase 74 pattern). Also extended the closed `SilentDropReason` union in `src/lib/validators/silent-drop-counter.ts` with the three Phase 80 reasons so the validator type-checks end-to-end.

## SilentDropReason Union Extension

The closed `SilentDropReason` union in `src/lib/validators/silent-drop-counter.ts` (line 35) was extended additively with three new reasons:

```ts
export type SilentDropReason =
  | 'unknown_enum_value'
  | 'unknown_field'
  | 'sanitization'
  | 'parse_error'
  // Phase 80 reasons (composition-aware extraction — Plan 02 firewall):
  | 'schema_version_rejected'   // parseStyleSpecSafe early-reject on schema_version != STYLE_SPEC_VERSION
  | 'archetype_fallback'         // slideArchetype absent/unrecognized; defaulted to DEFAULT_FALLBACK_ARCHETYPE
  | 'archetype_slot_mismatch'    // slot param (caption, split, …) supplied for an archetype that does not declare it
```

This is purely additive widening — existing call sites continue to compile unchanged. The corresponding compile-time gate test (silent-drop-counter.test.ts Test 7b) was updated to assert all 7 reasons and keep the `// @ts-expect-error 'random_string'` guard intact.

## Discriminated-Union Construction

The top-level `StyleSpecSchema` was replaced with a Zod 4 discriminated union keyed on `slideArchetype`. Each branch extends a shared `BaseStyleSpecShape` (Phase 74 section schemas + voice_note) with the archetype literal and merges the archetype-specific slot block:

```ts
export const StyleSpecSchema = z.discriminatedUnion('slideArchetype', [
  BaseStyleSpecShape.extend({ slideArchetype: z.literal('full-bleed-text-overlay') }),
  BaseStyleSpecShape.extend({ slideArchetype: z.literal('caption-bar-bottom') }).merge(CaptionSlotBlockZ),
  BaseStyleSpecShape.extend({ slideArchetype: z.literal('caption-bar-top') }).merge(CaptionSlotBlockZ),
  BaseStyleSpecShape.extend({ slideArchetype: z.literal('photo-collage-2up') }).merge(Collage2upSlotBlockZ),
  BaseStyleSpecShape.extend({ slideArchetype: z.literal('photo-collage-grid') }),
  BaseStyleSpecShape.extend({ slideArchetype: z.literal('flat-color-background') }),
  BaseStyleSpecShape.extend({ slideArchetype: z.literal('editorial-serif') }),
  BaseStyleSpecShape.extend({ slideArchetype: z.literal('notes-sticker') }),
])
```

Order matches `SLIDE_ARCHETYPES` (load-bearing per 80-01). Slot blocks (`CaptionSlotBlockZ`, `Collage2upSlotBlockZ`) end with `.catchall(z.never())` on the inner caption/split objects — prompt-injection defense preserved.

## V1-Rejection Branch Location

Inserted early in `parseStyleSpecSafe` body, **right after** the `isPlainObject(input)` check and **before** the cleanSection loop:

```ts
const rawVersion = input['schema_version']
if (rawVersion !== undefined && rawVersion !== STYLE_SPEC_VERSION) {
  counter.increment({
    field: 'schema_version',
    reason: 'schema_version_rejected',
    raw_value: rawVersion,
    schema_version: STYLE_SPEC_VERSION,
  })
  return {
    ok: false,
    counter,
    error: new z.ZodError([{
      code: 'custom',
      path: ['schema_version'],
      message: `schema_version ${String(rawVersion)} rejected; expected ${String(STYLE_SPEC_VERSION)}`,
      input: rawVersion,
    }]),
  }
}
```

The Phase 74 silent-coercion block (`cleaned.schema_version = STYLE_SPEC_VERSION; counter.increment(unknown_enum_value)`) was REMOVED. Phase 80 R4 requires LOUD rejection so the Plan 06 cache-purge migration is the only bridge from v1 rows to v2 shape — no in-place coercion.

Note: absent `schema_version` (undefined input) is NOT rejected at the early branch; it falls through to the final `safeParse` which fails on the literal mismatch (the discriminated union enforces `z.literal(STYLE_SPEC_VERSION)`).

## New Counter Event Reasons Added

Three new counter event call sites in `parseStyleSpecSafe`:

1. **`schema_version_rejected`** — early branch, on `schema_version != STYLE_SPEC_VERSION` and != undefined. Raw value is the rejected version literal.
2. **`archetype_fallback`** — after the cleanSection loop, when `input['slideArchetype']` is absent OR not in `SLIDE_ARCHETYPES`. The resolved archetype falls back to `DEFAULT_FALLBACK_ARCHETYPE` (from `style-spec-archetypes.ts` — single source of truth). Raw value is the rejected/undefined input.
3. **`archetype_slot_mismatch`** — when `input['caption']` is present but the resolved archetype is NOT in `CAPTION_BAR_ARCHETYPES` (caption-bar-bottom OR caption-bar-top), OR when `input['split']` is present but the resolved archetype is NOT in `SPLIT_ARCHETYPES` (photo-collage-2up). Per-field events: separate counter increment for `field: 'caption'` and `field: 'split'`.

## Test Coverage Added

Existing Phase 74 tests in `src/lib/validators/__tests__/style-spec.test.ts` were updated:
- `VALID` fixture: `schema_version: 1` → `schema_version: 2` + added `slideArchetype: 'full-bleed-text-overlay'`.
- Test V2: schema_version assertion now `toBe(2)`; added `result.spec.slideArchetype === 'full-bleed-text-overlay'`.
- Test V11: inverted from "fallback to 1 on v99" to "ok:false + schema_version_rejected on v1"; added V11b for the symmetric v99 case.

A new describe block `Phase 80 Plan 02 (R1, R2, R4): discriminated-union + slot firewall` adds 8 tests (P80-1 through P80-8) covering all 8 archetypes, archetype-fallback paths (missing + unknown), slot acceptance + slot-mismatch on caption + split, the closed-enum gate at the Zod boundary, and the numeric-literal closed-enum on `caption.heightFraction`.

## Verification

| Check                                                                   | Result   |
| ----------------------------------------------------------------------- | -------- |
| `npx tsc --noEmit` (scoped to validator/test files)                     | PASS     |
| `npx vitest run src/lib/validators/__tests__/`                          | 31/31    |
| `bash scripts/grep-gates/closed-enum-styleSpec.sh` (PARITY-05)          | PASS     |
| `grep -cE "schema_version_rejected\|archetype_fallback\|archetype_slot_mismatch" silent-drop-counter.ts` | 3 ≥ 3 |
| `grep -c "z.discriminatedUnion('slideArchetype'" style-spec.ts`         | 1 == 1   |
| `grep -c "from '@/lib/types/style-spec-archetypes'" style-spec.ts`      | 1 == 1   |
| 8 archetype literals in validator                                       | 11 ≥ 8  |
| `schema_version_rejected` in validator                                  | 2 ≥ 1   |
| `archetype_fallback` in validator                                       | 2 ≥ 1   |
| `archetype_slot_mismatch` in validator                                  | 3 ≥ 1   |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Worktree was branched before Plan 80-01 merged to main**
- **Found during:** Initial typecheck (`StyleSpec` did not have `slideArchetype` property in the worktree's view of types)
- **Issue:** The agent worktree branch (`worktree-agent-aa86cb43dc1275a4b`) was created from an older commit (`eab6821`) that predated the 80-01 merge commit (`4781888`). The plan dependencies declare that 80-01 outputs (`src/lib/types/style-spec-archetypes.ts` + `StyleSpec` v2) MUST be available; the worktree did not have them.
- **Fix:** `git stash push -- src/lib/validators/` to set aside in-progress Plan 02 edits, `git merge main --no-edit` to incorporate 80-01 (and other unrelated landed work on main), `git stash pop` to re-apply Plan 02 changes. Stash applied cleanly with no conflicts.
- **Files modified:** None directly — merge-only update; Plan 02 source changes are in the commit.
- **Commit:** Implicit (merge commit during `git merge main --no-edit`); the Plan 02 changes landed in the same `feat(80-02): ...` commit.

### Acceptance Criteria Note

The plan AC `grep -E "reference_artist|reference_brand|copy_exactly|style_freetext" src/lib/validators/style-spec.ts returns 0 matches` returns 1 match — but the single match is a pre-existing Phase 74 comment on line 4 (`// 1. Legal exposure — closed enums prevent reference_artist free-text.`). The PARITY-05 grep gate (`scripts/grep-gates/closed-enum-styleSpec.sh`) explicitly excludes comment-prefixed lines (`grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|#)'`) so the gate PASSES. The token only appears in human-readable explanatory commentary, not as a field name or string literal. No regression.

## Downstream Blockers

- **Plan 03 (extract-style-spec.ts)** — The extractor must emit `slideArchetype` on every StyleSpec it produces AND emit the matching slot block (caption for caption-bar-*; split for photo-collage-2up). Until Plan 03 lands, callers of `parseStyleSpecSafe` that pass extractor output without an archetype field will trigger `archetype_fallback` events (which is the intended fallback behavior — degraded but not failing).
- **Plan 04 (style-spec-projector.ts)** — The projector must import `slideArchetype` from the validated spec and emit `template_id_override` per the locked ARCHETYPE_TO_TEMPLATE map; until Plan 04 lands the validator firewall is in place but downstream routing remains on the Phase 77 behavior (no template_id_override).
- **Plan 05 (generate-from-style-spec.ts)** — Generation prompt must receive archetype + slot params; until Plan 05 lands the AI generator does not consume the new schema fields.
- **Plan 06 (supabase migration)** — Cache purge of `schema_version != 2` rows; until Plan 06 deploys, any cached v1 entries will be early-rejected by parseStyleSpecSafe with `schema_version_rejected` counter events on read, forcing re-extraction. This is the intended cache-hygiene behavior — by design, NOT a bug.

## Self-Check: PASSED

- `src/lib/validators/style-spec.ts` — FOUND (modified)
- `src/lib/validators/silent-drop-counter.ts` — FOUND (modified)
- `src/lib/validators/__tests__/style-spec.test.ts` — FOUND (modified)
- `src/lib/validators/__tests__/silent-drop-counter.test.ts` — FOUND (modified)
- Commit `995aaec` — FOUND in `git log --oneline`
