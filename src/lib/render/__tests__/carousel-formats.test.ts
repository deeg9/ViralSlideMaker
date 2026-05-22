import { describe, it, expect } from 'vitest'
import {
  CAROUSEL_FORMATS,
  CAROUSEL_FORMAT_IDS,
  DEFAULT_FORMAT_NEW,
  DEFAULT_FORMAT_LEGACY,
  REFERENCE_HEIGHT,
  resolveFormat,
  resolveFormatWithOverride,
  heightScale,
  scaleFontPx,
} from '../carousel-formats'

describe('carousel-formats', () => {
  it('defines the three formats at width 1080 with the expected heights', () => {
    expect(CAROUSEL_FORMATS.tiktok).toMatchObject({ w: 1080, h: 1920, ratioLabel: '9:16' })
    expect(CAROUSEL_FORMATS.instagram).toMatchObject({ w: 1080, h: 1350, ratioLabel: '4:5' })
    expect(CAROUSEL_FORMATS.square).toMatchObject({ w: 1080, h: 1080, ratioLabel: '1:1' })
    // Width is always 1080 — the core invariant of the feature.
    for (const id of CAROUSEL_FORMAT_IDS) {
      expect(CAROUSEL_FORMATS[id].w).toBe(1080)
    }
  })

  it('exposes all format ids', () => {
    expect([...CAROUSEL_FORMAT_IDS].sort()).toEqual(['instagram', 'square', 'tiktok'])
  })

  it('defaults: new carousels → instagram, legacy carousels → tiktok', () => {
    expect(DEFAULT_FORMAT_NEW).toBe('instagram')
    expect(DEFAULT_FORMAT_LEGACY).toBe('tiktok')
  })

  describe('resolveFormat', () => {
    it('resolves a valid id', () => {
      expect(resolveFormat('instagram')).toBe(CAROUSEL_FORMATS.instagram)
      expect(resolveFormat('square')).toBe(CAROUSEL_FORMATS.square)
      expect(resolveFormat('tiktok')).toBe(CAROUSEL_FORMATS.tiktok)
    })

    it('resolves NULL / undefined / unknown to tiktok (legacy contract)', () => {
      expect(resolveFormat(null)).toBe(CAROUSEL_FORMATS.tiktok)
      expect(resolveFormat(undefined)).toBe(CAROUSEL_FORMATS.tiktok)
      expect(resolveFormat('')).toBe(CAROUSEL_FORMATS.tiktok)
      expect(resolveFormat('garbage')).toBe(CAROUSEL_FORMATS.tiktok)
      expect(resolveFormat('__proto__')).toBe(CAROUSEL_FORMATS.tiktok)
    })
  })

  describe('resolveFormatWithOverride', () => {
    it('a valid override id wins over the stored format', () => {
      expect(resolveFormatWithOverride('instagram', 'tiktok')).toBe(CAROUSEL_FORMATS.instagram)
      expect(resolveFormatWithOverride('square', 'instagram')).toBe(CAROUSEL_FORMATS.square)
      expect(resolveFormatWithOverride('tiktok', null)).toBe(CAROUSEL_FORMATS.tiktok)
    })

    it('falls back to the stored format when the override is absent or junk', () => {
      expect(resolveFormatWithOverride(null, 'instagram')).toBe(CAROUSEL_FORMATS.instagram)
      expect(resolveFormatWithOverride(undefined, 'square')).toBe(CAROUSEL_FORMATS.square)
      expect(resolveFormatWithOverride('', 'instagram')).toBe(CAROUSEL_FORMATS.instagram)
      expect(resolveFormatWithOverride('widescreen', 'square')).toBe(CAROUSEL_FORMATS.square)
    })

    it('falls back to tiktok when neither override nor stored is valid (legacy contract)', () => {
      expect(resolveFormatWithOverride(null, null)).toBe(CAROUSEL_FORMATS.tiktok)
      expect(resolveFormatWithOverride('garbage', 'garbage')).toBe(CAROUSEL_FORMATS.tiktok)
    })
  })

  describe('heightScale', () => {
    it('is exactly 1 for tiktok (byte-identity guard)', () => {
      expect(heightScale(CAROUSEL_FORMATS.tiktok)).toBe(1)
    })

    it('scales by the height ratio for shorter canvases', () => {
      expect(heightScale(CAROUSEL_FORMATS.instagram)).toBeCloseTo(1350 / 1920)
      expect(heightScale(CAROUSEL_FORMATS.square)).toBeCloseTo(1080 / 1920)
      expect(REFERENCE_HEIGHT).toBe(1920)
    })
  })

  describe('scaleFontPx', () => {
    it('returns px unchanged for tiktok — exact, no rounding (byte-identity)', () => {
      expect(scaleFontPx(130, CAROUSEL_FORMATS.tiktok)).toBe(130)
      expect(scaleFontPx(38, CAROUSEL_FORMATS.tiktok)).toBe(38)
      // A non-integer stored size must survive the tiktok passthrough exactly.
      expect(scaleFontPx(130.5, CAROUSEL_FORMATS.tiktok)).toBe(130.5)
    })

    it('scales and rounds for shorter canvases', () => {
      expect(scaleFontPx(130, CAROUSEL_FORMATS.instagram)).toBe(Math.round(130 * (1350 / 1920)))
      expect(scaleFontPx(130, CAROUSEL_FORMATS.square)).toBe(Math.round(130 * (1080 / 1920)))
    })
  })
})
