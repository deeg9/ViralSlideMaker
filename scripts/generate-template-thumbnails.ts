/**
 * Phase 48 — Template thumbnail generator.
 *
 * Renders each registered template's `sample` data through the production
 * Satori → resvg pipeline (via next/og::ImageResponse) and writes a 1080×1920
 * PNG to public/templates/<id>.png.
 *
 * Why next/og: the production /api/render route uses ImageResponse to wrap
 * Satori + resvg-wasm — those bundles ship inside next/og. By reusing
 * ImageResponse here we get byte-identical pixels to /api/render without
 * adding satori or @resvg/resvg-wasm as new top-level deps.
 *
 * Run: `npm run thumbs` (idempotent — overwrites existing PNGs).
 */
import { ImageResponse } from 'next/og'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { templates } from '../src/lib/render/templates/index'
import { buildSlideElement } from '../src/lib/render/render-slide-satori'
import { loadFontBuffersForSlide } from '../src/lib/render/load-font'
import { makeSampleSlide } from '../src/lib/render/sample-slide'
import type { Slide } from '../src/lib/types/slide'

const OUT_DIR = join(process.cwd(), 'public', 'templates')

/**
 * Satori (the engine inside next/og::ImageResponse) requires `display: flex`
 * on any <div> with more than one child node. The hook/body text divs in
 * render-slide-satori.tsx don't set `display: flex`, so when hook_segments /
 * body_segments expand into multiple <span> siblings the rasterizer throws.
 *
 * The picker shows a LIVE React SlidePreview at runtime, so end-users see
 * accent-word highlights correctly. These static PNGs are dev-only fallbacks
 * (template.thumbnail field, not currently consumed by the picker UI). For
 * the static thumbnail we strip segments so the PNG renders without the
 * Satori multi-child constraint — colors fall back to the template's textColor.
 *
 * Tracked separately as a latent /api/render bug (see deferred-items.md):
 * production POST /api/render with hook_segments would hit the same error.
 */
function thumbnailSlide(template: (typeof templates)[number]): Slide {
  const slide = makeSampleSlide(template)
  return { ...slide, hook_segments: undefined, body_segments: undefined }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const template of templates) {
    const slide = thumbnailSlide(template)
    const ctx = { slideIndex: 0, totalSlides: 1, topic: undefined as string | undefined }
    const element = buildSlideElement(slide, template, null, null, undefined, ctx)
    const fonts = await loadFontBuffersForSlide(slide, template)
    const imageResponse = new ImageResponse(element, {
      width: 1080,
      height: 1920,
      fonts,
    })
    const buffer = Buffer.from(await imageResponse.arrayBuffer())
    const outPath = join(OUT_DIR, `${template.id}.png`)
    writeFileSync(outPath, buffer)
    console.log(`[thumbs] Generated public/templates/${template.id}.png`)
  }

  console.log(`[thumbs] Wrote ${templates.length} PNGs to public/templates/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
