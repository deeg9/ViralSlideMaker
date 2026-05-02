import { describe, it, expect } from 'vitest'

describe('validateTemplateRegistry', () => {
  it('does not throw on the live 5-template registry (no overlays declared)', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const { templates } = await import('@/lib/render/templates/index')
    expect(() => validateTemplateRegistry(templates)).not.toThrow()
  })

  it('does not throw on a template with each valid slot and each content type', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const valid = [{
      id: 'fixture-valid', name: 'V', thumbnail: '', fontFamily: '', hookFontSize: '', bodyFontSize: '',
      textColor: '', backgroundColor: '', overlayColor: '', overlayOpacity: 0,
      textAlign: 'left' as const, textPosition: 'top' as const, hookStyle: 'normal' as const,
      overlays: [
        { position: 'top-left' as const, content: { type: 'literal' as const, text: 'TR3NDING' } },
        { position: 'top-right' as const, content: { type: 'page-counter' as const } },
        { position: 'mid' as const, content: { type: 'slide-field' as const, field: 'topic' as const } },
        { position: 'bottom-card' as const, content: { type: 'slide-field' as const, field: 'hook_text' as const } },
        { position: 'free' as const, content: { type: 'literal' as const, text: 'A' }, offset: { x: 10, y: 20 } },
        { position: 'free' as const, content: { type: 'literal' as const, text: 'B' } },
      ],
      backgroundMode: 'image-with-bottom-card' as const,
    }]
    expect(() => validateTemplateRegistry(valid as never)).not.toThrow()
  })

  it("throws when an overlay has an invalid slot", async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const bad = [{
      id: 'fixture-bad-slot', name: '', thumbnail: '', fontFamily: '', hookFontSize: '', bodyFontSize: '',
      textColor: '', backgroundColor: '', overlayColor: '', overlayOpacity: 0,
      textAlign: 'left', textPosition: 'top', hookStyle: 'normal',
      overlays: [{ position: 'top-middle', content: { type: 'literal', text: 'x' } }],
    }]
    expect(() => validateTemplateRegistry(bad as never)).toThrow(/\[template-registry\].*fixture-bad-slot.*overlay\[0\].*top-middle/)
  })

  it("throws when slide-field references an unknown field", async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const bad = [{
      id: 'fixture-bad-field', name: '', thumbnail: '', fontFamily: '', hookFontSize: '', bodyFontSize: '',
      textColor: '', backgroundColor: '', overlayColor: '', overlayOpacity: 0,
      textAlign: 'left', textPosition: 'top', hookStyle: 'normal',
      overlays: [{ position: 'top-left', content: { type: 'slide-field', field: 'subtitle' } }],
    }]
    expect(() => validateTemplateRegistry(bad as never)).toThrow(/\[template-registry\].*fixture-bad-field.*overlay\[0\].*subtitle/)
  })

  it("throws when page-counter overlay carries an extraneous field", async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const bad = [{
      id: 'fixture-bad-counter', name: '', thumbnail: '', fontFamily: '', hookFontSize: '', bodyFontSize: '',
      textColor: '', backgroundColor: '', overlayColor: '', overlayOpacity: 0,
      textAlign: 'left', textPosition: 'top', hookStyle: 'normal',
      overlays: [{ position: 'top-right', content: { type: 'page-counter', text: 'never' } }],
    }]
    expect(() => validateTemplateRegistry(bad as never)).toThrow(/\[template-registry\].*fixture-bad-counter.*overlay\[0\].*page-counter.*text/)
  })

  it("throws when two overlays share the same non-'free' slot in one template", async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const bad = [{
      id: 'fixture-dup-slot', name: '', thumbnail: '', fontFamily: '', hookFontSize: '', bodyFontSize: '',
      textColor: '', backgroundColor: '', overlayColor: '', overlayOpacity: 0,
      textAlign: 'left', textPosition: 'top', hookStyle: 'normal',
      overlays: [
        { position: 'top-left', content: { type: 'literal', text: 'A' } },
        { position: 'top-left', content: { type: 'literal', text: 'B' } },
      ],
    }]
    expect(() => validateTemplateRegistry(bad as never)).toThrow(/\[template-registry\].*fixture-dup-slot.*overlay\[1\].*top-left/)
  })

  it("does NOT throw when two overlays both use the 'free' slot (free is exempt from duplicate check)", async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const ok = [{
      id: 'fixture-two-free', name: '', thumbnail: '', fontFamily: '', hookFontSize: '', bodyFontSize: '',
      textColor: '', backgroundColor: '', overlayColor: '', overlayOpacity: 0,
      textAlign: 'left', textPosition: 'top', hookStyle: 'normal',
      overlays: [
        { position: 'free', content: { type: 'literal', text: 'A' } },
        { position: 'free', content: { type: 'literal', text: 'B' } },
      ],
    }]
    expect(() => validateTemplateRegistry(ok as never)).not.toThrow()
  })
})

