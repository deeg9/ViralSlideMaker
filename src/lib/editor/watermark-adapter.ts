/**
 * Phase 60 (WMARK-01..05): Adapter between the legacy SlideStyleOverrides.watermark
 * slot and the unified Watermark element on Slide.
 *
 * Two pure functions — symmetric with text-box-adapter:
 *   - legacyWatermarkToElement(slide, slideIndex): derive a Watermark | null
 *   - elementToLegacyWatermark(watermark): produce the legacy slice that, when
 *     shallow-merged onto slide.style_overrides, reconstructs identical shape.
 *
 * Used by:
 *   - eager migration on slide load (use-slide-editor.ts createInitialState)
 *   - dual-write on save (legacy slot kept populated for back-compat)
 *
 * Idempotence guarantee: legacyWatermarkToElement(slide, i) → wm; placing wm
 *   into slide.watermark and calling again with same slideIndex returns equal id.
 *
 * No React or state coupling; safe to call from any layer.
 */

import type { Slide, SlideStyleOverrides, Watermark } from '@/lib/types/slide'

export interface WatermarkLegacySlice {
  watermark_patch: Partial<NonNullable<SlideStyleOverrides['watermark']>> | undefined
  hide_watermark_patch: boolean | undefined
}

export function legacyWatermarkToElement(
  slide: Slide,
  slideIndex: number,
): Watermark | null {
  const wm = slide.style_overrides?.watermark
  const hideWm = slide.style_overrides?.hide_watermark
  if (!wm && !hideWm) return null
  return {
    id: `w_${slideIndex}`,
    ...(wm?.enabled !== undefined ? { enabled: wm.enabled } : {}),
    ...(wm?.customLogoUrl !== undefined ? { customLogoUrl: wm.customLogoUrl } : {}),
    ...(wm?.customText !== undefined ? { customText: wm.customText } : {}),
    ...(wm?.position !== undefined ? { position: wm.position } : {}),
    ...(hideWm === true ? { hidden: true } : {}),
  }
}

export function elementToLegacyWatermark(
  watermark: Watermark | null,
): WatermarkLegacySlice {
  if (!watermark) {
    return { watermark_patch: undefined, hide_watermark_patch: undefined }
  }
  const patch: NonNullable<WatermarkLegacySlice['watermark_patch']> = {}
  if (watermark.enabled !== undefined) patch.enabled = watermark.enabled
  if (watermark.customLogoUrl !== undefined) patch.customLogoUrl = watermark.customLogoUrl
  if (watermark.customText !== undefined) patch.customText = watermark.customText
  if (watermark.position !== undefined) patch.position = watermark.position
  return {
    watermark_patch: Object.keys(patch).length > 0 ? patch : undefined,
    hide_watermark_patch: watermark.hidden === true ? true : undefined,
  }
}
