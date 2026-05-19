---
phase: 77-emit-integration-token-budget-gate-single-undo-editor-handoff
plan: 03
subsystem: provenance-ui
tags: [editor-02, editor-03, dashboard, project-detail, legal-03, additive-types]
requirements_completed:
  - EDITOR-02
  - EDITOR-03
dependency_graph:
  requires:
    - "Phase 74-01 StyleSpec type (src/lib/types/style-spec.ts)"
    - "Phase 74-02 ReferenceAssetRow + JSONB column constants (src/lib/types/projects-storage-constants.ts)"
    - "Phase 74-02 projects.style_spec + projects.reference_assets JSONB columns (migration shipped)"
  provides:
    - "Project type carrying optional style_spec + reference_assets (additive)"
    - "FromReferencesBadge — visible provenance chip on dashboard project cards"
    - "ReferenceThumbnailsStrip — horizontal reference thumbnails strip on project detail"
    - "Project detail page wired to render strip above SlideEditor when references present"
    - "Phase 78 (REMIX) handoff — Project type + components ready to render forked projects without changes"
  affects:
    - "Dashboard /dashboard project cards (visible chip when style_spec non-null)"
    - "Project detail page /project/[id] (slim strip above editor when reference_assets non-empty)"
tech_stack:
  added: []
  patterns:
    - "Pure presentation components — no Supabase, no router, no state hooks (source-grep tested)"
    - "Conditional render returns null for legacy projects — byte-identical to pre-Phase-77 layout"
    - "LEGAL-03 framing discipline enforced at component level via forbidden-token grep tests"
    - "Additive optional fields on Project type — TPLREND-05-style discipline; zero impact on existing consumers"
key_files:
  created:
    - "src/components/projects/from-references-badge.tsx"
    - "src/components/projects/reference-thumbnails-strip.tsx"
    - "src/components/projects/__tests__/from-references-badge.test.tsx"
    - "src/components/projects/__tests__/reference-thumbnails-strip.test.tsx"
    - "src/components/projects/__tests__/project-card-from-references-badge.test.tsx"
  modified:
    - "src/lib/types/project.ts"
    - "src/components/projects/project-card.tsx"
    - "src/app/(dashboard)/project/[id]/page.tsx"
decisions:
  - "Badge stack at top-2 left-2 with pointer-events-none — Public chip + FromReferencesBadge stacked vertically; pointer-events-none on the wrapper guarantees the chips never intercept the card's click handler (regression-safe vs the existing handleCardClick → router.push)"
  - "Strip uses raw <img> not next/image — Supabase signed-URL hosts would need next.config domain allowlisting; v1 ships <img> with loading=lazy + decoding=async + fixed 48x48 (no layout shift). next/image migration is a follow-up if perf telemetry warrants"
  - "Test 6/7 of project-card-from-references-badge use source-grep on page.tsx rather than mounting the server component — full server-component mount needs supabase + RLS + auth scaffolding the rest of this repo's vitest suite does not exercise; the strip's own 11 tests already prove conditional-render behavior, so source-grep is the practical wiring check"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-11"
  tasks_completed: 4
  tests_added: 25
  files_created: 5
  files_modified: 3
---

# Phase 77 Plan 03: From-References Provenance UI — Summary

Ship the user-facing "From references" provenance surface across both the dashboard project list and the project detail page. Badge on cards (EDITOR-02) + thumbnails strip on detail (EDITOR-03), both gated on the corresponding JSONB columns being non-null/non-empty so legacy projects (every pre-v2.13 project) render byte-identical to today.

## What Shipped

- **Project type extension** — `style_spec?: StyleSpec | null` + `reference_assets?: ReferenceAssetRow[] | null` added as optional + nullable. TPLREND-05-style additive discipline; existing consumers unchanged. `npx tsc --noEmit` produces zero new errors related to these fields.
- **FromReferencesBadge** (`src/components/projects/from-references-badge.tsx`) — pure presentation chip rendered ONLY when `hasStyleSpec={true}`. LEGAL-03 framing: "Inspired by references" (never "copied from" / "cloned from" / "exactly like"). Uses brand color `#3d0000` with backdrop-blur for legibility on photo backgrounds.
- **ReferenceThumbnailsStrip** (`src/components/projects/reference-thumbnails-strip.tsx`) — pure presentation horizontal strip; renders null for empty/null/undefined input. Each thumbnail is a 48×48 `<img>` with `loading="lazy"` + `decoding="async"`. Visible "Inspired by" caption + per-thumbnail alt text.
- **ProjectCard wiring** — top-left badge stack (Public chip + FromReferencesBadge) inside a `pointer-events-none` wrapper. Stacked vertically; doesn't clash with the existing top-right menu chrome.
- **Project detail page wiring** — strip rendered above `<SlideEditor>` in the `hasSlides` branch. Strip returns null when `reference_assets` is null/empty, so legacy projects keep the byte-identical full-bleed editor.

## Tasks (4)

