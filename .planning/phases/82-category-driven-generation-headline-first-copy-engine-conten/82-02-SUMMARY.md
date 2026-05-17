---
phase: 82-category-driven-generation-headline-first-copy-engine-conten
plan: 02
subsystem: ai
tags: [category-registry, prompt-module, news, facts, headline-first]

requires: []
provides:
  - "src/lib/ai/categories/ registry mirroring templates/index.ts"
  - "CategoryModule interface; ContentCategory string-literal union; getCategory()"
  - "News + Facts headline-first prompt modules with default templateIds"
affects: [82-03, 82-04, 82-05]

tech-stack:
  added: []
  patterns:
    - "Registry module: typed interface + array export + closed id enum + id-keyed getter"

key-files:
  created:
    - src/lib/ai/categories/types.ts
    - src/lib/ai/categories/news.ts
    - src/lib/ai/categories/facts.ts
    - src/lib/ai/categories/index.ts
    - src/lib/ai/categories/__tests__/registry.test.ts
  modified: []

key-decisions:
  - "getCategory() returns undefined for unknown ids — generation code treats unknown as a hard error, no silent fallback (R7)"
  - "News default template = news-cyan; Facts default = bold-yellow (Plan 04 owns the final keeper set and reconciles)"
  - "CategoryModule.ready flag distinguishes shipping categories from framework-only placeholders"

patterns-established:
  - "Category framework: drop in a module + register it; prompt assembly and routing unchanged"
---

# Plan 82-02 Summary — Category registry + News/Facts prompt modules

## What was built

The extensible content-category framework (R1) plus the two shipping headline-first
prompt modules (R2 News, R3 Facts), in a new `src/lib/ai/categories/` directory that
mirrors the `src/lib/render/templates/index.ts` registry pattern.

- **`types.ts`** — the `CategoryModule` interface: `id`, `label`, `tagline`, `ready`,
  `templateIds` (ordered; `[0]` is the default template), `buildPrompt()`.
- **`news.ts`** — `newsCategory`: all-caps tabloid register, one big headline per slide,
  `hook_segments` with newsworthy proper nouns/numbers `accent: true`, body text omitted,
  photojournalism `image_query`, optional sparse `accessory_label` kicker. Default
  template `news-cyan`, secondary `tr3nding-news`.
- **`facts.ts`** — `factsCategory`: one punchy fact per slide as a headline, key
  numbers/terms accented, body omitted, optional sparse one-liner label. Default
  template `bold-yellow`, plus `editorial-serif`, `y2k-pop`.
- **`index.ts`** — the registry: `CATEGORIES`, `CONTENT_CATEGORIES` (closed tuple),
  `ContentCategory` union, `getCategory()` (returns `undefined` for unknowns),
  `DEFAULT_CATEGORY = 'news'`.

## Verification

- `registry.test.ts` — 7 tests passing (CATEGORIES has News+Facts both ready,
  getCategory resolves + returns undefined for unknowns, non-empty templateIds with a
  string default, CONTENT_CATEGORIES/DEFAULT_CATEGORY correct, News/Facts prompts are
  headline-first + body-omitting).
- tsc — no errors in `categories/`.
- `buildFromSpecPrompt` (v2.13) untouched — Plan 02 created only new files.

## Unblocks

Plan 03 (generation wiring — `buildSystemPrompt` selects the module by category).
