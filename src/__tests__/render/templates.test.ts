import { describe, it, expect } from 'vitest'

describe('templates', () => {
  it('templates array has exactly 11 entries (5 legacy + 3 Phase 46 premium + 3 Phase 56 free)', async () => {
    const { templates } = await import('@/lib/render/templates/index')
    expect(templates).toHaveLength(11)
  })

  it('each template has all required SlideTemplate fields', async () => {
    const { templates } = await import('@/lib/render/templates/index')

    const requiredFields = [
      'id', 'name', 'thumbnail', 'fontFamily', 'hookFontSize',
      'bodyFontSize', 'textColor', 'backgroundColor', 'overlayColor',
      'overlayOpacity', 'textAlign', 'textPosition', 'hookStyle',
    ]

    for (const template of templates) {
      for (const field of requiredFields) {
        expect(template).toHaveProperty(field)
      }
    }
  })

  it('getTemplate returns the highlight-bar template by id', async () => {
    const { getTemplate } = await import('@/lib/render/templates/index')
    const template = getTemplate('highlight-bar')
    expect(template.id).toBe('highlight-bar')
    expect(template.name).toBe('Highlight Bar')
  })

  it('getTemplate returns default template (highlight-bar) for nonexistent id', async () => {
    const { getTemplate } = await import('@/lib/render/templates/index')
    const template = getTemplate('nonexistent')
    expect(template.id).toBe('highlight-bar')
  })

  it('module-load validator passes for the live registry (legacy 5 + Phase 46 premium 3 + Phase 56 free 3)', async () => {
    const mod = await import('@/lib/render/templates/index')
    // If validateTemplateRegistry threw at load, this import would have rejected.
    expect(mod.templates).toHaveLength(11)

    const legacyIds = new Set(['highlight-bar', 'news-drop', 'news-cyan', 'y2k-pop', 'bold-yellow'])
    const premiumIds = new Set(['magazine-bold', 'tr3nding-news', 'documentary'])
    const phase56FreeIds = new Set(['editorial-serif', 'notes-app-chic', 'brutalist-grid'])

    for (const t of mod.templates) {
      if (legacyIds.has(t.id)) {
        expect(t.overlays).toBeUndefined()
      } else if (premiumIds.has(t.id)) {
        expect(Array.isArray(t.overlays)).toBe(true)
        expect((t.overlays ?? []).length).toBeGreaterThan(0)
      } else if (phase56FreeIds.has(t.id)) {
        // Phase 56 free templates declare overlays (page counter / topic label
        // / decorative). brutalist-grid has 2; notes-app-chic has 4; editorial
        // -serif has 1. All should have at least one overlay.
        expect(Array.isArray(t.overlays)).toBe(true)
        expect((t.overlays ?? []).length).toBeGreaterThan(0)
      } else {
        throw new Error(`unexpected template id in registry: ${t.id}`)
      }
    }
  })
})

describe('buildSlideHtml', () => {
  it('produces HTML with 1080px width and 1920px height in body style', async () => {
    const { buildSlideHtml } = await import('@/lib/render/render-slide')
    const { getTemplate } = await import('@/lib/render/templates/index')

    const slide = {
      hook_text: 'Test Hook',
      body_text: 'Test Body',
      image_query: 'test',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
    }

    const html = buildSlideHtml(slide, getTemplate('highlight-bar'))

    expect(html).toContain('width: 1080px')
    expect(html).toContain('height: 1920px')
  })

  it('escapes HTML entities in hook_text and body_text', async () => {
    const { buildSlideHtml } = await import('@/lib/render/render-slide')
    const { getTemplate } = await import('@/lib/render/templates/index')

    const slide = {
      hook_text: '<script>alert("xss")</script>',
      body_text: 'Text with "quotes" & <brackets>',
      image_query: 'test',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
    }

    const html = buildSlideHtml(slide, getTemplate('highlight-bar'))

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&lt;brackets&gt;')
  })

  it('applies template overlay color and opacity', async () => {
    const { buildSlideHtml } = await import('@/lib/render/render-slide')
    const { getTemplate } = await import('@/lib/render/templates/index')

    const slide = {
      hook_text: 'Hook',
      body_text: 'Body',
      image_query: 'test',
      is_cta: false,
      background_url: 'https://example.com/photo.jpg',
      pexels_photo_id: 123,
    }

    const template = getTemplate('highlight-bar')
    const html = buildSlideHtml(slide, template)

    expect(html).toContain(template.overlayColor)
    expect(html).toContain(String(template.overlayOpacity))
  })
})
