import { createClient } from '@/lib/supabase/server'
import { ProjectList } from '@/components/projects/project-list'
import { PublishedList, type PublishedCarouselRow } from '@/components/dashboard/published-list'
import { Icon } from '@/components/ui/icon'
import { getCreditBalance, getUserTier, checkProjectLimit } from '@/lib/credits/check-credits'
import { TIER_CREDITS } from '@/lib/credits/types'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt'
import type { Project } from '@/lib/types/project'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    : { data: null }
  const userName =
    (profile?.display_name as string | null) ||
    (user?.user_metadata?.first_name as string) ||
    user?.email?.split('@')[0] ||
    'User'

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  const projectList = (projects as Project[]) ?? []

  const { data: publishedRows } = user
    ? await supabase
        .from('published_carousels')
        .select('id, slug, title, hero_image_url, bookmark_count, remix_count, unpublished_at')
        .eq('owner_id', user.id)
        .order('published_at', { ascending: false })
    : { data: [] }
  const published = (publishedRows as PublishedCarouselRow[] | null) ?? []

  // Ensure subscription exists (bootstraps free tier if needed)
  if (user) await ensureSubscription(user.id)

  // AI Credits based on user's subscription tier
  const tier = user ? await getUserTier(user.id) : 'free' as const
  const balance = user ? await getCreditBalance(user.id) : 0
  const monthlyAllowance = TIER_CREDITS[tier]
  const canCreateProject = user ? await checkProjectLimit(user.id, tier) : true

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
            <p className="text-3xl font-semibold text-[#3d0000] mt-1">{balance}</p>
            <p className="text-xs text-[#7d6161] mt-0.5">{balance} of {monthlyAllowance} credits ({tier})</p>
          </div>
        </div>
      </section>

      {/* Upgrade Prompts */}
      {balance <= 0 && tier === 'free' && (
        <UpgradePrompt context="generation" />
      )}
      {!canCreateProject && tier === 'free' && (
        <UpgradePrompt context="project_limit" />
      )}

      {/* Published to Explore */}
      <PublishedList rows={published} />

      {/* Recent Carousels */}
      <ProjectList projects={projectList} />
    </div>
  )
}
