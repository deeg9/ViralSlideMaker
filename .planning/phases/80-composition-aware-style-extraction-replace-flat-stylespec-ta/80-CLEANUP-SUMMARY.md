# Phase 80 Cleanup: Schema-Bump Cascade Fix Summary

One-liner: Resolved the Phase 80 schema_version 1→2 + required slideArchetype cascade across two production helpers and 15 test fixture files; AI/cache/validators/services suites all green; PARITY-05 grep gate passes.

## Scope

Plans 80-01 and 80-02 bumped `StyleSpecVersion` from `1` to `2` and intersected `StyleSpec` with `ArchetypeSlots` (a discriminated union keyed on `slideArchetype`). Plans 80-03..80-07 focused on their own scope and didn't migrate the existing fixtures or two `StyleSpec`-returning helpers. The cascade surfaced as ~22 TypeScript errors at compile time:

- `Type '1' is not assignable to type '2'` (every fixture still on `schema_version: 1`)
- `Property 'slideArchetype' is missing` (two production helpers that returned a new StyleSpec literal)

## Production fixes (commit `cb5fea2`, identical to main `5932ebd`)

1. `src/lib/ai/style-spec-aspect-filter.ts` — `applyAspectFilter` now spreads `...spec` at the top of the return object literal so `slideArchetype` + per-archetype slot params (`caption`, `split`) flow through. Aspect-filter's intent is to neutralize the 4 aspect categories (palette/typography/layout/decorations); archetype is structural composition and MUST be preserved (not neutralized).
2. `src/lib/ai/style-spec-brand-kit-merge.ts` — `applyBrandKitRemix` same fix. Brand-kit merge only overrides palette + typography; archetype is orthogonal and MUST pass through unchanged.

Both fixes are 1-line spreads with explanatory comments; no behavioral change beyond preserving the new fields.

## Test fixture updates (commit `29918b8`)

17 test files updated. Every legitimate-spec fixture changed `schema_version: 1` → `schema_version: 2` AND added `slideArchetype: 'full-bleed-text-overlay'` (the `DEFAULT_FALLBACK_ARCHETYPE` — `EmptySlots` variant, no slot params required).

| Suite | Files |
| --- | --- |
| AI helpers | `style-spec-aspect-filter.test.ts`, `style-spec-brand-kit-merge.test.ts`, `style-spec-projector.test.ts`, `generate-from-style-spec.test.ts`, `prompts.test.ts`, `extract-style-spec.test.ts`, `extract-style-spec.types.test.ts` |
| Render parity | `parity.style-spec-roundtrip.test.tsx` |
| Services | `carousel-from-references.test.ts`, `publish-style-spec-snapshot.test.ts` |
| Components | `state-machine.test.ts`, `recovery-integration.test.tsx`, `spec-preview-panel-integration.test.tsx`, `style-from-reference-shell.test.tsx`, `project-card-from-references-badge.test.tsx` |
| Server Actions | `actions.test.ts`, `regenerate-action.test.ts` |

### `Partial<StyleSpec>` cast pattern (8 helpers)

For `makeSpec(overrides?: Partial<StyleSpec>): StyleSpec` helpers, added `as StyleSpec` cast on the return value. `Partial<StyleSpec>` over a discriminated union cannot be spread back into the union without collapsing the discriminator (TS sees `slideArchetype` as a possibly-mutated literal post-spread). The cast preserves call-site ergonomics without weakening the production type.

### Version-comparison assertions

Two assertion updates (mirror of the literal-type change):
- `style-spec-aspect-filter.test.ts:179` `.toBe(1)` → `.toBe(2)`
- `style-spec-brand-kit-merge.test.ts:189` `.toBe(1)` → `.toBe(2)`
- `extract-style-spec.types.test.ts:48` `=== 1` → `=== 2`

## Files left intentionally on `schema_version: 1`

Per the scope description, these test v1-rejection or v1-event-metadata behavior and MUST stay on v1:

- `src/lib/validators/__tests__/style-spec.test.ts` — Test V11 verifies `parseStyleSpecSafe` rejects `schema_version=1` with a `schema_version_rejected` counter event. Plan 80-02 already updated this file.
- `src/lib/validators/__tests__/silent-drop-counter.test.ts` — `schema_version: 1` appears as a `SilentDropEvent` field (which version a drop happened in), not as a StyleSpec field. tsc accepts these.
- `src/lib/types/__tests__/slide-zero-new-fields.test.ts` — `@ts-expect-error` test that asserts `style_spec` is NOT a valid `Slide` property. The exact value doesn't matter.
- `src/lib/ai/__tests__/extract-style-spec.test.ts` JSON.stringify mocks (lines 230, 292, 483, 560, 637) — these are mocked Gemini "raw bytes" responses fed through the Phase B firewall. `parseStyleSpecSafe` is itself mocked in the test, so the actual schema_version value passed in the raw bytes doesn't drive validator behavior; the firewall test verifies routing, not validator semantics. tsc accepts these.

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| `npx tsc --noEmit` reports zero `Type '1' is not assignable to type '2'` or `Property 'slideArchetype' is missing` errors | PASS (0 of either) |
| AI + cache + validators + services suites pass | PASS (272/272 tests, 26/26 files) |
| `bash scripts/grep-gates/closed-enum-styleSpec.sh` exits 0 (PARITY-05) | PASS |
| Per-file commits, conventional commit style | PASS |

Remaining tsc errors in the project (22) are all pre-existing and explicitly out-of-scope per the objective:
- Mock typing inconsistencies (`Mock<Procedure | Constructable>`) in auth/api-keys/middleware/signup/projects/stripe tests
- `audit-log.test.ts` `Property 'error' does not exist` (Phase 79 legal-hardening surface)
- `projects-delete.test.ts` `Mock<(name: string)…> is not assignable to Mock<(...args: unknown[])…>`
- `slide-editor.treatment-sync.test.tsx:46` `A spread argument must either have a tuple type or be passed to a rest parameter`

## Deviations from scope

- Worktree HEAD safety: during the test-run step, an unintended `cd` to the parent repository caused later edits to land in the parent's `main` working tree rather than my worktree branch. The production fix commit (`5932ebd`) landed on `main` from the parent dir; this worktree branch later replayed the identical content as `cb5fea2` so its history is self-contained. No protected-branch HEAD rewrite occurred. The cascade no longer affects file routing — all worktree-local edits going forward used absolute worktree paths.
- `STATE.md` was modified in the parent (an unrelated `260514-l9q` commit-hash insertion) but per the objective ("do NOT update STATE.md or ROADMAP.md") I did not stage or commit any STATE/ROADMAP changes from my worktree.

## Commits on `worktree-agent-a3a936c901efc9389`

| Hash | Type | Description |
| --- | --- | --- |
| `cb5fea2` | fix | preserve slideArchetype in aspect-filter + brand-kit-merge |
| `29918b8` | test | bump StyleSpec fixtures to schema_version 2 + slideArchetype |
| (pending) | docs | 80-cleanup cascade fix summary |

## Verification

```
$ npx tsc --noEmit --pretty false 2>&1 | grep -c "Type '1' is not assignable to type '2'\|Property 'slideArchetype' is missing"
0

$ bash scripts/grep-gates/closed-enum-styleSpec.sh
PARITY-05: zero free-text closed-enum violations in src/
exit:0

$ npx vitest run src/lib/ai/ src/lib/cache/ src/lib/validators/ src/lib/services/
Test Files  26 passed (26)
     Tests  272 passed (272)
```
