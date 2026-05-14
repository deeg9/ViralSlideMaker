'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { saveVisibility } from '@/app/(dashboard)/dashboard/visibility-actions'

export interface VisibilityDropdownProps {
  projectId: string
  title: string
  isPublic: boolean
  tags: string[]
}

export function VisibilityDropdown({
  projectId,
  title,
  isPublic,
  tags,
}: VisibilityDropdownProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Outside-click closes the popover
  useEffect(() => {
    if (!open) return
    function handleMouseDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  function applyVisibility(next: 'public' | 'private') {
    setOpen(false)
    setError(null)
    if ((next === 'public') === isPublic) return // no-op when already in target state

    const formData = new FormData()
    formData.set('title', title)
    formData.set('visibility', next)
    formData.set('tags', tags.join(','))

    startTransition(async () => {
      const result = await saveVisibility(projectId, formData)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Visibility"
        className="px-3 py-1.5 bg-white text-[#3d0000] border border-[#3d0000] rounded-xl font-medium flex items-center gap-1.5 hover:bg-[#fff0f0] active:scale-95 transition-all text-xs disabled:opacity-60"
      >
        <Icon name={isPublic ? 'public' : 'lock'} size="sm" />
        {pending ? 'Saving…' : isPublic ? 'Public' : 'Private'}
        <Icon name="expand_more" size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          // quick-260514-visibility-fixes: anchor the menu's LEFT edge to the
          // trigger so it opens rightward into the rail's available space.
          // Previously `right-0` made the menu extend leftward and get
          // clipped by the rail's overflow-hidden boundary.
          className="absolute left-0 top-full mt-1 min-w-[200px] max-w-[260px] bg-white rounded-xl shadow-lg ring-1 ring-black/5 py-1 z-30"
        >
          <button
            role="menuitem"
            onClick={() => applyVisibility('public')}
            className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-[#fff0f0] transition-colors ${
              isPublic ? 'bg-[#fff0f0]' : ''
            }`}
          >
            <Icon name="public" size="sm" className="text-[#3d0000] mt-0.5" />
            <span className="flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[#3d0000] font-medium">Public</span>
                {isPublic && (
                  <Icon name="check" size="sm" className="text-[#3d0000] ml-auto" />
                )}
              </span>
              <span className="block text-xs text-[#7d6161] mt-0.5">
                Anyone can view & remix on Explore.
              </span>
            </span>
          </button>
          <button
            role="menuitem"
            onClick={() => applyVisibility('private')}
            className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-[#fff0f0] transition-colors ${
              !isPublic ? 'bg-[#fff0f0]' : ''
            }`}
          >
            <Icon name="lock" size="sm" className="text-[#3d0000] mt-0.5" />
            <span className="flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[#3d0000] font-medium">Private</span>
                {!isPublic && (
                  <Icon name="check" size="sm" className="text-[#3d0000] ml-auto" />
                )}
              </span>
              <span className="block text-xs text-[#7d6161] mt-0.5">
                Only you can see this carousel.
              </span>
            </span>
          </button>
        </div>
      )}

      {error && (
        <p className="absolute left-0 top-full mt-1 max-w-[240px] text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 z-30 break-words">
          {error}
        </p>
      )}
    </div>
  )
}
