import { describe, it, expect } from 'vitest'
import {
  resolveCaptionBar,
  hexToRgba,
  bottomCardBackground,
} from '../resolve-overlay'
import { magazineBold } from '../templates/magazine-bold'
import type { SlideStyleOverrides } from '@/lib/types/slide'

/**
 * quick-260515-k12 — regression suite for the shared caption-bar resolver.
 *
 * `resolveCaptionBar` is the SINGLE source of truth for the height/color/
 * opacity/position of the `image-with-bottom-card` caption bar. Both
 * slide-preview.tsx (browser preview) and render-slide-satori.tsx (PNG
 * export) import it so the two render paths cannot drift (PARITY-01).
 *
 * The byte-identity case (TPLREND-05) is the load-bearing assertion: a
 * magazine-bold slide with ZERO caption-bar overrides MUST resolve to the
 * EXACT values the old hardcoded path produced (38% / rgba(0,0,0,0.85) /
 * bottom). If this breaks, the resolver is wrong — never relax the test.
 */
describe('resolveCaptionBar — caption-bar override resolution', () => {
  it('returns the legacy defaults for magazine-bold with no overrides', () => {
    const result = resolveCaptionBar(undefined, magazineBold)
    expect(result).toEqual({
      heightPct: 38,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      position: 'bottom',
    })
  })

  it('honors caption_bar_height_pct', () => {
    const overrides: SlideStyleOverrides = { caption_bar_height_pct: 50 }
    expect(resolveCaptionBar(overrides, magazineBold).heightPct).toBe(50)
  })

  it('composes rgba() from caption_bar_color + caption_bar_opacity', () => {
    const overrides: SlideStyleOverrides = {
      caption_bar_color: '#3d0000',
      caption_bar_opacity: 0.6,
    }
    expect(resolveCaptionBar(overrides, magazineBold).backgroundColor).toBe(
      'rgba(61, 0, 0, 0.6)',
    )
  })

  it('honors caption_bar_position: top', () => {
    const overrides: SlideStyleOverrides = { caption_bar_position: 'top' }
    expect(resolveCaptionBar(overrides, magazineBold).position).toBe('top')
  })

  it('clamps caption_bar_height_pct to 10..90', () => {
    expect(
      resolveCaptionBar({ caption_bar_height_pct: 200 }, magazineBold).heightPct,
    ).toBe(90)
    expect(
      resolveCaptionBar({ caption_bar_height_pct: 5 }, magazineBold).heightPct,
    ).toBe(10)
  })

  it('byte-identity (TPLREND-05): no-override result equals the old hardcoded path', () => {
    const result = resolveCaptionBar({}, magazineBold)
    // The old preview/Satori bottom-card used these exact three values.
    expect(result.backgroundColor).toBe(
      bottomCardBackground(magazineBold.backgroundColor),
    )
    expect(result.heightPct).toBe(38)
    expect(result.position).toBe('bottom')
  })

  it('Satori px math: bottom-position 38% bar matches the old round(H*0.62) anchor', () => {
    const H = 1920
    // New path: top = H - round(H * heightPct/100); old hardcoded: round(H*0.62).
    expect(H - Math.round((H * 38) / 100)).toBe(Math.round(H * 0.62))
  })
})

describe('hexToRgba — hex + alpha → rgba() string', () => {
  it('expands a 6-digit hex', () => {
    expect(hexToRgba('#3d0000', 0.6)).toBe('rgba(61, 0, 0, 0.6)')
  })

  it('expands a 3-digit hex', () => {
    expect(hexToRgba('#000', 0.85)).toBe('rgba(0, 0, 0, 0.85)')
  })

  it('falls back to rgba(0,0,0,alpha) on malformed input', () => {
    expect(hexToRgba('#zzz', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })
})
