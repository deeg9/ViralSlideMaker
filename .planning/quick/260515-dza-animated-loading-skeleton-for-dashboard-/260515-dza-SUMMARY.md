---
phase: quick-260515-dza
plan: 01
subsystem: ui-loading-states
tags: [skeleton, loading, motion, dashboard, explore, ui, a11y]
dependency_graph:
  requires: []
  provides:
    - AnimatedLoadingSkeleton primitive (configurable maroon-palette skeleton with motion/react)
    - /dashboard route loading.tsx (mimics dashboard scaffold)
    - /explore route loading.tsx (mimics explore scaffold)
  affects:
    - Next.js App Router suspense boundaries for /dashboard and /explore
    - Perceived loading state for cold nav + Supabase query-in-flight scenarios
tech_stack:
  added: []  # No new deps — uses existing `motion@^12.38.0`
  patterns:
    - Next.js App Router `loading.tsx` suspense boundaries (server components rendering a client primitive)
    - ResizeObserver-driven positional animation (preferred over hardcoded pixel offsets / percentage math)
    - `useReducedMotion()` accessibility guard (flatten animation to static layout)
    - Shared client primitive consumed by route-shaped server wrappers
key_files:
  created:
    - src/components/ui/animated-loading-skeleton.tsx
    - src/app/(dashboard)/dashboard/loading.tsx
    - src/app/explore/loading.tsx
  modified: []
decisions:
  - Used ResizeObserver to measure card centers relative to the grid wrapper (chosen over percentage-anchored math) because the responsive grid wraps to different column counts at different breakpoints (1/2/3/4 cols), and only direct DOM measurement adapts to any `cols` configuration the wrappers pass in. Tradeoff: one extra measurement effect for precision wins over simpler math that breaks on narrow viewports.
  - Loading wrappers are server components (no `'use client'` directive) — only the inner `AnimatedLoadingSkeleton` is a client component. Keeps the route boundary cheap to stream.
  - Kept the literal "Explore" h1 + subtitle text in `explore/loading.tsx` so the suspending → loaded transition doesn't pop the heading.
metrics:
  tasks_completed: 3
  files_created: 3
  files_modified: 0
  duration_minutes: ~15
  commits: 3
  completed_at: "2026-05-15T17:13:12Z"
---

# Quick Task 260515-dza: Animated Loading Skeleton (Dashboard + Explore) Summary

## One-liner

Maroon-palette `AnimatedLoadingSkeleton` primitive with `motion/react` + reduced-motion guard, wired into `loading.tsx` boundaries for /dashboard and /explore so suspending Supabase queries no longer show a blank `#fff8f7` screen.

## What changed

Three new files, no modifications to existing code:

| File | Purpose | Commit |
| ---- | ------- | ------ |
| `src/components/ui/animated-loading-skeleton.tsx` | Shared `'use client'` primitive: configurable card grid with cascading background pulse + hopping search-icon glow + reduced-motion guard | `e033756` |
| `src/app/(dashboard)/dashboard/loading.tsx` | Server-component loading boundary; renders dashboard-shaped scaffold (heading bar + 3 summary cards + 6-card project grid skeleton) | `e6c7a50` |
| `src/app/explore/loading.tsx` | Server-component loading boundary; renders explore-shaped scaffold (Explore h1 + subtitle + search/filter row + 12-card 1/2/3/4 grid skeleton) | `7eefe63` |

## Search-icon positioning approach (key decision)

**Chosen: ResizeObserver + `getBoundingClientRect()` measurement.**

Why not the percentage-anchored approach the plan offered as an alternative:

- The responsive grid passes through 4 different column counts (`cols={{ base:1, sm:2, md:3, lg:4 }}` for explore; `{ base:1, sm:2, md:3 }` for dashboard). Hardcoded percentage math (e.g. `(16.7, 25)`, `(50, 25)`, `(83.3, 25)` for 3-col) holds only at one breakpoint; at narrower viewports the same percentages land outside the wrapped grid.
- Direct DOM measurement reads each card's actual rect at the current viewport, then animates `x` / `y` to those rect centers via `useAnimation()`. Re-measures on resize via `ResizeObserver` so the hop tracks the grid as it reflows.
- Tradeoff acknowledged: adds one ResizeObserver effect and a measurement state variable. Worth it because the search-icon hop is the most prominent moving part of the animation; misaligned hops to empty space would look broken.

