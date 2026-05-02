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
    // top-left (260502-tlw default): x = 43.2, y = 43.2
    it('places logo at top-left with safe margin', () => {
      const r = resolveForcedWatermark('free')!
      expect(r.x).toBeCloseTo(43.2, 1)
      expect(r.y).toBeCloseTo(43.2, 1)
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
      // top-left (260502-tlw default): x = 21.6, y = 21.6
      expect(r.x).toBeCloseTo(21.6, 1)
      expect(r.y).toBeCloseTo(21.6, 1)
      expect(r.logoSize).toBe(24)
    })
  })

  // quick-260502-er5: paid-tier opt-in + custom logo + bottom-right placement
  describe('paid-tier per-slide config (quick-260502-er5)', () => {
    const baseSlide = (watermark: NonNullable<NonNullable<import('../types/slide').Slide['style_overrides']>['watermark']>) =>
      ({
        hook_text: '',
        body_text: '',
        image_query: '',
        is_cta: false,
        background_url: null,
        pexels_photo_id: null,
        style_overrides: { watermark },
      }) as unknown as import('../types/slide').Slide

    it('paid tier WITHOUT slide config returns null (current default behavior preserved)', () => {
      expect(resolveForcedWatermark('plus')).toBeNull()
      expect(resolveForcedWatermark('pro')).toBeNull()
    })

    it('paid tier WITH enabled=true renders ViralSlideMaker mark', () => {
      const r = resolveForcedWatermark('plus', undefined, baseSlide({ enabled: true }))
      expect(r).not.toBeNull()
      expect(r!.logoUrl).toBe('/logo.png')
      expect(r!.text).toBe('ViralSlideMaker.com')
    })

    it('paid tier WITH enabled=false returns null', () => {
      expect(
        resolveForcedWatermark('pro', undefined, baseSlide({ enabled: false })),
      ).toBeNull()
    })

    it('free tier WITH enabled=false STILL renders (free opt-out is locked)', () => {
      const r = resolveForcedWatermark('free', undefined, baseSlide({ enabled: false }))
      expect(r).not.toBeNull()
      expect(r!.logoUrl).toBe('/logo.png')
    })

    it('paid tier WITH customLogoUrl renders custom logo', () => {
      const r = resolveForcedWatermark(
        'pro',
        undefined,
        baseSlide({ customLogoUrl: 'https://cdn.example.com/my-brand.png', customText: 'My Brand' }),
      )
      expect(r).not.toBeNull()
      expect(r!.logoUrl).toBe('https://cdn.example.com/my-brand.png')
      expect(r!.text).toBe('My Brand')
    })

    it('free tier IGNORES customLogoUrl (always shows ViralSlideMaker)', () => {
      const r = resolveForcedWatermark(
        'free',
        undefined,
        baseSlide({ customLogoUrl: 'https://cdn.example.com/my-brand.png', customText: 'My Brand' }),
      )
      expect(r!.logoUrl).toBe('/logo.png')
      expect(r!.text).toBe('ViralSlideMaker.com')
    })

    it('paid tier WITH position=bottom-right places mark on the right edge', () => {
      const r = resolveForcedWatermark(
        'pro',
        { width: 1080, height: 1920 },
        baseSlide({ enabled: true, position: 'bottom-right' }),
      )
      expect(r).not.toBeNull()
      // x should be far right (canvas.width - margin - markWidth), much greater than the bottom-left margin (~43)
      expect(r!.x).toBeGreaterThan(500)
      // y unchanged from bottom-left
      expect(r!.y).toBeCloseTo(1827.8, 1)
    })

    it('free tier IGNORES position override (always top-left, 260502-tlw)', () => {
      const r = resolveForcedWatermark(
        'free',
        { width: 1080, height: 1920 },
        baseSlide({ position: 'bottom-right' }),
      )
      expect(r!.x).toBeCloseTo(43.2, 1) // left margin
      expect(r!.y).toBeCloseTo(43.2, 1) // top margin (locked top-left)
    })

    // 260502-tlw: top-left is the new default + an explicit picker option.
    it('paid tier WITH position=top-left places mark in the top-left corner', () => {
      const r = resolveForcedWatermark(
        'pro',
        { width: 1080, height: 1920 },
        baseSlide({ enabled: true, position: 'top-left' }),
      )
      expect(r).not.toBeNull()
      expect(r!.x).toBeCloseTo(43.2, 1)
      expect(r!.y).toBeCloseTo(43.2, 1)
    })

    it('paid tier WITH position=bottom-left preserves legacy bottom-left placement', () => {
      const r = resolveForcedWatermark(
        'pro',
        { width: 1080, height: 1920 },
        baseSlide({ enabled: true, position: 'bottom-left' }),
      )
      expect(r).not.toBeNull()
      expect(r!.x).toBeCloseTo(43.2, 1)
      expect(r!.y).toBeCloseTo(1827.8, 1)
    })
  })
})
