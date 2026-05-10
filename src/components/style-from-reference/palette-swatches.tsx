'use client'

// Phase 76 Plan 02 (PREVIEW-02):
// Pure display component — renders 1–6 colored swatches with hex labels +
// an optional palette-mode badge for non-solid modes.
//
// Props are sliced from StyleSpec.palette + an optional `extras` array for
// additional palette colors that future emit pipelines may surface (Phase 77+
// may extend StyleSpecPalette with role colors). Today, callers in 76-02
// do not pass `extras`; the prop is wired so the PREVIEW-02 4–6 range is
// reachable without a follow-up component change.
//
// Copy: zero forbidden mimicry-framing tokens. Mode label is a closed enum
// title-cased ("Solid" / "Duotone" / "Gradient" / "Photo").

import type { StyleSpecPalette } from '@/lib/types/style-spec'

export interface PaletteSwatchesProps {
  palette: StyleSpecPalette
  /** Optional additional hex colors to surface alongside the role colors. */
  extras?: string[]
}

const MODE_LABELS: Record<StyleSpecPalette['mode'], string> = {
  solid: 'Solid',
  duotone: 'Duotone',
  gradient: 'Gradient',
  photo: 'Photo',
}

function collectHexes(palette: StyleSpecPalette, extras?: string[]): string[] {
  const out: string[] = [palette.primary]
  if (palette.secondary) out.push(palette.secondary)
  if (palette.accent) out.push(palette.accent)
  if (extras && extras.length > 0) out.push(...extras)
  return out
}

export function PaletteSwatches({ palette, extras }: PaletteSwatchesProps) {
  const hexes = collectHexes(palette, extras)
  const modeLabel = MODE_LABELS[palette.mode]

  return (
    <div data-testid="palette-swatches" className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-[#3d0000]">Palette</span>
        <span
          data-testid="palette-mode-badge"
          className="inline-flex items-center rounded-full border border-[#e2cfcf] bg-[#fff0f0] px-2 py-0.5 text-[10px] font-medium text-[#3d0000]"
        >
          {modeLabel}
        </span>
      </div>
      <ul className="flex flex-wrap gap-3" aria-label="Extracted palette colors">
        {hexes.map((hex, i) => (
          <li
            key={`${hex}-${i}`}
            data-testid="palette-swatch"
            className="flex flex-col items-center gap-1"
          >
            <div
              data-testid="palette-swatch-color"
              className="h-12 w-12 rounded-md border border-[#e2cfcf]"
              style={{ backgroundColor: hex }}
              aria-hidden="true"
            />
            <code className="text-[10px] font-mono text-[#7d6161]">{hex}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}
