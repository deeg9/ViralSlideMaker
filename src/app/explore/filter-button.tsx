'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/icon'

type Tab = 'trending' | 'new' | 'featured'

const TABS: Array<{ key: Tab; label: string; description: string }> = [
  { key: 'trending', label: 'Trending', description: 'Most remixed and bookmarked' },
  { key: 'new', label: 'New', description: 'Latest publishes' },
  { key: 'featured', label: 'Featured', description: 'Hand-picked by us' },
]

export function FilterButton({ current }: { current: Tab }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function handleSelect(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'trending') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.replace(qs ? `/explore?${qs}` : '/explore')
    setOpen(false)
  }

  const currentLabel = TABS.find((t) => t.key === current)?.label ?? 'Trending'

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#dbc1bc]/40 bg-white text-sm font-medium text-[#3d0000] hover:bg-[#fff0f0] transition-colors"
      >
        <Icon name="tune" size="sm" />
        <span>{currentLabel}</span>
        <Icon name="expand_more" size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-[0px_20px_40px_rgba(61,0,0,0.12)] border border-[#dbc1bc]/20 py-2 z-30"
        >
          {TABS.map((tab) => {
            const active = tab.key === current
            return (
              <button
                key={tab.key}
                onClick={() => handleSelect(tab.key)}
                role="menuitem"
                className={`flex items-start gap-3 w-full px-4 py-2.5 text-left hover:bg-[#fff0f0] transition-colors ${
                  active ? 'bg-[#fadbdb]' : ''
                }`}
              >
                <Icon
                  name={active ? 'check' : 'circle'}
                  size="sm"
                  className={active ? 'text-[#3d0000] mt-0.5' : 'text-transparent mt-0.5'}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#3d0000]">{tab.label}</p>
                  <p className="text-xs text-[#7d6161] mt-0.5">{tab.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
