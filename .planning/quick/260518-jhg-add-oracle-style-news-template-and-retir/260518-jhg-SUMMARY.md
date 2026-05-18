---
phase: quick-260518-jhg
plan: 01
subsystem: render-templates / ai-categories
tags: [template-picker, news, marketing-prep, hide-not-delete]
requires: []
provides:
  - "news-oracle SlideTemplate (picker-facing Oracle-style news keeper)"
  - "news-cyan retired from the picker (non-destructive)"
affects:
  - src/lib/render/templates/index.ts
  - src/lib/ai/categories/news.ts
  - src/lib/ai/prompts.ts
tech-stack:
  added: []
  patterns:
    - "hide-not-delete: HIDDEN_FROM_PICKER set, renderer + registry entry retained"
    - "append-at-end registration to preserve existing template indices"
key-files:
  created:
    - src/lib/render/templates/news-oracle.ts
  modified:
    - src/lib/render/templates/index.ts
    - src/lib/ai/categories/news.ts
    - src/lib/ai/prompts.ts
    - src/lib/render/templates/__tests__/keeper-curation.test.ts
    - src/__tests__/render/templates.test.ts
    - src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap
decisions:
  - "news-oracle classified as a non-overlay news template (newsZone full-bleed path, like news-cyan/news-drop)"
  - "templates.test.ts registry-count assertions updated 12->13 (intentional swap, test named in plan verify block)"
metrics:
  duration: ~18m
  completed: 2026-05-18
---

# Phase quick-260518-jhg Plan 01: Add Oracle-style News template and retire News Cyan from picker — Summary

Added a new picker-facing news template "News Oracle" capturing the polished
center-aligned style DNA of the user's "Oracle Layoff Analysis" carousel, and
retired `news-cyan` from the picker non-destructively (hide-not-delete) — all
marketing-launch prep so the template picker leads with a proven news look.

## What shipped

- **`src/lib/render/templates/news-oracle.ts`** — new `SlideTemplate` config:
  `id: 'news-oracle'`, Anton font (`hookFontWeight: 400`), near-black bg
  (`#0a0a0a`), 0.45 dark overlay for headline legibility, cyan accent
  (`#00E5FF`), `~130px` hook. The visual differentiator vs news-cyan/news-drop
  is `textAlign: 'center'` (Oracle hooks are centered). The `sample` mirrors
  the Oracle cover slide with 7 `hook_segments` (MASSIVE + SHAKEUP as accent
  pills via per-segment `highlightStyle: 'pill'`). No `overlays` /
  `backgroundMode` / `coverLayout` etc. — keeps the newsZone full-bleed path.
- **`index.ts`** — `newsOracle` imported and appended at the END of
  `templates[]` (preserves existing indices → registry-driven fingerprint test
  assigns it PTF13). `'news-cyan'` added to `HIDDEN_FROM_PICKER`. Doc comments
  on `HIDDEN_FROM_PICKER` / `pickerTemplates` updated for the swap.
- **`news.ts`** — News category `templateIds` repointed
  `['news-cyan','tr3nding-news']` → `['news-oracle','tr3nding-news']`
  (news-oracle becomes the News default; no category resolves to a hidden
  template — SPEC R7).
- **`prompts.ts`** — `'news-oracle'` added to the local `NEWS_TEMPLATES` set so
  `buildSystemPrompt('news-oracle')` emits the news prompt addendum like
  news-cyan. Registration plumbing only — prompt text untouched; the
  `carousel.ts` / `actions.ts` copies of `NEWS_TEMPLATES` left unchanged
  (out of scope — they gate photo-fetch behavior).
- **`keeper-curation.test.ts`** — `APPROVED_KEEPERS` swaps news-cyan →
  news-oracle (still 5 keepers), `CULLED_IDS` gains news-cyan (8 culled),
  registry-count assertion 12 → 13.
- **PTF13a/PTF13b fingerprints** — additive snapshot entries for news-oracle;
  PTF1..PTF12 / PTL1..PTL2 byte-identical (git diff: 4 insertions, 0
  modifications).

## TPLREND-05 invariant — SATISFIED

`news-cyan.ts` is byte-identical to the base commit
(`git diff --exit-code e47e075 HEAD -- src/lib/render/templates/news-cyan.ts`
is clean). `getTemplate('news-cyan')` still resolves. The `news-cyan` cases in
both legacy guards (`legacy-templates-byte-identical` JSON-hash +
`legacy-templates-regression` snapshot) PASS — the 3 existing news-cyan
carousels render byte-identically.

## Commits

| Task | Commit  | Description |
| ---- | ------- | ----------- |
| 1    | 6f57f40 | feat: add News Oracle template, retire News Cyan from picker |
| 2    | 4eb12e8 | feat: repoint News category + NEWS_TEMPLATES to news-oracle |
| 3    | 0cbb0a7 | test: add PTF13 render-parity fingerprints for news-oracle |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `templates.test.ts` registry-count + id-classification**
- **Found during:** Task 1
- **Issue:** `src/__tests__/render/templates.test.ts` (named in Task 1's
  `<verify>` block) had two hardcoded `toHaveLength(12)` assertions and an
  `else { throw 'unexpected template id' }` branch that would reject the new
  `news-oracle` id.
- **Fix:** Updated both length assertions 12 → 13 and added `'news-oracle'` to
  the no-overlay `legacyIds` set (news-oracle is a non-overlay news template,
  same render path as news-cyan/news-drop). The plan instructed the parallel
  registry-count update in `keeper-curation.test.ts`, so this is the same
  intentional swap reflected in an adjacent test the plan's verify step runs.
- **Files modified:** `src/__tests__/render/templates.test.ts`
- **Commit:** 6f57f40

This file was not in the plan's `files_modified` list but is named in Task 1's
verification command and must reflect the intentional registry change.

## Deferred Issues

Two test files in the plan's full-regression sweep fail — both confirmed
**pre-existing** (failing identically at the original base commit `e47e075`
with zero changes from this task applied). Logged to `deferred-items.md`. Not
fixed (SCOPE BOUNDARY — only auto-fix issues caused by this task's changes):

1. **`src/__tests__/ai/prompts.test.ts`** — `buildSystemPrompt returns string
   containing all 6 hook patterns` (no-arg base-prompt path; untouched by this
   task; fixing it would alter prompt text — explicitly OUT OF SCOPE).
2. **`legacy-templates-byte-identical.test.ts` / `legacy-templates-regression.test.tsx`**
   — `news-drop`, `highlight-bar`, `y2k-pop`, `bold-yellow` stale-snapshot
   drift. None of these templates were modified by this task. `news-cyan`
   (the only template in scope for TPLREND-05) PASSES both guards.

## Verification

In-scope sweep (6 test files — templates, validate, keeper-curation,
category-generation, category-routing, parity-fingerprint): **85/85 pass.**
Fingerprint suite stable without `-u`. `news-cyan.ts` byte-identical. No
OUT-OF-SCOPE file (`style-spec-projector*.ts`, `validate-slides.ts`,
`newsDropAddendum` prompt text) modified.

## Self-Check: PASSED

- `src/lib/render/templates/news-oracle.ts` — FOUND
- Commits 6f57f40, 4eb12e8, 0cbb0a7 — all FOUND
- `newsOracle` registered in `index.ts` — confirmed
