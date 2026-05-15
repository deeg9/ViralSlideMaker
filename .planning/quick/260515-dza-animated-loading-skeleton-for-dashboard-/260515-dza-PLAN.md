---
phase: quick-260515-dza
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ui/animated-loading-skeleton.tsx
  - src/app/(dashboard)/dashboard/loading.tsx
  - src/app/explore/loading.tsx
autonomous: true
requirements:
  - DZA-01  # Shared animated skeleton primitive (maroon-palette, motion/react, reduced-motion)
  - DZA-02  # Dashboard loading.tsx renders skeleton that mimics dashboard page scaffold
  - DZA-03  # Explore loading.tsx renders skeleton that mimics explore page scaffold

must_haves:
  truths:
    - "When /dashboard is suspending (e.g. cold nav, Supabase query in-flight), an animated skeleton resembling the dashboard layout appears instead of a blank screen"
    - "When /explore is suspending, an animated skeleton resembling the Explore grid appears instead of a blank screen"
    - "Both skeletons share a single underlying primitive (no duplicated motion logic)"
    - "The skeleton uses the project's maroon palette (#3d0000 / #fff0f0 / #fadbdb / #fff8f7), not the blue/gray from the user's draft"
    - "The skeleton imports motion from 'motion/react' (project standard, v12), NOT from 'framer-motion'"
    - "Users with prefers-reduced-motion see a static (or near-static) version — no looping pulse, no hopping search icon path"
    - "Existing routes that already have their own loading affordance (editor / generation form / extracting state) are untouched"
  artifacts:
    - path: "src/components/ui/animated-loading-skeleton.tsx"
      provides: "Shared 'use client' AnimatedLoadingSkeleton primitive — re-skinned to maroon, motion/react imports, prefers-reduced-motion guard, configurable cardCount / cols / showSearchIcon / className"
      contains: "'use client'"
    - path: "src/app/(dashboard)/dashboard/loading.tsx"
      provides: "Server component loading boundary for /dashboard — renders heading shell + summary-row shell + AnimatedLoadingSkeleton sized like project grid"
      contains: "AnimatedLoadingSkeleton"
    - path: "src/app/explore/loading.tsx"
      provides: "Server component loading boundary for /explore — renders heading shell + search-row shell + AnimatedLoadingSkeleton sized like 1/2/3/4 grid with 12 cards"
      contains: "AnimatedLoadingSkeleton"
  key_links:
    - from: "src/app/(dashboard)/dashboard/loading.tsx"
      to: "src/components/ui/animated-loading-skeleton.tsx"
      via: "import { AnimatedLoadingSkeleton } from '@/components/ui/animated-loading-skeleton'"
      pattern: "AnimatedLoadingSkeleton"
    - from: "src/app/explore/loading.tsx"
      to: "src/components/ui/animated-loading-skeleton.tsx"
      via: "import { AnimatedLoadingSkeleton } from '@/components/ui/animated-loading-skeleton'"
      pattern: "AnimatedLoadingSkeleton"
    - from: "src/components/ui/animated-loading-skeleton.tsx"
      to: "motion/react"
      via: "import { motion, useAnimation, useReducedMotion } from 'motion/react'"
      pattern: "from 'motion/react'"
---

<objective>
Add a polished animated loading skeleton to /dashboard and /explore via Next.js App Router `loading.tsx` boundaries.

Purpose: Today, when either page is suspending on Supabase queries, the user sees a blank `#fff8f7` background until the server payload arrives. The user supplied a working `AnimatedLoadingSkeleton` (Framer Motion based) and wants it to be the perceived loading state — a believable preview of the route, not a generic spinner.

Output:
1. `src/components/ui/animated-loading-skeleton.tsx` — shared `'use client'` primitive re-skinned to maroon palette, imports fixed to `motion/react`, prefers-reduced-motion respected, configurable via props.
2. `src/app/(dashboard)/dashboard/loading.tsx` — dashboard-shaped wrapper (heading + 3 summary cards + project grid skeleton).
3. `src/app/explore/loading.tsx` — explore-shaped wrapper (heading + search row + 1/2/3/4 card grid skeleton, 12 cards).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Pages being skeletonized (so the wrapper layouts match their real shape)
@src/app/(dashboard)/dashboard/page.tsx
@src/app/explore/page.tsx

