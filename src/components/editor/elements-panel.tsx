'use client'

/**
 * Editor right-sidebar — Elements tab (v1: Lines & Dividers).
 *
 * Mirrors the existing TextEditorPanel / ImagePickerPanel visual conventions
 * (Material Symbols icons, #3d0000 primary, #fff0f0 hover, 10px uppercase
 * labels). Click a divider tile → caller's `onInsertDivider(dataUri)` runs,
 * which dispatches ADD_CUSTOM_IMAGE with centered/narrow defaults.
 *
 * Color is baked from the active template's textColor at click time so each
 * divider matches the slide's typography tone (warm-dark on Paper Essay,
 * cream on Editorial Serif). Re-coloring on template switch is out of scope
 * for v1; the user can delete + re-add.
 */

import { Icon } from '@/components/ui/icon'
import { DIVIDERS } from '@/lib/elements/dividers'

/**
 * Stroke color used for the in-picker preview tiles only — distinct from
 * the templateTextColor baked into the actual insert. Picker tile bg is
 * `#fdf7f2` (light cream); 7 of 12 built-in templates have white or cream
 * textColor which would render invisibly against that bg. `#3d0000` (the
 * project's primary brand color) gives every preview tile high contrast
 * regardless of which template the user is editing.
 */
const PREVIEW_STROKE = '#3d0000'

interface ElementsPanelProps {
  /** Active template's text color — baked into every inserted divider. */
  templateTextColor: string
  /** Caller dispatches ADD_CUSTOM_IMAGE with the data URI + centered defaults. */
  onInsertDivider: (dataUri: string) => void
}

export function ElementsPanel({ templateTextColor, onInsertDivider }: ElementsPanelProps) {
  return (
    <div className="p-4 space-y-5">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="horizontal_rule" size="sm" className="text-[#3d0000]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#3d0000]">
            Lines &amp; Dividers
          </h3>
        </div>
        <p className="text-xs text-[#7d6161] mb-3 leading-snug">
          Click to add. Drag to move, resize from the corners.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {DIVIDERS.map((divider) => {
            const previewDataUri = divider.build(PREVIEW_STROKE)
            return (
              <button
                key={divider.id}
                type="button"
                onClick={() => onInsertDivider(divider.build(templateTextColor))}
                className="group relative aspect-[3/1] rounded-md border border-[#dbc1bc]/40 bg-[#fdf7f2] hover:bg-[#fff0f0] hover:border-[#3d0000]/40 transition-colors flex items-center justify-center px-2 py-1"
                aria-label={`Add ${divider.label} divider`}
                title={divider.label}
              >
                {/* Preview stroke is PREVIEW_STROKE for tile legibility; the
                    actual insert uses templateTextColor (baked at click time)
                    so the placed divider matches the active template tone. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewDataUri}
                  alt=""
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
                <span className="absolute -bottom-4 left-0 right-0 text-[9px] uppercase tracking-wide text-[#7d6161] opacity-0 group-hover:opacity-100 transition-opacity text-center">
                  {divider.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="pt-4 border-t border-[#dbc1bc]/20">
        <p className="text-[11px] text-[#7d6161] leading-relaxed">
          More elements coming soon — shapes, icons, illustrations.
        </p>
      </section>
    </div>
  )
}
