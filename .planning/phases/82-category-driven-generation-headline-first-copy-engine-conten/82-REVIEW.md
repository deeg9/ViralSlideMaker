---
phase: 82
slug: category-driven-generation-headline-first-copy-engine-conten
status: clean
depth: standard
reviewed: 2026-05-17T14:20:00Z
files_reviewed: 29
critical: 0
warning: 0
info: 2
---

# Phase 82 — Code Review

> **Plan 04 re-review (2026-05-17T14:20) — appended below.** The original
> review (24 files, the category-generation pipeline) is unchanged and still
> CLEAN. The Plan 04 re-review adds 5 template-curation files; overall status
> stays CLEAN (0 critical, 0 warning).

---

# Original review

**Depth:** standard · **Scope:** 24 source files changed by Phase 82 commits
(`72240e7`, `adf8068`, `a7516b1`, `f4fec26`).

## Verdict: CLEAN

No Critical or Warning findings. One Info observation (non-blocking).

## Files reviewed

Schema/AI: `schemas.ts`, `generate-slides.ts`, `validate-slides.ts`, `prompts.ts`,
`categories/{types,news,facts,index}.ts`, `text-box-adapter.ts`.
Generation: `actions.ts`, `carousel.ts`, `api/v1/carousel/route.ts`.
Types: `slide.ts`, `project.ts`. Migration: `20260517_phase82_projects_category.sql`.
UI: `category-selector.tsx`, `generation-form.tsx`, `template-picker.tsx`, `page.tsx`.
Consumer guards: `render-slide.ts`, `render-slide-satori.tsx`, `ai-generate-tab.tsx`,
`text-editor-panel-legacy.tsx`, `scripts/test-murphy-carousel.ts`.

## Findings

### Info — I-01: legacy news addendum coexists with the category block
`prompts.ts` keeps the legacy `NEWS_TEMPLATES`/`newsDropAddendum` branch active. When a
news category AND a news template are both selected, the assembled prompt carries both
the category block and the legacy news addendum. They are consistent in intent (both
instruct headline + accent), so this is mild redundancy, not a bug. The category block
is explicitly marked authoritative. No fix required — left intentionally for back-compat
(category-absent legacy callers still need the addendum).

## Checks passed

- **No import cycles** — `categories/` imports nothing from `prompts`/`generate-slides`/
  `templates`; `prompts` imports `categories` one-directionally.
- **Public-by-default** — `autoPublishOnGenerate` preserved on both generation paths;
  no early-return between generation success and the autoPublish call.
- **No security issues** — `category` is a closed-enum allowlist lookup (`getCategory`);
  the v1 API validates `category` before use; prompt text is static module content with
  no untrusted interpolation.
- **Schema consistency** — `body_text` optionality is consistent across Zod, the Gemini
  `responseSchema`, and the `Slide` TS type; the 6 consumer `?? ''` guards are byte-safe
  for the render-parity invariant.
- **Type safety** — `npx tsc --noEmit` at the 19-error pre-existing baseline (no new
  errors introduced by Phase 82).
- **Tests** — Phase-82 source-scope vitest run is green (399 passing) after removing a
  dead residual worktree that was running a stale pre-fix test copy.

## Note

A dead residual worktree (`.claude/worktrees/agent-a5b1874532af3a920/`) was producing a
phantom test failure during review — it was running a stale copy of
`slides-with-text-boxes.test.ts` from before the Plan 03 fix. Removed during review.

---

# Plan 04 re-review (template curation)

**Reviewed:** 2026-05-17T14:20:00Z · **Depth:** standard · **Status:** CLEAN
**Scope (5 files):** `templates/index.ts`, `templates/news-cyan.ts`,
`templates/__tests__/keeper-curation.test.ts`, `slides/template-picker.tsx`,
`vitest.config.ts` — the files touched by Plan 04 commit `abab1f9`.

## Verdict: CLEAN

No Critical or Warning findings. One Info observation (addressed during review).

## Findings

