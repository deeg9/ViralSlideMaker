---
phase: 84
slug: layoutrecipe-model-extraction
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
---

# Phase 84 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively from phase
> artifacts (PLAN/SUMMARY/VERIFICATION) — phase was executed and verified
> `passed` (4/4 success criteria) before this validation audit ran.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <test-file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1s (phase 84 files) / ~3min (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the task's `npx vitest run <file>`
- **After every plan wave:** Run `npx vitest run src/lib/types src/lib/validators src/lib/ai`
- **Before `/gsd-verify-work`:** Full suite must hold at the established baseline
- **Max feedback latency:** ~2 seconds (per-file)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 84-01 | 01 | 1 | RECIPE-01 | — | `LayoutRecipe` typed role-keyed model; 7 closed-enum `as const` tuples defined once (PARITY-05 closed-enum invariant); numeric caption-card geometry | unit / type | `npx vitest run src/lib/types/__tests__/layout-recipe.test.ts` | ✅ | ✅ green |
| 84-02 | 02 | 2 | RECIPE-01 | T-injection | `parseLayoutRecipeSafe` zod firewall — closed-enum silent-drop, numeric range clamp, unknown-key stripping (prompt-injection defense); `.catchall(z.never())` defence in depth; every drop counted not thrown | unit | `npx vitest run src/lib/validators/__tests__/layout-recipe.test.ts` | ✅ | ✅ green |
| 84-03 | 03 | 2 | RECIPE-02 | — | `extractLayoutRecipe` pure deterministic — no Gemini call / no new AI tier; median-per-numeric, mode-per-enum; round-trips through validator; never throws on empty input | unit | `npx vitest run src/lib/ai/__tests__/layout-recipe-extract.test.ts` | ✅ | ✅ green |
| 84-03 | 03 | 2 | RECIPE-02 (SC4) | — | Oracle-pattern `Slide[]` fixture → `extractLayoutRecipe` reproduces the Oracle per-slide pattern (blended cover card / full-bleed body / CTA card) | integration | `npx vitest run src/lib/ai/__tests__/layout-recipe-extract.oracle.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage:** 50/50 tests across 5 files pass — `layout-recipe.test.ts` types
(8), `layout-recipe.test.ts` validators (13), `layout-recipe-extract.test.ts`
(15), `layout-recipe-extract.oracle.test.ts` (6), plus the
`silent-drop-counter` regression suite (the new `range_clamp` reason did not
break it).

---

## Wave 0 Requirements

Existing infrastructure (vitest + `vitest.config.ts`) covers all phase
requirements. No framework install or stub scaffolding was required. Both
requirements (RECIPE-01 model+validator, RECIPE-02 deterministic extraction)
were delivered with dedicated, pure-function test suites — no live DB, no AI
SDK, no network in any test.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Phase 84 is a model +
validator + pure-extraction phase — every requirement is a pure, deterministic
function fully exercisable in-process. Recipe storage (Phase 86) and recipe
application at generation time (Phase 85) are out of scope for Phase 84 and
validated in their own phases.

---

## Validation Sign-Off

- [x] All tasks have automated verify (no Wave 0 dependencies needed)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — no gaps found)
- [x] No watch-mode flags
- [x] Feedback latency < 5s (per-file)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-18

---

## Validation Audit 2026-05-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Retroactive audit (State B — reconstructed from artifacts). Both phase
requirements (RECIPE-01, RECIPE-02) plus the SC4 Oracle proof were already
COVERED by dedicated test files delivered during execution. Phase 84's 5 test
files re-run green (50/50) at audit time. No gaps to fill; no test files
generated. No manual-only verifications — the phase is pure deterministic code.
