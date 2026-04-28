'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { toggleBookmark } from '../actions'

export function BookmarkButton({
  publishedId,
  initialBookmarked,
  signedIn,
}: {
  publishedId: string
  initialBookmarked: boolean
  signedIn: boolean
}) {
  const router = useRouter()
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    startTransition(async () => {
      const result = await toggleBookmark(publishedId)
      if (result.success) {
        setBookmarked(result.bookmarked)
      } else {
        alert(result.error)
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-all disabled:opacity-50 ${
        bookmarked
          ? 'bg-[#fadbdb] text-[#3d0000] border border-[#3d0000]'
          : 'bg-white text-[#3d0000] border border-[#dbc1bc]/40 hover:bg-[#fff0f0]'
      }`}
    >
      <Icon name={bookmarked ? 'bookmark' : 'bookmark_border'} size="sm" />
      {bookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
  )
}
