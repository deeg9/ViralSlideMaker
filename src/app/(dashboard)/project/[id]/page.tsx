export const maxDuration = 60

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/types/project'
import type { Slide } from '@/lib/types/slide'
import { GenerationForm } from '@/components/slides/generation-form'
import { SlideEditor } from '@/components/editor/slide-editor'
import { getUserTier } from '@/lib/credits/check-credits'

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

  // Editor mode: render full-width with no extra chrome
  if (hasSlides) {
    return (
      <SlideEditor
        initialSlides={slides}
        projectId={p.id}
        templateId={p.template_id ?? 'bold-minimal'}
        topic={p.topic ?? ''}
        title={p.title}
        userTier={tier}
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
        <h1 className="text-[3.5rem] font-semibold tracking-[-0.02em] leading-tight text-[#3d0000] mb-4">
          What shall we create?
        </h1>
        <p className="text-[#55423f] max-w-lg mx-auto leading-relaxed">
          Describe your presentation goals and our AI will curate the narrative structure and visual flow for you.
        </p>
      </div>

      <GenerationForm
        projectId={p.id}
        currentTopic={p.topic}
        currentTemplateId={p.template_id}
        hasSlides={false}
        userTier={tier}
      />
    </div>
  )
}
