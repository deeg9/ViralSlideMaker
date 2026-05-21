---
phase: 90
slug: pre-rendered-template-preview-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 90 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `90-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom env, `@vitejs/plugin-react`) |
| **Config file** | `vitest.config.ts` |
| **Setup file** | `src/__tests__/setup.ts` (ResizeObserver + getBoundingClientRect polyfills) |
| **Playwright** | `@playwright/test ^1.58.2` — picker smoke (PREVIEW-05) |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npx vitest run` |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched test file>` (< 30s)
- **After every plan wave:** full `npx vitest run` — the 3 render-parity fixture suites stay GREEN at 45/45, no NEW failures vs. the pre-v2.16 baseline
- **Phase gate:** full `npx vitest run` + the Playwright picker smoke green + a manual visual review of the 16 generated preview PNGs
- **Max feedback latency:** ~60s

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| PREVIEW-01 | All 16 code templates have a non-empty, URL-shaped `preview` | unit | `npx vitest run src/lib/render/templates/__tests__/code-template-previews.test.ts` | ❌ Wave 0 | ⬜ pending |
| PREVIEW-02 | Previews sourced from `christopherfill9@gmail.com` carousels; gaps generated | manual / live | the live pipeline run (Plan 2) | ⚠️ manual | ⬜ pending |
| PREVIEW-03 | Script: gap detection, deterministic path, idempotent rewrite | unit (pure helpers) | `npx vitest run scripts/__tests__/render-template-previews.test.ts` | ❌ Wave 0 | ⬜ pending |
| PREVIEW-03 | Live run populates Storage + source files | manual / live | `git diff` shows 16 `preview:` lines + 16 PNGs in bucket | ⚠️ manual | ⬜ pending |
| PREVIEW-04 | `<TemplateTilePreview>` is single-branch `<img>`, never `<SlidePreview>` | unit | `npx vitest run src/components/slides/__tests__/template-tile-preview.test.tsx` | ✅ REWRITE | ⬜ pending |
| PREVIEW-05 | Picker renders all tiles as `<img>` with valid `src`, no broken images; DB templates too | unit + e2e | `npx vitest run src/__tests__/components/template-picker.test.tsx` + Playwright smoke | ✅ REWRITE + ❌ smoke Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/manual*

---

## Wave 0 Requirements

- [ ] `src/lib/render/templates/__tests__/code-template-previews.test.ts` — asserts every `templates[]` entry has a non-empty, URL-shaped `preview`. Locks PREVIEW-01 + the forcing function.
- [ ] `scripts/__tests__/render-template-previews.test.ts` — unit tests for the script's pure helpers (gap-map builder, `code-templates/{slug}.png` path builder, idempotent source-file rewriter). Requires the script to export these helpers separately from `main()`.
- [ ] Playwright picker smoke spec — navigates to the project picker, asserts every tile is an `<img>` with non-empty `src`, asserts zero `data-testid="slide-preview"` nodes, checks no broken images (`naturalWidth > 0`). Use `mcp__playwright__browser_click` for any React interaction (project memory `feedback_playwright_react_clicks`).
- [ ] REWRITE `src/components/slides/__tests__/template-tile-preview.test.tsx` — current 3 tests assert the two-branch fallback; after PREVIEW-04 assert `<img>` always.
- [ ] REWRITE `src/__tests__/components/template-picker.test.tsx` — current tests `getAllByTestId('slide-preview')`; after PREVIEW-04 assert `getAllByRole('img')` instead.
- [ ] No framework install needed — vitest + Playwright already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live pipeline run | PREVIEW-02/03 | Touches the real `christopherfill9@gmail.com` account, real Gemini spend, real Supabase Storage writes | Run `scripts/render-template-previews.ts`; confirm 16 PNGs land in the `template-previews/code-templates/` bucket path and `git diff` shows 16 `preview:` URL lines wired into `src/lib/render/templates/*.ts` |
| Preview visual quality | PREVIEW-01 | "Looks like what generation produces" is a human judgment | Visually review the 16 generated preview PNGs — each depicts its template with a real photo background + representative text |

---

## Validation Sign-Off

- [ ] Every requirement has an `<automated>` verify or a Wave 0 / manual dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the 2 new test files + the Playwright smoke + the 2 rewrites
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after planning

**Approval:** pending
