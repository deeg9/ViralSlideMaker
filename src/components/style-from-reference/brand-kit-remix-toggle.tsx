'use client'

// Phase 76 Plan 02 (PREVIEW-08):
// Brand-kit remix toggle — visible only when a brand kit exists. Toggling
// dispatches TOGGLE_BRAND_KIT_REMIX into the reducer; when ON, renders a
// two-column "Extracted vs Brand Kit" merged-palette preview with a per-
// field arrow indicator showing which extracted color the brand kit will
// override at emit time (Phase 77 owns the actual merge — this surface is
// the user-facing preview).
//
// Copy: "Remix with Brand Kit" framing — zero forbidden mimicry-framing
// tokens.

import type { BrandKit } from '@/lib/types/brand-kit'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { SpecPreviewAction } from './state-machine'
import type { Dispatch } from 'react'

export interface BrandKitRemixToggleProps {
  brandKit: BrandKit | null
  brandKitAvailable: boolean
  useBrandKitRemix: boolean
  extractedPalette: StyleSpec['palette']
  dispatch: Dispatch<SpecPreviewAction>
}

interface MergeRow {
  field: 'primary' | 'secondary' | 'accent'
  label: string
  extracted: string | undefined
  brandKitColor: string | null
}

function buildMergeRows(
  palette: StyleSpec['palette'],
  brandKit: BrandKit,
): MergeRow[] {
  return [
    {
      field: 'primary',
      label: 'Primary',
      extracted: palette.primary,
      brandKitColor: brandKit.primary_color,
    },
    {
      field: 'secondary',
      label: 'Secondary',
      extracted: palette.secondary,
      brandKitColor: brandKit.secondary_color,
    },
    {
      field: 'accent',
      label: 'Accent',
      extracted: palette.accent,
      brandKitColor: brandKit.accent_color,
    },
  ]
}

function Swatch({ hex, testid }: { hex: string; testid: string }) {
  return (
    <div
      data-testid={testid}
      className="h-5 w-5 rounded border border-[#e2cfcf]"
      style={{ backgroundColor: hex }}
      aria-hidden="true"
    />
  )
}

function EmptySwatch({ testid }: { testid: string }) {
  return (
    <div
      data-testid={testid}
      className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-[#e2cfcf] text-[10px] text-[#7d6161]"
      aria-hidden="true"
    >
      —
    </div>
  )
}

export function BrandKitRemixToggle(props: BrandKitRemixToggleProps) {
  const { brandKit, brandKitAvailable, useBrandKitRemix, extractedPalette, dispatch } = props

  if (!brandKitAvailable || !brandKit) return null

  const inputId = 'brand-kit-remix-toggle-input'
  const rows = buildMergeRows(extractedPalette, brandKit)

  return (
    <div
      data-testid="brand-kit-remix-toggle"
      className="space-y-2 rounded-lg border border-[#e2cfcf] bg-[#fff8f8] p-3"
    >
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-[#3d0000]"
      >
        <input
          id={inputId}
          type="checkbox"
          checked={useBrandKitRemix}
          onChange={() => dispatch({ type: 'TOGGLE_BRAND_KIT_REMIX' })}
          className="h-4 w-4 rounded border-[#3d0000] text-[#3d0000]"
        />
        Remix with Brand Kit
      </label>

      {useBrandKitRemix && (
        <div
          data-testid="merge-preview"
          className="grid grid-cols-[auto_auto_auto_auto_auto] gap-x-2 gap-y-1.5 text-[11px] text-[#7d6161]"
          aria-label="Extracted vs Brand Kit color merge preview"
        >
          <span className="col-span-5 grid grid-cols-[auto_auto_auto_auto_auto] gap-x-2 font-medium text-[#3d0000]">
            <span></span>
            <span>Extracted</span>
            <span></span>
            <span>Brand Kit</span>
            <span></span>
          </span>
          {rows.map((row) => {
            const showArrow = !!row.brandKitColor && !!row.extracted
            return (
              <div key={row.field} className="contents">
                <span className="self-center text-[#3d0000]">{row.label}</span>
                {row.extracted ? (
                  <Swatch hex={row.extracted} testid="swatch-extracted" />
                ) : (
                  <EmptySwatch testid="swatch-extracted-empty" />
                )}
                <span className="self-center text-center text-[#7d6161]">
                  {showArrow ? (
                    <span data-testid="merge-arrow" aria-label="overridden by">
                      →
                    </span>
                  ) : (
                    ''
                  )}
                </span>
                {row.brandKitColor ? (
                  <Swatch hex={row.brandKitColor} testid="swatch-brand-kit" />
                ) : (
                  <EmptySwatch testid="swatch-brand-kit-empty" />
                )}
                <span></span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
