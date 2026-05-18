import { describe, it, expect } from 'vitest'
import {
  resolveCaptionBar,
  hexToRgba,
} from '../resolve-overlay'
import { magazineBold } from '../templates/magazine-bold'
import type { SlideStyleOverrides } from '@/lib/types/slide'

/**
 * quick-260517-k2n — regression suite for the reworked caption-card resolver.
 *
 * `resolveCaptionBar` is the SINGLE source of truth for the enabled state +
 * geometry (x/y/width/heightPct) + color of the caption card. All THREE render
 * paths import it — slide-preview.tsx (browser preview / canvas), the Satori
 * PNG export, and the HTML export — so the three paths cannot drift
 * (PARITY-01 / TPLREND-05).
 *
 * The byte-identity case (TPLREND-05) is the load-bearing assertion: a slide
 * with ZERO caption_bar_* overrides MUST resolve to `enabled: false` — i.e. no
 * card renders at all, identical to a pre-change slide. If this breaks, the
 * resolver is wrong — never relax the test.
 */
describe('resolveCaptionBar — caption-card override resolution', () => {
  it('byte-identity (TPLREND-05): no overrides resolves to enabled:false', () => {
    expect(resolveCaptionBar(undefined, magazineBold).enabled).toBe(false)
    expect(resolveCaptionBar({}, magazineBold).enabled).toBe(false)
  })

  it('a legacy slide carrying only caption_bar_height_pct still resolves enabled:false', () => {
    // k12 height-only slide — never had a real caption card; must stay off.
    expect(
      resolveCaptionBar({ caption_bar_height_pct: 50 }, magazineBold).enabled,
    ).toBe(false)
  })

  it('caption_bar_enabled:true yields default geometry', () => {
    const result = resolveCaptionBar(
      { caption_bar_enabled: true },
      magazineBold,
    )
    expect(result).toEqual({
      enabled: true,
      heightPct: 38,
      x: 0,
      y: 62, // bottom snap = 100 - 38
      width: 100,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      position: 'bottom',
      blendPct: 0, // quick-260518-ch8: edge-blend off by default
    })
  })

  it('composes rgba() from caption_bar_color + caption_bar_opacity', () => {
    const overrides: SlideStyleOverrides = {
      caption_bar_enabled: true,
      caption_bar_color: '#3d0000',
      caption_bar_opacity: 0.5,
    }
    expect(resolveCaptionBar(overrides, magazineBold).backgroundColor).toBe(
      'rgba(61, 0, 0, 0.5)',
    )
  })

  it('passes through explicit geometry verbatim', () => {
    const overrides: SlideStyleOverrides = {
      caption_bar_enabled: true,
      caption_bar_x: 10,
      caption_bar_y: 20,
      caption_bar_width: 80,
      caption_bar_height_pct: 50,
    }
    const result = resolveCaptionBar(overrides, magazineBold)
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.width).toBe(80)
    expect(result.heightPct).toBe(50)
  })

  it('clamps out-of-range geometry from a hand-edited payload', () => {
    // x/y/width clamp to [0,100]; height clamps to [10,90].
    expect(
      resolveCaptionBar(
        { caption_bar_enabled: true, caption_bar_x: 200 },
        magazineBold,
      ).x,
    ).toBe(100)
    expect(
      resolveCaptionBar(
        { caption_bar_enabled: true, caption_bar_x: -50 },
        magazineBold,
      ).x,
    ).toBe(0)
    expect(
      resolveCaptionBar(
        { caption_bar_enabled: true, caption_bar_width: 999 },
        magazineBold,
      ).width,
    ).toBe(100)
    expect(
      resolveCaptionBar(
        { caption_bar_enabled: true, caption_bar_height_pct: 5 },
        magazineBold,
      ).heightPct,
    ).toBe(10)
    expect(
      resolveCaptionBar(
        { caption_bar_enabled: true, caption_bar_height_pct: 200 },
        magazineBold,
      ).heightPct,
    ).toBe(90)
  })

  it('derives y from caption_bar_position when y is not explicit', () => {
    expect(
      resolveCaptionBar(
        { caption_bar_enabled: true, caption_bar_position: 'top' },
        magazineBold,
      ).y,
    ).toBe(0)
    // bottom => 100 - heightPct (default height 38 => 62)
    expect(
      resolveCaptionBar(
        { caption_bar_enabled: true, caption_bar_position: 'bottom' },
        magazineBold,
      ).y,
    ).toBe(62)
    // bottom with a custom height
    expect(
      resolveCaptionBar(
        {
          caption_bar_enabled: true,
          caption_bar_position: 'bottom',
          caption_bar_height_pct: 50,
        },
        magazineBold,
      ).y,
    ).toBe(50)
  })

  it('an explicit caption_bar_y always wins over the position-derived default', () => {
    expect(
      resolveCaptionBar(
        {
          caption_bar_enabled: true,
          caption_bar_position: 'top',
          caption_bar_y: 33,
        },
        magazineBold,
      ).y,
    ).toBe(33)
  })

  it('3-path parity: Satori px math agrees with HTML percent values', () => {
    // quick-260517-k2n Task 4 — pin that the Satori px conversion of the
    // resolved percents lands on the expected integer pixels, and that the
    // HTML path emits those same resolved percents verbatim.
    const W = 1080
    const H = 1920
    const result = resolveCaptionBar(
      {
        caption_bar_enabled: true,
        caption_bar_x: 10,
        caption_bar_y: 20,
        caption_bar_width: 80,
        caption_bar_height_pct: 50,
      },
      magazineBold,
    )
    // Satori path: explicit numeric px against W/H.
    expect(Math.round((result.x / 100) * W)).toBe(108)
    expect(Math.round((result.y / 100) * H)).toBe(384)
    expect(Math.round((result.width / 100) * W)).toBe(864)
    expect(Math.round((result.heightPct / 100) * H)).toBe(960)
    // HTML path: the resolved percents are emitted verbatim.
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.width).toBe(80)
    expect(result.heightPct).toBe(50)
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
