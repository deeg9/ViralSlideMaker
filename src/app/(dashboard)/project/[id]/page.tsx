import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/types/project'
import type { Slide } from '@/lib/types/slide'
import { GenerationForm } from '@/components/slides/generation-form'
import { SlideGrid } from '@/components/slides/slide-grid'
import { DownloadControls } from '@/components/slides/download-controls'
import { SlideEditor } from '@/components/editor/slide-editor'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const supabase = await createClient()

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
  const createdDate = new Date(p.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to dashboard
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{p.title}</h1>
        {p.description && (
          <p className="text-muted-foreground">{p.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Created on {createdDate}
        </p>
      </div>

      {/* Generating state */}
      {p.generation_status === 'generating' && (
        <div className="rounded-xl border border-border p-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-muted-foreground font-medium">Generating slides...</p>
          </div>
        </div>
      )}

      {/* Generation form: prominent when no slides, collapsible when slides exist */}
      {!hasSlides ? (
        <div className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Create Your Carousel</h2>
          <GenerationForm
            projectId={p.id}
            currentTopic={p.topic}
            currentTemplateId={p.template_id}
            hasSlides={false}
          />
        </div>
      ) : (
        <>
          {/* Slide Editor */}
          <SlideEditor
            initialSlides={slides}
            projectId={p.id}
            templateId={p.template_id ?? 'bold-minimal'}
            topic={p.topic ?? ''}
          />

          {/* Download controls */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Download</h2>
            <DownloadControls
              projectId={p.id}
              slideCount={slides.length}
              projectTitle={p.title}
            />
          </div>

          {/* Regeneration form */}
          <details className="rounded-xl border border-border">
            <summary className="px-6 py-4 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Regenerate with different settings
            </summary>
            <div className="px-6 pb-6">
              <GenerationForm
                projectId={p.id}
                currentTopic={p.topic}
                currentTemplateId={p.template_id}
                hasSlides={true}
              />
            </div>
          </details>
        </>
      )}
    </div>
  )
}
