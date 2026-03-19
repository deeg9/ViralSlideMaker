import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/types/project'

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

      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          Slide editor coming soon.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Phase 2 will bring the full AI-powered slide editor.
        </p>
      </div>
    </div>
  )
}