### Info — I-02: vitest.config.ts initially replaced (not extended) the default exclude
The first form of the new `test.exclude` array was a hand-written list. Vitest's
`exclude` *replaces* the built-in defaults rather than extending them, so the
default config-file / cypress exclusions were dropped. Harmless here (no
`cypress/` dir; no `*.config.*` matches the test glob) but fragile.
**Fix (APPLIED during review):** changed to
`exclude: [...configDefaults.exclude, '**/.claude/worktrees/**']`, importing
`configDefaults` from `vitest/config`. Verified: keeper-curation suite still
passes; zero worktree files collected.

## Checks passed

- **HIDDEN_FROM_PICKER** — set updated to exactly the 7 approved culled ids;
  the `pickerTemplates` filter expression and the `getTemplate` body are
  unchanged — culled templates still resolve (hide-not-delete back-compat).
- **news-cyan polish** — pure `SlideTemplate` config change; `backgroundMode`/
  `overlays` correctly left undefined so the template keeps the legacy newsZone
  full-bleed path; tsc clean, lint:gates pass.
- **TemplatePicker category filter** — `visibleTemplates` intersection is safe:
  `keeper-curation.test.ts` guarantees every category `templateIds` entry is a
  picker-visible keeper, so the filtered list is never empty.
- **No import cycle** — the category-coverage invariant is enforced by the
  keeper-curation test rather than by importing the category registry into
  `templates/index.ts` (which would create a render↔ai cycle).
- **keeper-curation.test.ts** — 6 well-formed assertions; covers the keeper set,
  culled-renderer resolution, registry integrity, and category coverage.
- **Render-parity** — the `news-cyan` snapshot regen is scoped to `news-cyan`
  only; every other template byte-identical (verified via `git diff`).

---

## R10 round 2 re-review (2026-05-17) — Plans 08 + 09 (Gaps D + E)

**Appended below.** The earlier reviews are unchanged. This re-review adds the
6 Plan 08+09 source files; overall status stays **CLEAN** (0 critical, 0 warning).

**Scope:** commits `d0763ed` (Plan 08), `28c4d5e` (Plan 09).
**Files reviewed:** `hook-fit.ts`, `promote-news-headline.ts`, `resolve-overlay.ts`,
`render-slide-satori.tsx`, `render-slide.ts`, `slide-preview.tsx`.

### Critical / Warning
None.

### Info

1. **News-layout gate expressed three ways (consistency, not a bug).**
   `render-slide-satori.tsx` passes `newsZone != null`; `slide-preview.tsx` +
   `render-slide.ts` pass `isNewsLayoutSlide` (`template.backgroundMode == null
   && overrides.layout != null`). Verified equivalent — in Satori `newsZone` is
   non-null exactly when `backgroundMode == null && overrides.layout` (truthy
   ⟺ `!= null` for the `'cover' | 'body'` union). The full render-parity sweep
   confirms it (43 pre-existing failures HEAD = 43 after, zero new). Cosmetic.

2. **`render-slide.ts` numeric fallback `parseInt(template.hookFontSize) || 64`.**
   Pre-change the HTML path used `template.hookFontSize` verbatim; every real
   template uses the `'Npx'` format so `parseInt` is byte-identical. Confirmed
   by the full render-parity sweep showing zero new failures.

### Verdict — CLEAN

- `fitHeadlineToBox` / `captionCardBox` are pure, bounded (ceiling 240 / floor
  64), never throw on string input.
- The `hook-fit.ts` ↔ `resolve-overlay.ts` cycle is correctly broken via
  `import type` for `ResolvedCaptionBar`.
- `resolveNewsHeadlineFit` is a strict no-op for non-news / no-caption-card
  slides — byte-identity preserved.
- The k2n caption-card rework is untouched (caption-card markup unchanged in all
  three paths; `resolveCaptionBar` read-only consumed; no circular import).
- Snapshot regeneration is narrow + intentional (only the `overflow-wrap:
  break-word → normal` flip; no unrelated template changed — verified via
  `git diff`).

No fix pass required.