describe('Phase 55 (SLOP-03): premium-tier bodyFontFamily requirement', () => {
  const baseValidPremiumTemplate = {
    id: 'magazine-bold',
    name: 'Test',
    thumbnail: '/test.png',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    hookFontSize: '120px',
    bodyFontSize: '32px',
    textColor: '#fff',
    backgroundColor: '#000',
    overlayColor: '#000',
    overlayOpacity: 0.15,
    textAlign: 'left' as const,
    textPosition: 'bottom' as const,
    hookStyle: 'uppercase' as const,
    bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
  }

  it('passes when premium template declares non-empty bodyFontFamily', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    expect(() => validateTemplateRegistry([baseValidPremiumTemplate])).not.toThrow()
  })

  it('throws when premium template (magazine-bold) is missing bodyFontFamily', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const invalid = { ...baseValidPremiumTemplate }
    delete (invalid as { bodyFontFamily?: string }).bodyFontFamily
    expect(() => validateTemplateRegistry([invalid])).toThrow(
      /Template 'magazine-bold' is premium-tier but missing required 'bodyFontFamily' field/
    )
  })

  it('throws when premium template (tr3nding-news) has empty-string bodyFontFamily', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const invalid = { ...baseValidPremiumTemplate, id: 'tr3nding-news', bodyFontFamily: '' }
    expect(() => validateTemplateRegistry([invalid])).toThrow(
      /Template 'tr3nding-news' is premium-tier but missing required 'bodyFontFamily' field/
    )
  })

  it('throws when premium template (documentary) has missing bodyFontFamily', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const invalid = { ...baseValidPremiumTemplate, id: 'documentary' }
    delete (invalid as { bodyFontFamily?: string }).bodyFontFamily
    expect(() => validateTemplateRegistry([invalid])).toThrow(
      /Template 'documentary' is premium-tier but missing required 'bodyFontFamily' field/
    )
  })

  it('does NOT throw when LEGACY template (highlight-bar) is missing bodyFontFamily', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const legacyTemplate = { ...baseValidPremiumTemplate, id: 'highlight-bar' }
    delete (legacyTemplate as { bodyFontFamily?: string }).bodyFontFamily
    expect(() => validateTemplateRegistry([legacyTemplate])).not.toThrow()
  })

  it('does NOT throw when LEGACY template (news-drop) has empty-string bodyFontFamily', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const legacyTemplate = { ...baseValidPremiumTemplate, id: 'news-drop', bodyFontFamily: '' }
    expect(() => validateTemplateRegistry([legacyTemplate])).not.toThrow()
  })

  it('all 3 PREMIUM_TEMPLATE_IDS are recognized by validator (positive: live registry passes)', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const { templates } = await import('@/lib/render/templates/index')
    // Regression guard against accidentally removing bodyFontFamily from a real
    // premium template — Phase 55 declared it on all 3, validator must agree.
    expect(() => validateTemplateRegistry(templates)).not.toThrow()
  })
})

describe('Phase 56 (TPL-04, D-34): decorative overlay asset validation', () => {
  const baseFreeTemplate = {
    id: 'test-free-template',
    name: 'Test Free',
    thumbnail: '/test.png',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    hookFontSize: '110px',
    bodyFontSize: '32px',
    textColor: '#fff',
    backgroundColor: '#000',
    overlayColor: '#000',
    overlayOpacity: 0,
    textAlign: 'left' as const,
    textPosition: 'center' as const,
    hookStyle: 'normal' as const,
  }

  it('accepts overlay with a valid decorative asset', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const tpl = {
      ...baseFreeTemplate,
      overlays: [
        {
          position: 'free' as const,
          content: { type: 'decorative' as const, asset: 'tape-strip-1' as const },
          offset: { x: 60, y: 40 },
        },
      ],
    }
    expect(() => validateTemplateRegistry([tpl])).not.toThrow()
  })

  it('throws when overlay has an unknown decorative asset', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const tpl = {
      ...baseFreeTemplate,
      overlays: [
        {
          position: 'free' as const,
          content: { type: 'decorative' as const, asset: 'invented-asset' as never },
        },
      ],
    }
    expect(() => validateTemplateRegistry([tpl])).toThrow(/unknown asset 'invented-asset'/)
  })

  it('throws when decorative overlay has non-number rotation', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const tpl = {
      ...baseFreeTemplate,
      overlays: [
        {
          position: 'free' as const,
          content: {
            type: 'decorative' as const,
            asset: 'sticky-note-yellow' as const,
            rotation: 'invalid' as never,
          },
        },
      ],
    }
    expect(() => validateTemplateRegistry([tpl])).toThrow(/rotation must be a number/)
  })

  it('throws when decorative overlay has scale <= 0', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const tpl = {
      ...baseFreeTemplate,
      overlays: [
        {
          position: 'free' as const,
          content: { type: 'decorative' as const, asset: 'arrow-up' as const, scale: 0 },
        },
      ],
    }
    expect(() => validateTemplateRegistry([tpl])).toThrow(/scale must be a number in/)
  })

  it('throws when decorative overlay has scale > 2', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const tpl = {
      ...baseFreeTemplate,
      overlays: [
        {
          position: 'free' as const,
          content: { type: 'decorative' as const, asset: 'arrow-up' as const, scale: 2.5 },
        },
      ],
    }
    expect(() => validateTemplateRegistry([tpl])).toThrow(/scale must be a number in/)
  })

  it('accepts decorative overlay with valid scale=1.5', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const tpl = {
      ...baseFreeTemplate,
      overlays: [
        {
          position: 'free' as const,
          content: { type: 'decorative' as const, asset: 'polaroid-frame' as const, scale: 1.5 },
        },
      ],
    }
    expect(() => validateTemplateRegistry([tpl])).not.toThrow()
  })

  it('throws when decorative overlay has opacity > 1', async () => {
    const { validateTemplateRegistry } = await import('@/lib/render/templates/validate')
    const tpl = {
      ...baseFreeTemplate,
      overlays: [
        {
          position: 'free' as const,
          content: {
            type: 'decorative' as const,
            asset: 'halftone-dots-light' as const,
            opacity: 1.5,
          },
        },
      ],
    }
    expect(() => validateTemplateRegistry([tpl])).toThrow(/opacity must be a number in/)
  })
})
