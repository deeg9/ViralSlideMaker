import { AnimatedLoadingSkeleton } from '@/components/ui/animated-loading-skeleton'

/**
 * Explore loading boundary.
 *
 * Sits BELOW `explore/layout.tsx` — TopNavbar is already rendered by the parent layout,
 * so this component fills only the `<main>` slot. Keeps the literal "Explore" h1 +
 * "Discover and remix carousels from the community" subtitle so the suspending → loaded
 * transition doesn't pop the heading text in.
 */
export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" aria-busy="true" aria-live="polite">
      {/* Heading block — matches real page.tsx text exactly so the transition feels seamless */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#3d0000]">Explore</h1>
        <p className="text-sm text-[#7d6161] mt-1">Discover and remix carousels from the community</p>
      </div>

      {/* Search + filter row placeholder */}
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
