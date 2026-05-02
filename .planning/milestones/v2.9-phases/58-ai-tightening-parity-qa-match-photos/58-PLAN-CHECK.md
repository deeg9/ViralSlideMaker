---
phase: 58-ai-tightening-parity-qa-match-photos
checked: 2026-04-30
checker: orchestrator-inline
plans_checked: 3
status: PASSED
issues_found: 0
issues_resolved: 0
---

# Phase 58 Plan Check

Plans checked against `58-CONTEXT.md` decisions and the orchestrator's
hard constraints.

## Coverage matrix

| Requirement | Plan | Coverage Verdict |
|---|---|---|
| AIROLE-01 | 58-01 | COVERED — schema role enum + assignSlideRoles deterministic distribution |
| AIROLE-02 | 58-01 | COVERED — verbatim D-04 block in buildSystemPrompt |
| AIROLE-03 | 58-01 | COVERED — template_id_override in Zod + Gemini schemas + TEMPLATE_IDS const |
| AIROLE-04 | 58-01 | COVERED — validateAndRepair silent default + strip; never-throws preserved |
| AIROLE-05 | 58-01 | COVERED — D-12 v2.7 baseline re-verification gate |
| MATCH-01 | 58-02 | COVERED — wired into actions.ts upload flow |
| MATCH-02 | 58-02 | COVERED — `tier !== 'free'` premium gate; free fallback to inline index-order |
| MATCH-03 | 58-02 | COVERED — MAX_PHOTOS=8 const + match_photo_cache table |
| MATCH-04 | 58-02 | COVERED — Promise.race vs 10s setTimeout reject |
| MATCH-05 | 58-02 | COVERED — gemini_vision_match enum + CREDIT_COSTS + refund flow |
| PARITY-01 | 58-03 | COVERED — parity.test.tsx with identity check + 3 templates |
| PARITY-02 | 58-03 | COVERED — renderGrain/renderVignette assertion |
| PARITY-03 | 58-03 | COVERED — render-parity-grid.ts script + npm run parity-grid |
| PARITY-04 | 58-03 | COVERED — extend no-css-filter.test.ts to 3 new template files + decorative.ts |
| PARITY-05 | 58-03 | COVERED — zip-metadata.test.ts with sharp.metadata() assertions |
| PARITY-06 | 58-03 | COVERED — deleteProjectService extension + projects-delete.test.ts |

All 16 requirements: COVERED. Zero gaps.

## Hard constraint check

| Constraint | Plan | Honored |
|---|---|---|
| TPLREND-05 parity invariant — final ship-gate check | 58-03 (PARITY-01, PARITY-02) | YES |
| No new template defaults to Inter | n/a (Phase 56 already enforced via SLOP-03 validator) | YES — Phase 58 does not add templates |
| stylize-image.ts stays parked | All plans | YES — explicitly out-of-scope in CONTEXT and 58-VERIFICATION row 7 (N/A) |
| match-photos-to-slides.ts is premium-tier only | 58-02 | YES — D-09 + actions.ts caller gate |
| Diversity gate is advisory in v2.9 | 58-01 | YES — D-14, test does not fail CI |
| No new npm dependencies | All plans | YES — uses existing sharp, vitest, jszip, supabase, @google/genai |
| v2.7 audit baseline (19/19) re-passes | 58-01 (D-12) | YES — full suite re-run after each prompt change |
| No scope creep — AIROLE 5 roles closed | 58-01 (D-02) | YES |
| MATCH gate premium-only — no free heuristics | 58-02 | YES — free path explicitly index-order only |
| PARITY scoped — 3 new templates + 2 helpers | 58-03 | YES — not all 11 × 11 |

All 10 hard constraints: HONORED.

## Plan-quality check

### Plan 58-01 (AI tightening)

- ✅ 8 tasks; all atomic
- ✅ files_modified manifest matches task descriptions
- ✅ verifications include npm run typecheck + targeted vitest + full-suite baseline check (D-12)
- ✅ verbatim text from D-04 inlined in plan body
- ✅ deterministic table from D-05 inlined
- ✅ corpus from D-13 referenced (defined in test fixture)
- ✅ Wave 1 (no deps)

### Plan 58-02 (match-photos premium gate)

- ✅ 5 tasks; all atomic
- ✅ Migration SQL inlined in plan (apply via mcp__supabase__apply_migration)
- ✅ Refactor scope per D-09 explicit (DO NOT touch enumerated)
- ✅ Premium gate in CALLER (D-09) not in match-photos (correct — keeps function pure)
- ✅ Refund flow mirrors imagen_generation pattern (cited line numbers)
- ✅ 4 test cases enumerated (MAX_PHOTOS, timeout, cache hit, cache write)
- ✅ depends_on: [58-01] (sequenced for clean atomic commits)
- ✅ Wave 2

### Plan 58-03 (Parity QA + cascade-delete + ship gate)

- ✅ 7 tasks; all atomic
- ✅ Identity-check mechanism for PARITY-01 (D-11) explicit, not visual regression
- ✅ no-css-filter.test.ts extended NOT replaced (preserves 4-case Phase 55 baseline)
- ✅ render-parity-grid.ts allowed to ship as scaffold with v3.0 follow-up note (Satori half is the substantive deliverable; React preview half deferred)
- ✅ ZIP metadata strip uses sharp (already a Phase 54 dep)
- ✅ Cascade-delete extends BOTH the service AND the call site in dashboard/actions.ts
- ✅ 4 cascade-delete test cases enumerated
- ✅ 58-VERIFICATION.md template includes the 15-row ship-gate table from CONTEXT D-15
- ✅ depends_on: [58-01, 58-02] (verifier doc references both)
- ✅ Wave 3

## Risks identified

R-01: Plan 58-01 Task 5 mutates the `T` type parameter of
`validateAndRepair` to add `role` + `template_id_override`. If
`SlideContentSchema` Zod inference flows back to a stricter shape,
the in-place mutation may need a cast. Plan body documents this; the
executor should preserve the never-throws contract first, type
strictness second.

R-02: Plan 58-02 Task 2's `admin` parameter wiring in actions.ts may
require hoisting an admin client construction. The plan flags this
and points to `src/lib/services/ai-regen.ts` as the precedent. If
the existing `admin` variable is in scope, no new client; otherwise
add `const admin = createServiceRoleClient()` at the top of
`generateCarousel`.

R-03: Plan 58-03 Task 3's `render-parity-grid.ts` deferred React-
preview-half to v3.0. This is a documented partial — the script
ships as scaffold; the substantive Satori-side iteration is
exercised. Risk: a future maintainer treats this as "complete" when
it's "partial." Mitigation: the script and 58-VERIFICATION.md row 1
both explicitly note the deferred half.

R-04: Plan 58-03 Task 4's `renderSlideToSatori` may not be a
directly-importable named export. The plan documents adapting to
`buildSlideElement` + `ImageResponse` if needed. Executor must
verify the pipeline tests cover the SAME path `/api/render/route.ts`
uses.

All risks: ACCEPTABLE for v2.9 (final-phase polish; partials are
documented; no risk to ship gate).

## Verdict

**PASSED** — 3 plans cover all 16 requirements; 10/10 hard constraints
honored; 0 issues blocking; 4 risks documented as acceptable.

Plans ready for `/gsd-execute-phase 58`.
