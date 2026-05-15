'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useAnimation, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'

/**
 * AnimatedLoadingSkeleton — shared maroon-palette skeleton primitive.
 *
 * Used by `app/(dashboard)/dashboard/loading.tsx` and `app/explore/loading.tsx`
 * to show a believable preview of the route while Supabase queries are in flight.
 *
 * Design notes:
 *  - Imports come from 'motion/react' (project standardized on `motion` v12, not framer-motion).
 *  - Palette is the project maroon set (#3d0000 / #fff0f0 / #fadbdb / #7d6161 / #dbc1bc).
 *  - The search-icon "hop" uses ResizeObserver-driven positioning rather than the user's
 *    hardcoded xBase/yBase/xStep/yStep pixel offsets — chosen over percentage-anchored
 *    math because the responsive grid wraps to different column counts at different
 *    breakpoints (1 / 2 / 3 / 4 cols depending on viewport), and only direct DOM
 *    measurement adapts cleanly to any `cols` configuration the wrappers pass in.
 *    Tradeoff: adds a small measurement effect (one ResizeObserver on the grid wrapper),
 *    but precision wins over simplicity here because the hop is the most visible part
 *    of the animation.
 *  - Honors `useReducedMotion()` — when the OS-level "Reduce motion" preference is on,
 *    every animated element collapses to a static maroon panel (no looping pulse, no hop).
 */

export interface AnimatedLoadingSkeletonProps {
  /** Number of placeholder cards to render. Default: 6. */
  cardCount?: number
  /** Responsive column counts. Default: { base: 1, sm: 2, md: 3 }. */
  cols?: {
    base?: 1
    sm?: 1 | 2
    md?: 1 | 2 | 3
    lg?: 1 | 2 | 3 | 4
  }
  /** Show the glowing search icon hopping between cards. Default: true. */
  showSearchIcon?: boolean
  /** Extra classes on the outer wrapper. */
  className?: string
}

/**
 * Build the responsive Tailwind grid-cols string from the `cols` prop.
 * Tailwind needs literal class names so it can ship them in the production bundle;
 * we enumerate every supported combination rather than interpolating numbers.
 */
function buildGridColsClass(cols: AnimatedLoadingSkeletonProps['cols']): string {
  const base = cols?.base ?? 1
  const sm = cols?.sm
  const md = cols?.md
  const lg = cols?.lg

  const parts: string[] = []
  // base
  parts.push(base === 1 ? 'grid-cols-1' : 'grid-cols-1')
  // sm
  if (sm === 1) parts.push('sm:grid-cols-1')
  else if (sm === 2) parts.push('sm:grid-cols-2')
  // md
  if (md === 1) parts.push('md:grid-cols-1')
  else if (md === 2) parts.push('md:grid-cols-2')
  else if (md === 3) parts.push('md:grid-cols-3')
  // lg
  if (lg === 1) parts.push('lg:grid-cols-1')
  else if (lg === 2) parts.push('lg:grid-cols-2')
  else if (lg === 3) parts.push('lg:grid-cols-3')
  else if (lg === 4) parts.push('lg:grid-cols-4')

  return parts.join(' ')
}

interface CardCenter {
  x: number
  y: number
}

export function AnimatedLoadingSkeleton({
  cardCount = 6,
  cols,
  showSearchIcon = true,
  className,
}: AnimatedLoadingSkeletonProps) {
  const prefersReducedMotion = useReducedMotion()
  const gridRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])
  const [centers, setCenters] = useState<CardCenter[]>([])
  const controls = useAnimation()

  const gridColsClass = buildGridColsClass(cols)

  // Measure card centers relative to the grid wrapper.
  // Re-runs on resize so the search-icon hop tracks the grid as it reflows.
  useEffect(() => {
    if (!gridRef.current) return
    if (!showSearchIcon) return

    const measure = () => {
      const grid = gridRef.current
      if (!grid) return
      const gridRect = grid.getBoundingClientRect()
      const next: CardCenter[] = []
      for (let i = 0; i < cardCount; i++) {
        const card = cardRefs.current[i]
        if (!card) continue
        const r = card.getBoundingClientRect()
        next.push({
          x: r.left - gridRect.left + r.width / 2,
          y: r.top - gridRect.top + r.height / 2,
        })
      }
      setCenters(next)
    }

    measure()

    const ro = new ResizeObserver(() => measure())
    ro.observe(gridRef.current)
    cardRefs.current.forEach((c) => {
      if (c) ro.observe(c)
    })

    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [cardCount, showSearchIcon, cols])

  // Drive the search-icon hop loop.
  // Skips entirely when reduced motion is preferred — badge sits at card 0.
  useEffect(() => {
    if (!showSearchIcon) return
    if (prefersReducedMotion) return
    if (centers.length === 0) return

    let cancelled = false

    const run = async () => {
      // initial place at card 0 instantly
      await controls.start({
        x: centers[0].x,
        y: centers[0].y,
        transition: { duration: 0 },
      })
      let i = 0
      while (!cancelled) {
        // dwell on current card
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 300)
          // best-effort cancel on unmount
          return () => clearTimeout(t)
        })
        if (cancelled) break
        i = (i + 1) % centers.length
        await controls.start({
          x: centers[i].x,
          y: centers[i].y,
          transition: { duration: 0.65, ease: 'easeInOut' },
        })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [centers, controls, prefersReducedMotion, showSearchIcon])

  return (
    <div className={cn('relative w-full', className)}>
      <div
        ref={gridRef}
        className={cn('relative grid gap-4', gridColsClass)}
      >
        {Array.from({ length: cardCount }).map((_, idx) => {
          const delay = idx * 0.12
          return (
            <div
              key={idx}
              ref={(el) => {
                cardRefs.current[idx] = el
              }}
              className="relative aspect-[9/16] rounded-2xl border border-[#dbc1bc]/30 overflow-hidden"
            >
              {prefersReducedMotion ? (
                <div className="absolute inset-0 bg-[#fff0f0]" />
              ) : (
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    backgroundColor: ['#fff0f0', '#fadbdb', '#fff0f0'],
                  }}
                  transition={{
                    duration: 1.6,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                    delay,
                  }}
                />
              )}

              {/* Title + meta bars near the bottom of the card */}
              <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2">
                {prefersReducedMotion ? (
                  <>
                    <div className="h-3 w-3/4 rounded-full bg-[#fadbdb]" />
                    <div className="h-3 w-1/2 rounded-full bg-[#fadbdb]" />
                  </>
                ) : (
                  <>
                    <motion.div
                      className="h-3 w-3/4 rounded-full"
                      animate={{
                        backgroundColor: ['#fadbdb', '#fff0f0', '#fadbdb'],
                      }}
                      transition={{
                        duration: 1.6,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'easeInOut',
                        delay,
                      }}
                    />
                    <motion.div
                      className="h-3 w-1/2 rounded-full"
                      animate={{
                        backgroundColor: ['#fadbdb', '#fff0f0', '#fadbdb'],
                      }}
                      transition={{
                        duration: 1.6,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'easeInOut',
                        delay: delay + 0.08,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}

        {showSearchIcon && centers.length > 0 && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-12 rounded-full bg-[#fff8f7]"
            style={{
              boxShadow: '0 0 24px rgba(61, 0, 0, 0.35)',
            }}
            initial={{
              x: centers[0].x,
              y: centers[0].y,
            }}
            animate={prefersReducedMotion ? undefined : controls}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3d0000"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="20" y1="20" x2="16.65" y2="16.65" />
            </svg>
          </motion.div>
        )}
      </div>
    </div>
  )
}
