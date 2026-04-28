'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { publishProjectToExplore } from '@/app/(dashboard)/project/[id]/publish-actions'

export function PublishModal({
  projectId,
  defaultTitle,
  open,
  onClose,
}: {
  projectId: string
  defaultTitle: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('tags', tags)

    startTransition(async () => {
      const result = await publishProjectToExplore(projectId, formData)
      if (result.success) {
        router.push(`/explore/${result.slug}?published=1`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 border border-[#dbc1bc]/40 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#3d0000]">Publish to Explore</h2>
            <p className="text-sm text-[#7d6161] mt-1">
              Anyone can view and remix this carousel. You can unpublish at any time.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-[#7d6161] hover:bg-[#fadbdb] rounded-lg">
            <Icon name="close" size="sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#3d0000] mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-[#dbc1bc]/60 bg-[#fff8f7] text-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#3d0000]/20"
              placeholder="What's this carousel about?"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#3d0000] mb-1.5">
              Description <span className="text-xs font-normal text-[#7d6161]">(optional, {description.length}/500)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-[#dbc1bc]/60 bg-[#fff8f7] text-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#3d0000]/20"
              placeholder="Help others find your work"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#3d0000] mb-1.5">
              Tags <span className="text-xs font-normal text-[#7d6161]">(up to 5, comma-separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#dbc1bc]/60 bg-[#fff8f7] text-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#3d0000]/20"
              placeholder="hooks, storytime, productivity"
            />
            <p className="text-xs text-[#7d6161] mt-1">Lowercase letters, numbers, hyphens, underscores</p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#7d6161] hover:bg-[#fadbdb] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !title.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-[#3d0000] text-white hover:bg-[#3d0000]/90 disabled:opacity-50 active:scale-95 transition-all"
            >
              {pending ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
