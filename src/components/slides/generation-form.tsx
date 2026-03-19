'use client'

import { useState, useTransition } from 'react'
import { generateCarousel } from '@/app/(dashboard)/project/[id]/actions'
import { TemplatePicker } from './template-picker'
import { useRouter } from 'next/navigation'

interface GenerationFormProps {
  projectId: string
  currentTopic?: string
  currentTemplateId?: string
  hasSlides: boolean
}

export function GenerationForm({
  projectId,
  currentTopic,
  currentTemplateId,
  hasSlides,
}: GenerationFormProps) {
  const [topic, setTopic] = useState(currentTopic ?? '')
  const [templateId, setTemplateId] = useState(currentTemplateId ?? 'bold-minimal')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return

    setError(null)
    startTransition(async () => {
      const result = await generateCarousel(projectId, topic.trim(), templateId)
      if (!result.success) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="topic" className="text-sm font-medium">
          Topic
        </label>
        <textarea
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter your carousel topic..."
          rows={3}
          disabled={isPending}
          className="rounded-lg border border-border bg-background px-4 py-3 text-sm
            placeholder:text-muted-foreground focus:outline-none focus:ring-2
            focus:ring-foreground/20 disabled:opacity-50 resize-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Template</label>
        <TemplatePicker selectedId={templateId} onSelect={setTemplateId} />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !topic.trim()}
        className="rounded-lg bg-foreground text-background px-6 py-3 text-sm font-medium
          hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating slides...
          </>
        ) : hasSlides ? (
          'Regenerate Carousel'
        ) : (
          'Generate Carousel'
        )}
      </button>
    </form>
  )
}
