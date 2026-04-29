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
