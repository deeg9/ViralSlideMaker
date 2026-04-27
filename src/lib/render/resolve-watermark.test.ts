import { describe, it, expect } from 'vitest'
import { resolveWatermark, type LogoPositionKey } from './resolve-watermark'

const URL = 'https://example.com/logo.png'

const baseBrandKit = {
  logo_url: URL,
  logo_position: 'bottom-right' as const,
  logo_size_pct: 10,
  logo_opacity_pct: 60,
}

const baseSlide = { style_overrides: undefined }

describe('resolveWatermark', () => {
  describe('short-circuits', () => {
    it('returns null when brandKit is null', () => {
      expect(resolveWatermark(null, baseSlide)).toBeNull()
    })

    it('returns null when brandKit is undefined', () => {
      expect(resolveWatermark(undefined, baseSlide)).toBeNull()
    })

    it('returns null when logo_url is empty string', () => {
      expect(
        resolveWatermark({ ...baseBrandKit, logo_url: '' }, baseSlide)
      ).toBeNull()
    })

    it('returns null when logo_url is undefined', () => {
      expect(
        resolveWatermark({ ...baseBrandKit, logo_url: undefined }, baseSlide)
      ).toBeNull()
    })

    it('returns null when logo_url is null', () => {
      expect(
        resolveWatermark({ ...baseBrandKit, logo_url: null }, baseSlide)
      ).toBeNull()
    })

    it('returns null when logo_position is null', () => {
      expect(
        resolveWatermark({ ...baseBrandKit, logo_position: null }, baseSlide)
      ).toBeNull()
    })

    it('returns null when slide.style_overrides.hide_watermark === true', () => {
      expect(
        resolveWatermark(baseBrandKit, {
          style_overrides: { hide_watermark: true },
        })
      ).toBeNull()
    })

    it('does NOT short-circuit when hide_watermark is false', () => {
      const result = resolveWatermark(baseBrandKit, {
        style_overrides: { hide_watermark: false },
      })
      expect(result).not.toBeNull()
    })
  })

  describe('1080x1920 canvas, size 10%, opacity 60%', () => {
    // margin = 1080 * 0.04 = 43.2
    // width = 1080 * 0.10 = 108
    // For middle/bottom Y math we use square approximation: height = width = 108
    // middle-Y = (1920 - 108) / 2 = 906
    // bottom-Y = 1920 - 43.2 - 108 = 1768.8
    // center-X = (1080 - 108) / 2 = 486
    // right-X = 1080 - 43.2 - 108 = 928.8
    const cases: Array<{ pos: LogoPositionKey; x: number; y: number }> = [
      { pos: 'top-left', x: 43.2, y: 43.2 },
      { pos: 'top-center', x: 486, y: 43.2 },
      { pos: 'top-right', x: 928.8, y: 43.2 },
      { pos: 'middle-left', x: 43.2, y: 906 },
      { pos: 'middle-center', x: 486, y: 906 },
      { pos: 'middle-right', x: 928.8, y: 906 },
      { pos: 'bottom-left', x: 43.2, y: 1768.8 },
      { pos: 'bottom-center', x: 486, y: 1768.8 },
      { pos: 'bottom-right', x: 928.8, y: 1768.8 },
    ]

    for (const { pos, x, y } of cases) {
      it(`computes correct x/y for ${pos}`, () => {
        const result = resolveWatermark(
          { ...baseBrandKit, logo_position: pos },
          baseSlide
        )
        expect(result).not.toBeNull()
        expect(result!.x).toBeCloseTo(x, 1)
        expect(result!.y).toBeCloseTo(y, 1)
        expect(result!.width).toBeCloseTo(108, 1)
      })
    }

    it('returns opacity as 0–1 fraction (0.6, not 60)', () => {
      const result = resolveWatermark(baseBrandKit, baseSlide)
      expect(result!.opacity).toBeCloseTo(0.6, 5)
    })

    it('returns the brand kit logo_url unchanged', () => {
      const result = resolveWatermark(baseBrandKit, baseSlide)
      expect(result!.url).toBe(URL)
    })
  })

  describe('defaults', () => {
    it('applies size_pct=10 default when null', () => {
      const result = resolveWatermark(
        { ...baseBrandKit, logo_size_pct: null },
        baseSlide
      )
      // 1080 * 0.10 = 108
      expect(result!.width).toBeCloseTo(108, 1)
    })

    it('applies size_pct=10 default when undefined', () => {
      const result = resolveWatermark(
        { logo_url: URL, logo_position: 'bottom-right' },
        baseSlide
      )
      expect(result!.width).toBeCloseTo(108, 1)
    })

    it('applies opacity_pct=60 default when null', () => {
      const result = resolveWatermark(
        { ...baseBrandKit, logo_opacity_pct: null },
        baseSlide
      )
      expect(result!.opacity).toBeCloseTo(0.6, 5)
    })

    it('applies opacity_pct=60 default when undefined', () => {
      const result = resolveWatermark(
        { logo_url: URL, logo_position: 'bottom-right' },
        baseSlide
      )
      expect(result!.opacity).toBeCloseTo(0.6, 5)
    })
  })

  describe('custom canvas sizes', () => {
    it('scales coordinates with the supplied canvas dimensions', () => {
      // 540x960 canvas (half size). margin = 21.6, width = 54
      const result = resolveWatermark(baseBrandKit, baseSlide, {
        width: 540,
        height: 960,
      })
      // bottom-right: x = 540 - 21.6 - 54 = 464.4, y = 960 - 21.6 - 54 = 884.4
      expect(result!.x).toBeCloseTo(464.4, 1)
      expect(result!.y).toBeCloseTo(884.4, 1)
      expect(result!.width).toBeCloseTo(54, 1)
    })
  })
})
