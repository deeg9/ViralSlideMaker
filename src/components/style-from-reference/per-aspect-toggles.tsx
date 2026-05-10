'use client'

// Phase 76 Plan 02 (PREVIEW-06):
// Per-aspect toggles — 4 checkboxes (palette / typography / layout /
// decorations) wired to the reducer's TOGGLE_ASPECT action. When zero
// boxes are checked, an inline hint surfaces near the group as visible
// affordance for the disabled-Generate state owned by Plan 76-01's
// reducer guard (PREVIEW-06 enforcement parity).
//
// Defaults (all-on) live in the reducer's initialSpecPreviewState — this
// component renders FROM state, never sets defaults.

import type { SpecPreviewAspects, SpecPreviewAction } from './state-machine'
import type { Dispatch } from 'react'

export interface PerAspectTogglesProps {
  aspects: SpecPreviewAspects
  dispatch: Dispatch<SpecPreviewAction>
}

const ITEMS: Array<{ key: keyof SpecPreviewAspects; label: string }> = [
  { key: 'palette', label: 'Palette' },
  { key: 'typography', label: 'Typography' },
  { key: 'layout', label: 'Layout' },
  { key: 'decorations', label: 'Decorations' },
]

export function PerAspectToggles({ aspects, dispatch }: PerAspectTogglesProps) {
  const noneChecked = !ITEMS.some((i) => aspects[i.key])

  return (
    <fieldset
      data-testid="aspects-checkbox-group"
      aria-label="Choose which extracted aspects to apply"
      className="space-y-2"
    >
      <legend className="text-[12px] font-semibold text-[#3d0000]">
        Apply
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {ITEMS.map((item) => {
          const id = `aspect-${item.key}`
          return (
            <label
              key={item.key}
              htmlFor={id}
              className="inline-flex items-center gap-2 text-[13px] text-[#3d0000] cursor-pointer"
            >
              <input
                id={id}
                type="checkbox"
                checked={aspects[item.key]}
                onChange={() => dispatch({ type: 'TOGGLE_ASPECT', aspect: item.key })}
                className="h-4 w-4 rounded border-[#3d0000] text-[#3d0000]"
              />
              {item.label}
            </label>
          )
        })}
      </div>
      {noneChecked && (
        <p
          data-testid="aspect-empty-hint"
          className="text-[11px] text-[#a30000]"
          role="alert"
        >
          Select at least one aspect to generate.
        </p>
      )}
    </fieldset>
  )
}
