---
phase: 82-category-driven-generation-headline-first-copy-engine-conten
plan: 04
subsystem: ui
tags: [template-curation, keeper-signoff, hide-not-delete, render-parity]

requires:
  - phase: 82-02
    provides: "category registry — categories' templateIds the keeper list must cover"
provides:
  - "HIDDEN_FROM_PICKER reconciled to the user-approved 7-id cull list (pickerTemplates = 5 keepers)"
  - "category-filtered TemplatePicker (the picker `category` prop — landed in Plan 03)"
  - "news-cyan polished toward the reference news-headline style"
  - "keeper-curation test (templates/__tests__/keeper-curation.test.ts)"
  - "82-KEEPER-SIGNOFF.md — APPROVED by the user 2026-05-17 (SPEC R9)"
affects: [82-05]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - src/lib/render/templates/__tests__/keeper-curation.test.ts
  modified:
    - src/lib/render/templates/index.ts
    - src/lib/render/templates/news-cyan.ts
    - src/__tests__/render/__fixtures__/legacy-template-hashes.json
    - src/__tests__/render/__snapshots__/legacy-templates-regression.test.tsx.snap
    - src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap
    - src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap
    - src/lib/render/__tests__/__snapshots__/parity.style-spec-absent-baseline.test.tsx.snap
    - vitest.config.ts

key-decisions:
  - "R9 sign-off APPROVED by the user 2026-05-17 — curation committed."
  - "news-cyan polished WITHIN the existing field set (overlayOpacity 0->0.45, overlayColor #000000->#0a0a0a, hookFontSize 110->124px). backgroundMode/overlays left undefined ON PURPOSE: news-cyan already renders full-bleed via the legacy newsZone cover/body path; forcing backgroundMode would route it OFF that path and break the news-zone layout. The .toBeUndefined() guard in legacy-templates-regression.test.tsx therefore still passes."
  - "Render-parity scoped to news-cyan ONLY: the news-cyan polish changes 12 fingerprint snapshot keys (PTF3/PTF16/PTF74/PTL1) across 3 parity files + the news-cyan block in legacy-templates-regression.test.tsx.snap + the news-cyan entry in legacy-template-hashes.json. An initial blanket `-u` also regenerated the 4 OTHER stale legacy snapshots — those were reverted; only the news-cyan block was kept."
  - "vitest.config.ts: added `.claude/worktrees/**` to test.exclude — a live nested agent worktree was poisoning the test glob with phantom duplicate failures."

patterns-established: []
---

# Plan 82-04 Summary — Template curation (R8/R9) — COMPLETE

## Status: COMPLETE

The SPEC R9 keeper-list sign-off gate was **APPROVED by the user on 2026-05-17**
(`82-KEEPER-SIGNOFF.md`). Plan 04 Tasks 2-5 executed.

## (a) Approved keeper list + cull set

Recorded and approved in `82-KEEPER-SIGNOFF.md`:
- **Keepers (5, picker-visible):** `news-cyan` (News default), `tr3nding-news`
  (News), `bold-yellow` (Facts default), `editorial-serif` (Facts), `y2k-pop`
  (Facts).
- **Culled (7, hidden from picker — renderers RETAINED):** `highlight-bar`,
  `news-drop`, `magazine-bold`, `documentary`, `notes-app-chic`,
  `brutalist-grid`, `paper-essay`.

Both shipping categories are covered — `news.templateIds`
(`news-cyan`, `tr3nding-news`) and `facts.templateIds`
(`bold-yellow`, `editorial-serif`, `y2k-pop`) are all keepers; no category
resolves to a hidden template.

## (b) HIDDEN_FROM_PICKER update (Task 2)

`src/lib/render/templates/index.ts` — `HIDDEN_FROM_PICKER` reconciled to the
exact 7-id cull list (added `notes-app-chic` + `paper-essay` to the pre-existing
5). `pickerTemplates` (the existing `templates.filter(...)`) now yields exactly
the 5 keepers. `getTemplate()`, the `templates` array (all 12), and the filter
expression are unchanged — culled renderers stay registered and resolvable.

## (c) Category-aware picker (Task 3)

The `TemplatePicker` `category` prop + `visibleTemplates` filter
(`pickerTemplates` ∩ category `templateIds`, ordered by `templateIds`, falling
back to all keepers when no category) was landed in Plan 03's commit `a7516b1`.
Verified present and correct — no further change needed.

## (d) news-cyan polish + the single intentional parity-snapshot change (Task 4/5)

`src/lib/render/templates/news-cyan.ts` polished toward the reference
news-headline look, WITHIN the existing `SlideTemplate` field set:
- `overlayOpacity` `0` → `0.45` — dark tint over the full-bleed photo so the
  white headline reads against bright news imagery.
- `overlayColor` `#000000` → `#0a0a0a` — matches the template's near-black.
- `hookFontSize` `110px` → `124px` — headline is the dominant focal element.
- `hookStyle` stays `'uppercase'`; `accentColor` stays cyan `#00E5FF`.
- `backgroundMode`/`overlays` deliberately left **undefined** — news-cyan
  already renders full-bleed via the legacy newsZone cover/body path; that path
  also leaves room for the top-anchored accessory_label.

**Render-parity diff is scoped to `news-cyan` ONLY** (verified via `git diff`):
- 12 fingerprint snapshot keys (PTF3, PTF16, PTF74, PTL1 — all `(news-cyan)`)
  across `parity.template-fingerprint`, `parity.template-fingerprint-decorations-undefined`,
  `parity.style-spec-absent-baseline`.
- the `legacy-news-cyan` block in `legacy-templates-regression.test.tsx.snap`.
- the `news-cyan` entry in `legacy-template-hashes.json`
  (`9fef19b3…` → `4875445c…`).
- **Every other template's snapshot is byte-identical to HEAD.** An initial
  blanket `-u` had also regenerated 4 other stale legacy snapshots
  (pre-existing `quick-260515-o75` WYSIWYG-casing drift, unrelated to Phase 82) —
  those were reverted; only the news-cyan block was retained.

## (e) Back-compat (hide-not-delete) holds

`keeper-curation.test.ts` (6 tests, all passing) asserts: every culled id still
resolves via `getTemplate(culledId)` to its real renderer; the registry still
holds all 12 templates; every category `templateIds` entry is a picker-visible
keeper. Saved projects referencing a culled template render unchanged.

## (f) Plan 05 unblocked

Plan 05 (structural verification suite + R9/R10 gates) was already executed; the
keeper-curation suite added here complements it. No remaining Plan 05 work.

## Pre-existing out-of-scope failures (NOT introduced by this plan)

The render-parity sweep has 16 pre-existing failures (baseline before Plan 04
had 18; this plan reduced it by 2 — `news-cyan` legacy-regression + byte-identical
both now pass). The remaining 16 (`highlight-bar`, `news-drop`, `y2k-pop`,
`bold-yellow`, `magazine-bold`, `tr3nding-news`, and the `render-slide-satori`
overlay suite) are stale snapshots from the `quick-260515-o75` WYSIWYG
hook-casing fix that were never re-snapshotted — pre-dating Phase 82, outside
Plan 04's scope. Flagged for a follow-up snapshot-refresh task.
