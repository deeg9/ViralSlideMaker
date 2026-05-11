import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProjectList } from '@/components/projects/project-list'
import type { ProjectPublishedState } from '@/components/projects/project-card'
import { Icon } from '@/components/ui/icon'
import { getCreditBalance, getUserTier, checkProjectLimit } from '@/lib/credits/check-credits'
import { TIER_CREDITS } from '@/lib/credits/types'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt'
import type { Project } from '@/lib/types/project'
import type { BrandKit } from '@/lib/types/brand-kit'

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

  // Single brand-kit fetch shared across every dashboard card so each
  // ProjectCard's <SlidePreview> renders with the same brand-kit overrides
  // the editor and Satori export use. One DB read for the whole grid.
  const { data: brandKitRow } = user
    ? await supabase
        .from('brand_kits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null }
  const brandKit = (brandKitRow as BrandKit | null) ?? null

  const { data: publishedRows } = user
    ? await supabase
        .from('published_carousels')
        .select('id, slug, tags, source_project_id')
        .eq('owner_id', user.id)
        .is('unpublished_at', null)
        .order('published_at', { ascending: false })
    : { data: [] }
  const publishedByProjectId: Record<string, ProjectPublishedState> = {}
  for (const row of (publishedRows as Array<{
    id: string
    slug: string
    tags: string[] | null
    source_project_id: string | null
  }> | null) ?? []) {
    if (!row.source_project_id) continue
    if (publishedByProjectId[row.source_project_id]) continue
    publishedByProjectId[row.source_project_id] = {
      publishedId: row.id,
      slug: row.slug,
      tags: row.tags ?? [],
    }
  }

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

      {/* Phase 76 Plan 03 — entry-point CTA for the v2.13 spec-from-reference
          flow. Sits beside the existing project-creation affordance so users
          discover the new path on first visit. Card-style for visual parity
          with neighboring summary cards. Copy uses "Inspired by" framing per
          LEGAL-03 forward-compat. */}
      <section>
        <Link
          href="/style-from-reference/new"
          data-testid="from-references-cta"
          className="block rounded-2xl border border-[#dbc1bc] bg-white p-6 hover:border-[#3d0000] transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <Icon name="image" className="text-[#3d0000]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#3d0000] mb-1">
                From references
              </h3>
              <p className="text-sm text-[#7d6161]">
                Upload up to 8 images and generate a slideshow inspired by their style.
              </p>
            </div>
          </div>
        </Link>
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

      {/* Recent Carousels */}
      <ProjectList
        projects={projectList}
        publishedByProjectId={publishedByProjectId}
        brandKit={brandKit}
      />
    </div>
  )
}
