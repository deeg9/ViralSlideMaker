// Phase 86 (ADMIN-02): reusable single-slide-to-PNG render helper.
//
// This is the reusable form of the `/api/render` single-slide Satori pipeline
// (the same pattern inlined in `/api/render` GET and in seed-explore's
// `renderHero`). The Save-as-Template save endpoint uses it to render slide 0
// — the cover — of a source carousel to a faithful preview PNG synchronously.
//
// Render parity (TPLREND-05) is preserved: it reuses `buildSlideElement` +
// `loadFontBuffersForSlide` unchanged and the 1080x1920 dimensions of every
// other render path — no new render fields, no new Satori options.

import { ImageResponse } from 'next/og'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

/**
 * Render a single slide to a 1080x1920 PNG Buffer via the existing Satori
 * pipeline. Pass slide 0 to get the carousel's cover snapshot.
 *
 * @param slide    The slide to render (slide 0 for a cover preview).
 * @param template The resolved template style.
 * @param ctx      Render context (slideIndex / totalSlides / topic) forwarded
 *                 to the shared overlay resolver — same source as the React
 *                 preview and PNG export.
 * @param origin   Optional request origin for absolute asset URLs.
 */
export async function renderCoverPreviewPng(
  slide: Slide,
  template: SlideTemplate,
  ctx: { slideIndex: number; totalSlides: number; topic?: string },
  origin?: string,
): Promise<Buffer> {
  const element = buildSlideElement(slide, template, null, 'free', origin, ctx)
  const fonts = await loadFontBuffersForSlide(slide, template)
  const imageResponse = new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts,
  })
  return Buffer.from(await imageResponse.arrayBuffer())
}