# Layouts that wrap them (so the loading.tsx inherits the right chrome — no need to re-render TopNavbar / DashboardShell, they live above the loading boundary)
@src/app/(dashboard)/layout.tsx
@src/app/explore/layout.tsx

# Existing maroon-palette motion/react component — mirror its 'use client' + import style
@src/components/ui/orbital-loader.tsx

# Card components the skeleton is mimicking (so the placeholder card aspect/shape matches)
@src/app/explore/explore-card.tsx
@src/components/projects/project-card.tsx

<interfaces>
<!-- Key facts extracted from the codebase so the executor doesn't have to re-discover them -->

Motion package (from package.json):
- "motion": "^12.38.0"  ← v12. Import path is 'motion/react', NOT 'framer-motion'.
- Example existing usage: src/components/ui/orbital-loader.tsx imports `import { motion } from 'motion/react'`

Project color palette (used throughout dashboard + explore):
- Maroon text:        #3d0000
- Maroon at 20% alpha: rgba(61, 0, 0, 0.2)   (use as `#3d0000` with /20 in Tailwind arbitrary, or rgba in inline style)
- Page background:    #fff8f7
- Card pulse light:   #fff0f0
- Card pulse dark:    #fadbdb
- Muted text:         #7d6161
- Border tint:        #dbc1bc / rgba(219, 193, 188, 0.3)

Dashboard page shape (what the skeleton wrapper mimics):
- Outer: `<div className="space-y-16">`
- Heading section: `<section className="flex items-center justify-between gap-8">` with a big `<h1 className="text-[3.5rem] font-semibold tracking-tighter text-[#3d0000] leading-tight">` on the left and a small CTA pill on the right.
- Summary cards row: `<section className="grid grid-cols-1 md:grid-cols-3 gap-6">` with 3 `bg-[#fff0f0]` / `bg-[#fadbdb]` cards (`p-8 rounded-xl`, ~104px tall).
- Project grid: rendered inside `<ProjectList>` — uses `aspect-[9/16] rounded-xl` thumbnails in a responsive grid. For the skeleton, render 6 placeholder cards in a `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6` (mirrors what real ProjectList does).

Explore page shape (what the skeleton wrapper mimics):
- Outer: `<div className="mx-auto max-w-6xl px-4 py-8">`
- Heading block: `<h1 className="text-3xl font-bold text-[#3d0000]">Explore</h1>` + `<p className="text-sm text-[#7d6161] mt-1">Discover and remix carousels from the community</p>`
- Search/filter row: `<div className="flex items-stretch gap-2 mb-6">` — a flex-1 search box (~40px tall, rounded) and a filter button.
- Card grid: `<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">` of `aspect-[9/16] rounded-2xl` cards.

Existing 'use client' motion/react pattern (orbital-loader.tsx):
```tsx
'use client'
import { motion } from 'motion/react'
// ...
<motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }} />
```

