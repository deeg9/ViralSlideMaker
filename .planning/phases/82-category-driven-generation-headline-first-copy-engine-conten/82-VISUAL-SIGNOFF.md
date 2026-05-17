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

**Verdict:** _pending — no user visual verdict recorded yet._
**Date:** _—_
