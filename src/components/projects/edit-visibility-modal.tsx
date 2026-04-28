'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { saveVisibility } from '@/app/(dashboard)/dashboard/visibility-actions'

export interface EditVisibilityModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  defaultTitle: string
  initialVisibility: 'public' | 'private'
  initialTags: string[]
}

export function EditVisibilityModal({
  open,
  onClose,
  projectId,
  defaultTitle,
  initialVisibility,
  initialTags,
}: EditVisibilityModalProps) {
  const router = useRouter()
  const [title, setTitle] = useState(defaultTitle)
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialVisibility)
  const [tags, setTags] = useState(initialTags.join(', '))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Re-sync when modal reopens for a different project
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle)
      setVisibility(initialVisibility)
      setTags(initialTags.join(', '))
      setError(null)
    }
  }, [open, defaultTitle, initialVisibility, initialTags])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('title', title)
    formData.set('visibility', visibility)
    formData.set('tags', tags)

    startTransition(async () => {
      const result = await saveVisibility(projectId, formData)
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setError(result.error)
      }
    })
  }

  const isPublishing =
    pending && visibility === 'public' && initialVisibility === 'private'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 border border-[#dbc1bc]/40 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#3d0000]">Edit visibility</h2>
            <p className="text-sm text-[#7d6161] mt-1">
              Public carousels appear on Explore and can be remixed by others.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#7d6161] hover:bg-[#fadbdb] rounded-lg"
            aria-label="Close"
          >
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
              Visibility
            </label>
            <div className="inline-flex p-1 bg-[#fff0f0] rounded-xl">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  visibility === 'private'
                    ? 'bg-white text-[#3d0000] shadow-sm'
                    : 'text-[#7d6161] hover:text-[#3d0000]'
                }`}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  visibility === 'public'
                    ? 'bg-[#3d0000] text-white shadow-sm'
                    : 'text-[#7d6161] hover:text-[#3d0000]'
                }`}
              >
                Public
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#3d0000] mb-1.5">
              Category{' '}
              <span className="text-xs font-normal text-[#7d6161]">
                (search hashtags, up to 5, comma-separated)
              </span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#dbc1bc]/60 bg-[#fff8f7] text-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#3d0000]/20"
              placeholder="hooks, storytime, productivity"
              disabled={visibility === 'private'}
            />
            <p className="text-xs text-[#7d6161] mt-1">
              {visibility === 'private'
                ? 'Tags only apply when public.'
                : 'Lowercase letters, numbers, hyphens, underscores.'}
            </p>
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
              {pending ? (isPublishing ? 'Publishing…' : 'Saving…') : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
