'use client'

// Tool pills for the carousel prompt — a compact row of option triggers
// below the prompt card (Claude-style outline pills, Bloom Rose palette).

import { Icon } from '@/components/ui/icon'

interface ToolPillProps {
  /** Material Symbol name. */
  icon: string
  label: string
  /** True when this pill's panel is open. */
  active: boolean
  onClick: () => void
}

export function ToolPill({ icon, label, active, onClick }: ToolPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors active:scale-95 ${
        active
          ? 'border-[#3d0000] bg-[#fff0f0] text-[#3d0000]'
          : 'border-[#dbc1bc] bg-white text-[#7d6161] hover:border-[#3d0000]/50 hover:text-[#3d0000]'
      }`}
    >
      <Icon name={icon} size="sm" />
      {label}
    </button>
  )
}
