# Phase 94 — SUMMARY

**Result:** All four polish items (POLISH-01..04) implemented, mobile-gated, atomic-committed. tsc clean (0 new errors). Picker tests 7/7.

## Per-requirement

| Req | Status | File(s) | Approach | See it @393px |
|-----|--------|---------|----------|---------------|
| POLISH-01 | done | `src/components/slides/template-picker.tsx` | Mobile `grid grid-cols-2`; `md:` restores horizontal filmstrip | dashboard → tap **Visual Style** expander; also `/project/[id]` empty state |
| POLISH-02 | done | `src/app/(dashboard)/settings/layout.tsx` | Right-edge gradient fade + scroll-snap on the mobile tab strip | `/settings` (any sub-route), top tab strip |
| POLISH-03 | done | `src/app/explore/[slug]/carousel-slideshow.tsx` | Pointer-event swipe (≥50px, `\|dx\|>\|dy\|`) reusing `goPrev`/`goNext` | `/explore/<slug>` — drag the slide left/right |
| POLISH-04 | done | `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/project/[id]/page.tsx` | Heroes `text-[2.25rem] md:text-[3.5rem]`; tightened mobile spacing | `/dashboard` hero; `/project/[id]` empty-state hero |

## Desktop-regression guard
- POLISH-01: grid utilities unprefixed, all original filmstrip utilities `md:`-prefixed → md+ pixel-identical.
- POLISH-02: entire affected block is `md:hidden`; the `md:block` sidebar untouched.
- POLISH-03: additive (new pointer handlers + shared functions); no layout/visual change; chevrons render identically.
- POLISH-04: size/spacing changes use `md:`-prefixed restoration of the original values.

## Tests
- `tsc --noEmit`: 20 errors (baseline, all test files) → **0 new**.
- `template-picker.test.tsx`: 7/7 pass.
- Full suite: 62 failed / 3367 passed = identical to pre-change baseline (ToS mocks, snapshot drift, mis-collected Playwright e2e). Phase 94 adds 0 failures.

## Commits
- `a89b236` feat(mobile): POLISH-01 template picker wraps to grid on mobile
- `8585ebb` feat(mobile): POLISH-02 settings sub-nav scroll affordance
- `7789247` feat(mobile): POLISH-03 swipe navigation on public carousel viewer
- `604ce49` feat(mobile): POLISH-04 tune heading scale + spacing for 393px

## Deviations
- POLISH-04 also fixed the `/project/[id]` empty-state hero (same `text-[3.5rem]` fold-eater) for cross-surface consistency — page-level heading only, editor chrome untouched, so it does not infringe the 92–93 editor track.
- POLISH-02 hid the native scrollbar in favor of the gradient fade as the single affordance (cleaner, consistent with the picker's `hide-scrollbar`).
