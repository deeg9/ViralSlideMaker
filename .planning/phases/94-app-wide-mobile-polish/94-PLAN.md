# Phase 94 — PLAN

**Status:** complete
**Branch:** `feat/carousel-output-format`
**Approach:** four atomic, independent edits (one per requirement). No shared blast radius; ordered POLISH-01 → 02 → 03 → 04.

## Task 1 — POLISH-01: picker wrap grid
- **File:** `src/components/slides/template-picker.tsx`
- **Change:** container `grid grid-cols-2 gap-4 pb-2 md:flex md:gap-4 md:overflow-x-auto md:hide-scrollbar md:pb-4 md:-mx-4 md:px-4`; tile `w-full md:flex-none md:w-40`.
- **Verify:** `npx vitest run src/__tests__/components/template-picker.test.tsx` (7/7).

## Task 2 — POLISH-02: settings sub-nav fade + snap
- **File:** `src/app/(dashboard)/settings/layout.tsx`
- **Change:** wrap mobile strip in `relative` parent; scroller gets `hide-scrollbar scroll-px-4 snap-x snap-mandatory`, tabs `snap-start`; add `pointer-events-none aria-hidden` right-edge fade `from-[#fff8f7]`.
- **Verify:** tsc clean; visual @393px /settings.

## Task 3 — POLISH-03: public viewer swipe
- **File:** `src/app/explore/[slug]/carousel-slideshow.tsx`
- **Change:** extract `goPrev`/`goNext`; add `swipeStart` ref + `handlePointerDown`/`handlePointerUp` (≥50px, `|dx|>|dy|`); wire onto slide container with `touch-pan-y`; chevrons reuse handlers.
- **Verify:** tsc clean; visual swipe @393px /explore/<slug>.

## Task 4 — POLISH-04: typography @393px
- **Files:** `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/project/[id]/page.tsx`
- **Change:** heroes `text-[2.25rem] md:text-[3.5rem]`; dashboard `space-y-10 md:space-y-16`; empty-state `mb-8 md:mb-12`.
- **Verify:** tsc clean; visual fold @393px.

## Exit gate
- tsc: no new errors vs 20-error test baseline.
- Touched-component tests green.
- ROADMAP + REQUIREMENTS traceability ticked.
- Atomic commit per requirement.
