---
phase: 82-category-driven-generation-headline-first-copy-engine-conten
plan: 04
subsystem: ui
tags: [template-curation, keeper-signoff, hide-not-delete, render-parity, BLOCKED]

requires:
  - phase: 82-02
    provides: "category registry — categories' templateIds the keeper list must cover"
provides:
  - "category-filtered TemplatePicker (the picker `category` prop — landed early in Plan 03)"
  - "82-KEEPER-SIGNOFF.md — proposed keeper list, PENDING user approval"
affects: [82-05]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/82-category-driven-generation-headline-first-copy-engine-conten/82-KEEPER-SIGNOFF.md
  modified: []

key-decisions:
  - "BLOCKED at the SPEC R9 keeper-list sign-off gate — autonomous run has no interactive question channel; curation must NOT be committed without user approval"
  - "TemplatePicker category-filtering (Plan 04 Task 3) was landed in Plan 03 to keep Plan 03 committable — the picker prop + filtering is done"

patterns-established: []
---

# Plan 82-04 Summary — Template curation — BLOCKED on R9 sign-off

## Status: BLOCKED

Plan 04 is **blocked at Task 1, the SPEC R9 keeper-list sign-off gate**. SPEC R9
mandates the user approve the ~4-6 keeper list BEFORE any template is hidden. This
autonomous run has no interactive question (`AskUserQuestion`) channel, so the
curation change (Tasks 2-5) is NOT committed.

## What was done

- **`82-KEEPER-SIGNOFF.md`** — a proposed ~5-keeper list is recorded for the user to
  review, with per-template reasoning and category coverage:
  - Keepers: `news-cyan` (News default), `tr3nding-news` (News), `bold-yellow` (Facts
    default), `editorial-serif` (Facts), `y2k-pop` (Facts).
  - Cull list: `highlight-bar`, `news-drop`, `magazine-bold`, `documentary`,
    `notes-app-chic`, `brutalist-grid`, `paper-essay` — hidden from the picker,
    renderers retained.
- **TemplatePicker category-filtering** (Plan 04 Task 3) was landed in Plan 03's commit
  (`a7516b1`) — the `category` prop + `visibleTemplates` filter to the category's
  `templateIds` subset is done and tested.

## What is BLOCKED (Tasks 2-5)

- Task 2 — update `HIDDEN_FROM_PICKER` to the approved cull set.
- Task 4 — polish `news-cyan` toward the reference (full-bleed photo + dark gradient
  + kicker).
- Task 5 — keeper-curation test + intentional `news-cyan` parity-snapshot regen.

These require the user to approve the keeper list in `82-KEEPER-SIGNOFF.md` first.

## Mitigations already in place

- **No silent highlight-bar fallback (R7)** — already satisfied by Plan 03's
  effective-template resolution: a category always resolves to a curated template, with
  or without the picker cull.
- **Category coverage** — all 5 proposed keepers are already picker-visible, so the
  category-filtered picker works correctly today.

## Resume

After the user approves the keeper list, run:
`/gsd-execute-phase 82 --no-transition` (Plan 04 Tasks 2-5 + parity-snapshot regen).
