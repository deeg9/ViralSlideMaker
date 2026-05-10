'use client'

// Phase 76 Plan 01 (PREVIEW-01):
// SpecPreviewPanel skeleton. Owns the Generate + Re-extract CTAs because
// their enable/disable + click handlers are state-machine-driven invariants
// that this plan defines. Plans 76-02 + 76-03 modify this file in later
// waves to fill the slot CONTENT — they will:
//
//   76-02: render PaletteSwatches in palette-slot, FontCategoryBadges in
//          typography-slot, LayoutSketch in layout-slot, the sanitized
//          voice_note caption in voice-note-slot, PerAspectToggles in
//          aspects-slot, the brand-kit toggle in brand-kit-slot, and the
//          credit-cost label in credit-cost-slot.
//   76-03: add inline RefusalWarning chips near the affected slots.
//
// Plans 76-02 and 76-03 MUST NOT both modify this file in parallel
// (shared-file dependency forces them into Wave 2 sequentially per the
// plan's depends_on graph).
//
// Copy posture: Generate / Re-extract / "Inspired by" framing only. Phase 79
// grep gate will enforce zero mimicry-framing tokens project-wide.

import type { ReactNode } from 'react'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { SpecPreviewState, SpecPreviewAction } from './state-machine'

export interface SpecPreviewPanelProps {
  state: SpecPreviewState
  dispatch: React.Dispatch<SpecPreviewAction>
  brandKit: BrandKit | null
  onGenerate: () => void
  onReExtract: () => void
  /** Optional slot for Plan 76-03's RefusalWarning render — kept here so
   *  76-03 can inject its surface without forking the panel. */
  refusalWarningSlot?: ReactNode
}

function hasAtLeastOneAspect(state: SpecPreviewState): boolean {
  const a = state.aspects
  return a.palette || a.typography || a.layout || a.decorations
}

function refusalAcknowledgedOrAbsent(state: SpecPreviewState): boolean {
  // PREVIEW-10: refusal warning is non-blocking BUT Generate is gated until
  // the user explicitly acknowledges it. If no flagged refs, treat as
  // acknowledged (no warning to confirm).
  const anyFlagged = state.refusalFlags.some(
    (f) => f.contains_logo || f.contains_face || f.contains_watermark,
  )
  if (!anyFlagged) return true
  return state.refusalAcknowledged
}

export function SpecPreviewPanel(props: SpecPreviewPanelProps) {
  const { state } = props
  const spec: StyleSpec | null = state.spec

  const generateDisabled =
    !hasAtLeastOneAspect(state) || !refusalAcknowledgedOrAbsent(state)
  const reExtractDisabled = state.retriesRemaining <= 0

  // Plan 76-02 will replace these inert placeholders with real components.
  // The skeleton renders empty mount-point divs whose testids are the
  // contract Plan 76-02 + 76-03 build against.
  return (
    <section
      data-testid="spec-preview-panel"
      className="rounded-2xl border border-[#e2cfcf] bg-white p-6 space-y-5"
      aria-label="Style spec preview — review before generating"
    >
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[#3d0000]">
          Inspired by your references
        </h2>
        <p className="text-[12px] text-[#7d6161]">
          Review the extracted style. Toggle off anything you do not want
          applied, or re-extract to try again.
        </p>
      </header>

      {props.refusalWarningSlot ?? null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-testid="palette-slot" data-slot="palette" className="min-h-[64px]" />
        <div data-testid="typography-slot" data-slot="typography" className="min-h-[64px]" />
        <div data-testid="layout-slot" data-slot="layout" className="min-h-[64px]" />
        <div data-testid="voice-note-slot" data-slot="voice-note" className="min-h-[64px]">
          {spec?.voice_note ? (
            <p className="text-[13px] italic text-[#3d0000]">{spec.voice_note}</p>
          ) : null}
        </div>
      </div>

      <div data-testid="aspects-slot" data-slot="aspects" className="min-h-[48px]" />

      <div data-testid="brand-kit-slot" data-slot="brand-kit" className="min-h-[32px]" />

      <div className="flex items-center justify-between gap-3 pt-2">
        <div data-testid="credit-cost-slot" data-slot="credit-cost" className="text-[12px] text-[#7d6161]" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="re-extract-cta"
            disabled={reExtractDisabled}
            onClick={props.onReExtract}
            className={
              'rounded-xl px-4 py-2 text-sm font-semibold border transition-colors ' +
              (reExtractDisabled
                ? 'border-[#e2cfcf] text-[#7d6161] cursor-not-allowed bg-white'
                : 'border-[#3d0000] text-[#3d0000] hover:bg-[#fff0f0] bg-white')
            }
            aria-label={`Re-extract (${state.retriesRemaining} retries remaining)`}
          >
            Re-extract ({state.retriesRemaining} left)
          </button>

          <button
            type="button"
            data-testid="generate-cta"
            disabled={generateDisabled}
            onClick={props.onGenerate}
            className={
              'rounded-xl px-5 py-2 text-sm font-bold transition-colors ' +
              (generateDisabled
                ? 'bg-[#e2cfcf] text-[#7d6161] cursor-not-allowed'
                : 'bg-[#3d0000] text-white hover:bg-[#5a0000]')
            }
          >
            Generate
          </button>
        </div>
      </div>
    </section>
  )
}
