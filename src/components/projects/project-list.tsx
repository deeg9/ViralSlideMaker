import { CreateProjectDialog } from './create-project-dialog'
import { ProjectCard, type ProjectPublishedState } from './project-card'
import { Icon } from '@/components/ui/icon'
import type { Project } from '@/lib/types/project'

interface ProjectListProps {
  projects: Project[]
  showCreateOnly?: boolean
  publishedByProjectId?: Record<string, ProjectPublishedState>
}

export function ProjectList({ projects, showCreateOnly, publishedByProjectId }: ProjectListProps) {
  if (showCreateOnly) {
    return <CreateProjectDialog />
  }

  return (
    <section className="space-y-8">
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
            />
          ))}
          {/* Start Fresh card */}
          <CreateProjectDialog asPlaceholderCard />
        </div>
      )}
    </section>
  )
}
