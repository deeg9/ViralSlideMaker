// Generation runs as a Server Action invoked from the inlined GenerationForm
// below; that action executes under THIS route's config, so mirror the
// /project/[id] page's allowance for slow AI-image generations.
export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProjectList } from '@/components/projects/project-list'
import type { ProjectPublishedState } from '@/components/projects/project-card'
import { getCreditBalance, getUserTier, checkProjectLimit } from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt'
import { FirstRunWelcomeDialog } from '@/components/onboarding/first-run-welcome-dialog'
import { GenerationForm } from '@/components/slides/generation-form'
import { createProjectService } from '@/lib/services/projects'
import { getPickerDbTemplates } from '@/lib/render/templates/registry'
import { hasUserAcceptedCurrentTos } from '@/lib/legal/audit-log'
import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'
import { acceptStyleFromReferenceTosCurrentVersionAction } from '@/app/(dashboard)/style-from-reference/actions'
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
  const canCreateProject = user ? await checkProjectLimit(user.id, tier) : true

  // The dashboard now hosts the carousel-creation form inline. GenerationForm
  // needs a real project to write into (file uploads + the generate actions),
  // so reuse the user's existing empty draft if there is one, else create one.
  // This keeps at most one throwaway "Untitled Project" around — consistent
  // with the render-time bootstrap that ensureSubscription already does above.
  const emptyDraft = projectList.find(
    (p) => p.generation_status === 'draft' && (p.slide_data ?? []).length === 0,
  )
  let scratchProjectId = emptyDraft?.id ?? null
  if (!scratchProjectId && user && canCreateProject) {
    const created = await createProjectService(supabase, user.id, {
      title: 'Untitled Project',
      description: null,
    })
    scratchProjectId = created?.id ?? null
  }

  // Server-side props for the inlined GenerationForm — same data the
  // /project/[id] empty-state page feeds it. Skipped when there's no form.
  const dbTemplates = scratchProjectId ? await getPickerDbTemplates() : []
  const tosAlreadyAccepted = user
    ? await hasUserAcceptedCurrentTos(
        createAdminClient(),
        user.id,
        STYLE_FROM_REFERENCE_TOS_VERSION,
      )
    : true

  return (
    <div className="space-y-16">
      {/* Welcome Header */}
      <section>
        <h1 className="text-[3.5rem] font-semibold tracking-tighter text-[#3d0000] leading-tight">
          Welcome back, {userName}!
        </h1>
      </section>

      {/* Carousel creation form — moved here from the /project/[id] empty
          state. Renders into a reused/created scratch draft project; on a
          successful generation it navigates to that project's editor. */}
      {scratchProjectId && (
        <section className="max-w-3xl mx-auto w-full">
          <GenerationForm
            projectId={scratchProjectId}
            currentTopic={emptyDraft?.topic}
            currentTemplateId={emptyDraft?.template_id}
            currentCategory={emptyDraft?.category}
            hasSlides={false}
            userTier={tier}
            tosAlreadyAccepted={tosAlreadyAccepted}
            acceptTosAction={acceptStyleFromReferenceTosCurrentVersionAction}
            dbTemplates={dbTemplates}
            redirectToEditorOnSuccess
          />
        </section>
      )}

      {/* Upgrade Prompts */}
      {balance <= 0 && tier === 'free' && (
        <UpgradePrompt context="generation" />
      )}
      {!canCreateProject && tier === 'free' && (
        <UpgradePrompt context="project_limit" />
      )}

      {/* Recent Carousels — the scratch draft is excluded so the empty
          project backing the form above doesn't show as a duplicate card. */}
      <ProjectList
        projects={projectList.filter((p) => p.id !== scratchProjectId)}
        publishedByProjectId={publishedByProjectId}
      />

      {/* Phase 81: first-run tour welcome modal. Self-gating — renders nothing
          when the user has already completed/skipped the tour or has dismissed
          the welcome to start the checklist. Provider is mounted by the
          (dashboard)/layout.tsx wrapper. */}
      <FirstRunWelcomeDialog />
    </div>
  )
}
