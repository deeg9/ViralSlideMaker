'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

const STORAGE_PREFIX = 'vsm:hint-dismissed:'

interface HintPillProps {
  hintKey: string
  children: React.ReactNode
  icon?: string
  className?: string
}

export function HintPill({
  hintKey,
  children,
  icon = 'lightbulb',
  className,
}: HintPillProps) {
  // Default hidden until the mount effect reads localStorage — avoids the
  // hydration-mismatch warning a dismissal flag the server can't see would
  // otherwise produce.
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(localStorage.getItem(STORAGE_PREFIX + hintKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [hintKey])

  if (!mounted || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_PREFIX + hintKey, '1')
    } catch {
      // Storage may be unavailable (private mode); still hide for the session.
    }
    setDismissed(true)
  }

  return (
    <div
      role="status"
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 bg-[#fff0e8] border border-[#3d0000]/15 rounded-full text-[11px] text-[#7d4a3a] shadow-sm',
        className,
      )}
    >
      <Icon name={icon} size="sm" className="text-[#b35a3a]" />
      <span>{children}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss hint"
        className="ml-1 -mr-1 p-0.5 text-[#7d4a3a]/60 hover:text-[#3d0000] rounded-full transition-colors"
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  )
}
