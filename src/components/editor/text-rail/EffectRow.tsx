'use client'

import type { ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'

interface EffectRowProps {
  /** Display label e.g. 'Shadow' / 'Outline' / 'Highlight'. */
  label: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  /** Sliders/swatches shown only when enabled is true. */
  children?: ReactNode
  /** Optional test id suffix; the row uses `effect-row-{label}` by default. */
  testId?: string
}

/**
 * Phase 50 (D-05): generic toggle row used 3× inside ActiveTextBoxCard for
 * Shadow / Outline / Highlight. Switch on → renders `children` in a panel
 * with `pl-4 border-l-2 border-[#fadbdb]` framing so the relationship
 * between the toggle and its controls is visually clear.
 *
 * No animation — instant reveal per D-17.
 */
export function EffectRow({
  label,
  enabled,
  onToggle,
  children,
  testId,
}: EffectRowProps) {
  const tid = testId ?? `effect-row-${label.toLowerCase()}`
  return (
    <div className="space-y-2" data-testid={tid} data-enabled={enabled ? 'true' : 'false'}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          {label}
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${label.toLowerCase()}`}
          data-testid={`${tid}-switch`}
        />
      </div>

      {enabled && (
        <div
          className="mt-3 pl-4 border-l-2 border-[#fadbdb] space-y-3"
          data-testid={`${tid}-content`}
        >
          {children}
        </div>
      )}
    </div>
  )
}
