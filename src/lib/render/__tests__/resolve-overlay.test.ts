import { describe, it, expect } from 'vitest'
import { resolveCaptionBar, captionCardBackgroundStyle } from '../resolve-overlay'
import { editorialSerif } from '../templates/editorial-serif'
import type { SlideTemplate } from '../templates'
import type { SlideStyleOverrides } from '@/lib/types/slide'

/**
 * quick-260518-ch8 — regression suite for the caption-card edge-blend feature.
 *
 * Covers the new `caption_bar_blend_pct` field on `resolveCaptionBar` and the
 * shared `captionCardBackgroundStyle` helper that all three render paths
 * (editor preview, Satori PNG export, HTML export) consume so the blend
 * gradient cannot drift between them (PARITY-01 / TPLREND-05).
 *
 * Byte-identity invariant: with NO `caption_bar_blend_pct` the resolver
 * returns `blendPct: 0` and `captionCardBackgroundStyle` returns a plain
 * `{ backgroundColor }` — byte-identical to a pre-change slide.
 *
 * Tampering threat T-ch8-01: a hand-edited / AI-emitted payload cannot push an
 * out-of-range blend stop into any render path — the resolver clamps to [0,50].
 */

const template: SlideTemplate = editorialSerif

describe('resolveCaptionBar — caption_bar_blend_pct', () => {
  it('no overrides → blendPct 0 (blend off) and heightPct 38 (legacy default unchanged)', () => {
    const cc = resolveCaptionBar(undefined, template)
    expect(cc.blendPct).toBe(0)
    expect(cc.heightPct).toBe(38)
  })

  it('caption_bar_blend_pct: 30 → blendPct 30', () => {
    const o: SlideStyleOverrides = { caption_bar_blend_pct: 30 }
    expect(resolveCaptionBar(o, template).blendPct).toBe(30)
  })

  it('clamps caption_bar_blend_pct above the [0,50] range (80 → 50)', () => {
    const o: SlideStyleOverrides = { caption_bar_blend_pct: 80 }
    expect(resolveCaptionBar(o, template).blendPct).toBe(50)
  })

  it('clamps caption_bar_blend_pct below the [0,50] range (-5 → 0)', () => {
    const o: SlideStyleOverrides = { caption_bar_blend_pct: -5 }
    expect(resolveCaptionBar(o, template).blendPct).toBe(0)
  })
})

describe('captionCardBackgroundStyle — shared blend gradient helper', () => {
  it('blendPct 0 → returns a plain { backgroundColor } only (byte-identical to pre-change card)', () => {
    const style = captionCardBackgroundStyle({
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      blendPct: 0,
      position: 'bottom',
    })
    expect(style).toEqual({ backgroundColor: 'rgba(0, 0, 0, 0.85)' })
    expect('backgroundImage' in style).toBe(false)
  })

  it('blendPct 30, position bottom → linear-gradient transparent at the TOP edge, card color from ~30% down', () => {
    const style = captionCardBackgroundStyle({
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      blendPct: 30,
      position: 'bottom',
    })
    expect('backgroundImage' in style).toBe(true)
    const grad = (style as { backgroundImage: string }).backgroundImage
    expect(grad).toBe(
      'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.85) 30%, rgba(0, 0, 0, 0.85) 100%)',
    )
    // No Satori-incompatible primitives (RESEARCH Pitfall #2).
    expect(grad).not.toMatch(/filter|mask|backdrop-filter|mix-blend-mode/)
  })

  it('blendPct 30, position top → card color from the top through ~70%, fading to TRANSPARENT at the BOTTOM edge', () => {
    const style = captionCardBackgroundStyle({
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      blendPct: 30,
      position: 'top',
    })
    expect('backgroundImage' in style).toBe(true)
    const grad = (style as { backgroundImage: string }).backgroundImage
    expect(grad).toBe(
      'linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.85) 70%, transparent 100%)',
    )
    expect(grad).not.toMatch(/filter|mask|backdrop-filter|mix-blend-mode/)
  })
})