| # | Task | Commit | Tests |
| - | ---- | ------ | ----- |
| 1 | Extend Project type (additive) | `cda41fa` | TS-only (npx tsc --noEmit GREEN for new fields) |
| 2 | FromReferencesBadge + tests | `268139f` | 6 GREEN |
| 3 | ReferenceThumbnailsStrip + tests | `2b1793c` | 11 GREEN |
| 4 | Wire badge into ProjectCard + strip into project detail page + integration tests | `73b3492` | 8 GREEN |

**Total: 25 GREEN tests across 3 new test files** (target was 23+).

## Verification Results

```
$ npx vitest run \
    src/components/projects/__tests__/from-references-badge.test.tsx \
    src/components/projects/__tests__/reference-thumbnails-strip.test.tsx \
    src/components/projects/__tests__/project-card-from-references-badge.test.tsx
Test Files  3 passed (3)
     Tests  25 passed (25)
```

```
$ npm run lint:gates
PARITY-05: zero free-text closed-enum violations in src/
```

```
$ npx tsc --noEmit  # filtered to changed-file paths
(zero errors related to project.ts / from-references-badge.tsx /
 reference-thumbnails-strip.tsx / project-card.tsx /
 app/(dashboard)/project/[id]/page.tsx)
```

```
$ npx vitest run src/__tests__/projects/dashboard.test.tsx
Test Files  1 passed (1)
     Tests  3 passed (3)   # pre-existing dashboard tests — no regression
```

## LEGAL-03 Framing Audit

Exact strings used in the new components (case-preserving):

| Component | String | Where |
| --------- | ------ | ----- |
| FromReferencesBadge | `Inspired by references` | visible text + aria-label |
| ReferenceThumbnailsStrip | `Inspired by` | caption (uppercase) |
| ReferenceThumbnailsStrip | `Inspired by reference N` | per-thumbnail alt text |

Forbidden token scan (Test 5 of badge + Test 8 of strip): rendered HTML grepped case-insensitively against `["exactly like", "exactly the same", "copied from", "cloned from", "clone of", "duplicate of", "copy of"]` — zero matches across all rendered output.

## Legacy-Project Defense

The "byte-identical for legacy projects" promise (Phase 74 PTF baseline) is preserved by:

- **Test 2 of FromReferencesBadge** — `hasStyleSpec=false` → component returns null (no DOM produced).
- **Test 1, 2, 2b of ReferenceThumbnailsStrip** — empty/null/undefined input → component returns null (no DOM produced).
- **Test 7b of integration** — SlideEditor mount preserved; the only added wrapper is a fragment whose first child renders null when references are absent.
- **Pre-existing dashboard test** still passes (3/3 GREEN) — no regression to the project list rendering path.

For any legacy project (style_spec null, reference_assets null), the rendered DOM is:
- ProjectCard: identical to pre-Phase-77 except an empty `pointer-events-none` flex wrapper at top-left when not public (one extra empty `<div>` — visually invisible, layout-neutral).
- Project detail (hasSlides): identical to pre-Phase-77 except a React fragment + a null-rendering `<ReferenceThumbnailsStrip>` (zero DOM impact).

## Phase 78 (REMIX) Handoff

The Project type now carries `style_spec` and `reference_assets` — when Phase 78's fork RPC duplicates a project, copying these two columns lights up the badge + strip on the forked project automatically. No component changes required; the wiring is idempotent under copy.

## Deviations from Plan

**None — plan executed exactly as written.**

Minor scoped additions:
- Test 2b on ReferenceThumbnailsStrip (null in addition to undefined input) — defensive bonus test, no plan deviation.
- Badge wrapper added one flex container at top-left of ProjectCard combining Public chip + FromReferencesBadge into a single stack. The plan suggested a standalone wrapper for the badge; combining with Public is cleaner and avoids two competing absolute-positioned elements at the same coordinates. The Public chip's visual position is preserved (still top-2 left-2).

## Out-of-Scope Pre-Existing Issues (Not Fixed)

Per Rule 3 scope boundary — these are out-of-scope and pre-date Plan 77-03:

- `src/__tests__/projects/crud.test.ts` — 3 failing tests due to "Not authenticated" (Supabase auth mock setup issue, vitest 4 Mock type changes). Verified failing on the pre-Plan-77-03 baseline via `git stash` round-trip. Not caused by this plan; safe to leave for a focused test-infra fix.
- Various `src/__tests__/**/*.test.ts` files have vitest 4 Mock type errors (`Mock<Procedure | Constructable>` not callable) — repo-wide test infrastructure issue, pre-existing, unrelated to this plan's surface.

## Self-Check: PASSED

Files claimed-created exist:
- `src/components/projects/from-references-badge.tsx` — FOUND
- `src/components/projects/reference-thumbnails-strip.tsx` — FOUND
- `src/components/projects/__tests__/from-references-badge.test.tsx` — FOUND
- `src/components/projects/__tests__/reference-thumbnails-strip.test.tsx` — FOUND
- `src/components/projects/__tests__/project-card-from-references-badge.test.tsx` — FOUND

Commits exist in git log:
- `cda41fa` — FOUND (Task 1: Project type extension)
- `268139f` — FOUND (Task 2: FromReferencesBadge)
- `2b1793c` — FOUND (Task 3: ReferenceThumbnailsStrip)
- `73b3492` — FOUND (Task 4: integration wiring)