Next.js App Router loading.tsx convention:
- File path: `src/app/<route-segment>/loading.tsx`
- Default-exported React component (can be `async` but doesn't need to be)
- Rendered automatically by the router when a sibling `page.tsx` is suspending
- Replaces `<Suspense>` boundary; sits BELOW the surrounding `layout.tsx`, so the dashboard shell / top navbar are still visible during loading
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create shared AnimatedLoadingSkeleton primitive</name>
  <files>src/components/ui/animated-loading-skeleton.tsx</files>
  <action>
Create `src/components/ui/animated-loading-skeleton.tsx` as a `'use client'` component. It's the shared primitive both `loading.tsx` files import.

Required:

1. **First line:** `'use client'` directive.

2. **Imports:** `import { motion, useAnimation, useReducedMotion } from 'motion/react'`. Do NOT import from `framer-motion` — the project standardized on `motion` v12 (verified in package.json). Also import `useEffect`, `useState`, and `cn` from `@/lib/utils`.

3. **Public API:**
```tsx
export interface AnimatedLoadingSkeletonProps {
  /** Number of placeholder cards to render. Default: 6. */
  cardCount?: number
  /** Responsive column counts. Default: { base: 1, sm: 2, md: 3 }. */
  cols?: { base?: 1; sm?: 1 | 2; md?: 1 | 2 | 3; lg?: 1 | 2 | 3 | 4 }
  /** Show the glowing search icon hopping between cards. Default: true. */
  showSearchIcon?: boolean
  /** Extra classes on the outer wrapper. */
  className?: string
}

export function AnimatedLoadingSkeleton(props: AnimatedLoadingSkeletonProps): JSX.Element
```

4. **Card pulse animation:** Each placeholder card is `aspect-[9/16] rounded-2xl border border-[#dbc1bc]/30 overflow-hidden`. Background uses Framer Motion animating between `#fff0f0` → `#fadbdb` → `#fff0f0`, duration 1.6s, `repeat: Infinity`, `ease: 'easeInOut'`. Stagger each card's delay by `index * 0.12s` so the pulse cascades across the grid. Inside each card, render two stacked horizontal bars (`h-3 rounded-full bg-[#fadbdb]`) near the bottom representing title + meta — also pulsing.

5. **Search-icon hop (when showSearchIcon === true):** Render an absolutely-positioned circular badge inside a relatively-positioned grid wrapper. The badge contains a search SVG icon (use `<svg>` directly so we don't pull in Lucide — match the user's draft) with `stroke="#3d0000"`. Glow: `box-shadow: 0 0 24px rgba(61, 0, 0, 0.35)`. The badge animates between card centers using `useAnimation()`. **Critical: do NOT hardcode `xBase 40 / yBase 60 / xStep 210 / yStep 230` from the user's draft — those break at different viewport widths.** Instead:
   - Compute card positions relatively: use CSS percentages anchored to grid track centers. For a `cols={3}` grid with 6 cards, the centers are at `(left%, top%)` ∈ { (16.7, 25), (50, 25), (83.3, 25), (16.7, 75), (50, 75), (83.3, 75) } (approx).
   - Or simpler: use `ResizeObserver` on the grid wrapper to read each card's `getBoundingClientRect()` relative to the wrapper, then animate `x` / `y` in pixels with `useAnimation`. Recompute on resize.
   - Either approach is acceptable. Document which one you picked in a comment with rationale. Tradeoff to call out: percentage-anchored is simpler but less precise on narrow viewports where grid wraps to fewer cols; ResizeObserver is precise but adds a measurement effect.
   - Loop: hop between cards with a 0.65s eased transition, dwell 0.3s at each card, then move on. Wrap back to card 0 after the last.

6. **Prefers-reduced-motion guard:** Call `useReducedMotion()`. When it returns true:
   - Card pulse: render a static `bg-[#fff0f0]` (no `<motion.div animate>`).
   - Bars inside cards: static `bg-[#fadbdb]`.
   - Search icon: still rendered at its initial position but NO animation (no hop). Optional: hide entirely — your choice, just make sure no looping animation runs.
   - The component must still return a valid skeleton (don't conditionally null-out the whole thing).

7. **Layout:** Outer wrapper is `<div className={cn('relative w-full', className)}>`. Inside, the responsive grid is built from `cols` using Tailwind class composition. Reasonable default: `grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3` (override via cols prop — wrappers in Tasks 2/3 will pass the right values).

8. **Re-skinning vs user's draft:** The user's draft uses blue + gray; you MUST replace with the maroon palette listed in the `<interfaces>` block. Do NOT keep any `bg-blue-*` / `bg-gray-*` / `bg-slate-*` / `text-blue-*` classes. Search icon `stroke` and glow use `#3d0000`.

9. **No `max-w-4xl` outer wrapper:** The user's draft self-constrains to `max-w-4xl` inside a white card. Drop that — the wrappers in Tasks 2/3 own outer width and chrome.

Verify there are no leftover `framer-motion` imports anywhere in the file. Verify there are no leftover `blue`/`gray`/`slate` color tokens.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow &amp;&amp; test -f src/components/ui/animated-loading-skeleton.tsx &amp;&amp; head -1 src/components/ui/animated-loading-skeleton.tsx | grep -qx "'use client'" &amp;&amp; grep -q "from 'motion/react'" src/components/ui/animated-loading-skeleton.tsx &amp;&amp; ! grep -q "from 'framer-motion'" src/components/ui/animated-loading-skeleton.tsx &amp;&amp; grep -q "useReducedMotion" src/components/ui/animated-loading-skeleton.tsx &amp;&amp; grep -q "#3d0000" src/components/ui/animated-loading-skeleton.tsx &amp;&amp; ! grep -E "bg-(blue|gray|slate)-" src/components/ui/animated-loading-skeleton.tsx &amp;&amp; npx tsc --noEmit 2>&amp;1 | (grep "src/components/ui/animated-loading-skeleton.tsx" || echo "no new tsc errors in skeleton file")</automated>
  </verify>
  <done>
    File exists with `'use client'` directive. Imports `motion`, `useAnimation`, `useReducedMotion` from `'motion/react'` (not `framer-motion`). Uses `useReducedMotion()` to disable animations when set. Renders a configurable grid of `aspect-[9/16]` pulsing cards in the maroon palette (no blue/gray classes). Search icon glow uses `#3d0000` at low alpha. Exports `AnimatedLoadingSkeleton` and `AnimatedLoadingSkeletonProps`. `npx tsc --noEmit` introduces no new errors attributable to this file.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add dashboard loading boundary</name>
  <files>src/app/(dashboard)/dashboard/loading.tsx</files>
  <action>
Create `src/app/(dashboard)/dashboard/loading.tsx` as a default-exported server component (no `'use client'` needed — it just renders the client primitive). Mirror the layout shape of `src/app/(dashboard)/dashboard/page.tsx` so the user sees a believable preview, not a generic box.

Required structure (use the EXACT class strings below — they match `page.tsx`):

```tsx
import { AnimatedLoadingSkeleton } from '@/components/ui/animated-loading-skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-16" aria-busy="true" aria-live="polite">
      {/* Welcome Header — h1 placeholder bar */}
      <section className="flex items-center justify-between gap-8">
        <div className="h-14 w-[60%] rounded-xl bg-[#fff0f0]" />
        <div className="h-10 w-32 rounded-full bg-[#fadbdb] flex-shrink-0" />
      </section>

      {/* Summary cards row — 3 placeholder summary tiles matching page.tsx exactly */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#fff0f0] p-8 rounded-xl h-[148px]" />
        <div className="bg-[#fff0f0] p-8 rounded-xl h-[148px]" />
        <div className="bg-[#fadbdb] p-8 rounded-xl h-[148px]" />
      </section>

      {/* Project grid skeleton — 6 cards in 1/2/3 cols, matches ProjectList shape */}
      <AnimatedLoadingSkeleton
        cardCount={6}
        cols={{ base: 1, sm: 2, md: 3 }}
        showSearchIcon
      />
    </div>
  )
}
```

Notes:
- Do NOT wrap in `<DashboardShell>` — the dashboard layout (`src/app/(dashboard)/layout.tsx`) lives above this loading boundary and already renders the shell + sidebar + credit display. The loading.tsx renders ONLY the `children` slot.
- The h1 placeholder height (`h-14`) approximates the real `text-[3.5rem]` heading.
- The summary card height (`h-[148px]`) is the eyeballed real height of the `p-8` + 4 stacked elements. Slight variance is fine.
- `aria-busy="true"` + `aria-live="polite"` on the outer wrapper announce the loading state to screen readers.
- No motion code lives in this file — all animation is inside `<AnimatedLoadingSkeleton>`.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow &amp;&amp; test -f "src/app/(dashboard)/dashboard/loading.tsx" &amp;&amp; grep -q "AnimatedLoadingSkeleton" "src/app/(dashboard)/dashboard/loading.tsx" &amp;&amp; grep -q "aria-busy" "src/app/(dashboard)/dashboard/loading.tsx" &amp;&amp; grep -q "grid-cols-1 md:grid-cols-3" "src/app/(dashboard)/dashboard/loading.tsx" &amp;&amp; ! grep -q "'use client'" "src/app/(dashboard)/dashboard/loading.tsx" &amp;&amp; npx tsc --noEmit 2>&amp;1 | (grep "src/app/(dashboard)/dashboard/loading.tsx" || echo "no new tsc errors in dashboard loading")</automated>
  </verify>
  <done>
    File exists at `src/app/(dashboard)/dashboard/loading.tsx`. Default-exports a server component named `DashboardLoading`. Imports and renders `<AnimatedLoadingSkeleton cardCount={6} cols={{ base:1, sm:2, md:3 }} showSearchIcon />`. Renders heading bar + 3 summary card placeholders matching page.tsx layout. Has `aria-busy="true"` and `aria-live="polite"` on outer wrapper. No `'use client'` directive (server component is correct here). `npx tsc --noEmit` introduces no new errors attributable to this file.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add explore loading boundary</name>
  <files>src/app/explore/loading.tsx</files>
  <action>
Create `src/app/explore/loading.tsx` as a default-exported server component. Mirror the layout shape of `src/app/explore/page.tsx`.

Required structure:

```tsx
import { AnimatedLoadingSkeleton } from '@/components/ui/animated-loading-skeleton'

export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" aria-busy="true" aria-live="polite">
      {/* Heading block — matches real page.tsx text exactly so the transition feels seamless */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#3d0000]">Explore</h1>
        <p className="text-sm text-[#7d6161] mt-1">Discover and remix carousels from the community</p>
      </div>

      {/* Search / filter row placeholder */}
      <div className="flex items-stretch gap-2 mb-6">
        <div className="flex-1 min-w-0 h-10 rounded-xl bg-[#fff0f0]" />
        <div className="h-10 w-24 rounded-xl bg-[#fadbdb]" />
      </div>

      {/* 12-card 1/2/3/4 grid skeleton */}
      <AnimatedLoadingSkeleton
        cardCount={12}
        cols={{ base: 1, sm: 2, md: 3, lg: 4 }}
        showSearchIcon
      />
    </div>
  )
}
```

Notes:
- Keep the real `<h1>` "Explore" + subtitle text — they don't depend on data and rendering them in the skeleton makes the suspending→loaded transition appear instant (the text doesn't pop in).
- Card count 12 fills two rows of a 4-col `lg` grid (or 4 rows at `md`, 6 rows at `sm`, 12 rows at `base`).
- Same `aria-busy` / `aria-live` posture as dashboard loading.
- No `<TopNavbar>` — the explore layout (`src/app/explore/layout.tsx`) renders it above this boundary.
- No `'use client'` directive.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow &amp;&amp; test -f src/app/explore/loading.tsx &amp;&amp; grep -q "AnimatedLoadingSkeleton" src/app/explore/loading.tsx &amp;&amp; grep -q "max-w-6xl" src/app/explore/loading.tsx &amp;&amp; grep -q "Discover and remix carousels" src/app/explore/loading.tsx &amp;&amp; grep -q "aria-busy" src/app/explore/loading.tsx &amp;&amp; ! grep -q "'use client'" src/app/explore/loading.tsx &amp;&amp; npx tsc --noEmit 2>&amp;1 | (grep "src/app/explore/loading.tsx" || echo "no new tsc errors in explore loading") &amp;&amp; npm run lint -- --max-warnings=0 src/components/ui/animated-loading-skeleton.tsx "src/app/(dashboard)/dashboard/loading.tsx" src/app/explore/loading.tsx 2>&amp;1 | tail -20</automated>
  </verify>
  <done>
    File exists at `src/app/explore/loading.tsx`. Default-exports a server component named `ExploreLoading`. Imports and renders `<AnimatedLoadingSkeleton cardCount={12} cols={{ base:1, sm:2, md:3, lg:4 }} showSearchIcon />`. Outer wrapper has `max-w-6xl px-4 py-8` matching page.tsx. Real "Explore" h1 + subtitle text rendered. Has `aria-busy="true"` and `aria-live="polite"`. No `'use client'` directive. `npx tsc --noEmit` introduces no new errors. ESLint passes for all three new files (no new warnings or errors).
  </done>
</task>

</tasks>

<verification>

## Overall phase checks (after all three tasks)

```bash
# 1) Type check — no new tsc errors introduced by this plan
cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "(animated-loading-skeleton|app/\(dashboard\)/dashboard/loading|app/explore/loading)" || echo "no new errors in plan files"

# 2) Lint — no new lint errors in the three new files
npm run lint -- src/components/ui/animated-loading-skeleton.tsx "src/app/(dashboard)/dashboard/loading.tsx" src/app/explore/loading.tsx

# 3) Import sanity — confirm motion comes from the right package across all three files
grep -rn "from 'framer-motion'" src/components/ui/animated-loading-skeleton.tsx "src/app/(dashboard)/dashboard/loading.tsx" src/app/explore/loading.tsx
# Expected: zero matches

grep -rn "from 'motion/react'" src/components/ui/animated-loading-skeleton.tsx
# Expected: at least one match

# 4) Palette discipline — no blue/gray escape
grep -nE "bg-(blue|gray|slate)-|text-(blue|gray|slate)-" src/components/ui/animated-loading-skeleton.tsx "src/app/(dashboard)/dashboard/loading.tsx" src/app/explore/loading.tsx
# Expected: zero matches

# 5) Runtime smoke — start dev server and hit each route (manual but cheap)
#    npm run dev, then visit /dashboard and /explore. Throttle to "Slow 3G" in devtools
#    Network tab to see the skeleton render before the page resolves.
```

## What the user should manually verify (≤30 seconds)

1. `npm run dev`, sign in, then click hard-refresh on `/dashboard` with Network throttled to Slow 3G. Skeleton should appear immediately (cascading pulse + maroon palette + hopping search icon), then resolve to the real dashboard.
2. Same drill on `/explore`. Skeleton should match the 4-col grid at desktop width.
3. Toggle "Reduce motion" in macOS System Settings → Accessibility → Display, hard-refresh either page. Skeleton should still render but be static (no pulse loop, no search-icon hop).
4. Other routes (e.g. `/project/[id]`, `/extracting`) should be untouched — they have their own loading affordances (orbital loader, letter-circle loader).

</verification>

<success_criteria>

- [ ] `src/components/ui/animated-loading-skeleton.tsx` exists, imports `motion`, `useAnimation`, `useReducedMotion` from `'motion/react'`, and uses the maroon palette throughout.
- [ ] Component honors `useReducedMotion()` — no looping animation when the OS-level preference is set.
- [ ] `src/app/(dashboard)/dashboard/loading.tsx` exists, renders dashboard-shaped scaffold + `<AnimatedLoadingSkeleton cardCount={6} cols={{ base:1, sm:2, md:3 }} showSearchIcon />`.
- [ ] `src/app/explore/loading.tsx` exists, renders explore-shaped scaffold + `<AnimatedLoadingSkeleton cardCount={12} cols={{ base:1, sm:2, md:3, lg:4 }} showSearchIcon />`.
- [ ] `npx tsc --noEmit` introduces no new errors attributable to the three new files (baseline TS error count preserved).
- [ ] `npm run lint` introduces no new warnings or errors in the three new files.
- [ ] No `framer-motion` imports anywhere in the three new files.
- [ ] No `bg-blue-*` / `bg-gray-*` / `bg-slate-*` classes anywhere in the three new files.
- [ ] Hard-refresh on /dashboard and /explore with throttled network shows the skeleton (manual visual check).
- [ ] No other route's loading affordance is touched (orbital loader, letter-circle loader, CreditDisplay Suspense fallback all unchanged).

</success_criteria>

<output>
After completion, create `.planning/quick/260515-dza-animated-loading-skeleton-for-dashboard-/260515-dza-SUMMARY.md` documenting:
- The positioning approach chosen for the search-icon hop (percentage-anchored vs ResizeObserver) and why.
- Any deviations from the user's draft (palette, imports, `max-w-4xl` removal, reduced-motion guard).
- Confirmation of `npx tsc --noEmit` and `npm run lint` results.
- Manual QA result (slow-3G hard-refresh on both routes + reduced-motion toggle).
</output>
