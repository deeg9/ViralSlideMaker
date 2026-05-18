---
phase: quick-260518-ch8
plan: 01
subsystem: render
tags: [caption-card, render-parity, hook-fit]
---

# Quick Task 260518-ch8: Caption Card Height + Edge Blend Summary

Added a Height slider and an Edge blend toggle/amount slider to the Caption Card
panel, wired through the shared `captionCardBackgroundStyle` resolver helper so
the gradient renders identically in the canvas preview, the Satori PNG export,
and the HTML export.

## Checkpoint Feedback Fix

**Reported bug:** Dragging the new Caption Card **Height slider** also resized
the **news headline text** rendered inside the card (verified at Height 90% — the
headline "ORACLE CUTS 30,000" was blown up to fill the enlarged card). The user's
ask: the Height slider must be the card's own visual property and must not affect
any other layer or element.

**Root cause:** `resolveNewsHeadlineFit()` in `src/lib/render/resolve-overlay.ts`
re-fits the news headline via `fitHeadlineToBox(hookText, captionCardBox(...))`.
`captionCardBox()` in `src/lib/render/hook-fit.ts` derived the fit box's
`heightPx` from `resolved.heightPct` — the user-controlled
`caption_bar_height_pct`. A taller card therefore enlarged the fit box height,
letting `fitHeadlineToBox` pick a larger font. The coupling fired on all three
render paths (preview, Satori PNG, HTML) because they share the resolver. Body
text and custom text boxes were unaffected — the headline was the only coupled
element.

**Fix:** Decoupled the card's **height** from headline font sizing.
- Added `CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT = 38` in `hook-fit.ts` — a fixed
  reference height equal to the existing default `caption_bar_height_pct`.
- `captionCardBox()` now derives `heightPx` from that fixed constant instead of
  `resolved.heightPct`. The headline auto-fit no longer reads the user-controlled
  caption height.
- **WIDTH coupling kept** — `captionCardBox().widthPx` still tracks
  `caption_bar_width`, preserving the Phase 82 horizontal-overflow / mid-word-break
  safety. Only the HEIGHT dimension was decoupled.
- `resolveCaptionBar()` reuses the same named constant for its `?? 38` default so
  the resolver default and the fit reference stay in lockstep.
- **Byte-identity:** a slide at the default caption height (38%) re-fits
  byte-identical before and after — the reference height equals the old default.
  Only non-default heights change behavior: they now match the 38% result
  instead of scaling with the slider.
- Updated the doc comments on `captionCardBox` and `resolveNewsHeadlineFit` to
  state that height no longer feeds the fit.

Net result: dragging the Height slider (or otherwise changing
`caption_bar_height_pct`) leaves the headline font size — and every other
element — unchanged. A taller card just gives the caption more empty breathing
room, exactly as the slider's helper text promises. The fix lives in the shared
resolver/`hook-fit` layer, so all three render paths stay in parity
(PARITY-01 / TPLREND-05).

**Tests:** Added height-invariance and byte-identity tests
(`news-headline-fit.test.tsx`, `hook-fit.test.ts`); adjusted the tests that
asserted the old height-coupled fit, preserving each test's width/overflow
intent; fixed a stale `resolveCaptionBar` snapshot in `caption-bar-overrides.test.ts`
that was missing the `blendPct: 0` field. All caption-card / hook-fit /
render-parity suites pass (91 tests). `npx tsc --noEmit` is clean on every
touched file.

**Files changed:**
- `src/lib/render/hook-fit.ts` — `CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT` constant; `captionCardBox` height decoupling
- `src/lib/render/resolve-overlay.ts` — reuse the constant for the default; doc-comment update
- `src/lib/render/__tests__/hook-fit.test.ts` — height-invariance tests; width-coupling test
- `src/lib/render/__tests__/news-headline-fit.test.tsx` — height-invariance + byte-identity tests
- `src/lib/render/__tests__/caption-bar-overrides.test.ts` — stale snapshot fix (`blendPct: 0`)

**Commit:** `f3b2c4d` — `fix(quick-260518-ch8): decouple caption card height from headline font sizing`

## Deferred Items

`npx tsc --noEmit` reports 19 pre-existing errors in unrelated test files (auth,
stripe, legal, projects-delete, slide-editor.treatment-sync) — present on the
base commit `ffd1119`, not caused by this fix, out of scope.
