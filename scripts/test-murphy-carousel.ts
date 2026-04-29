/**
 * End-to-end smoke test for v2.7 Premium Templates.
 *
 * Generates a 5-slide carousel about the Murphy Campbell case using:
 * - Phase 47 Gemini prompt pipeline (premium-tier addendum + length caps + typo gate + aiVoiceNote)
 * - magazine-bold template (Phase 46) — Murphy reference design
 * - Phase 45 Satori renderer (overlays, image-with-bottom-card, mint pills)
 *
 * Renders all 5 slides to PNG so you can visually compare to the Murphy reference.
 * Uses placeholder Pexels images (folk singer / B&W photography keywords) —
 * AI emits image_query strings; we pick a static B&W photo URL for the test
 * since fetching Pexels would require a separate API key.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { generateSlideContent } from '../src/lib/ai/generate-slides'
import { buildSlideElement } from '../src/lib/render/render-slide-satori'
import { getTemplate } from '../src/lib/render/templates'
import { loadFontBuffersForSlide } from '../src/lib/render/load-font'
import type { Slide } from '../src/lib/types/slide'

const OUT_DIR = join(process.cwd(), 'tmp', 'murphy-test')
const TOPIC = 'Murphy Campbell, a folk singer from Western North Carolina, sues OpenAI after AI cloned her singing voice and stole her copyright'
const TEMPLATE_ID = 'magazine-bold'
const SLIDE_COUNT = 5

// Static B&W folk singer placeholder so we can render without hitting Pexels.
// In production, /api/render fetches the actual Pexels URL the AI emits.
const PLACEHOLDER_BG = 'https://images.pexels.com/photos/1407322/pexels-photo-1407322.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop'

async function main(): Promise<void> {
  console.log(`[murphy-test] Generating ${SLIDE_COUNT}-slide carousel for: "${TOPIC}"`)
  console.log(`[murphy-test] Template: ${TEMPLATE_ID}`)
  console.log(`[murphy-test] Calling Gemini via Phase 47 pipeline...\n`)

  const startGen = Date.now()
  const carousel = await generateSlideContent(TOPIC, SLIDE_COUNT, undefined, TEMPLATE_ID)
  const genMs = Date.now() - startGen

  console.log(`[murphy-test] Gemini returned in ${genMs}ms`)
  console.log(`[murphy-test] Title: ${carousel.title}`)
  console.log(`[murphy-test] Slides: ${carousel.slides.length}\n`)

  // Show generated content per slide
  for (let i = 0; i < carousel.slides.length; i++) {
    const s = carousel.slides[i]
    const hookWords = s.hook_text.trim().split(/\s+/).length
    const bodyWords = s.body_text.trim().split(/\s+/).length
    const hookPills = (s.hook_segments ?? []).filter(seg => seg.highlightColor).length
    console.log(`Slide ${i + 1} (${s.is_cta ? 'CTA' : 'content'}):`)
    console.log(`  hook (${hookWords}w): ${s.hook_text}`)
    console.log(`  body (${bodyWords}w): ${s.body_text}`)
    console.log(`  highlight pills: ${hookPills}`)
    console.log(`  image_query: ${s.image_query}`)
    if (s.hook_segments && s.hook_segments.length > 0) {
      const segPreview = s.hook_segments
        .map(seg => seg.highlightColor ? `[${seg.text}]` : seg.text)
        .join(' ')
      console.log(`  segments: ${segPreview}`)
    }
    console.log()
  }

  // Render each slide to PNG
  console.log(`[murphy-test] Rendering ${carousel.slides.length} PNGs to ${OUT_DIR}/...`)
  mkdirSync(OUT_DIR, { recursive: true })

  const template = getTemplate(TEMPLATE_ID)
  for (let i = 0; i < carousel.slides.length; i++) {
    const aiSlide = carousel.slides[i]
    const slide: Slide = {
      hook_text: aiSlide.hook_text,
      body_text: aiSlide.body_text,
      hook_segments: aiSlide.hook_segments,
      body_segments: aiSlide.body_segments,
      image_query: aiSlide.image_query,
      is_cta: aiSlide.is_cta,
      background_url: PLACEHOLDER_BG,
      pexels_photo_id: null,
      style_overrides: aiSlide.layout ? { layout: aiSlide.layout as 'cover' | 'body' } : {},
    }
    const ctx = {
      slideIndex: i,
      totalSlides: carousel.slides.length,
      topic: 'TR3NDING',
    }
    const element = buildSlideElement(slide, template, null, null, undefined, ctx)
    const fonts = await loadFontBuffersForSlide(slide, template)
    const imageResponse = new ImageResponse(element, { width: 1080, height: 1920, fonts })
    const pngBytes = Buffer.from(await imageResponse.arrayBuffer())
    const outPath = join(OUT_DIR, `slide-${i + 1}.png`)
    writeFileSync(outPath, pngBytes)
    console.log(`[murphy-test]   wrote ${outPath} (${(pngBytes.length / 1024).toFixed(1)} KB)`)
  }

  console.log(`\n[murphy-test] Done. ${carousel.slides.length} PNGs in ${OUT_DIR}/`)
  console.log(`[murphy-test] Compare slide-1.png to /Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_1.png`)
}

main().catch((err: unknown) => {
  console.error('[murphy-test] FAILED:', err)
  process.exit(1)
})
