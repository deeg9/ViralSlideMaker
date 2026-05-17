# Phase 82 — Visual Sign-Off (SPEC R10)

**Status:** ⛔ PENDING USER VISUAL APPROVAL — `human_needed` verification item.

> SPEC R10 gates "done" on automated structural tests AND a user visual sign-off
> on sample News + Facts carousels. The structural half is met (see
> `src/lib/ai/__tests__/category-generation.test.ts` — 11 passing tests). The
> visual half requires a human judgment and an interactive review channel that
> this autonomous run does not have — so it is recorded here as a
> `human_needed` verification item, NOT marked passed.

## Fixed test-topic set (for repeatable visual checks)

**News topics:**
1. "Major tech company announces 19,000 layoffs"
2. "City council approves new downtown transit line"

**Facts topics:**
1. "Surprising facts about how the human brain uses energy"
2. "How much water the average person uses in a single day"

## How the user runs the visual check

For each topic above:
1. Open the creation form (a project's "What shall we create?" page).
2. In the new **Content Category** section, pick **News** (for the News topics) or
   **Facts & Info** (for the Facts topics).
3. Enter the topic and click **Generate Carousel**.
4. Review the generated slides against the reference screenshots on `~/Desktop`:
   `Screenshot 2026-05-15 at 5.13.25 / 5.13.49 / 5.14.10 PM.png` — the target
   news-headline style (full-bleed photo, dark gradient, one big accent-highlighted
   headline, small kicker label).

Expected for News/Facts: the headline is the dominant text element, ≥1 accent-marked
keyword per headline, no required body text, optional sparse kicker labels.

## User decision required

- **Approve** — the sample News + Facts generations match the reference style, OR
- **Needs work** — describe what is off (recorded as a follow-up).

**Verdict:** ⚠️ NEEDS WORK — recorded 2026-05-17. Layout approved ("I like the overall layout"); two defects block sign-off. Routed to Phase 82 R10 gap-closure.

**Date:** 2026-05-17

## Needs-work findings (gap-closure scope)

User tested "Major tech company announces 19,000 layoffs" via the News category. Layout is good (headline-first, top-anchored on a dark image). Reference for the target state: `~/Desktop/Screenshot 2026-05-17 at 2.13.25 PM.png` (user's manual edit — big headline + pill-highlighted keywords).

- **Gap A — font size is capped.** `clampManualHookSize()` (`src/lib/render/hook-fit.ts`, `MANUAL_GROWTH_MAX = 1.6`) clamps a manual hook size to 1.6× the auto-fit value on every news-layout slide (applied in `render-slide-satori.tsx` and `slide-preview.tsx`). Entering 190 vs 290 in the editor renders identically. The headline cannot be made large enough.
- **Gap B — News does not highlight keywords.** Generated news slides render plain white text, no highlights. `categories/news.ts` instructs Gemini to mark words `accent: true`, but (1) `accent: true` renders as two-color *text* whereas the target is **pill** highlights (`highlightColor` + `highlightStyle: 'pill'`, as the editor's `toggleAccent` produces), and (2) the generated slide showed no highlight at all — segments are dropped or not emitted. News generation must reliably produce pill-highlighted keywords.
- **Gap C — generated headline starts too small.** Generation never sets `font_size`; news headlines fall back to the template default (~110–124). News headline-only slides should generate large enough to dominate the slide like the reference.

## Gap-closure resolution (R10 cycle — 2026-05-17)

All 3 gaps fixed via gap-closure Plans 06 + 07 (commits `939d8cf`, `f1acfac`, `53f4a5c`).

- **Gap A — FIXED (`82-06`).** `clampManualHookSize` is now body-aware: a 5th
  `hasBody` parameter; when a slide has no body box (headline-only news slides —
  the default per R4) the manual size is returned verbatim — no cap. The cap
  only fires for slides that carry body text, and `MANUAL_GROWTH_MAX` was raised
  1.6× → 2.6×. Both renderers thread an identical `hasBody` signal (TPLREND-05).
  The editor hook font-size input `max` was raised 240 → 400. Entering 190 vs
  290 now renders distinctly; the headline can dominate the slide.
- **Gap B — FIXED (`82-07`).** New `promoteNewsHeadline` transform: every
  `accent: true` segment is promoted to a **pill** (`highlightColor` from the
  template accent color + `highlightStyle: 'pill'`, mirroring the editor's
  `toggleAccent`). Root cause of "no highlight at all" FOUND: `hook_segments` is
  schema-OPTIONAL in both the Zod and Gemini response schemas, so Gemini can
  emit a headline with none — and on the user's run it did. The transform
  deterministically DERIVES pill segments from `hook_text` when Gemini emits
  none, so a news headline can never reach the renderer un-highlighted.
- **Gap C — FIXED (`82-07`).** `promoteNewsHeadline` sets
  `style_overrides.hook_font_size` to 200 on every news slide so the headline
  dominates instead of falling back to the ~124px template default. A
  code-review fix (`53f4a5c`) corrected the layout-lift in both generation
  paths to MERGE `style_overrides` rather than replace it (a bare replacement
  would have discarded the size).

**Verdict:** ⛔ STILL PENDING USER VISUAL APPROVAL. The 3 reported defects are
fixed in code with passing tests, but the R10 **visual** sign-off remains a
human judgment. The user must re-generate sample News carousels via the News
category and confirm the output now matches `~/Desktop/Screenshot 2026-05-17 at
2.13.25 PM.png` (big headline + pill-highlighted keywords). This autonomous run
does NOT mark the visual sign-off approved.
