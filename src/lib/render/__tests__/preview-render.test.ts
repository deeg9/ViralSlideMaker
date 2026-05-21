import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

/**
 * Phase 86 (ADMIN-02) — preview render helper.
 *
 * The real Satori/resvg wasm stack is too heavy for a jsdom unit test, so the
 * three render dependencies are mocked. The test proves renderCoverPreviewPng
 * drives the pipeline with the correct 1080x1920 dimensions and forwards the
 * slide / template / ctx.
 */

// Capture the ImageResponse constructor options for assertion.
const imageResponseCalls: Array<{ element: unknown; options: unknown }> = []
const buildSlideElementCalls: unknown[][] = []

vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(element: unknown, options: unknown) {
      imageResponseCalls.push({ element, options })
    }
    async arrayBuffer(): Promise<ArrayBuffer> {
      return new ArrayBuffer(8)
    }
  },
}))

vi.mock('@/lib/render/render-slide-satori', () => ({
  buildSlideElement: (...args: unknown[]) => {
    buildSlideElementCalls.push(args)
    return { __sentinel: 'element' }
  },
}))

vi.mock('@/lib/render/load-font', () => ({
  loadFontBuffersForSlide: async () => [],
}))

import { renderCoverPreviewPng } from '@/lib/render/preview-render'

const slide = { hook_text: 'Hi', body_text: 'Body', is_cta: false } as Slide
const template = { id: 't', name: 'T' } as SlideTemplate
const ctx = { slideIndex: 0, totalSlides: 5, topic: 'sleep' }

describe('renderCoverPreviewPng', () => {
  beforeEach(() => {
    imageResponseCalls.length = 0
    buildSlideElementCalls.length = 0
  })

  it('resolves to a Buffer', async () => {
    const result = await renderCoverPreviewPng(slide, template, ctx)
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('constructs ImageResponse with 1080x1920 dimensions', async () => {
    await renderCoverPreviewPng(slide, template, ctx)
    expect(imageResponseCalls).toHaveLength(1)
    const options = imageResponseCalls[0].options as { width: number; height: number }
    expect(options.width).toBe(1080)
    expect(options.height).toBe(1920)
  })

  it('forwards the slide, template, and ctx to buildSlideElement', async () => {
    await renderCoverPreviewPng(slide, template, ctx)
    expect(buildSlideElementCalls).toHaveLength(1)
    const args = buildSlideElementCalls[0]
    expect(args[0]).toBe(slide)
    expect(args[1]).toBe(template)
    // Phase 89 (BKSHELVE): the brandKit positional arg #3 was removed from
    // buildSlideElement, shifting ctx from index 5 to index 4.
    expect(args[4]).toEqual(ctx)
  })
})
