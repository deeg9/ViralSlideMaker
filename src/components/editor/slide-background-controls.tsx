'use client'

/**
 * quick-260517-k2n: Caption Card control card.
 *
 * Mounted in the editor right-rail ELEMENTS tab (inside ElementsPanel's
 * `slideLevelCards`). Controls the caption card — an independent
 * draggable/resizable colored rectangle overlay rendered ABOVE the full-bleed
 * photo and BELOW the hook/body text. The card NO LONGER constrains the photo:
 * the photo is a permanent full-bleed background and is never resized/zoned by
 * this card. The user drags + resizes the card directly on the editor canvas.
 *
 * Controls:
 *   1. On/off Switch — `style_overrides.caption_bar_enabled`. The toggle reads
 *      the RESOLVED caption state (via `resolveCaptionBar`), so it reads ON for
 *      an unedited news-layout slide (the quick-260518-8o0 resolver default
 *      seeds a black caption card on news slides). OFF writes an EXPLICIT
 *      `caption_bar_enabled: false` (not a deleted key) so the news resolver
 *      default cannot silently re-enable the card.
 *   2. Color swatch row — `style_overrides.caption_bar_color` (hex, PCL12).
 *   3. Opacity slider — `style_overrides.caption_bar_opacity` (0..1). Lets the
 *      photo show through a semi-transparent card. Preview-on-change,
 *      commit-on-release (KBD-09).
 *   4. Top/Bottom snap buttons — rewrite `style_overrides.caption_bar_y`
 *      (Top => 0, Bottom => 100 - height) and `caption_bar_position`. The card
 *      is otherwise positioned by dragging it on the canvas.
 *
 * There is NO Photo-height slider — the card never touches `news_image_height`.
 * The panel NEVER writes `layout` / `news_image_height` / `background_color`.
 *
 * quick-260518-8o0: the panel has news-layout awareness — the toggle reads ON
 * for an unedited news-layout slide and OFF writes explicit false — but it
 * still NEVER writes `layout` / `news_image_height` / `background_color`.
 *
 * The card is NOT gated on `backgroundMode` — every selected slide can enable
 * it (the parent mounts this card unconditionally).
 *
 * The `data-testid="slide-background-controls"` shell + the
 * `caption-card-position-{cover,body}` testids are KEPT STABLE (test-bearing);
 * `cover` maps to the Bottom snap, `body` maps to the Top snap.
 *
 * All three renderers (slide-preview.tsx, render-slide-satori.tsx,
 * render-slide.ts) resolve the card via the shared `resolveCaptionBar` helper.
 */

import { useEffect, useState } from 'react'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { resolveCaptionBar } from '@/lib/render/resolve-overlay'
import { Switch } from '@/components/ui/switch'
import { COLOR_SWATCHES } from './text-rail/color-swatches'

/** Default caption-card height percent — matches resolveCaptionBar's default. */
const DEFAULT_CAPTION_HEIGHT = 38
/** Default caption-card opacity — matches resolveCaptionBar's default (0.85). */
const DEFAULT_CAPTION_OPACITY = 0.85
/** quick-260518-ch8: blend amount written when the Edge blend toggle is flipped
 *  ON — a sensible mid-range starting fade. */
const BLEND_ON_DEFAULT = 25

export interface SlideBackgroundControlsProps {
  slide: Slide
  /** Per-slide-RESOLVED template (post resolvePerSlideTemplate) — drives the
   *  color-picker default. */
  template: SlideTemplate
  /** Commit dispatch — records one undo entry. */
  onSlideUpdate: (updates: Partial<Slide>) => void
  /** quick-260517-k2n: transient live-preview dispatch for the Opacity slider —
   *  fires UPDATE_SLIDE with noHistory:true so a drag lands on the canvas
   *  without polluting the undo stack. The committing dispatch fires through
   *  `onSlideUpdate` on pointer-up. Optional so isolated unit tests can omit
   *  it; falls back to `onSlideUpdate` when absent. */
  onSlidePreview?: (updates: Partial<Slide>) => void
}

/**
 * Coerce a hex string to the 6-digit `#RRGGBB` form `<input type="color">`
 * requires. Expands 3-digit hex; strips an 8-digit hex's alpha; falls back to
 * '#000000' on anything malformed so the native picker never gets bad input.
 */
function toColorInputValue(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 8) h = h.slice(0, 6)
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return '#000000'
  return `#${h.toLowerCase()}`
}