The component renders the icon as a `<motion.div>` with `boxShadow: '0 0 24px rgba(61, 0, 0, 0.35)'` and a raw `<svg>` (matches user's draft — avoids pulling in `lucide-react` just for a 22×22 icon).

## Deviations from the user's draft

Tracked as deliberate re-skinning (not Rule-1/2/3 deviations — they were all called out in the plan):

| What | Why |
| ---- | --- |
| Imports `from 'motion/react'` (not `'framer-motion'`) | Project uses `motion@^12.38.0` — `framer-motion` would resolve to nothing |
| Maroon palette (`#3d0000` / `#fff0f0` / `#fadbdb` / `#7d6161` / `#dbc1bc`) | User's draft used blue/gray; project has zero blue/gray surface |
| Dropped `max-w-4xl` self-constraining wrapper | The route-level wrappers (`loading.tsx`) own outer width — `space-y-16` on dashboard, `mx-auto max-w-6xl px-4 py-8` on explore |
| Dropped hardcoded `xBase 40 / yBase 60 / xStep 210 / yStep 230` | Pixel-locked to one specific viewport width; replaced with ResizeObserver (see above) |
| Added `useReducedMotion()` guard | OS-level "Reduce motion" preference must produce a static skeleton (no pulse loop, no hop) — accessibility requirement from plan's truths list |
| Replaced `<motion.div animate>` pulse with `<motion.div animate={{ backgroundColor: [...] }}>` | Cleaner than swapping `background-color` via state; lets `motion/react` interpolate between the two maroon shades |
| Search-icon SVG inlined (no Lucide) | Matches user's draft; keeps the primitive dependency-free |

## Deviations from Plan

### Auto-fixed Issues

**1. [Lint cleanup] Removed two unused `eslint-disable-next-line no-await-in-loop` directives**
- **Found during:** Task 1 lint check (`npm run lint --max-warnings=0`)
- **Issue:** Project ESLint config (`next/core-web-vitals` + `next/typescript`) doesn't enable `no-await-in-loop`, so the disable directives surfaced as `Unused eslint-disable directive` warnings.
- **Fix:** Dropped both directives.
- **Files modified:** `src/components/ui/animated-loading-skeleton.tsx`
- **Commit:** Folded into `e033756` (pre-commit cleanup)

No other deviations. Plan executed exactly as written.

## Authentication gates

None encountered — pure UI work, no auth-protected surface touched.

## Verification — automated

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` — total error count vs baseline | **19 / 19** (baseline preserved; zero new errors attributable to the three new files) |
| `npx tsc --noEmit` filtered to plan files | `no new errors in plan files` |
| `npm run lint --max-warnings=0` across all three new files | clean (zero errors, zero warnings) |
| `grep "from 'framer-motion'"` across all three files | zero matches |
| `grep "from 'motion/react'"` in skeleton | one import + one comment match (≥1 expected) |
| `grep -E "bg-(blue\|gray\|slate)-\|text-(blue\|gray\|slate)-"` across all three files | zero matches |
| `'use client'` directive present on skeleton, absent on both `loading.tsx` files | confirmed |
| `aria-busy="true"` + `aria-live="polite"` on both wrappers | confirmed |
| Real "Explore" h1 + "Discover and remix carousels from the community" subtitle present in explore wrapper | confirmed (literal text match) |

## Verification — manual (pending user)

The plan called out four manual checks the user should perform; these are intentionally out of scope for the automated executor:

1. `npm run dev`, sign in, hard-refresh `/dashboard` with Network throttled to Slow 3G — expect cascading skeleton + maroon palette + hopping search icon, then real dashboard.
2. Same drill on `/explore` — expect 4-col 12-card grid skeleton at desktop width.
3. Toggle macOS Accessibility → Display → Reduce motion ON; hard-refresh either page — expect static skeleton (no pulse loop, no search-icon hop), still visible/intact.
4. Unrelated routes (`/project/[id]`, `/extracting`, `/login`) untouched — confirm their existing loading affordances (orbital loader, letter-circle loader, etc.) still render.

## Known Stubs

None. The skeleton is a pure UI primitive; no data is stubbed. Both `loading.tsx` wrappers are static-layout shells (they don't read any data and shouldn't — that's the entire point of the suspense boundary).

## Threat Flags

None. No new network endpoints, no auth path changes, no schema changes, no file access patterns introduced. The change surface is render-only client UI sitting below the existing authenticated layout.

## Commits

- `e033756` — feat(ui): add AnimatedLoadingSkeleton primitive (260515-dza)
- `e6c7a50` — feat(dashboard): add loading.tsx with animated skeleton (260515-dza)
- `7eefe63` — feat(explore): add loading.tsx with animated skeleton (260515-dza)

## Self-Check: PASSED

- File `src/components/ui/animated-loading-skeleton.tsx`: FOUND
- File `src/app/(dashboard)/dashboard/loading.tsx`: FOUND
- File `src/app/explore/loading.tsx`: FOUND
- Commit `e033756`: FOUND in git log
- Commit `e6c7a50`: FOUND in git log
- Commit `7eefe63`: FOUND in git log
