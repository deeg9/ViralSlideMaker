import { describe, expect, it } from 'vitest'
import type { Slide } from '@/lib/types/slide'
import {
  legacyWatermarkToElement,
  elementToLegacyWatermark,
  type WatermarkLegacySlice,
} from '@/lib/editor/watermark-adapter'
import { resolveForcedWatermark } from '@/lib/render/resolve-forced-watermark'

// -----------------------------------------------------------------------------
// Fixture helpers (mirror text-box-adapter.test.ts pattern)
// -----------------------------------------------------------------------------

function baseSlide(): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
}

function shape1NoWatermark(): Slide {
  // No watermark anywhere
  return baseSlide()
}

function shape2LegacyEnabled(): Slide {
  return {
    ...baseSlide(),
    style_overrides: {
      watermark: {
        enabled: true,
        customText: 'Brand',
        position: 'bottom-right',
      },
    },
  }
}

function shape3CustomLogo(): Slide {
  return {
    ...baseSlide(),
    style_overrides: {
      watermark: {
        enabled: true,
        customLogoUrl: 'https://cdn.example.com/logo.png',
        customText: 'Acme',
        position: 'bottom-left',
      },
    },
  }
}

function shape4Position(pos: 'top-left' | 'bottom-left' | 'bottom-right'): Slide {
  return {
    ...baseSlide(),
    style_overrides: {
      watermark: { enabled: true, position: pos },
    },
  }
}

function shape5UnifiedOnly(): Slide {
  // slide.watermark already populated, no legacy slot. Adapter should still
  // produce a faithful round-trip from the legacy view of this slide
  // (which has nothing). We test this via legacy → element only.
  return {
    ...baseSlide(),
    watermark: {
      id: 'w_0',
      enabled: true,
      customText: 'Unified',
      position: 'top-left',
    },
  }
}

function shape6BothPathsPresent(): Slide {
  return {
    ...baseSlide(),
    style_overrides: {
      watermark: {
        enabled: true,
        customText: 'Legacy',
        position: 'bottom-right',
      },
    },
    watermark: {
      id: 'w_0',
      enabled: true,
      customText: 'Unified',
      position: 'top-left',
    },
  }
}

/**
 * Reconstruct a slide's style_overrides slice from elementToLegacyWatermark
 * output, mirroring what the production save path does.
 */
