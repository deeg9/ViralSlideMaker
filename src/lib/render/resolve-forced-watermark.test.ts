import { describe, it, expect } from 'vitest'
import { resolveForcedWatermark } from './resolve-forced-watermark'

describe('resolveForcedWatermark', () => {
  describe('tier gating', () => {
    it('returns null for plus tier', () => {
      expect(resolveForcedWatermark('plus')).toBeNull()
    })

    it('returns null for pro tier', () => {
      expect(resolveForcedWatermark('pro')).toBeNull()
    })

    it('returns null for null tier', () => {
      expect(resolveForcedWatermark(null)).toBeNull()
    })

    it('returns null for undefined tier', () => {
      expect(resolveForcedWatermark(undefined)).toBeNull()
    })

    it('returns object for free tier', () => {
      const result = resolveForcedWatermark('free')
      expect(result).not.toBeNull()
    })
  })

  describe('1080x1920 canvas defaults', () => {
    // margin = 1080 * 0.04 = 43.2
    // logoSize = round(1080 * 0.045) = round(48.6) = 49
    // fontSize = round(1080 * 0.022) = round(23.76) = 24
    // gap      = round(1080 * 0.012) = round(12.96) = 13
    // bottom-left: x = 43.2, y = 1920 - 43.2 - 49 = 1827.8
    it('places logo at bottom-left with safe margin', () => {
      const r = resolveForcedWatermark('free')!
      expect(r.x).toBeCloseTo(43.2, 1)
      expect(r.y).toBeCloseTo(1827.8, 1)
    })

    it('returns expected logo, font, and gap sizes', () => {
      const r = resolveForcedWatermark('free')!
      expect(r.logoSize).toBe(49)
      expect(r.fontSize).toBe(24)
      expect(r.gap).toBe(13)
    })

    it('returns brand text "ViralSlideMaker.com"', () => {
      const r = resolveForcedWatermark('free')!
      expect(r.text).toBe('ViralSlideMaker.com')
    })

    it('returns logoUrl pointing at /logo.png', () => {
      const r = resolveForcedWatermark('free')!
      expect(r.logoUrl).toBe('/logo.png')
    })

    it('returns opacity 0.55 (not a percent)', () => {
      const r = resolveForcedWatermark('free')!
      expect(r.opacity).toBeCloseTo(0.55, 5)
    })

    it('returns white text with a soft drop shadow', () => {
      const r = resolveForcedWatermark('free')!
      expect(r.textColor).toBe('#ffffff')
      expect(r.textShadow).toMatch(/rgba\(0,0,0/)
    })
  })

  describe('custom canvas sizes', () => {
    it('scales coordinates with the supplied canvas dimensions', () => {
      // 540x960 canvas (half size). margin = 21.6, logoSize = round(24.3) = 24
      const r = resolveForcedWatermark('free', { width: 540, height: 960 })!
      // bottom-left: x = 21.6, y = 960 - 21.6 - 24 = 914.4
      expect(r.x).toBeCloseTo(21.6, 1)
      expect(r.y).toBeCloseTo(914.4, 1)
      expect(r.logoSize).toBe(24)
    })
  })
})
