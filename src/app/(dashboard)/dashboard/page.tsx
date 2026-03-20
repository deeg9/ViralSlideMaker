import { createClient } from '@/lib/supabase/server'
import { ProjectList } from '@/components/projects/project-list'
import { Icon } from '@/components/ui/icon'
import { checkCredits } from '@/lib/credits/check-credits'
import type { Project } from '@/lib/types/project'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userName = user?.email?.split('@')[0] ?? 'User'

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  const projectList = (projects as Project[]) ?? []

  // AI Credits based on user's subscription tier
  const credits = await checkCredits()
  const totalCredits = credits.limit
  const remaining = credits.remaining

  return (
    <div className="space-y-16">
      {/* Welcome Header */}
      <section className="flex items-center justify-between gap-8">
        <h1 className="text-[3.5rem] font-semibold tracking-tighter text-[#3d0000] leading-tight">
          Welcome back, {userName}!
        </h1>
        <div className="flex-shrink-0">
          <ProjectList projects={projectList} showCreateOnly />
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#fff0f0] p-8 rounded-xl flex flex-col gap-4">
          <Icon name="folder_open" className="text-[#3d0000]" />
          <div>
            <p className="text-[0.75rem] font-bold uppercase tracking-widest text-[#7d6161]">Active Projects</p>
            <p className="text-3xl font-semibold text-[#3d0000] mt-1">{projectList.length}</p>
          </div>
        </div>
        <div className="bg-[#fff0f0] p-8 rounded-xl flex flex-col gap-4">
          <Icon name="edit_note" className="text-[#3d0000]" />
          <div>
            <p className="text-[0.75rem] font-bold uppercase tracking-widest text-[#7d6161]">Drafts</p>
            <p className="text-3xl font-semibold text-[#3d0000] mt-1">
              {projectList.filter(p => p.generation_status === 'draft').length}
            </p>
          </div>
        </div>
        <div className="bg-[#fadbdb] p-8 rounded-xl flex flex-col gap-4">
          <Icon name="bolt" className="text-[#3d0000]" />
          <div>
            <p className="text-[0.75rem] font-bold uppercase tracking-widest text-[#3d0000]">AI Credits</p>
            <p className="text-3xl font-semibold text-[#3d0000] mt-1">{remaining}</p>
            <p className="text-xs text-[#7d6161] mt-0.5">{remaining} of {totalCredits} this month</p>
          </div>
        </div>
      </section>

      {/* Recent Carousels */}
      <ProjectList projects={projectList} />
    </div>
  )
}
