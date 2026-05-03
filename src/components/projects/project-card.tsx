'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { deleteProject } from '@/app/(dashboard)/dashboard/actions'
import { EditVisibilityModal } from './edit-visibility-modal'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates'
import type { Project } from '@/lib/types/project'
import type { Slide } from '@/lib/types/slide'
import type { BrandKit } from '@/lib/types/brand-kit'

export interface ProjectPublishedState {
  publishedId: string
  slug: string
  tags: string[]
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

interface ProjectCardProps {
  project: Project
  publishedState?: ProjectPublishedState | null
  brandKit?: BrandKit | null
}

export function ProjectCard({ project, publishedState, brandKit }: ProjectCardProps) {
  const router = useRouter()
  const slides = (project.slide_data ?? []) as Slide[]
  const [menuOpen, setMenuOpen] = useState(false)
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  // Lazy-mount the heavy <SlidePreview> only when the card scrolls into view.
  // Below-the-fold cards render a lightweight <img> placeholder until then,
  // keeping initial paint snappy on dashboards with many projects. Once
  // mounted, the preview stays mounted (sticky-true) so flipping slides
  // and scrolling back keeps state without re-render cost.
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  const menuWrapperRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const isPublic = !!publishedState
  const template = getTemplate(project.template_id ?? 'highlight-bar')
  const safeIndex = Math.min(currentSlideIndex, Math.max(0, slides.length - 1))
  const currentSlide = slides[safeIndex]
  const hasMultipleSlides = slides.length > 1
  const isFirstSlide = safeIndex === 0
  const isLastSlide = safeIndex === slides.length - 1

  function handlePrevSlide(e: React.MouseEvent) {
    e.stopPropagation()
    setCurrentSlideIndex((i) => Math.max(0, i - 1))
  }

  function handleNextSlide(e: React.MouseEvent) {
    e.stopPropagation()
    setCurrentSlideIndex((i) => Math.min(slides.length - 1, i + 1))
  }

  function handleCardClick() {
    router.push(`/project/${project.id}`)
  }

  // Outside-click closes the menu
  useEffect(() => {
    if (!menuOpen) return
    function handleMouseDown(event: MouseEvent) {
      if (
        menuWrapperRef.current &&
        !menuWrapperRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [menuOpen])

  // IntersectionObserver-based lazy mount. rootMargin pre-mounts the preview
  // ~one card-height before it enters the viewport so users with fast scroll
  // don't see the placeholder→preview swap mid-card. Disconnects after the
  // first intersection — the preview stays mounted for the lifetime of the
  // card. Falls back to immediate-mount on environments without IO (SSR /
  // very old browsers).
  useEffect(() => {
    if (hasBeenVisible) return
    const el = thumbRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setHasBeenVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasBeenVisible])

  function handleMenuToggle(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen((v) => !v)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return
    await deleteProject(project.id)
  }

  function handleEditVisibility(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    setVisibilityModalOpen(true)
  }

  return (
    <>
    <div className="group cursor-pointer" onClick={handleCardClick}>
      <div
        ref={thumbRef}
        className="aspect-[9/16] bg-[#fadbdb] rounded-xl overflow-hidden relative mb-4 transition-all duration-300 group-hover:scale-[1.02]"
      >
        {currentSlide ? (
          hasBeenVisible ? (
            <SlidePreview
              slide={currentSlide}
              template={template}
              index={safeIndex}
              slideIndex={safeIndex}
              totalSlides={slides.length}
              topic={project.topic ?? undefined}
              editable={false}
              brandKit={brandKit ?? null}
            />
          ) : currentSlide.background_url ? (
            <img
              src={currentSlide.background_url}
              alt={project.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ backgroundColor: template.backgroundColor }}
              aria-hidden
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="auto_awesome_motion" size="xl" className="text-[#dbc1bc]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#3d0000]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 pointer-events-none">
          <span className="text-white text-[0.75rem] font-bold uppercase tracking-widest">Open Editor</span>
        </div>
        {hasMultipleSlides && (
          <>
            <button
              type="button"
              onClick={handlePrevSlide}
              disabled={isFirstSlide}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow-md text-[#3d0000] flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
            >
              <Icon name="chevron_left" size="sm" />
            </button>
            <button
              type="button"
              onClick={handleNextSlide}
              disabled={isLastSlide}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow-md text-[#3d0000] flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
            >
              <Icon name="chevron_right" size="sm" />
            </button>
            <span
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-white/90 text-[#3d0000] text-[0.6rem] font-bold tracking-wider tabular-nums opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              aria-live="polite"
            >
              {safeIndex + 1} / {slides.length}
            </span>
          </>
        )}
        {/* More-actions menu (3 dots → Delete) */}
        <div
          ref={menuWrapperRef}
          className={`absolute top-2 right-2 transition-opacity ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            onClick={handleMenuToggle}
            className="p-1.5 bg-white/90 rounded-full hover:bg-white shadow-sm"
            aria-label={`More actions for ${project.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Icon name="more_vert" size="sm" className="text-[#3d0000]" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="absolute top-full right-0 mt-1 min-w-[160px] bg-white rounded-lg shadow-lg ring-1 ring-black/5 py-1 z-20"
            >
              <button
                role="menuitem"
                onClick={handleEditVisibility}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#3d0000] hover:bg-[#fff0f0] transition-colors"
              >
                <Icon name="visibility" size="sm" />
                Edit visibility
              </button>
              <button
                role="menuitem"
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Icon name="delete" size="sm" />
                Delete
              </button>
            </div>
          )}
        </div>
        {isPublic && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#3d0000] text-white text-[0.625rem] font-bold uppercase tracking-wider">
            Public
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-[#3d0000] truncate">{project.title}</h3>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[#7d6161]">
          {slides.length} slide{slides.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[0.65rem] text-[#dbc1bc]">&bull;</span>
        <span className="text-[0.65rem] font-medium text-[#7d6161]">
          {relativeTime(project.updated_at)}
        </span>
      </div>
    </div>
    <EditVisibilityModal
      open={visibilityModalOpen}
      onClose={() => setVisibilityModalOpen(false)}
      projectId={project.id}
      defaultTitle={project.title}
      initialVisibility={isPublic ? 'public' : 'private'}
      initialTags={publishedState?.tags ?? []}
    />
    </>
  )
}
