---
phase: 71-ai-emit-fork-rpc-comprehensive-parity-audit
plan: 03
subsystem: ptf17-ai-emit-byte-identity-parity, v2.12-ship-gate-doc
tags: [parity, ptf17, ai-emit, fingerprint, ship-gate, audit, v2.12, byte-identity, snapshot, decoration]

# Dependency graph
requires:
  - phase: 71
    provides: 71-01 — DecorationEmitSchema + resolveAIDecoration + AI_POSITION_RECTS (the exact pipeline PTF17 pipes its emit through)
  - phase: 71
    provides: 71-02 — AI-05 advisory + MIGR-01 fork RPC (referenced + cross-linked from V2.12-SHIP-GATES.md)
  - phase: 69
    provides: PTF13/14/18 byte-identity precedent + extractDecorationSlice / normalizeDecorationSlice helper pattern + fingerprintFixtureSlide test fixture
  - phase: 67
    provides: PTF16 idempotent-absence baseline + DecorationSchema final-shape gate
provides:
  - PTF17 fingerprint test (5 cross-renderer + 2 sanity = 7 tests; 6 snapshots) — the v2.12 final byte-identity invariant
  - 71-V2.12-SHIP-GATES.md — single canonical reference for every v2.12 audit gate (42 gates × 275 ship-gate tests across 14 files, all GREEN)
