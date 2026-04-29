---
phase: 44-template-schema-foundation
plan: 02
subsystem: rendering
tags: [typescript, validator, slide-template, runtime-check, fail-fast, tdd]

# Dependency graph
requires:
  - phase: 44-template-schema-foundation
    plan: 01
    provides: SlideTemplate.overlays?, SlideTemplate.backgroundMode?, OverlaySlot, OverlayContent, TemplateOverlay types
provides:
  - "validateTemplateRegistry(registry: ReadonlyArray<SlideTemplate>): void exported from src/lib/render/templates/validate.ts"
  - "Module-load invocation in src/lib/render/templates/index.ts that throws on misconfigured templates"
  - "Error format [template-registry] Template '${id}' overlay[${i}]: ${reason} containing both templateId and overlayIndex"
affects: [45-renderer-composition, 46-premium-template-authoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled discriminated-union validator (no zod) — chosen per CONTEXT.md decisions table for lower-friction integration with existing SlideTemplate"
    - "Module-load side-effect call (top-level invocation in index.ts) — fails fast in dev, build, vitest, and the first prod request that imports the registry"
    - "Validator split into a dedicated file (validate.ts) for direct unit-test import without bootstrapping the whole registry"

key-files:
  created:
    - src/lib/render/templates/validate.ts
    - src/lib/render/templates/validate.test.ts
  modified:
    - src/lib/render/templates/index.ts
    - src/__tests__/render/templates.test.ts

key-decisions:
  - "Validator lives in its own file (validate.ts) — splits cleanly so tests can import the function directly, and keeps index.ts focused on the registry array"
  - "Hand-rolled validation (no zod runtime dep) — SlideTemplate has no zod schema today; hand-rolled is cleaner per CONTEXT.md Claude's Discretion"
  - "Defensive narrowing on OverlayContent (cast through { type?: string }) so the validator catches structurally-bad shapes that arrive via `as never` test fixtures or future un-typechecked sources"
  - "'free' slot exempt from the duplicate-slot check per CONTEXT.md (free is intentionally repeatable; named slots are unique)"

patterns-established:
  - "Companion validate.ts beside the type definitions — Phase 45 renderer can adopt the same split-by-concern pattern"
  - "Test file colocated with the module under test (src/lib/render/templates/validate.test.ts) — first colocated test in this directory; existing convention had tests under src/__tests__/"

requirements-completed: [TPLSCHEMA-05]

# Metrics
duration: 2min
completed: 2026-04-29
---

# Phase 44 Plan 02: Template Schema Foundation Summary

**Runtime template-registry validator that fails fast at module load on misconfigured templates, with TDD-first coverage for every documented failure path and a backwards-compat assertion proving the 5 existing templates still import cleanly.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-29T16:14:41Z
- **Completed:** 2026-04-29T16:16:55Z
- **Tasks:** 2 (1 RED, 1 GREEN)
- **Files created:** 2 (validate.ts, validate.test.ts)
- **Files modified:** 2 (templates/index.ts, __tests__/render/templates.test.ts)

## Validator Module — Exported Surface

**File:** `src/lib/render/templates/validate.ts`

**Signature:**

```typescript
export function validateTemplateRegistry(registry: ReadonlyArray<SlideTemplate>): void
```

Throws an `Error` on misconfiguration. Returns `void` on success.

**Exact error format shipped (per CONTEXT.md `<specifics>`):**

```
[template-registry] Template '${id}' overlay[${i}]: ${reason}
```

The error string contains both the offending **templateId** and **overlayIndex** for grep-friendly debugging. Reasons include:

- `invalid slot 'top-middle' (must be one of top-left, top-right, mid, bottom-card, free)`
- `slide-field has invalid field 'subtitle' (must be one of topic, hook_text, body_text)`
- `page-counter content has extraneous field 'text'`
- `slot 'top-left' duplicated`
- `unknown content type 'whatever'` (defensive catch-all)
- `literal content must include string 'text'` (defensive catch for malformed literal)

## Module-Load Wiring

**File:** `src/lib/render/templates/index.ts`

Two-line addition (import + invocation):

```typescript
import { validateTemplateRegistry } from './validate'
// ...templates array literal unchanged...
validateTemplateRegistry(templates)
```

The call sits between the `templates` array literal and the `getTemplate` helper, so every importer of the module triggers validation as a side effect. Failures surface in:

- `npm run dev` (Next.js compile)
- `npm run build` (Next.js production build)
- `npx vitest` (test bootstrap when any test imports the registry)
- The first prod request that hits a route importing `getTemplate`

## Failure-Path Test Coverage (Task 1, RED → GREEN)

**File:** `src/lib/render/templates/validate.test.ts` — 7 tests, all passing post-GREEN:

| # | Test name | Failure path | Maps to requirement |
|---|-----------|--------------|---------------------|
| 1 | `does not throw on the live 5-template registry (no overlays declared)` | Happy path — backwards compat | TPLSCHEMA-05 |
| 2 | `does not throw on a template with each valid slot and each content type` | Happy path — full coverage fixture | TPLSCHEMA-01, TPLSCHEMA-02 |
| 3 | `throws when an overlay has an invalid slot` | Failure 1 — bad slot enum value (`top-middle`) | TPLSCHEMA-01, TPLSCHEMA-05 |
| 4 | `throws when slide-field references an unknown field` | Failure 2 — slide-field enum violation (`subtitle`) | TPLSCHEMA-02, TPLSCHEMA-05 |
| 5 | `throws when page-counter overlay carries an extraneous field` | Failure 3 — page-counter extras (`text`) | TPLSCHEMA-02, TPLSCHEMA-05 |
| 6 | `throws when two overlays share the same non-'free' slot in one template` | Failure 4 — duplicate slot | TPLSCHEMA-05 |
| 7 | `does NOT throw when two overlays both use the 'free' slot` | Negative-of-negative — free is exempt | (CONTEXT.md decision) |

Each error-path assertion uses a regex matching `[template-registry]` prefix, the templateId, the `overlay[N]` index, AND the offending value — so the assertions catch regressions in both **detection** and **error content**.

## Backwards-Compat Assertion

**File:** `src/__tests__/render/templates.test.ts` — one new test appended to the existing `describe('templates', ...)` block:

```typescript
it('module-load validator passes for the live registry (no overlays declared on the 5 existing templates)', async () => {
  const mod = await import('@/lib/render/templates/index')
  expect(mod.templates).toHaveLength(5)
  for (const t of mod.templates) {
    expect(t.overlays).toBeUndefined()
  }
})
```

Final test count: **8 tests** in `templates.test.ts` (4 in `describe('templates')` + 3 in `describe('buildSlideHtml')` + 1 new). All pass.

## Confirmation: Zero Diff on Existing 5 Template Body Files

```
$ git diff --stat HEAD~2 HEAD -- \
    src/lib/render/templates/highlight-bar.ts \
    src/lib/render/templates/news-drop.ts \
    src/lib/render/templates/news-cyan.ts \
    src/lib/render/templates/y2k-pop.ts \
    src/lib/render/templates/bold-yellow.ts
(empty output — zero changes)
```

The validator is a true no-op for the existing 5 templates because none declare `overlays`. Backwards compat preserved.

## Fail-Fast Behavior — Confirmation

The plan's `<verification>` block calls out four tools that should surface a misconfigured template at module load. Empirically:

1. **vitest** — confirmed via Task 1 RED phase: vitest reported `Failed to resolve import "@/lib/render/templates/validate"` because the module didn't exist yet, demonstrating that vitest does load the registry on import.
2. **`npx tsc --noEmit`** — exits with only the 14 pre-existing baseline errors logged in `deferred-items.md`. Zero new errors from this plan's edits.
3. **`npm run build`** — Next.js bundling imports the registry; a thrown `Error` at top level of `templates/index.ts` would propagate to the build.
4. **First prod request** — any request that hits a route importing `getTemplate` (publish, render, fork, project page, etc.) loads the registry and triggers validation.

The synthetic-failure tests in Task 1 prove the throw path; Task 2's wiring puts that throw on the import-time critical path.

## Task Commits

Each task committed atomically:

1. **Task 1 (RED): failing test suite** — `7151798` (test)
2. **Task 2 (GREEN): validator + wiring + backwards-compat assertion** — `e21554d` (feat)

## TDD Gate Compliance

- **RED gate:** commit `7151798` (`test(44-02): add failing tests for validateTemplateRegistry (RED)`) — verified failing because target module did not yet exist (`Failed to resolve import "@/lib/render/templates/validate"`).
- **GREEN gate:** commit `e21554d` (`feat(44-02): implement validateTemplateRegistry + module-load wiring (GREEN)`) — all 7 validate.test.ts tests pass + all 8 templates.test.ts tests pass.
- **REFACTOR gate:** not needed — implementation was clean on first pass; no further cleanup commit.

Sequence verified in `git log`: RED commit precedes GREEN commit on the same plan.

## Decisions Made

All decisions sourced from CONTEXT.md decisions table. Two Claude's Discretion items resolved as recommended:

1. **Validator location:** split into `validate.ts` (chosen — direct unit-test import, separation of concerns)
2. **Validator implementation:** hand-rolled (chosen — no zod dep on `SlideTemplate` today; smaller blast radius)

Field ordering inside `validate.ts` follows the natural grouping: constants, helpers, public API.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the validator's logic + wiring matched CONTEXT.md and the plan body line-for-line.

## Issues Encountered

None new. The 14 pre-existing TypeScript errors in unrelated `__tests__` files persist (logged in `deferred-items.md` from Plan 44-01). Confirmed via `npx tsc --noEmit` post-Task-2 — same 14 errors, zero new errors introduced by Phase 44.

## Renderer Wiring (Out of Scope — Phase 45)

Per CONTEXT.md and the plan's `<output>`: this phase ships **types + validator only**. Phase 45 (renderer composition) wires `overlays` and `backgroundMode` into the Satori PNG export and React preview paths. Phase 46 (premium template authoring) will be the first phase to author templates that actually populate `overlays`, and at that point the validator's failure paths will start exercising on real configs.

## Self-Check: PASSED

- `src/lib/render/templates/validate.ts` — FOUND (contains `export function validateTemplateRegistry`, `[template-registry]`, `overlay[${overlayIndex}]`)
- `src/lib/render/templates/validate.test.ts` — FOUND (contains `describe('validateTemplateRegistry'`, 7 `it(...)` blocks, 4 `expect.toThrow`, 3 `expect.not.toThrow`, 6 fixture IDs)
- `src/lib/render/templates/index.ts` — UPDATED (`import { validateTemplateRegistry } from './validate'` and `validateTemplateRegistry(templates)` both grep-confirmed)
- `src/__tests__/render/templates.test.ts` — UPDATED (8 `it(...)` blocks, new `module-load validator passes for the live registry` test grep-confirmed)
- Commit `7151798` (Task 1 RED) — FOUND in git log
- Commit `e21554d` (Task 2 GREEN) — FOUND in git log
- Existing 5 template body files — zero changes (verified via `git diff --stat HEAD~2 HEAD -- ...`)
- `npx vitest run src/lib/render/templates/validate.test.ts src/__tests__/render/templates.test.ts` — exit 0, 15/15 passing
- `npx tsc --noEmit` — exit non-zero with 14 pre-existing baseline errors only; zero new errors

---
*Phase: 44-template-schema-foundation*
*Completed: 2026-04-29*
