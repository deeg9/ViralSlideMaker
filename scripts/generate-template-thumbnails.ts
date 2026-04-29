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

const OUT_DIR = join(process.cwd(), 'public', 'templates')

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const template of templates) {
    if (!/^[a-z0-9-]+$/.test(template.id)) {
      throw new Error(`[thumbs] Unsafe template id '${template.id}' — must match [a-z0-9-]+`)
    }
    const slide = makeSampleSlide(template)
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