affects: [v2.12-milestone-ship, 72-rotation-handles-aabb (PTF15 carry-forward), v2.13-promote-AI-05-to-fail-CI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PTF17 cross-renderer + snapshot defense-in-depth — mirrors PTF13/14/18 prior art (expect(preview).toBe(satori) AND expect(preview).toMatchSnapshot)"
    - "TEST-ONLY pipe-through helper with throw-on-failure semantics (vs production silent-drop) — fixture mistakes fail loudly in CI rather than silently producing 0 decorations"
    - "Multi-decoration extraction by data-decoration-id — fingerprintBoth(slide, decorationId) target a specific deco in the same slide HTML"
    - "Locked derived_palette test fixture (['#11AABB', '#22CCDD', '#33EEFF', ...]) — palette-token resolution determinism across snapshot regenerations"
    - "v2.12 ship-gate doc as single canonical reference — every gate row links phase + plan + test file path + test count + commit hash + status (re-run any gate via one path)"

key-files:
  created:
    - src/lib/render/__tests__/parity.template-fingerprint-decorations-ai-emit.test.tsx
    - src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-ai-emit.test.tsx.snap
    - .planning/phases/71-ai-emit-fork-rpc-comprehensive-parity-audit/71-V2.12-SHIP-GATES.md
  modified: []

key-decisions:
  - "Copy-paste extractDecorationSlice + normalizeDecorationSlice helpers into the new PTF17 test file (vs hoist to parity-fingerprint-fixtures.ts) — matches Phase 69 PTF16 precedent (parity.template-fingerprint-decorations-undefined.test.tsx also duplicates), keeps PTF13/14/18 untouched (zero regression risk), and PTF17 needed an extended variant of extractDecorationSlice anyway (multi-decoration via data-decoration-id arg) so the helper was not 1:1 with the PTF13 version"
  - "Locked derived_palette = ['#11AABB', '#22CCDD', '#33EEFF', '#44112233', '#5566FF77', '#778899'] — palette-vibrant resolves to '#11AABB' (Phase 56 node-vibrant index 0 = Vibrant). Modifying any value requires regenerating snapshots"
  - "TEST-ONLY pipeAIEmitToDecoration helper THROWS on validation failure — production ingest in generate-slides.ts silent-drops, but tests want loud failures on fixture mistakes (a typo'd lucideName here would silently produce 0 decorations and then fail byte-identity with a confusing diff)"
  - "Sourced commit hashes from `git log --oneline -- <file>` per gate; sourced test counts from `npx vitest run --reporter=verbose` aggregation (275 ship-gate tests across 14 files) — both authoritative, no manual count drift"
  - "Phase 67 DEPS-01 cited via Phase 67-02 docs commit (e76f8fa) where the bundle-delta verification was finalized; base lucide-react upgrade install commit is bbd93be — both referenced in the ship-gate doc"

patterns-established:
  - "AI-emit byte-identity: full DecorationEmitSchema → resolveAIDecoration → DecorationSchema pipe-through is the production-equivalent test fixture (skip ANY layer = fingerprint covers a different surface). Cross-ref Plan 71-01 for the resolver contract."
  - "Multi-decoration fingerprint extraction: extractDecorationSlice(html, decorationId) — required when ≥2 decorations land on the same slide (multi-decoration test). Pattern carries forward to any future N-decoration parity test."
  - "v2.12 ship-gate doc layout: 9 gate-family sections + aggregate table + carry-forward + manual QA + sign-off. Future v2.13+ ship-gate doc should mirror layout (single canonical reference, every row linkable)."

requirements-completed: [PARITY-10]

# Metrics
duration: 6min
completed: 2026-05-04
---

# Phase 71 Plan 03: PTF17 AI-emit parity audit + V2.12-SHIP-GATES.md Summary

**PTF17 byte-identity fingerprint test (5 cross-renderer + 2 sanity = 7 tests; 6 snapshots) closes the final v2.12 byte-identity invariant — AI-emitted decorations pipe through DecorationEmitSchema → resolveAIDecoration → DecorationSchema and render byte-identical between Satori PNG and React preview — and 71-V2.12-SHIP-GATES.md enumerates all 42 v2.12 audit gates (275 tests GREEN across 14 files) as the single canonical ready-to-ship checklist.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-04T03:08:30Z
- **Completed:** 2026-05-04T03:14:30Z
- **Tasks:** 2
- **Files modified:** 3 (3 created, 0 modified)

## Accomplishments

- PTF17 fingerprint test ships GREEN on first vitest run (TDD RED skipped — schema + helper + snapshot all converge cleanly thanks to Plan 71-01's silent-fallback resolver and the established PTF13/14/18 helper pattern). 7 tests covering icon-accent / icon-palette-vibrant / shape-rect-accent / shape-circle-palette-vibrant / multi-decoration / 2 sanity (rect-locked + final-shape-validity).
- 6 snapshots committed in `__snapshots__/parity.template-fingerprint-decorations-ai-emit.test.tsx.snap` — second-run snapshot stability verified.
- `71-V2.12-SHIP-GATES.md` shipped as the single canonical v2.12 audit-gate reference: 42 gates across 9 gate families, 275 ship-gate tests GREEN, every row linking phase + plan + test file path + test count + commit hash + status.
- Phase 69 PTF13/14/18 still 31/31 GREEN (no regression from helper copy-paste); Phase 71 full suite (AI + migration + PTF17) 133/133 GREEN; tsc baseline 17 preserved.
- v2.12 milestone (Phases 67/68/69/70/71) is officially ready-to-ship pending Phase 72 (rotation handles, post-v2.12-ship work) + 4 manual QA smoke tests enumerated in the ship-gate doc.

## Task Commits

Each task was committed atomically:

1. **Task 1: PTF17 AI-emit parity fingerprint baseline** — `a347858` (test)
2. **Task 2: V2.12-SHIP-GATES.md enumerating all audit gates** — `c187e1f` (docs)

**Plan metadata:** This SUMMARY (will be committed alongside STATE.md / ROADMAP.md / REQUIREMENTS.md updates as the final plan-completion commit).

## Files Created/Modified

- `src/lib/render/__tests__/parity.template-fingerprint-decorations-ai-emit.test.tsx` (NEW) — 7 PTF17 tests + the `pipeAIEmitToDecoration` test-only helper (throws on validation failure) + locked `LOCKED_DERIVED_PALETTE` fixture + extended `extractDecorationSlice(html, decorationId?)` for multi-decoration extraction.
- `src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-ai-emit.test.tsx.snap` (NEW) — 6 PTF17 snapshots: 4 single-decoration fingerprints (icon-accent / icon-palette-vibrant / shape-accent / shape-palette-vibrant) + 2 multi-decoration named slices (`multi-decoration-icon-slice`, `multi-decoration-shape-slice`).
- `.planning/phases/71-ai-emit-fork-rpc-comprehensive-parity-audit/71-V2.12-SHIP-GATES.md` (NEW) — 217-line single canonical v2.12 audit-gate enumeration with 9 gate-family sections, aggregate ship-gate table, carry-forward to v2.13+, manual QA items, sign-off block.

## Decisions Made

1. **Copy-paste helpers vs. hoist to fixtures module** — Chose copy-paste per the plan's fallback option. Rationale: Phase 69 PTF16 (`parity.template-fingerprint-decorations-undefined.test.tsx`) already established the precedent. PTF17 also needs an EXTENDED variant of `extractDecorationSlice` (accepts `decorationId` for multi-decoration extraction in Test 5), so a 1:1 hoist would have required either two helpers in the fixtures module or a parameterized version that PTF13/14/18 don't need. Copy-paste keeps PTF13/14/18 zero-regression-risk and lets PTF17 own its extended variant cleanly.
2. **Locked derived_palette fixture values** — `['#11AABB', '#22CCDD', '#33EEFF', '#44112233', '#5566FF77', '#778899']` — index 0 = `#11AABB` is what `palette-vibrant` resolves to (Phase 56 node-vibrant ordering: Vibrant=0). Other entries are present for schema validity but only index 0 is referenced. Documented in test file header — modifying values requires regenerating the 6 snapshots.
3. **TEST-ONLY pipe-through helper THROWS** — `pipeAIEmitToDecoration` calls `safeParse` and throws on `success === false`. Production ingest silent-drops; tests want loud failures. A typo'd `lucideName` in a fixture should fail CI immediately with the schema error message, not silently produce 0 decorations and then fail byte-identity with a confusing "decoration slice missing" diff.
4. **Test count + commit hash sourcing** — All 14 ship-gate test files run via `npx vitest run --reporter=verbose` and per-file counts extracted via awk; per-file commit hashes from `git log --oneline -- <file>`. No manual count drift; numbers in the ship-gate doc match the SUMMARY counts in upstream plans (verified by spot-check against 71-01/71-02 SUMMARYs).
5. **DEPS-01 commit reference** — Cited two commits: base lucide-react upgrade install (`bbd93be`, Phase 67-01) AND the bundle-delta verification doc completion (`e76f8fa`, Phase 67-02). The negative-bundle-delta evidence lives in the docs commit; the actual install lives in the chore commit. Both linked.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan offered a recommended "hoist helpers to parity-fingerprint-fixtures.ts" path AND a fallback "copy-paste" path. I picked the fallback (copy-paste) because PTF17 needed an extended variant of `extractDecorationSlice` (multi-decoration support via `decorationId` arg), which would have made the hoist non-trivial. This is documented as a Decision (item #1 above), not a deviation — the plan explicitly anticipated and authorized either path.

The plan also said "1-2 atomic commits"; I shipped 2 atomic commits (Task 1 = `a347858` test commit, Task 2 = `c187e1f` docs commit) — within the 1-2 range.

## Issues Encountered

- None. TDD RED-skip: PTF17 test file passed all 7 tests on first vitest run (snapshots written), and snapshot stability verified on second run. The Plan 71-01 resolver + DecorationSchema final-shape gate combine cleanly enough that fixture-mistake → silent-drop → byte-identity-fail was avoided by the throw-on-failure helper design.

## User Setup Required

None — this plan adds tests + a documentation file. No external service configuration, no environment variables, no new dependencies.

## Verification

```bash
# PTF17 first run (snapshots written) + second run (stability check)
npx vitest run src/lib/render/__tests__/parity.template-fingerprint-decorations-ai-emit.test.tsx
# → 7/7 GREEN; 6 snapshots stable

# PTF13/14/18 regression sweep
npx vitest run src/lib/render/__tests__/parity.template-fingerprint-decorations.test.tsx
# → 31/31 GREEN

# Combined PTF13/14/17/18
npx vitest run src/lib/render/__tests__/parity.template-fingerprint-decorations-ai-emit.test.tsx \
                src/lib/render/__tests__/parity.template-fingerprint-decorations.test.tsx
# → 38/38 GREEN

# Full Phase 71 suite (AI + migration)
npx vitest run src/lib/ai/__tests__/ supabase/migrations/__tests__/
# → 133/133 GREEN

# tsc baseline
npx tsc --noEmit | grep -c "error TS"
# → 17 (baseline preserved)

# Ship-gate doc structure checks
grep -c "^| " .planning/phases/71-ai-emit-fork-rpc-comprehensive-parity-audit/71-V2.12-SHIP-GATES.md
# → 45 table rows (≥20 required)
grep -E "PTF13|PTF14|PTF16|PTF17|PTF18|PCL11|PCL12|PCL13|PRA|PRS7|LP-NEW|SWEEP-PICK|DEPS-01|DEPS-05|MIGR-01|MIGR-02|AI-05" 71-V2.12-SHIP-GATES.md | wc -l
# → 44 gate references (≥17 required)
grep -c "GREEN" 71-V2.12-SHIP-GATES.md
# → 26 GREEN entries (≥15 required)
```

## Self-Check: PASSED

**Files verified to exist:**
- `src/lib/render/__tests__/parity.template-fingerprint-decorations-ai-emit.test.tsx`: FOUND
- `src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-ai-emit.test.tsx.snap`: FOUND (6 snapshots)
- `.planning/phases/71-ai-emit-fork-rpc-comprehensive-parity-audit/71-V2.12-SHIP-GATES.md`: FOUND

**Commits verified:**
- `a347858` (Task 1 — test PTF17 AI-emit parity fingerprint baseline): FOUND
- `c187e1f` (Task 2 — docs V2.12-SHIP-GATES.md enumerating all audit gates): FOUND

**Verification commands re-run at end:**
- PTF17 + PTF13/14/18: 38/38 GREEN
- Full AI + migration suites: 133/133 GREEN
- tsc baseline 17 preserved
- Ship-gate doc structural checks: 45 rows / 44 gate refs / 26 GREEN

## Cross-Refs

- **Plan 71-01:** Resolved `DecorationContent` from `resolveAIDecoration` is the input to PTF17's `pipeAIEmitToDecoration` helper. The resolver's `AI_POSITION_RECTS` locked safe-zone offsets are pinned by the PTF17 sanity test (`expect(decoration.position).toEqual({ x: 70, y: 8, width: 22, height: 16 })`).
- **Plan 71-02:** AI-05 advisory diversity check + MIGR-01 fork RPC migration both enumerated in the ship-gate doc (with commit hashes `cec0791` and `ffaef03`). PTF17 does not exercise these directly — the diversity check is post-ingest advisory and the fork RPC is server-side SQL.
- **Phase 69 PTF13/14/18:** Direct precedent for the cross-renderer + snapshot pin pattern. PTF17 helpers are copy-paste-extended variants of the Phase 69 helpers; helper-source comments cross-link.
- **Phase 67 PTF16:** Idempotent-absence baseline (73 tests). Cited in the ship-gate doc + this SUMMARY as the pre-v2.12 baseline that v2.12 cannot regress.

## Next Phase Readiness

- v2.12 milestone (Phases 67/68/69/70/71) is OFFICIALLY READY TO SHIP pending the 4 manual QA smoke tests enumerated in `71-V2.12-SHIP-GATES.md`. All 42 audit gates × 275 ship-gate tests GREEN.
- **Phase 72 — interactive rotation handles + PTF15 (45° rotated arrow byte-identical) — is post-v2.12-ship work.** v2.12 ships first; Phase 72 lands on top of v2.12's released schema + renderer.
- **v2.13 successors (carry-forward in ship-gate doc):**
  - Promote AI-05 from advisory → fail-CI (with retry-once)
  - Per-template `decorationWhitelist?` for premium templates
  - Live MIGR-02 integration test against a Supabase test instance (when test infra lands)
- Plan 71-03 closes PARITY-10 (PTF17). Phase 71 closes 1+4+2+1 = 7 of 7 phase requirements: AI-01..04 (Plan 71-01), AI-05 + MIGR-01 (Plan 71-02), PARITY-10 (Plan 71-03).

---
*Phase: 71-ai-emit-fork-rpc-comprehensive-parity-audit*
*Plan: 03*
*Completed: 2026-05-04*
