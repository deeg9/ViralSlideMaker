import { createClient } from '@/lib/supabase/server'
import { ProjectList } from '@/components/projects/project-list'
import type { Project } from '@/lib/types/project'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your slideshow projects
        </p>
      </div>
      <ProjectList projects={(projects as Project[]) ?? []} />
    </div>
  )
}
