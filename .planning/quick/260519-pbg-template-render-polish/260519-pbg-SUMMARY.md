---
phase: quick-260519-pbg
plan: 01
subsystem: render-templates / text-box-adapter
tags: [template-polish, color-block, kicker-pill, accessory-label]
requires: [quick-260519-t3x]
provides:
  - "bold-yellow + y2k-pop: color-block kill-switch (suppress photos)"
  - "tr3nding-news: TR3NDING kicker moved out of photo subject zone"
  - "accessory_label: top-center kicker pill instead of top-left plain text"
affects:
  - src/lib/render/templates/bold-yellow.ts
  - src/lib/render/templates/y2k-pop.ts
  - src/lib/render/templates/tr3nding-news.ts
  - src/lib/editor/text-box-adapter.ts
tech-stack:
  added: []
  patterns:
    - "backgroundMode: 'color' kill-switch (mirror of paper-essay/soft-sage)"
    - "overlay slot 'top-left' for magazine-kicker placement"
    - "text_box with effects.highlight = synthesized pill for at-AI-ingest defaults"
key-files:
  modified:
    - src/lib/render/templates/bold-yellow.ts
    - src/lib/render/templates/y2k-pop.ts
    - src/lib/render/templates/tr3nding-news.ts
    - src/lib/editor/text-box-adapter.ts
    - 3 parity-fingerprint snapshot files (additive bg color suppression)
decisions:
  - "Accept the BREAKING change for bold-yellow/y2k-pop: existing carousels with persisted slide.background_url will now render the solid color instead of the photo (slide.background_url is preserved in DB; only the renderer suppresses it)"
  - "TR3NDING pill goes to top-left kicker (user-approved 2026-05-19 via AskUserQuestion; 4 options surveyed: top-left / top-right-stacked / above-bottom-card / remove)"
  - "accessory_label fix is at-AI-ingest only — user-dragged positions on existing slides still win"
metrics:
  duration: ~30m
  completed: 2026-05-19

commits:
  - ebc0903 fix: backgroundMode 'color' for bold-yellow + y2k-pop
  - 33c5226 fix: move TR3NDING pill from mid to top-left kicker
  - 75f90ea fix: style + center accessory_label as a real kicker
---

# Phase quick-260519-pbg Plan 01: Template render polish — Summary

Three coupled bugs surfaced during real-world testing of quick-260519-t3x's
three new templates (Chrome Pulse, Sunset Tabloid, Soft Sage). All three
are template / text-box-adapter changes that improve render quality for
NEW generations without losing data on existing carousels.

## What shipped

### Commit 1 — `ebc0903` color-block kill-switch
- `bold-yellow.ts`: added `backgroundMode: 'color'` — Brittany-Broski
  yellow color-block now suppresses any persisted slide.background_url.
- `y2k-pop.ts`: same — hot-pink color-block stays a color block.
- **BREAKING:** existing carousels using these templates with a saved
  Pexels photo will render the solid color instead at next paint.
  `slide.background_url` is preserved in the DB; only the renderer
  suppresses it.

### Commit 2 — `33c5226` TR3NDING pill move
- `tr3nding-news.ts`: the literal `TR3NDING` overlay's `position`
  changed from `'mid'` (top:55% center) to `'top-left'`.
  - Why: the mid slot landed dead-center on the photo subject's face on
    most stock photography. The user flagged this on their "TRUMP MOVES
    TO UNBLOCK NVIDIA CHIPS FOR CHINA" generation where the pill sat
    over Karoline Leavitt's body.
  - Top-left is the magazine-kicker convention — above the headline,
    out of the photo's central focus zone.
- Pill geometry (black bg, mint text, pill border-radius) is unchanged.
  Only the slot moved.

### Commit 3 — `75f90ea` accessory_label kicker styling
- `text-box-adapter.ts:legacyToTextBoxes`: changed the at-AI-ingest
  default for the accessory_label text_box.
- Pre-fix: anchor `'top'` resolved to `left:0% / top:0% / width:60%
  text-align:left` — visually a top-LEFT plain text with no background,
  low contrast on photos, AND collides with the new TR3NDING top-left
  kicker.
- Post-fix: top-center band (x:20, y:3, width:60), center-aligned,
  white text, tight black 80%-alpha highlight pill (8px padding).
  Reads as a proper kicker on any background. Unit-verified via
  direct `legacyToTextBoxes` invocation.

## Verification

- Test suites: 939 AI + editor tests pass; 246 template-render tests
  pass after snapshot updates.
- Playwright E2E: regenerated chrome-pulse + sunset-tabloid + soft-sage
  via the picker → AI → renderer pipeline. All three templates render
  correctly with the auto-fit + override-strip fixes from
  quick-260519-t3x's `82d7798`.
- TR3NDING new position: thumbnail rendered via `npm run thumbs`,
  visually verified the pill is top-left, headline + body untouched.
- accessory_label: direct legacyToTextBoxes invocation confirmed the
  new text_box structure (top-center anchor + center text-align +
  white color + black highlight pill).

## Deferred / out of scope

- The accessory_label visual on a real generation needs a Gemini emit
  that actually includes an accessory_label. The Chrome Pulse Kicker
  Test generation today emitted none (Gemini's "sparing" emit policy).
  The fix is unit-verified; visual will appear on the next generation
  that emits one.
- The tr3nding-news mid-pill move means existing carousels rendered
  under the old position will now show the pill top-left. That's the
  intended fix per user approval, but worth noting if any cached
  marketing screenshots reference the old position.
