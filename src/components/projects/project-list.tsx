'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProjectCard, type ProjectPublishedState } from './project-card'
import { StartNewProject } from './start-new-project'
import { Icon } from '@/components/ui/icon'
import type { Project } from '@/lib/types/project'
import type { BrandKit } from '@/lib/types/brand-kit'

interface ProjectListProps {
  projects: Project[]
  showCreateOnly?: boolean
  publishedByProjectId?: Record<string, ProjectPublishedState>
  brandKit?: BrandKit | null
}

// quick-260510-modal-on-prompt-page: anyone hitting /dashboard?new=1 (legacy
// URL from before this change) gets the new flow auto-fired and the param
// dropped off the URL. Rendered as a hidden StartNewProject child so the
// effect runs in the same component tree that owns the start fn.
function LegacyNewQueryBridge() {
  return (
    <StartNewProject>
      {({ start }) => <LegacyNewQueryEffect start={start} />}
    </StartNewProject>
  )
}

function LegacyNewQueryEffect({ start }: { start: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const wantsNew = searchParams.get('new') === '1'
  const firedRef = useRef(false)
  useEffect(() => {
    if (!wantsNew || firedRef.current) return
    firedRef.current = true
    router.replace('/dashboard')
    start()
  }, [wantsNew, router, start])
  return null
}

export function ProjectList({ projects, showCreateOnly, publishedByProjectId, brandKit }: ProjectListProps) {
  if (showCreateOnly) {
    return (
      <StartNewProject>
        {({ start, pending }) => (
          <button
            type="button"
            onClick={start}
            disabled={pending}
            className="bg-[#3d0000] text-white px-8 py-4 rounded-xl font-bold tracking-tight shadow-lg shadow-[#3d0000]/10 hover:translate-y-[-2px] transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <Icon name="add" size="sm" />
            Create New Slide
          </button>
        )}
      </StartNewProject>
    )
  }

  return (
    <section className="space-y-8">
      <LegacyNewQueryBridge />
      <div className="flex items-center justify-between border-b border-[#dbc1bc]/15 pb-6">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-medium tracking-tight text-[#3d0000] whitespace-nowrap">Recent Carousels</h2>
          <div className="hidden md:flex items-center bg-[#fff0f0] px-4 py-2 rounded-full w-full max-w-sm">
            <Icon name="search" size="sm" className="text-[#7d6161]" />
            <input
              className="bg-transparent border-none focus:ring-0 text-sm font-medium w-full text-[#3d0000] placeholder-[#7d6161]/50 ml-2"
              placeholder="Search carousels..."
              type="text"
            />
          </div>
        </div>
        <span className="text-[0.75rem] font-bold uppercase tracking-widest text-[#3d0000]">
          {projects.length} total
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="auto_awesome_motion" size="xl" className="text-[#dbc1bc] mb-4" />
          <p className="text-lg font-medium text-[#7d6161] mb-2">No carousels yet.</p>
          <p className="text-sm text-[#7d6161]">Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              publishedState={publishedByProjectId?.[project.id] ?? null}
              brandKit={brandKit ?? null}
            />
          ))}
          {/* Start Fresh card — same trigger as header button */}
          <StartNewProject>
            {({ start, pending }) => (
              <button
                type="button"
                onClick={start}
                disabled={pending}
                className="aspect-[9/16] bg-[#fff0f0] border-2 border-dashed border-[#dbc1bc]/30 rounded-xl flex flex-col items-center justify-center gap-4 hover:bg-[#ffe1e1] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-full bg-[#fadbdb] flex items-center justify-center">
                  <Icon name="add" className="text-[#3d0000]" />
                </div>
                <span className="text-[0.75rem] font-bold uppercase tracking-widest text-[#7d6161]">Start Fresh</span>
              </button>
            )}
          </StartNewProject>
        </div>
      )}
    </section>
  )
}
