---
phase: 02
slug: ai-generation-and-image-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AIGEN-01 | unit | `npx vitest run src/__tests__/ai/generate-slides.test.ts -t "generates slides"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | AIGEN-02 | unit | `npx vitest run src/__tests__/ai/generate-slides.test.ts -t "structured content"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | AIGEN-03 | unit | `npx vitest run src/__tests__/ai/prompts.test.ts -t "hook patterns"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | REND-01 | unit | `npx vitest run src/__tests__/render/render-slide.test.ts -t "dimensions"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | REND-02 | integration | `npx vitest run src/__tests__/render/render-slide.test.ts -t "server render"` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | REND-03 | unit | `npx vitest run src/__tests__/download/zip-slides.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 2 | REND-04 | unit | `npx vitest run src/__tests__/render/render-api.test.ts -t "single download"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | TMPL-01 | unit | `npx vitest run src/__tests__/render/templates.test.ts -t "template selection"` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | TMPL-02 | unit | `npx vitest run src/__tests__/render/templates.test.ts -t "template properties"` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 1 | UIUX-03 | unit | `npx vitest run src/__tests__/components/slide-preview.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/ai/generate-slides.test.ts` — stubs for AIGEN-01, AIGEN-02 (mock Claude API)
- [ ] `src/__tests__/ai/prompts.test.ts` — stubs for AIGEN-03 (hook pattern validation)
- [ ] `src/__tests__/render/render-slide.test.ts` — stubs for REND-01, REND-02 (mock Puppeteer)
- [ ] `src/__tests__/render/render-api.test.ts` — stubs for REND-04 (API route tests)
- [ ] `src/__tests__/render/templates.test.ts` — stubs for TMPL-01, TMPL-02
- [ ] `src/__tests__/download/zip-slides.test.ts` — stubs for REND-03
- [ ] `src/__tests__/components/slide-preview.test.tsx` — stubs for UIUX-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual quality of rendered slides | REND-01 | Pixel-level visual inspection | Render sample slides, verify text legibility and layout |
| TikTok hook engagement quality | AIGEN-03 | Subjective content quality | Generate 5 prompts, review hook text for engagement patterns |
| Template visual style accuracy | TMPL-01 | Design aesthetic judgment | Generate with each template, verify distinct visual styles |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
