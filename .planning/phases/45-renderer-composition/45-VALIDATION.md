---
phase: 45
slug: renderer-composition
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + jsdom 29 + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` (existing — no changes) |
| **Quick run command** | `npx vitest run src/lib/render/resolve-overlay.test.ts src/__tests__/render/render-slide-satori.test.tsx src/__tests__/components/slide-preview-overlays.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5s quick / ~45s full |

---

## Sampling Rate

- **After every task commit:** Run quick command (target test files for the task)
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green plus `npm run build` clean
- **Max feedback latency:** 60 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 1 | TPLREND-03 | — | resolveOverlayContent returns correct strings for all 3 OverlayContent types | unit | `npx vitest run src/lib/render/resolve-overlay.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-02 | 01 | 1 | TPLREND-01 | — | SLOT_GEOMETRY exposes pixel anchors for all 5 named slots | unit | `npx vitest run src/lib/render/resolve-overlay.test.ts` | ❌ W0 | ⬜ pending |
| 45-02-01 | 02 | 2 | TPLREND-01, TPLREND-02 | — | Satori buildSlideElement composes overlays + backgroundMode correctly | snapshot | `npx vitest run src/__tests__/render/render-slide-satori.test.tsx` | ❌ W0 | ⬜ pending |
| 45-02-02 | 02 | 2 | TPLREND-04 | — | Satori per-segment highlightColor renders pill spans | snapshot | `npx vitest run src/__tests__/render/render-slide-satori.test.tsx` | ❌ W0 | ⬜ pending |
| 45-02-03 | 02 | 2 | TPLREND-03 | — | Server callsites pass slideIndex/totalSlides ctx to buildSlideElement | grep | `grep -rn 'buildSlideElement(' src/ \| grep -E ', \\{ slideIndex'` | ✅ | ⬜ pending |
| 45-03-01 | 03 | 3 | TPLREND-05 | — | <SlidePreview> overlay DOM signature matches Satori snapshot | DOM render | `npx vitest run src/__tests__/components/slide-preview-overlays.test.tsx` | ❌ W0 | ⬜ pending |
| 45-03-02 | 03 | 3 | TPLREND-05 | — | Editor callsites pass slideIndex/totalSlides props to <SlidePreview> | grep | `grep -rn '<SlidePreview' src/components/ \| grep slideIndex` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/render/resolve-overlay.test.ts` — unit stubs for TPLREND-01/03
- [ ] `src/__tests__/render/render-slide-satori.test.tsx` — Satori snapshot stubs for TPLREND-01/02/04
- [ ] `src/__tests__/components/slide-preview-overlays.test.tsx` — DOM signature stubs for TPLREND-05

*Reuses existing vitest 4.1.0 infrastructure — no new framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Murphy reference visual fidelity | TPLREND-01..05 | Pixel-perfect parity with reference image requires human eye; Phase 46 actually authors `magazine-bold` and exercises full render path | After Phase 46 ships `magazine-bold`, render carousel from project with B&W photo + topic and visually compare to `/Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_1.png` |
| Editor preview/PNG export visual parity | TPLREND-05 | DOM-signature test asserts structure but not pixel rendering; final visual confirmation needs human review | Open editor, set magazine-bold template, export PNG, open both preview and PNG side by side, confirm overlay positions and pill rendering match |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
