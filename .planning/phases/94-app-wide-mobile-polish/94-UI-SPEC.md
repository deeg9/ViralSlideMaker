# Phase 94 — UI-SPEC (4 polish items)

Design principle for all four: **mobile-first override, desktop restored at `md:`.** No desktop visual change.

## POLISH-01 — Template picker → mobile grid
- **Mobile (`<md`):** `grid grid-cols-2 gap-4 pb-2`; tiles `w-full` (fill the column). All 16 templates wrap and are scannable in-place — no hidden horizontal scroll.
- **Desktop (`md+`):** original `flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4` filmstrip; tiles `md:flex-none md:w-40`. Byte-identical to before.
- **Why 2 cols:** 393px − 2×16px container padding ≈ 361px → two ~170px tiles read at a comfortable 9:16 thumb size; 3 cols would shrink names below legibility. FEATURES.md: grid-over-carousel for many items.
- **Test safety:** tile DOM (img count, name spans) unchanged → existing `template-picker.test.tsx` stays green.

## POLISH-02 — Settings sub-nav discoverability
- **Affordance:** right-edge gradient fade `bg-gradient-to-l from-[#fff8f7] to-transparent` (matches dashboard page bg), `w-10`, `absolute inset-y-0 right-0`, `pointer-events-none` + `aria-hidden`. Signals "more tabs this way."
- **Scroll-snap:** outer scroller `snap-x snap-mandatory scroll-px-4`; each tab `snap-start` → active tab never left half-clipped.
- Scrollbar hidden (`hide-scrollbar`) so the fade is the sole, clean affordance.
- **Desktop:** the whole block is `md:hidden`; the `md:block` sidebar is untouched.

## POLISH-03 — Public carousel swipe
- **Mechanism:** native Pointer Events on the slide container (no dep). `onPointerDown` records `{x,y}`; `onPointerUp` computes `dx,dy`.
- **Gesture rule:** step a slide only if `|dx| ≥ 50px` **and** `|dx| > |dy|` (horizontal-dominant). `dx<0 → next`, `dx>0 → prev`. Vertical-dominant drags fall through so page scroll is unaffected (`touch-pan-y` on the element).
- **Handler reuse:** extracted `goPrev`/`goNext`; chevrons now call them too — single source of truth, all three entry points (left chevron, right chevron, swipe) clamp identically.
- **No-regression:** a tap = pointerdown+up with `dx≈0` < threshold → no nav; chevrons unchanged visually.

## POLISH-04 — Typography/spacing @393px
- **Heroes:** the two `text-[3.5rem]` (56px) headings → `text-[2.25rem] md:text-[3.5rem]` (36px mobile, 56px desktop). Targets: dashboard "Welcome back" and `/project/[id]` "What shall we create?".
- **Rhythm:** dashboard container `space-y-16 → space-y-10 md:space-y-16`; empty-state `mb-12 → mb-8 md:mb-12`.
- **Scope discipline:** other headings already mobile-sane (`text-3xl` Explore = 30px, `text-xl` Recent Carousels = 20px) — left alone. Subscription price `text-5xl` left (blessed surface).
