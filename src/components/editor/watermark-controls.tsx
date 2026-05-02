'use client'

/**
 * quick-260502-er5: per-slide watermark controls.
 * Mounted in the right rail BELOW <PhotoTreatmentControls>.
 *
 * Tier behavior (locked):
 *   - free tier: ViralSlideMaker watermark is ALWAYS ON. Toggle is disabled
 *     and renders a "Pro" lock chip + upgrade CTA. Custom upload also locked.
 *   - paid tier (plus/pro): toggle functional (default off — current
 *     resolveForcedWatermark behavior); custom-logo upload + position picker
 *     enabled.
 *
 * Server enforces tier (defense in depth) — this UI is the affordance, not
 * the security boundary.
 */

import { useRef } from 'react'
import { Icon } from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

export type WatermarkPosition = 'top-left' | 'bottom-left' | 'bottom-right'

export type WatermarkSpec = NonNullable<SlideStyleOverrides['watermark']>

export interface WatermarkControlsProps {
  slide: Slide
  /** 'free' | 'plus' | 'pro' — drives lock state. */
  userTier: 'free' | 'plus' | 'pro'
  /** Drives the spinner — typically the second tuple value of useTransition. */
  isPending: boolean
  /** Patch handler for non-upload changes. */
  onWatermarkChange?: (patch: WatermarkSpec) => void
  /** Upload handler — invoked when the user picks a logo file. */
  onCustomLogoUpload?: (file: File) => void
  /** Clears the custom logo. Distinct from disabling. */
  onCustomLogoRemove?: () => void
}

const POSITION_OPTIONS: Array<{ value: WatermarkPosition; label: string }> = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

export function WatermarkControls({
  slide,
  userTier,
  isPending,
  onWatermarkChange,
  onCustomLogoUpload,
  onCustomLogoRemove,
}: WatermarkControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isPaid = userTier !== 'free'
  const isReadOnly = !onWatermarkChange
  const wm = slide.style_overrides?.watermark ?? {}
  // Free tier: branded watermark ALWAYS renders. Paid tier: renders only when
  // explicitly enabled OR a customLogoUrl is set.
  const renders = !isPaid || wm.enabled === true || !!wm.customLogoUrl
  const hasCustom = !!wm.customLogoUrl
  const position: WatermarkPosition = wm.position ?? 'top-left'

  function emit(patch: Partial<WatermarkSpec>) {
    if (!onWatermarkChange) return
    onWatermarkChange({ ...wm, ...patch })
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !onCustomLogoUpload) return
    onCustomLogoUpload(file)
    // Reset so the same file can be re-picked if the user removes and re-adds.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div
      className="bg-[#fff0f0] border border-[#fadbdb] rounded-2xl p-4 space-y-4"
      data-testid="watermark-controls"
      data-tier={userTier}
    >
      {/* Section title + spinner */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Watermark
        </span>
        {isPending && (
          <span
            aria-live="polite"
            className="flex items-center gap-1 text-[10px] font-bold text-[#3d0000]"
          >
            <Icon name="progress_activity" size="sm" className="animate-spin" />
            Saving…
          </span>
        )}
      </div>

      {/* Show watermark toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#3d0000]">
            Show watermark
          </span>
          {!isPaid && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#3d0000] text-white"
              title="Upgrade to Pro to remove the ViralSlideMaker watermark"
            >
              Pro
            </span>
          )}
        </div>
        <Switch
          aria-label="Show watermark"
          checked={renders}
          disabled={!isPaid || isReadOnly}
          onCheckedChange={(checked) => {
            // Free tier can't disable — Switch is disabled, but guard anyway.
            if (!isPaid) return
            emit({ enabled: checked })
          }}
        />
      </div>

      {!isPaid && (
        <p className="text-[10px] text-[#7d6161] leading-snug">
          Upgrade to Pro to remove the ViralSlideMaker watermark or use your own.
        </p>
      )}

      {/* Position picker — paid only */}
      {isPaid && renders && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Position
          </span>
          <div className="flex gap-2" role="radiogroup" aria-label="Watermark position">
            {POSITION_OPTIONS.map((opt) => {
              const active = position === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={isReadOnly}
                  onClick={() => emit({ position: opt.value })}
                  className={
                    active
                      ? 'flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[#3d0000] text-white'
                      : 'flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white text-[#7d6161] border border-[#dbc1bc]/30 hover:bg-[#fadbdb]'
                  }
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Custom logo upload — paid only */}
      {isPaid && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Custom Logo
          </span>
          {hasCustom ? (
            <div className="flex items-center gap-2">
              <img
                src={wm.customLogoUrl}
                alt="Custom watermark logo"
                className="w-8 h-8 rounded object-contain bg-white border border-[#dbc1bc]/30"
              />
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => onCustomLogoRemove?.()}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white text-[#7d6161] border border-[#dbc1bc]/30 hover:bg-[#fadbdb]"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-white text-[#3d0000] border border-[#3d0000]/20 hover:bg-[#fadbdb]"
            >
              <Icon name="upload" size="sm" />
              Upload logo
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFilePicked}
            className="hidden"
            data-testid="watermark-logo-input"
          />
        </div>
      )}
    </div>
  )
}
