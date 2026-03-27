'use client'

import { useEffect } from 'react'
import { FONT_CATALOG, type FontEntry } from '@/lib/fonts/font-catalog'
import { extractFontName } from '@/lib/render/load-font'

interface FontPickerProps {
  value: string | undefined
  onChange: (family: string) => void
  templateFont: string
}

const CATEGORIES: Array<{ label: string; value: FontEntry['category'] }> = [
  { label: 'Sans-serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Display', value: 'display' },
  { label: 'Handwriting', value: 'handwriting' },
]

/**
 * Build a single Google Fonts URL that loads all catalog fonts for dropdown preview.
 */
function buildAllFontsUrl(): string {
  const families = FONT_CATALOG.map((entry) => {
    const encoded = entry.family.replace(/\s+/g, '+')
    return `family=${encoded}:wght@400;700`
  })
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

export function FontPicker({ value, onChange, templateFont }: FontPickerProps) {
  const templateFontName = extractFontName(templateFont)

  // Inject a single <link> tag to load all catalog fonts for preview rendering
  useEffect(() => {
    const linkId = 'font-picker-catalog-link'
    if (document.getElementById(linkId)) return

    const link = document.createElement('link')
    link.id = linkId
    link.rel = 'stylesheet'
    link.href = buildAllFontsUrl()
    document.head.appendChild(link)
  }, [])

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    fonts: FONT_CATALOG.filter((f) => f.category === cat.value),
  }))

  return (
    <div data-testid="font-picker">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Font</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-[#fff0f0] text-[#3d0000] rounded-lg px-3 py-2 text-xs border-none focus:ring-1 focus:ring-[#3d0000] cursor-pointer"
        style={{ fontFamily: value ? `'${value}', sans-serif` : templateFont }}
      >
        <option value="" style={{ fontFamily: 'system-ui, sans-serif' }}>
          Default ({templateFontName})
        </option>
        {grouped.map((group) => (
          <optgroup key={group.value} label={group.label}>
            {group.fonts.map((entry) => (
              <option
                key={entry.family}
                value={entry.family}
                style={{ fontFamily: `'${entry.family}', sans-serif` }}
              >
                {entry.family}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
