'use client'

import { useEffect, useRef } from 'react'
import { trackView } from '../actions'

export function ViewTracker({ publishedId }: { publishedId: string }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackView(publishedId).catch(() => {
      // swallow — view tracking is best-effort
    })
  }, [publishedId])
  return null
}
