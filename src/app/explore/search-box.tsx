'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/icon'

export function ExploreSearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentRef = useRef(initialQuery)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim()
      if (trimmed === lastSentRef.current) return
      lastSentRef.current = trimmed
      const params = new URLSearchParams(searchParams.toString())
      if (trimmed) {
        params.set('q', trimmed)
        params.delete('tab')
      } else {
        params.delete('q')
      }
      const qs = params.toString()
      router.replace(qs ? `/explore?${qs}` : '/explore')
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, router, searchParams])

  return (
    <div className="relative mb-6">
      <Icon
        name="search"
        size="sm"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d6161]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search carousels by title, description, or tag…"
        className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#dbc1bc]/40 bg-white text-[#3d0000] placeholder:text-[#7d6161]/60 focus:outline-none focus:ring-2 focus:ring-[#3d0000]/20"
      />
    </div>
  )
}
