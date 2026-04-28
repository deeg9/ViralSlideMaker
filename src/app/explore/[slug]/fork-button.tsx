'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { forkCarousel } from '../actions'

export function ForkButton({
  publishedId,
  signedIn,
}: {
  publishedId: string
  signedIn: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    startTransition(async () => {
      const result = await forkCarousel(publishedId)
      if (result.success) {
        router.push(`/project/${result.projectId}`)
      } else {
        alert(result.error)
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 bg-[#3d0000] text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-[#3d0000]/90 active:scale-95 transition-all disabled:opacity-50"
    >
      <Icon name="content_copy" size="sm" />
      {pending ? 'Forking…' : 'Fork to my account'}
    </button>
  )
}
