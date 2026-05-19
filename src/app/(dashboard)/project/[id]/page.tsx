export const maxDuration = 60

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/types/project'
import type { Slide } from '@/lib/types/slide'
import { GenerationForm } from '@/components/slides/generation-form'
import { ProjectNamingDialog } from '@/components/projects/project-naming-dialog'
import { ReferenceThumbnailsStrip } from '@/components/projects/reference-thumbnails-strip'
// Phase 78 Plan 02 Task 3 (REMIX-05): "Regenerate from references" entry
// point — internally null-renders when reference_assets is null/empty, so
// it's safe to mount unconditionally; the gate lives in the component.
import { RegenerateFromReferencesButton } from '@/components/projects/regenerate-from-references-button'
import { SlideEditor } from '@/components/editor/slide-editor'
import { getUserTier } from '@/lib/credits/check-credits'
import { getBrandKit } from '@/app/(dashboard)/settings/brand-kit/actions'
// quick-260514-g7y: forward ToS clickwrap state into GenerationForm so
// the inlined style-from-reference collapsible can open its clickwrap
// modal on first reference upload (same gate as the deleted standalone
// /style-from-reference/new page).
import { createAdminClient } from '@/lib/supabase/admin'
import { hasUserAcceptedCurrentTos } from '@/lib/legal/audit-log'
import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'
import { acceptStyleFromReferenceTosCurrentVersionAction } from '@/app/(dashboard)/style-from-reference/actions'
// Phase 87 (WIRE-01): server-side DB-backed template fetch for the picker.
import { getPickerDbTemplates } from '@/lib/render/templates/registry'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) {
    notFound()
  }

  const p = project as Project
  const slides = (p.slide_data ?? []) as Slide[]
  const hasSlides = slides.length > 0

  const tier = user ? await getUserTier(user.id) : 'free' as const
  const brandKit = user ? await getBrandKit() : null

  // quick-260514-g7y: pre-compute ToS acceptance server-side so the
  // inlined collapsible can decide to render the clickwrap modal without
  // a client-side round-trip. Same pattern as the deleted standalone
  // /style-from-reference/new page used.
  const tosAlreadyAccepted = user
    ? await hasUserAcceptedCurrentTos(
        createAdminClient(),
        user.id,
        STYLE_FROM_REFERENCE_TOS_VERSION,
      )
    : true

  const { data: publishedRow } = user
    ? await supabase
        .from('published_carousels')
        .select('id, slug, tags')
        .eq('source_project_id', p.id)
        .eq('owner_id', user.id)
        .is('unpublished_at', null)
        .maybeSingle()
    : { data: null }
  const initialPublishedState = publishedRow
    ? {
        publishedId: (publishedRow as { id: string }).id,
        slug: (publishedRow as { slug: string }).slug,
        tags: ((publishedRow as { tags: string[] | null }).tags ?? []) as string[],
      }
    : null

  // Editor mode: render full-width with no extra chrome.
  // Phase 77 EDITOR-03: ReferenceThumbnailsStrip renders ABOVE the editor —
  // it returns null when reference_assets is null/empty, so legacy projects
  // (every pre-v2.13 project) keep the byte-identical full-bleed editor; only
  // style-from-reference projects gain the slim provenance bar.
  if (hasSlides) {
    const hasReferences =
      Array.isArray(p.reference_assets) && p.reference_assets.length > 0
    return (
      <>
        {hasReferences && (
          <div className="flex items-center justify-between gap-3 bg-[#fff5f5] border-b border-[#dbc1bc]/30">
            {/* Strip carries its own background + border; rendered first so
                "Inspired by" reads at the start of the row, regenerate CTA
                trails on the right */}
            <ReferenceThumbnailsStrip references={p.reference_assets ?? null} />
            <div className="px-4">
              <RegenerateFromReferencesButton project={p} />
            </div>
          </div>
        )}
        <SlideEditor
          initialSlides={slides}
          projectId={p.id}
          templateId={p.template_id ?? 'highlight-bar'}
          topic={p.topic ?? ''}
          title={p.title}
          userTier={tier}
          brandKit={brandKit}
          initialPublishedState={initialPublishedState}
        />
      </>
    )
  }

  // Phase 87 (WIRE-01): fetch DB-backed templates server-side and thread
  // them into the generation form so the picker can show them merged under
  // their category. getPickerDbTemplates never throws — a DB read failure
  // degrades to a code-templates-only picker. Fetched here (after the
  // hasSlides editor branch) so it runs only on the generation-form path.
  const dbTemplates = await getPickerDbTemplates()

  return (
    <div className="max-w-3xl mx-auto pt-4 px-4 pb-32 md:pb-12">
      {/* Generating state */}
      {p.generation_status === 'generating' && (
        <div className="rounded-xl bg-[#fff0f0] border border-[#dbc1bc]/20 p-8 text-center mb-8">
          <div className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-5 w-5 text-[#3d0000]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-[#3d0000] font-medium">Generating slides...</p>
          </div>
        </div>
      )}

      <div className="text-center mb-12">
        <h1 className="text-[3.5rem] font-semibold tracking-[-0.02em] leading-tight text-[#3d0000]">
          What shall we create?
        </h1>
      </div>

      <GenerationForm
        projectId={p.id}
        currentTopic={p.topic}
        currentTemplateId={p.template_id}
        currentCategory={p.category}
        hasSlides={false}
        userTier={tier}
        brandKit={brandKit}
        tosAlreadyAccepted={tosAlreadyAccepted}
        acceptTosAction={acceptStyleFromReferenceTosCurrentVersionAction}
        dbTemplates={dbTemplates}
      />

      {/* quick-260510-modal-on-prompt-page: invisible until ?naming=1 is in
          the URL — StartNewProject lands here right after creating the row,
          and the dialog auto-opens for the user to enter a real title. */}
      <ProjectNamingDialog
        projectId={p.id}
        initialTitle={p.title}
        initialDescription={p.description ?? undefined}
      />
    </div>
  )
}
