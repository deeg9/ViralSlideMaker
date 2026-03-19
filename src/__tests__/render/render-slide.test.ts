import { describe, it, expect } from 'vitest'
import { buildSlideHtml } from '@/lib/render/render-slide'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

const mockSlide: Slide = {
  hook_text: 'Test Hook',
  body_text: 'Test Body',
  image_query: 'test',
  is_cta: false,
  background_url: null,
  pexels_photo_id: null,
}

describe('buildSlideHtml', () => {
  it('produces HTML containing width: 1080px and height: 1920px', () => {
    const html = buildSlideHtml(mockSlide, getTemplate('bold-minimal'))
    expect(html).toContain('width: 1080px')
    expect(html).toContain('height: 1920px')
  })
})
