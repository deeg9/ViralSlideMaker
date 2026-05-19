---
phase: 85
slug: recipe-driven-generation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
---

# Phase 85 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively from phase
> artifacts (PLAN/SUMMARY/VERIFICATION) — phase was executed and verified
> `passed` (RECGEN-01, 4/4 success criteria) before this validation audit ran.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <test-file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1s (phase 85 files) / ~3min (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the task's `npx vitest run <file>`
- **After every plan wave:** Run `npx vitest run src/lib/ai src/lib/services 'src/app/(dashboard)/project'`
- **Before `/gsd-verify-work`:** Full suite must hold at the established baseline
- **Max feedback latency:** ~2 seconds (per-file)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 85-01 | 01 | 1 | RECGEN-01 (SC1) | — | `applyLayoutRecipe` pure projection — recipe caption-card/hook/text_align → existing `caption_bar_*`/`hook_position`/`hook_font_size` fields; null recipe = no-op early-return; zero new slide fields; zero Gemini calls | unit | `npx vitest run src/lib/ai/__tests__/layout-recipe-apply.test.ts` | ✅ | ✅ green |
| 85-02 | 02 | 2 | RECGEN-01 (SC1) | — | Both `generateCarousel` paths wired through `applyLayoutRecipe` before save; `resolveLayoutRecipe` returns null for code templates / DB error / bad parse (never throws); `autoPublishOnGenerate` preserved on both paths | integration | `npx vitest run src/lib/services/__tests__/carousel-recipe-generation.test.ts` | ✅ | ✅ green |
| 85-03 | 03 | 3 | RECGEN-01 (SC2) | — | Recipe-carrying News Oracle generation comes out Oracle-shaped (blended cover card, big centered headline, full-bleed photo, cyan pills, "Trending" label preserved) | integration | `npx vitest run src/lib/services/__tests__/carousel-recipe-generation.test.ts` | ✅ | ✅ green |
| 85-03 | 03 | 3 | RECGEN-01 (SC3) | T-back-compat | **Hard gate** — flat-style-only (no-recipe) generation persists byte-identical `slide_data` across two runs; no recipe geometry leaks onto a no-recipe cover | integration / regression | `npx vitest run src/lib/services/__tests__/carousel-recipe-generation.test.ts` | ✅ | ✅ green |
| 85-03 | 03 | 3 | RECGEN-01 (SC4) | T-public-default | **Hard gate** — newly generated recipe-shaped carousels default to Public; `autoPublishOnGenerate` called exactly once on both `generateCarousel` paths (recipe + no-recipe) | integration / regression | `npx vitest run 'src/app/(dashboard)/project/[id]/__tests__/actions-recipe-generation.test.ts'` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage:** 24/24 tests across 3 files pass — `layout-recipe-apply.test.ts`
(13), `carousel-recipe-generation.test.ts` (7, API-service path),
`actions-recipe-generation.test.ts` (4, dashboard server-action path).

---

## Wave 0 Requirements

Existing infrastructure (vitest + `vitest.config.ts`) covers all phase
requirements. No framework install or stub scaffolding was required. Gemini is
mocked at the `generateSlideContent` boundary (per the existing
`carousel-from-references.test.ts` precedent) and `resolveLayoutRecipe` is
mocked deterministically — `applyLayoutRecipe` itself runs real, so the genuine
projection + both pipeline wirings are exercised with no live DB and no network.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Both hard gates — SC3
(byte-identical no-recipe generation) and SC4 (public-by-default) — have
dedicated named regression tests on both `generateCarousel` paths. The
`feedback_public_by_default` recurring regression risk is explicitly covered
by the SC4 per-path `autoPublishOnGenerate` assertions.

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

Retroactive audit (State B — reconstructed from artifacts). RECGEN-01 and all
4 success criteria — including both hard gates (SC3 byte-identical, SC4
public-by-default) — were already COVERED by dedicated test files delivered
during execution. Phase 85's 3 test files re-run green (24/24) at audit time.
No gaps to fill; no test files generated. No manual-only verifications.
