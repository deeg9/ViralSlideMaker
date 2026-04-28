export const maxDuration = 60

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/types/project'
import type { Slide } from '@/lib/types/slide'
import { GenerationForm } from '@/components/slides/generation-form'
import { SlideEditor } from '@/components/editor/slide-editor'
import { getUserTier } from '@/lib/credits/check-credits'
import { getBrandKit } from '@/app/(dashboard)/settings/brand-kit/actions'

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

  // Editor mode: render full-width with no extra chrome
  if (hasSlides) {
    return (
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
    )
  }

  return (
    <div className="max-w-3xl mx-auto pt-4">
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
        hasSlides={false}
        userTier={tier}
        brandKit={brandKit}
      />
    </div>
  )
}