export function SlideBackgroundControls({
  slide,
  template,
  onSlideUpdate,
  onSlidePreview,
}: SlideBackgroundControlsProps) {
  // quick-260518-8o0: is this a news-layout slide? Mirrors the gate in
  // render-slide.ts (~line 327) — a legacy template (no `backgroundMode`)
  // with a `layout` override. The renderers compute the same boolean to feed
  // `resolveCaptionBar`; the panel must use it too so the toggle agrees with
  // what renders.
  const isNewsLayoutSlide =
    template.backgroundMode == null && slide.style_overrides?.layout != null

  // quick-260518-8o0: the toggle reflects the RESOLVED caption state — calling
  // the SAME `resolveCaptionBar` the three renderers use, so the panel cannot
  // drift from the canvas/Satori/HTML output. For an unedited news-layout
  // slide the resolver default fires => the toggle reads ON.
  // quick-260519-vy2: mirror the canonical resolver — all four derived
  // values (enabled, heightPct, blendPct, opacity) must agree with what
  // the three renderers paint. captionCardDefaults on a template (e.g.
  // news-oracle, chrome-pulse) would otherwise drift the right-panel
  // sliders OFF from the canvas/Satori/HTML output.
  const resolvedBar = resolveCaptionBar(
    slide.style_overrides,
    template,
    isNewsLayoutSlide,
  )
  const captionPanelOn = resolvedBar.enabled

  // Effective (resolved) card color — same fallback chain the renderers use,
  // so the active swatch reflects what the slide actually renders.
  const color =
    slide.style_overrides?.caption_bar_color ?? template.backgroundColor

  // Resolved snap-preset position (purely for the radiogroup's active state).
  const position: 'cover' | 'body' =
    slide.style_overrides?.caption_bar_position === 'top' ? 'body' : 'cover'

  // Resolved opacity percent (0..100) for the slider.
  // quick-260519-vy2: opacity routes through its own fallback chain
  // (not resolvedBar.backgroundColor, which bakes alpha into an rgba
  // string). Mirrors the resolver's logic for this dimension.
  const opacityPct = Math.round(
    (slide.style_overrides?.caption_bar_opacity
      ?? template.captionCardDefaults?.opacity
      ?? DEFAULT_CAPTION_OPACITY) * 100,
  )

  // Local drag draft — the range <input> is driven from this so the thumb
  // tracks mid-gesture before a committing dispatch re-renders the slide. Sync
  // back whenever the resolved value changes (undo/redo, slide switch).
  const [opacityDraft, setOpacityDraft] = useState(opacityPct)
  useEffect(() => {
    setOpacityDraft(opacityPct)
  }, [opacityPct])

  // quick-260518-ch8: resolved caption-card height percent (10..90) for the
  // Height slider — mirrors resolveCaptionBar's `caption_bar_height_pct ?? 38`.
  // quick-260519-vy2: take heightPct from the resolved bar so a
  // template-default (e.g. news-oracle's heightPct:42) reaches the
  // slider on an unedited slide.
  const heightPct = resolvedBar.heightPct
  const [heightDraft, setHeightDraft] = useState(heightPct)
  useEffect(() => {
    setHeightDraft(heightPct)
  }, [heightPct])

  // quick-260518-ch8: resolved edge-blend percent (0..50) for the Edge blend
  // slider — mirrors resolveCaptionBar's `caption_bar_blend_pct ?? 0`. Blend is
  // "on" when this is > 0.
  // quick-260519-vy2: take blendPct from the resolved bar so the
  // Edge blend toggle reads ON for templates shipping a non-zero
  // blendPct default.
  const blendPct = resolvedBar.blendPct
  const [blendDraft, setBlendDraft] = useState(blendPct)
  useEffect(() => {
    setBlendDraft(blendPct)
  }, [blendPct])

  /** Emit a merged style_overrides patch. A single discrete pick = one undo
   *  entry, so this always goes through the committing dispatch. */
  function patch(p: Partial<SlideStyleOverrides>) {
    const next = { ...(slide.style_overrides ?? {}), ...p }
    onSlideUpdate({ style_overrides: next })
  }

  /** quick-260518-8o0: turn the caption card OFF. Writes an EXPLICIT
   *  `caption_bar_enabled: false` (uniform — same code path for news and
   *  non-news slides). The explicit `false` is REQUIRED on news-layout slides:
   *  resolveCaptionBar's news default fires on an ABSENT key, so a deleted key
   *  would silently re-enable the card — `false` makes OFF stick (CONTEXT.md
   *  "Toggle OFF behavior", locked). For non-news slides this is still
   *  byte-identical at render time because the resolver gate is
   *  `=== true || (== null && isNewsLayoutSlide)` — an explicit `false` and an
   *  absent key both resolve `enabled: false`. Sibling overrides are kept. */
  function setCaptionOff() {
    patch({ caption_bar_enabled: false })
  }

  /** Opacity-slider patch — `commit` picks the history-recording dispatch vs
   *  the transient (noHistory) preview one (KBD-09). Writes a 0..1 fraction. */
  function patchOpacity(valuePct: number, commit: boolean) {
    const next = {
      ...(slide.style_overrides ?? {}),
      caption_bar_opacity: valuePct / 100,
    }
    ;(commit ? onSlideUpdate : onSlidePreview ?? onSlideUpdate)({
      style_overrides: next,
    })
  }

  /** quick-260518-ch8: Height-slider patch — mirrors patchOpacity's
   *  preview-on-change / commit-on-release pattern (KBD-09). Writes
   *  `caption_bar_height_pct`. On a COMMIT it ALSO re-anchors `caption_bar_y`
   *  the same way `snap()` does: a bottom-snapped card must keep its top edge
   *  at `100 - newHeight` so it grows upward and stays glued to the bottom edge
   *  (without this it would grow downward off-canvas). A top-snapped card keeps
   *  `caption_bar_y: 0`. */
  function patchHeight(valuePct: number, commit: boolean) {
    const next: Partial<SlideStyleOverrides> = {
      ...(slide.style_overrides ?? {}),
      caption_bar_height_pct: valuePct,
    }
    if (commit) {
      next.caption_bar_y = position === 'cover' ? 100 - valuePct : 0
    }
    ;(commit ? onSlideUpdate : onSlidePreview ?? onSlideUpdate)({
      style_overrides: next,
    })
  }

  /** quick-260518-ch8: Edge-blend-amount-slider patch — mirrors patchOpacity's
   *  preview-on-change / commit-on-release pattern (KBD-09). Writes
   *  `caption_bar_blend_pct` (0..50). */
  function patchBlend(valuePct: number, commit: boolean) {
    const next = {
      ...(slide.style_overrides ?? {}),
      caption_bar_blend_pct: valuePct,
    }
    ;(commit ? onSlideUpdate : onSlidePreview ?? onSlideUpdate)({
      style_overrides: next,
    })
  }

  /** Top/Bottom snap — rewrites caption_bar_position + caption_bar_y. */
  function snap(pos: 'cover' | 'body') {
    const height =
      slide.style_overrides?.caption_bar_height_pct ?? DEFAULT_CAPTION_HEIGHT
    if (pos === 'body') {
      patch({ caption_bar_position: 'top', caption_bar_y: 0 })
    } else {
      patch({ caption_bar_position: 'bottom', caption_bar_y: 100 - height })
    }
  }

  return (
    <div
      className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-4"
      data-testid="slide-background-controls"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        Caption Card
      </span>

      <p className="text-[11px] text-[#7d6161] leading-snug">
        A colored card behind your captions — drag and resize it on the canvas.
      </p>

      {/* quick-260518-8o0: on/off toggle — `checked` reads the RESOLVED caption
          state (ON for an unedited news-layout slide). ON → caption_bar_enabled:
          true; OFF → explicit caption_bar_enabled: false (so the news resolver
          default cannot silently re-enable the card). */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#3d0000]">
          Caption card
        </span>
        <Switch
          aria-label="Caption card"
          data-testid="caption-card-toggle"
          checked={captionPanelOn}
          onCheckedChange={(checked) =>
            checked ? patch({ caption_bar_enabled: true }) : setCaptionOff()
          }
        />
      </div>

      {/* Top/Bottom snap presets — only shown while the card is ON. cover =
          Bottom snap, body = Top snap (testid strings kept stable). */}
      {captionPanelOn && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Snap to edge
          </span>
          <div
            className="flex gap-2"
            role="radiogroup"
            aria-label="Caption card snap position"
          >
            {(
              [
                { value: 'cover', label: 'Bottom' },
                { value: 'body', label: 'Top' },
              ] as const
            ).map((opt) => {
              const active = position === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`caption-card-position-${opt.value}`}
                  onClick={() => snap(opt.value)}
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

      {/* Color + Opacity are only meaningful when the card is ON, so they are
          gated behind `captionPanelOn`. The opacityDraft hooks above remain
          unconditional (rules-of-hooks) — only this JSX is gated. */}
      {captionPanelOn && (
      <>
      {/* Color — swatch-row picker: round COLOR_SWATCHES preset circles + a
          circular palette-icon button wrapping a hidden native
          <input type="color"> for arbitrary hex. Writes caption_bar_color.
          Both paths emit explicit hex strings (PCL12). */}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-[#3d0000]">Color</span>
        <div className="flex gap-3">
          {COLOR_SWATCHES.map((swatch) => {
            const active = color.toLowerCase() === swatch.toLowerCase()
            return (
              <button
                key={swatch}
                type="button"
                data-testid={`caption-card-color-swatch-${swatch}`}
                onClick={() => patch({ caption_bar_color: swatch })}
                className={`w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 ${
                  active ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
                }`}
                style={{
                  backgroundColor: swatch,
                  border: swatch === '#ffffff' ? '1px solid #dbc1bc' : undefined,
                }}
                aria-label={`Set caption card color to ${swatch}`}
                aria-pressed={active}
                title={swatch}
              />
            )
          })}
          <label
            className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1"
            data-testid="caption-card-color-palette"
          >
            <span
              className="material-symbols-outlined text-[#7d6161]"
              style={{ fontSize: 14 }}
              aria-hidden
            >
              palette
            </span>
            <input
              type="color"
              value={toColorInputValue(color)}
              data-testid="caption-card-color"
              aria-label="Set custom caption card color"
              className="sr-only"
              onChange={(e) => patch({ caption_bar_color: e.target.value })}
            />
          </label>
        </div>
      </div>

      {/* Opacity — lets the photo show through a semi-transparent card. The
          slider value is a 0..100 percent; it commits a 0..1 fraction.
          Preview-on-change, commit-on-release (KBD-09). */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#3d0000]">
            Opacity
          </span>
          <span className="text-[11px] font-bold text-[#7d6161]">
            {Math.round(opacityDraft)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={opacityDraft}
          data-testid="caption-card-opacity"
          aria-label="Caption card opacity"
          className="w-full accent-[#3d0000]"
          onChange={(e) => {
            const n = Number(e.target.value)
            setOpacityDraft(n)
            patchOpacity(n, false)
          }}
          onPointerUp={(e) =>
            patchOpacity(Number((e.target as HTMLInputElement).value), true)
          }
          onMouseUp={(e) =>
            patchOpacity(Number((e.target as HTMLInputElement).value), true)
          }
        />
        <p className="text-[10px] text-[#7d6161] leading-snug">
          A lower opacity lets the photo show through the card.
        </p>
      </div>

      {/* quick-260518-ch8: Height — resizes the caption card from the panel
          (previously only via the canvas resize-handles). Writes
          caption_bar_height_pct. Preview-on-change, commit-on-release (KBD-09);
          a commit also re-anchors caption_bar_y so a bottom-snapped card grows
          upward instead of off the bottom of the canvas. */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#3d0000]">
            Height
          </span>
          <span className="text-[11px] font-bold text-[#7d6161]">
            {Math.round(heightDraft)}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={90}
          step={1}
          value={heightDraft}
          data-testid="caption-card-height"
          aria-label="Caption card height"
          className="w-full accent-[#3d0000]"
          onChange={(e) => {
            const n = Number(e.target.value)
            setHeightDraft(n)
            patchHeight(n, false)
          }}
          onPointerUp={(e) =>
            patchHeight(Number((e.target as HTMLInputElement).value), true)
          }
          onMouseUp={(e) =>
            patchHeight(Number((e.target as HTMLInputElement).value), true)
          }
        />
        <p className="text-[10px] text-[#7d6161] leading-snug">
          A taller card gives the caption more breathing room.
        </p>
      </div>

      {/* quick-260518-ch8: Edge blend — toggle + amount slider. ON writes a
          sensible default blend amount; OFF writes 0. The amount slider only
          shows while blend is on. Writes caption_bar_blend_pct (0..50). */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#3d0000]">
            Edge blend
          </span>
          <Switch
            aria-label="Edge blend"
            data-testid="caption-card-blend-toggle"
            checked={blendPct > 0}
            onCheckedChange={(checked) =>
              patch({ caption_bar_blend_pct: checked ? BLEND_ON_DEFAULT : 0 })
            }
          />
        </div>
        {blendPct > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#3d0000]">
                Amount
              </span>
              <span className="text-[11px] font-bold text-[#7d6161]">
                {Math.round(blendDraft)}%
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={blendDraft}
              data-testid="caption-card-blend-amount"
              aria-label="Edge blend amount"
              className="w-full accent-[#3d0000]"
              onChange={(e) => {
                const n = Number(e.target.value)
                setBlendDraft(n)
                patchBlend(n, false)
              }}
              onPointerUp={(e) =>
                patchBlend(Number((e.target as HTMLInputElement).value), true)
              }
              onMouseUp={(e) =>
                patchBlend(Number((e.target as HTMLInputElement).value), true)
              }
            />
          </div>
        )}
        <p className="text-[10px] text-[#7d6161] leading-snug">
          Fades the card edge that meets the photo into a smooth transition.
        </p>
      </div>
      </>
      )}
    </div>
  )
}