function applyWatermarkSlice(
  original: Slide,
  slice: WatermarkLegacySlice,
): Slide {
  const merged: Slide = { ...original }
  const overrides = { ...(original.style_overrides ?? {}) }
  if (slice.watermark_patch !== undefined) {
    overrides.watermark = { ...slice.watermark_patch }
  } else {
    delete overrides.watermark
  }
  if (slice.hide_watermark_patch !== undefined) {
    overrides.hide_watermark = slice.hide_watermark_patch
  } else {
    delete overrides.hide_watermark
  }
  if (Object.keys(overrides).length > 0) {
    merged.style_overrides = overrides
  } else {
    delete (merged as Partial<Slide>).style_overrides
  }
  return merged
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('legacyWatermarkToElement', () => {
  it('Test 1: lifts style_overrides.watermark into a Watermark element with deterministic id', () => {
    const slide = shape2LegacyEnabled()
    const wm = legacyWatermarkToElement(slide, 0)
    expect(wm).not.toBeNull()
    expect(wm).toEqual({
      id: 'w_0',
      enabled: true,
      customText: 'Brand',
      position: 'bottom-right',
    })
    // 'hidden' field absent (not set to undefined)
    expect('hidden' in (wm as object)).toBe(false)
  })

  it('Test 2: returns null when slide has neither watermark nor hide_watermark', () => {
    const slide = shape1NoWatermark()
    expect(legacyWatermarkToElement(slide, 0)).toBeNull()
  })

  it('Test 3: hide_watermark=true alone produces Watermark{id, hidden:true}', () => {
    const slide: Slide = {
      ...baseSlide(),
      style_overrides: { hide_watermark: true },
    }
    const wm = legacyWatermarkToElement(slide, 0)
    expect(wm).toEqual({ id: 'w_0', hidden: true })
  })

  it('Test 4: ids are deterministic across calls (idempotency) and per-slide-index', () => {
    const slide = shape2LegacyEnabled()
    const a = legacyWatermarkToElement(slide, 5)
    const b = legacyWatermarkToElement(slide, 5)
    expect(a?.id).toBe(b?.id)
    expect(a?.id).toBe('w_5')
    const c = legacyWatermarkToElement(slide, 3)
    const d = legacyWatermarkToElement(slide, 7)
    expect(c?.id).toBe('w_3')
    expect(d?.id).toBe('w_7')
  })
})

describe('elementToLegacyWatermark', () => {
  it('Test 5: element with config fields produces watermark_patch + undefined hide_watermark_patch', () => {
    const slice = elementToLegacyWatermark({
      id: 'w_0',
      enabled: true,
      customText: 'Brand',
      position: 'bottom-left',
    })
    expect(slice).toEqual({
      watermark_patch: {
        enabled: true,
        customText: 'Brand',
        position: 'bottom-left',
      },
      hide_watermark_patch: undefined,
    })
  })

  it('Test 6: element with hidden=true produces hide_watermark_patch=true and watermark_patch=undefined', () => {
    const slice = elementToLegacyWatermark({ id: 'w_0', hidden: true })
    expect(slice).toEqual({
      watermark_patch: undefined,
      hide_watermark_patch: true,
    })
  })

  it('Test 10: null input returns both patches undefined (caller can delete)', () => {
    const slice = elementToLegacyWatermark(null)
    expect(slice).toEqual({
      watermark_patch: undefined,
      hide_watermark_patch: undefined,
    })
  })
})

describe('round-trip', () => {
  it('Test 7: legacy → element → legacy reproduces config fields losslessly', () => {
    const original = shape3CustomLogo()
    const wm = legacyWatermarkToElement(original, 0)
    expect(wm).not.toBeNull()
    const slice = elementToLegacyWatermark(wm)
    const reconstructed = applyWatermarkSlice(original, slice)
    const wm2 = legacyWatermarkToElement(reconstructed, 0)
    expect(wm2).not.toBeNull()
    // Config fields must equal across the round-trip.
    expect(wm2?.enabled).toBe(wm?.enabled)
    expect(wm2?.customLogoUrl).toBe(wm?.customLogoUrl)
    expect(wm2?.customText).toBe(wm?.customText)
    expect(wm2?.position).toBe(wm?.position)
    // Same slideIndex => same id.
    expect(wm2?.id).toBe(wm?.id)
  })
})

describe('free-tier preservation (RESEARCH Q10)', () => {
  it('Test 8: free tier WITH enabled=false STILL renders (free opt-out is locked)', () => {
    // Build a slide whose legacy slot has enabled=false (paid tier would
    // skip; free tier MUST still render the watermark).
    const slide: Slide = {
      ...baseSlide(),
      style_overrides: { watermark: { enabled: false } },
    }
    // Round-trip via the adapter: derive element, push back to slice,
    // reconstruct, and re-derive. The slot must still be `enabled=false`.
    const wm = legacyWatermarkToElement(slide, 0)
    const slice = elementToLegacyWatermark(wm)
    const reconstructed = applyWatermarkSlice(slide, slice)
    expect(reconstructed.style_overrides?.watermark?.enabled).toBe(false)

    const forced = resolveForcedWatermark(
      'free',
      { width: 1080, height: 1920 },
      reconstructed,
    )
    expect(forced).not.toBeNull()
  })
})

describe('6 fixture shapes round-trip losslessly', () => {
  it('Test 9: each fixture shape produces a stable round-trip', () => {
    const cases: Slide[] = [
      shape1NoWatermark(),
      shape2LegacyEnabled(),
      shape3CustomLogo(),
      shape4Position('top-left'),
      shape4Position('bottom-left'),
      shape4Position('bottom-right'),
      shape5UnifiedOnly(),
      shape6BothPathsPresent(),
    ]
    for (const slide of cases) {
      const wm = legacyWatermarkToElement(slide, 0)
      const slice = elementToLegacyWatermark(wm)
      const reconstructed = applyWatermarkSlice(slide, slice)
      const wm2 = legacyWatermarkToElement(reconstructed, 0)
      // Round-trip equality: config fields must match.
      if (wm === null) {
        expect(wm2).toBeNull()
      } else {
        expect(wm2).not.toBeNull()
        expect(wm2?.enabled).toBe(wm.enabled)
        expect(wm2?.customLogoUrl).toBe(wm.customLogoUrl)
        expect(wm2?.customText).toBe(wm.customText)
        expect(wm2?.position).toBe(wm.position)
      }
    }
  })
})
