---
phase: 82
slug: category-driven-generation-headline-first-copy-engine-conten
status: clean
depth: standard
reviewed: 2026-05-17
files_reviewed: 24
critical: 0
warning: 0
info: 1
---

# Phase 82 — Code Review

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
