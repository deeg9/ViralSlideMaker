'use client'

// Phase 86 (ADMIN-01) — the Save-as-Template client form. Mirrors the form
// idiom of claim-username-form.tsx: native controls, useTransition submit,
// inline success/error blocks. Posts { projectId, name, category } to the
// admin-gated /api/admin/templates endpoint.

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { CONTENT_CATEGORIES } from '@/lib/ai/categories'

interface ProjectOption {
  id: string
  title: string
  template_id: string | null
  slide_data: unknown[]
}

type Result =
  | null
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

const INPUT_CLASS =
  'w-full rounded-xl border border-[#dbc1bc]/60 bg-white px-3 py-3 text-sm text-[#3d0000] focus:border-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#3d0000]/20'

// Title-case a category id for the select option label (news -> News).
function categoryLabel(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

export function SaveTemplateForm({ projects }: { projects: ProjectOption[] }) {
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [result, setResult] = useState<Result>(null)
  const [isSubmitting, startSubmit] = useTransition()

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  // No-projects empty state — the admin has nothing to save yet.
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-[#dbc1bc]/60 bg-white px-6 py-8 text-center">
        <h2 className="text-base font-semibold text-[#3d0000]">No carousels yet</h2>
        <p className="mt-1.5 text-sm text-[#7d6161]">
          Create a carousel first, then come back to save it as a template.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#3d0000] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-[#3d0000]/90 active:scale-95"
        >
          Go to dashboard
        </Link>
      </div>
    )
  }

  const canSubmit =
    !!selectedProjectId && name.trim().length > 0 && !!category && !isSubmitting

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    startSubmit(async () => {
      try {
        const res = await fetch('/api/admin/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProjectId,
            name: name.trim(),
            category,
          }),
        })
        if (res.ok) {
          setResult({
            kind: 'success',
            message:
              'Template saved. It appears in the picker for everyone within a minute.',
          })
          setSelectedProjectId('')
          setName('')
          setCategory('')
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          const reason = data.error ?? 'unknown error'
          setResult({
            kind: 'error',
            message: `Couldn’t save the template: ${reason}. Check your selection and try again.`,
          })
        }
      } catch {
        setResult({
          kind: 'error',
          message:
            'Couldn’t save the template: network error. Check your selection and try again.',
        })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Source carousel */}
      <div>
        <label htmlFor="source-carousel" className="mb-1.5 block text-sm font-semibold text-[#3d0000]">
          Source carousel
        </label>
        <select
          id="source-carousel"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Select a carousel</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-[#7d6161]">
          Pick one of your carousels — its cover slide becomes the template preview.
        </p>
      </div>

      {/* Template name */}
      <div>
        <label htmlFor="template-name" className="mb-1.5 block text-sm font-semibold text-[#3d0000]">
          Template name
        </label>
        <input
          id="template-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bold News Headline"
          className={INPUT_CLASS}
          maxLength={80}
        />
        <p className="mt-1.5 text-xs text-[#7d6161]">
          Shown in the picker. A URL-safe id is generated from this name.
        </p>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="template-category" className="mb-1.5 block text-sm font-semibold text-[#3d0000]">
          Category
        </label>
        <select
          id="template-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Choose a category</option>
          {CONTENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </div>

      {/* Picker preview */}
      <div>
        <h2 className="mb-1.5 text-sm font-semibold text-[#3d0000]">Picker preview</h2>
        <div className="aspect-[9/16] w-40 overflow-hidden rounded-xl border border-[#dbc1bc]/60 bg-white">
          {selectedProject ? (
            <div className="flex h-full w-full items-center justify-center bg-[#fff0f0] p-3 text-center">
              <span className="text-[11px] font-semibold leading-tight text-[#3d0000]">
                {selectedProject.title}
              </span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-3 text-center">
              <span className="text-[11px] text-[#7d6161]">
                Select a carousel to preview its cover slide.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Success / error blocks */}
      {result?.kind === 'success' && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {result.message}
        </div>
      )}
      {result?.kind === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center rounded-xl bg-[#3d0000] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-[#3d0000]/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
      >
        {isSubmitting ? 'Saving…' : 'Save as template'}
      </button>
    </form>
  )
}
