import { describe, it, expect } from 'vitest'

describe('templates', () => {
  it('templates array has exactly 16 entries (5 legacy + 3 Phase 46 premium + 3 Phase 56 free + paper-essay + news-oracle + 3 quick-260519-t3x)', async () => {
    const { templates } = await import('@/lib/render/templates/index')
    expect(templates).toHaveLength(16)
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

  it('module-load validator passes for the live registry (legacy 5 + Phase 46 premium 3 + Phase 56 free 3 + paper-essay + news-oracle + 3 quick-260519-t3x)', async () => {
    const mod = await import('@/lib/render/templates/index')
    // If validateTemplateRegistry threw at load, this import would have rejected.
    expect(mod.templates).toHaveLength(16)

    // quick task 260518-jhg: news-oracle is a non-overlay news template (same
    // newsZone full-bleed render path as news-drop / news-cyan) — overlays
    // must be undefined, so it belongs in the legacy/no-overlay bucket.
    // quick task 260519-t3x: sunset-tabloid is a color-block no-overlay
    // template (legacy bucket alongside bold-yellow / y2k-pop). soft-sage +
    // chrome-pulse both declare overlays — free-tier overlay bucket.
    const legacyIds = new Set([
      'highlight-bar', 'news-drop', 'news-cyan', 'y2k-pop', 'bold-yellow', 'news-oracle',
      'sunset-tabloid',
    ])
    const premiumIds = new Set(['magazine-bold', 'tr3nding-news', 'documentary'])
    const freeOverlayIds = new Set([
      'editorial-serif', 'notes-app-chic', 'brutalist-grid', 'paper-essay',
      'soft-sage', 'chrome-pulse',
    ])

    for (const t of mod.templates) {
      if (legacyIds.has(t.id)) {
        expect(t.overlays).toBeUndefined()
      } else if (premiumIds.has(t.id)) {
        expect(Array.isArray(t.overlays)).toBe(true)
        expect((t.overlays ?? []).length).toBeGreaterThan(0)
      } else if (freeOverlayIds.has(t.id)) {
        // Free-tier overlay-using templates: page counter and/or decorative.
        // brutalist-grid has 2; notes-app-chic has 4; editorial-serif has 1;
        // paper-essay has 1. All should have at least one overlay.
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

  it('renders paper-essay with cream background, warm-dark text, and serif body font', async () => {
    const { buildSlideHtml } = await import('@/lib/render/render-slide')
    const { getTemplate } = await import('@/lib/render/templates/index')

    const template = getTemplate('paper-essay')
    const html = buildSlideHtml(
      {
        hook_text: 'leaving a good person',
        body_text: "here's the psychology",
        image_query: 'test',
        is_cta: false,
        background_url: null,
        pexels_photo_id: null,
      },
      template,
    )

    // Visual contract — these are what reach the rendered page on the legacy
    // hook_text path. headingFontFamily ('Playfair Display') is only emitted
    // via the text_boxes renderer path; this path inherits template.fontFamily.
    expect(template.id).toBe('paper-essay')
    expect(html).toContain('#F2EBDA') // paper cream bg
    expect(html).toContain('#1F1F1F') // warm-dark text
    expect(html).toContain('Lora') // body font (also inherited by hook on legacy path)

    // page-counter overlay is declared on the template but rendered via
    // resolveOverlayContent which needs slide context (current/total) — not
    // exercised by buildSlideHtml in isolation. Confirm declarative wiring
    // by finding the page-counter overlay regardless of array position
    // (other decorative overlays — paper-frame, rule-thin — share the array).
    const pageCounterOverlay = template.overlays?.find(
      (o) => o.content.type === 'page-counter',
    )
    expect(pageCounterOverlay).toBeDefined()
    expect(pageCounterOverlay?.style?.color).toBe('#6B6354')

    // Brittany "mindful by b" signature look: hairline frame + rule-thin
    // separator should both be declared as decorative overlays.
    const decorativeAssets = (template.overlays ?? [])
      .filter((o) => o.content.type === 'decorative')
      .map((o) => (o.content.type === 'decorative' ? o.content.asset : null))
    expect(decorativeAssets).toContain('paper-frame')
    expect(decorativeAssets).toContain('rule-thin')
  })

  it('paper-essay (backgroundMode: color) suppresses persisted slide.background_url', async () => {
    const { buildSlideHtml } = await import('@/lib/render/render-slide')
    const { getTemplate } = await import('@/lib/render/templates/index')

    // Slide carries a Pexels URL from a prior template — paper-essay should
    // ignore it entirely and paint the template's solid cream background.
    const html = buildSlideHtml(
      {
        hook_text: 'staying is the default',
        body_text: 'doing nothing = you stayed',
        image_query: 'mindfulness',
        is_cta: false,
        background_url: 'https://images.pexels.com/photos/12345/should-not-render.jpg',
        pexels_photo_id: 12345,
      },
      getTemplate('paper-essay'),
    )

    // Hard kill-switch: the photo URL must NOT appear in the output, and the
    // page must paint the template's cream background instead.
    expect(html).not.toContain('should-not-render.jpg')
    expect(html).not.toContain('background-image')
    expect(html).toContain('background-color: #F2EBDA')
  })

  it('legacy image-bleed templates still honor slide.background_url', async () => {
    const { buildSlideHtml } = await import('@/lib/render/render-slide')
    const { getTemplate } = await import('@/lib/render/templates/index')

    // Sanity check: backgroundMode kill-switch is paper-essay-specific. The
    // legacy default (highlight-bar) and image-bleed templates must keep
    // rendering background_url unchanged.
    const html = buildSlideHtml(
      {
        hook_text: 'Hook',
        body_text: 'Body',
        image_query: 'test',
        is_cta: false,
        background_url: 'https://example.com/photo.jpg',
        pexels_photo_id: 1,
      },
      getTemplate('highlight-bar'),
    )

    expect(html).toContain("https://example.com/photo.jpg")
    expect(html).toContain('background-image')
  })
})
