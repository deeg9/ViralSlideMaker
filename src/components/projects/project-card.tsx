'use client'

import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { deleteProject } from '@/app/(dashboard)/dashboard/actions'
import type { Project } from '@/lib/types/project'
import type { Slide } from '@/lib/types/slide'

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
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const slides = (project.slide_data ?? []) as Slide[]

  function handleCardClick() {
    router.push(`/project/${project.id}`)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return
    await deleteProject(project.id)
  }

  return (
    <div className="group cursor-pointer" onClick={handleCardClick}>
      <div className="aspect-[9/16] bg-[#fadbdb] rounded-xl overflow-hidden relative mb-4 transition-all duration-300 group-hover:scale-[1.02]">
        {slides[0]?.background_url ? (
          <img
            src={slides[0].background_url}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="auto_awesome_motion" size="xl" className="text-[#dbc1bc]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#3d0000]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <span className="text-white text-[0.75rem] font-bold uppercase tracking-widest">Open Editor</span>
        </div>
        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
          aria-label={`Delete ${project.title}`}
        >
          <Icon name="delete" size="sm" className="text-red-600" />
        </button>
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
  )
}
