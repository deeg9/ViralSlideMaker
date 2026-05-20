'use client'

// Phase 81 (R3): Embla welcome modal — 3 slides as of quick-260520-gr3.
// Slide order: Welcome → Topic → Publish.
//
// quick-260520-gr3 (2026-05-20):
//   - Renamed slide 1 to "Welcome to Viral Slide Maker" (was "TikTok
//     Slideshow Creator"); brand is settling on Viral Slide Maker everywhere.
//   - Removed the "Bring your own references" slide — we are pivoting away
//     from references-first messaging in the post-signup tour.
//   - Replaced the Publish-to-share placeholder with a globe SVG; the prior
//     card+arrow+checkmark composition read poorly at modal scale.
//
// Self-gating: reads { needsOnboarding, welcomeSeen, markWelcomeSeen, skipTour }
// from useOnboarding(). Renders nothing when needsOnboarding=false or
// welcomeSeen=true. No props.
//
// D-04: built on shadcn Dialog primitive (@/components/ui/dialog).
// D-05: Embla for the carousel (embla-carousel-react).
// D-06: any motion imports MUST be from `motion/react`, NEVER `framer-motion`.
//       This file uses pure CSS transitions for the dots — no motion import
//       needed.

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { useOnboarding } from './onboarding-provider'

// Locked copy (CONTEXT.md <specifics>). Updated by quick-260520-gr3:
// brand rename + references slide dropped. Three slides now.
const SLIDES = [
  {
    title: 'Welcome to Viral Slide Maker',
    body: 'Type a topic, get a ready-to-post carousel in seconds.',
  },
  {
    title: 'Tell us your topic',
    body: 'Describe what you want, and AI generates the slides.',
  },
  {
    title: 'Publish to share',
    body: 'Your carousel is public by default — share the link or fork ours.',
  },
] as const

