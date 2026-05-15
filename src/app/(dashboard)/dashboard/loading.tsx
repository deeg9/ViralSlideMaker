import { AnimatedLoadingSkeleton } from '@/components/ui/animated-loading-skeleton'

/**
 * Dashboard loading boundary.
 *
 * Sits BELOW `(dashboard)/layout.tsx` — DashboardShell + sidebar + credit display are
 * already rendered by the parent layout, so this component only fills the `children`
 * slot. Mirrors the layout shape of `dashboard/page.tsx` so the suspending → loaded
 * transition feels seamless.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-16" aria-busy="true" aria-live="polite">
      {/* Welcome Header — h1 placeholder bar + small CTA pill */}
      <section className="flex items-center justify-between gap-8">
        <div className="h-14 w-[60%] rounded-xl bg-[#fff0f0]" />
        <div className="h-10 w-32 rounded-full bg-[#fadbdb] flex-shrink-0" />
      </section>

      {/* Summary cards row — 3 placeholder tiles matching page.tsx exactly */}
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
