'use client'

/**
 * Phase 57 (EDITOR-01, EDITOR-04, D-08, D-11, D-12): per-slide photo
 * treatment controls. Mounted in the right rail BELOW <SlideSettings>.
 *
 * Composition:
 *   - Section title row + spinner when isPending
 *   - B&W toggle (radix Switch)
 *   - Duotone radio row (Off / Cream / Cobalt)
 *   - Grain radio row (Off / Subtle / Medium / Heavy)
 *
 * Treatment kind is single source of truth — selecting any duotone
 * forces B&W off (and vice versa). Grain is decoupled (renderer-side
 * override per D-09).
 *
 * Disabled-state stub renders when slide has no photo at all (D-12).
 *
 * NO CSS-filter fast preview (D-04). Server-side treat.ts is the only
 * path. ~3s cache miss / instant cache hit per EDITOR-02.
 */

import { Icon } from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

export type TreatmentKind = 'bw' | 'duotone-cream' | 'duotone-cobalt' | 'none'
export type GrainIntensity = 'subtle' | 'medium' | 'heavy' | 'off'

export type TreatmentSpec = {
  kind: TreatmentKind
  grain?: GrainIntensity
}

export interface PhotoTreatmentControlsProps {
  slide: Slide
  template: SlideTemplate
  /** Drives the spinner — typically the second tuple value of useTransition. */
  isPending: boolean
  /** When omitted, controls render in a read-only/disabled state (D-29). */
  onTreatmentChange?: (spec: TreatmentSpec) => void
}

const DUOTONE_OPTIONS: Array<{
  value: TreatmentKind
  label: string
  swatch: string
}> = [
  { value: 'none', label: 'Off', swatch: 'transparent' },
  { value: 'duotone-cream', label: 'Cream', swatch: '#F5EFE6' },
  { value: 'duotone-cobalt', label: 'Cobalt', swatch: '#0047AB' },
]

const GRAIN_OPTIONS: Array<{ value: GrainIntensity; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
]

function activeKindFromSlide(slide: Slide): TreatmentKind {
  const applied = slide.style_overrides?.treatment_applied
  if (applied === 'bw') return 'bw'
  if (applied === 'duotone-cream') return 'duotone-cream'
  if (applied === 'duotone-cobalt') return 'duotone-cobalt'
  return 'none'
}

function activeGrainFromSlide(slide: Slide): GrainIntensity {
  return slide.style_overrides?.grain_intensity ?? 'off'
}

export function PhotoTreatmentControls({
  slide,
  template: _template, // reserved for future per-template gating; not read today
  isPending,
  onTreatmentChange,
}: PhotoTreatmentControlsProps) {
  void _template

  const activeKind = activeKindFromSlide(slide)
  const activeGrain = activeGrainFromSlide(slide)
  const bwOn = activeKind === 'bw'
  const isReadOnly = !onTreatmentChange

  // Disabled-state stub (D-12): no photo at all.
  const noPhoto = !slide.original_source_url && !slide.background_url
  if (noPhoto) {
    return (
      <div
        className="bg-[#fff0f0] border border-[#fadbdb] rounded-2xl p-4 space-y-4"
        data-testid="photo-treatment-controls"
        data-state="disabled-no-photo"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Photo Treatment
          </span>
        </div>
        <div className="text-center text-[10px] text-[#dbc1bc] py-2">
          Add a photo to apply treatments.
        </div>
      </div>
    )
  }

  function emit(next: Partial<TreatmentSpec>) {
    if (!onTreatmentChange) return
    onTreatmentChange({
      kind: next.kind ?? activeKind,
      grain: next.grain ?? activeGrain,
    })
  }

  return (
    <div
      className="bg-[#fff0f0] border border-[#fadbdb] rounded-2xl p-4 space-y-4"
      data-testid="photo-treatment-controls"
    >
      {/* Section title row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Photo Treatment
        </span>
        {isPending && (
          <span
            aria-live="polite"
            className="flex items-center gap-1 text-[10px] font-bold text-[#3d0000]"
          >
            <Icon name="progress_activity" size="sm" className="animate-spin" />
            Treating…
          </span>
        )}
      </div>

      {/* B&W toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#3d0000]">
          Black &amp; White
        </span>
        <Switch
          aria-label="Toggle black and white treatment"
          checked={bwOn}
          disabled={isReadOnly}
          onCheckedChange={(checked) => {
            emit({ kind: checked ? 'bw' : 'none' })
          }}
        />
      </div>

      {/* Duotone radio row */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Duotone
        </span>
        <div className="flex gap-2" role="radiogroup" aria-label="Duotone preset">
          {DUOTONE_OPTIONS.map((opt) => {
            const active =
              (opt.value === 'none' && activeKind !== 'duotone-cream' && activeKind !== 'duotone-cobalt')
              || activeKind === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={isReadOnly}
                onClick={() => emit({ kind: opt.value })}
                className={
                  active
                    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-[#3d0000] text-white'
                    : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-white text-[#7d6161] border border-[#dbc1bc]/30 hover:bg-[#fadbdb]'
                }
              >
                {opt.value !== 'none' && (
                  <span
                    aria-hidden="true"
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: opt.swatch,
                      border: opt.swatch === '#F5EFE6' ? '1px solid rgba(125,97,97,0.3)' : undefined,
                    }}
                  />
                )}
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grain radio row */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Grain
        </span>
        <div className="flex gap-2" role="radiogroup" aria-label="Grain intensity">
          {GRAIN_OPTIONS.map((opt) => {
            const active = activeGrain === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={isReadOnly}
                onClick={() => emit({ grain: opt.value })}
                className={
                  active
                    ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-[#3d0000] text-white'
                    : 'px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-white text-[#7d6161] border border-[#dbc1bc]/30 hover:bg-[#fadbdb]'
                }
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