export function FirstRunWelcomeDialog() {
  const { needsOnboarding, welcomeSeen, markWelcomeSeen, skipTour } = useOnboarding()
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'center',
    skipSnaps: false,
  })
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setCurrentSlide(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  const isOpen = needsOnboarding && !welcomeSeen

  const handleSkip = useCallback(() => {
    skipTour()
  }, [skipTour])

  const handleGetStarted = useCallback(() => {
    markWelcomeSeen()
  }, [markWelcomeSeen])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Backdrop / Esc / X-button = ephemeral dismiss (welcomeSeen=true, no DB
        // write). The persistent "I'm done with onboarding" write is reserved for
        // the explicit text Skip button (handleSkip → skipTour) and the
        // "Get Started" completion on slide 4 (handleGetStarted → markWelcomeSeen
        // → checklist takes over).
        markWelcomeSeen()
      }
    },
    [markWelcomeSeen],
  )

  const isLastSlide = currentSlide === SLIDES.length - 1
  const isFirstSlide = currentSlide === 0

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0">
        {/* Accessibility: Radix requires DialogTitle + Description. Visible
            heading is the slide-active <h2> below. */}
        <DialogTitle className="sr-only">Welcome to Viral Slide Maker</DialogTitle>
        <DialogDescription className="sr-only">
          First-run introduction. Three slides covering the welcome, how to
          describe a topic, and how publishing works.
        </DialogDescription>

        {/* Visual area: 4 placeholder SVGs swiped by Embla */}
        <div className="embla overflow-hidden" ref={emblaRef}>
          <div className="embla__container flex">
            {SLIDES.map((slide, i) => (
              <div
                key={slide.title}
                className="embla__slide min-w-0 flex-[0_0_100%]"
                aria-hidden={i !== currentSlide}
              >
                <PlaceholderSvg index={i} />
              </div>
            ))}
          </div>
        </div>

        {/* Active title + body */}
        <div className="px-6 pt-5">
          <h2 className="text-2xl font-semibold text-[#3d0000] leading-tight">
            {SLIDES[currentSlide].title}
          </h2>
          <p className="mt-2 text-[15px] text-[#7d6161] leading-relaxed">
            {SLIDES[currentSlide].body}
          </p>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 py-4">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                i === currentSlide ? 'w-6 bg-[#3d0000]' : 'w-1.5 bg-[#dbc1bc]',
              )}
              aria-label={`Go to slide ${i + 1} of ${SLIDES.length}`}
              aria-current={i === currentSlide ? 'true' : undefined}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-2 border-t border-[#fadbdb]/40">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-[#7d6161] hover:text-[#3d0000] transition-colors px-2 py-2"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {!isFirstSlide && (
              <button
                type="button"
                onClick={() => emblaApi?.scrollPrev()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#dbc1bc] text-[#3d0000] bg-white hover:bg-[#fff0f0] transition-colors text-sm font-medium"
              >
                <ChevronLeft className="size-4" />
                Back
              </button>
            )}
            {isLastSlide ? (
              <button
                type="button"
                onClick={handleGetStarted}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#3d0000] text-white hover:opacity-90 transition-opacity text-sm font-semibold"
              >
                Get Started
              </button>
            ) : (
              <button
                type="button"
                onClick={() => emblaApi?.scrollNext()}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#3d0000] text-white hover:opacity-90 transition-opacity text-sm font-semibold"
              >
                Next
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Placeholder SVG visuals per slide. Real product screenshots ship in a
// follow-up quick task (SPEC out-of-scope). Each slide uses a distinct
// arrangement so the carousel feels purposeful.
//
// quick-260520-gr3: 3 slides — palettes/labels indexed 0..2.
//   0: Welcome (stacked carousel cards)
//   1: Topic   (textarea with cursor)
//   2: Publish (globe — "your slides reach the world")
function PlaceholderSvg({ index }: { index: number }) {
  const palettes = [
    { bg: '#fff0f0', fg: '#3d0000', accent: '#dbc1bc' },
    { bg: '#fff0f0', fg: '#7d6161', accent: '#3d0000' },
    { bg: '#fadbdb', fg: '#3d0000', accent: '#ffffff' },
  ] as const
  const labels = ['Welcome', 'Type a topic', 'Publish to share'] as const
  const palette = palettes[index] ?? palettes[0]
  const label = labels[index] ?? ''

  return (
    <svg
      viewBox="0 0 400 240"
      className="w-full h-[240px] block"
      role="img"
      aria-label={label}
    >
      <rect width="400" height="240" fill={palette.bg} />

      {index === 0 && (
        <>
          {/* Stacked carousel-card silhouette */}
          <rect x="120" y="50" width="160" height="120" rx="14" fill={palette.accent} opacity="0.7" />
          <rect x="140" y="40" width="160" height="120" rx="14" fill={palette.fg} opacity="0.92" />
          <rect x="160" y="30" width="160" height="120" rx="14" fill={palette.accent} />
          <circle cx="240" cy="90" r="18" fill={palette.bg} />
          <rect x="180" y="120" width="120" height="6" rx="3" fill={palette.bg} opacity="0.7" />
          <rect x="180" y="134" width="84" height="6" rx="3" fill={palette.bg} opacity="0.55" />
        </>
      )}

      {index === 1 && (
        <>
          {/* Topic textarea with a cursor */}
          <rect x="70" y="60" width="260" height="120" rx="14" fill="#ffffff" stroke={palette.accent} strokeWidth="2" />
          <rect x="90" y="80" width="180" height="6" rx="3" fill={palette.accent} />
          <rect x="90" y="96" width="220" height="6" rx="3" fill={palette.accent} />
          <rect x="90" y="112" width="120" height="6" rx="3" fill={palette.accent} />
          <line x1="218" y1="106" x2="218" y2="122" stroke={palette.fg} strokeWidth="2" />
        </>
      )}

      {index === 2 && (
        <>
          {/* Globe — outer disc, equator, prime meridian, two secondary
              meridians. Slightly off-center so the modal feels alive. The
              "world reach" metaphor reads cleanly at 200x200. */}
          <circle cx="200" cy="108" r="72" fill={palette.accent} />
          <circle
            cx="200"
            cy="108"
            r="72"
            fill="none"
            stroke={palette.fg}
            strokeWidth="3"
          />
          {/* Equator */}
          <line
            x1="128"
            y1="108"
            x2="272"
            y2="108"
            stroke={palette.fg}
            strokeWidth="2.5"
          />
          {/* Latitude bands (ellipses) for spherical feel */}
          <ellipse
            cx="200"
            cy="108"
            rx="72"
            ry="28"
            fill="none"
            stroke={palette.fg}
            strokeWidth="1.5"
            opacity="0.6"
          />
          <ellipse
            cx="200"
            cy="108"
            rx="72"
            ry="56"
            fill="none"
            stroke={palette.fg}
            strokeWidth="1.5"
            opacity="0.45"
          />
          {/* Prime meridian */}
          <line
            x1="200"
            y1="36"
            x2="200"
            y2="180"
            stroke={palette.fg}
            strokeWidth="2.5"
          />
          {/* Side meridians (elliptical arcs approximated as ellipses) */}
          <ellipse
            cx="200"
            cy="108"
            rx="36"
            ry="72"
            fill="none"
            stroke={palette.fg}
            strokeWidth="1.5"
            opacity="0.7"
          />
        </>
      )}

      <text
        x="200"
        y="222"
        textAnchor="middle"
        fontSize="11"
        fill={palette.fg}
        opacity="0.65"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  )
}
