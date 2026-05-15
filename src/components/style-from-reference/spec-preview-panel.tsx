'use client'

// Phase 76 Plan 01 (PREVIEW-01) + Plan 02 (PREVIEW-02..06 + 08 + 11):
// SpecPreviewPanel. Owns the Generate + Re-extract CTAs because their
// enable/disable + click handlers are state-machine-driven invariants
// (76-01's contract).
//
// quick 260511-flj: PREVIEW-10 RefusalWarning gate REMOVED. Generate is
// disabled ONLY when no aspect is checked (single-predicate). The
// refusalWarningSlot prop and the refusalAcknowledgedOrAbsent helper have
// been deleted; liability for IP / right-of-publicity / trademark exposure
// shifted to the user via the strengthened Phase 79 LEGAL-05 T&C clickwrap
// (STYLE_FROM_REFERENCE_TOS_VERSION bumped to force re-acceptance).
//
// Copy posture: Generate / Re-extract / "Inspired by" framing only. Phase 79
// grep gate enforces zero mimicry-framing tokens project-wide.

import type { StyleSpec } from '@/lib/types/style-spec'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { SpecPreviewState, SpecPreviewAction } from './state-machine'
// Plan 76-02 slot fills:
import { PaletteSwatches } from './palette-swatches'
import { FontCategoryBadges } from './font-category-badges'
import { LayoutSketch } from './layout-sketch'
import { VoiceNoteCaption } from './voice-note-caption'
import { PerAspectToggles } from './per-aspect-toggles'
import { BrandKitRemixToggle } from './brand-kit-remix-toggle'
import { CreditCostDisplay } from './credit-cost-display'

export interface SpecPreviewPanelProps {
  state: SpecPreviewState
  dispatch: React.Dispatch<SpecPreviewAction>
  brandKit: BrandKit | null
  onGenerate: () => void
  onReExtract: () => void
  /** quick-260514-g7y: when true (inline-collapsible mode), the bottom
   *  Generate button + credit-cost display are hidden — the outer
   *  GenerationForm's Generate Carousel button owns generation routing
   *  in that context. Re-extract stays visible so the user can iterate
   *  inside the collapsible without leaving the form. Defaults to false
   *  so the legacy standalone-page render path is unchanged. */
  hideGenerateCta?: boolean
}

function hasAtLeastOneAspect(state: SpecPreviewState): boolean {
  const a = state.aspects
  return a.palette || a.typography || a.layout || a.decorations
}

export function SpecPreviewPanel(props: SpecPreviewPanelProps) {
  const { state } = props
  const spec: StyleSpec | null = state.spec

  // quick 260511-flj: single-predicate gate — Generate disabled iff no aspect checked.
  const generateDisabled = !hasAtLeastOneAspect(state)
  const reExtractDisabled = state.retriesRemaining <= 0

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-testid="palette-slot" data-slot="palette" className="min-h-[64px]">
          {spec ? <PaletteSwatches palette={spec.palette} /> : null}
        </div>
        <div data-testid="typography-slot" data-slot="typography" className="min-h-[64px]">
          {spec ? (
            <FontCategoryBadges
              hookCategory={spec.typography.hookFontCategory}
              bodyCategory={spec.typography.bodyFontCategory}
            />
          ) : null}
        </div>
        <div data-testid="layout-slot" data-slot="layout" className="min-h-[64px]">
          {spec ? (
            <LayoutSketch layout={spec.layout} decorationsDensity={spec.decorations.density} />
          ) : null}
        </div>
        <div data-testid="voice-note-slot" data-slot="voice-note" className="min-h-[64px]">
          {spec ? <VoiceNoteCaption voiceNote={spec.voice_note} /> : null}
        </div>
      </div>

      <div data-testid="aspects-slot" data-slot="aspects" className="min-h-[48px]">
        <PerAspectToggles aspects={state.aspects} dispatch={props.dispatch} />
      </div>

      <div data-testid="brand-kit-slot" data-slot="brand-kit" className="min-h-[32px]">
        {spec ? (
          <BrandKitRemixToggle
            brandKit={props.brandKit}
            brandKitAvailable={state.brandKitAvailable}
            useBrandKitRemix={state.useBrandKitRemix}
            extractedPalette={spec.palette}
            dispatch={props.dispatch}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        {props.hideGenerateCta ? (
          // quick-260515-dwu: pre-fix copy said "Use Generate Carousel
          // below to render" — but in inline-collapsible mode there is
          // no button below; the prompt-arrow above IS the entry point.
          // Pointing users at a phantom button was the second half of
          // the bug-report's broken UX (alongside the missing
          // style_spec/reference_assets persistence).
          <span className="text-[12px] text-[#7d6161]">
            Style ready. Send your prompt above to apply it.
          </span>
        ) : (
          <div data-testid="credit-cost-slot" data-slot="credit-cost" className="text-[12px] text-[#7d6161]">
            <CreditCostDisplay cost={1} />
          </div>
        )}

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

          {!props.hideGenerateCta && (
            <button
              type="button"
              data-testid="generate-cta"
              disabled={generateDisabled}
              onClick={props.onGenerate}
              // quick 260511-flj: single gate. Title surfaces WHY when disabled
              // so users don't stare at a dead button.
              title={
                generateDisabled
                  ? 'Check at least one aspect above (palette, typography, layout, or decorations) before generating.'
                  : undefined
              }
              aria-describedby={generateDisabled ? 'generate-cta-blocker' : undefined}
              className={
                'rounded-xl px-5 py-2 text-sm font-bold transition-colors ' +
                (generateDisabled
                  ? 'bg-[#e2cfcf] text-[#7d6161] cursor-not-allowed'
                  : 'bg-[#3d0000] text-white hover:bg-[#5a0000]')
              }
            >
              Generate
            </button>
          )}
          {!props.hideGenerateCta && generateDisabled && (
            <p
              id="generate-cta-blocker"
              data-testid="generate-cta-blocker"
              className="text-xs text-[#7d6161] mt-1"
            >
              Check at least one aspect above to enable Generate.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
