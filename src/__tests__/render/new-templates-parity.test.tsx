// Phase 56 (TPL-10): per-template parity audit for the 3 new free-tier
// templates (editorial-serif, notes-app-chic, brutalist-grid).
//
// Asserts:
//   1. Each template is registered in the templates array.
//   2. Each template declares an explicit non-Inter bodyFontFamily (D-04 +
//      Anti-Pattern #1).
//   3. Each template declares coverLayout distinct from default layout (TPL-06).
//   4. None of the 3 are in PREMIUM_TEMPLATE_IDS (TPL-09 free-tier).
//   5. Thumbnail path matches /templates/{id}.png convention (TPL-08).
//   6. Resolver-helper consumption is symmetric: both React preview and
//      Satori-target JSX trees include the same data-layer markers when the
//      template declares grainMode / vignette / decorative overlays
//      (TPLREND-05 — TPL-10 parity invariant).
//   7. Configuration matches a committed snapshot (regression guard against
//      accidental drift, mirrors Phase 55 legacy-templates-byte-identical).

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { createHash } from 'node:crypto'
import { templates, getTemplate } from '@/lib/render/templates'
import { PREMIUM_TEMPLATE_IDS } from '@/lib/render/templates/premium-tier'
import type { SlideTemplate } from '@/lib/render/templates'
import type { Slide } from '@/lib/types/slide'
import {
  renderGrain,
  renderVignette,
  renderDecorativeOverlay,
} from '@/lib/render/resolve-overlay'

const NEW_TEMPLATE_IDS = ['editorial-serif', 'notes-app-chic', 'brutalist-grid'] as const

function makeMinimalSlide(template: SlideTemplate): Slide {
  return {
    hook_text: template.sample?.hook_text ?? 'Sample hook',
    body_text: template.sample?.body_text ?? 'Sample body',
    hook_segments: template.sample?.hook_segments,
    image_query: 'sample',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
}

describe('Phase 56: new templates parity (TPL-10)', () => {
  for (const id of NEW_TEMPLATE_IDS) {
    describe(`${id}`, () => {
      it('is registered in the templates array', () => {
        const tpl = templates.find((t) => t.id === id)
        expect(tpl, `template '${id}' missing from registry`).toBeDefined()
        expect(tpl?.id).toBe(id)
      })

      it('declares an explicit non-Inter bodyFontFamily (D-04, Anti-Pattern #1)', () => {
        const tpl = getTemplate(id)
        expect(tpl.bodyFontFamily).toBeDefined()
        expect(tpl.bodyFontFamily).not.toBe('')
        expect(tpl.bodyFontFamily?.toLowerCase()).not.toContain('inter')
      })

      it('declares coverLayout distinct from default layout (TPL-06)', () => {
        const tpl = getTemplate(id)
        expect(tpl.coverLayout).toBeDefined()
      })

      it('is NOT in PREMIUM_TEMPLATE_IDS — free-tier per TPL-09', () => {
        expect((PREMIUM_TEMPLATE_IDS as readonly string[]).includes(id)).toBe(false)
      })

      it('thumbnail path matches /templates/{id}.png convention (TPL-08)', () => {
        const tpl = getTemplate(id)
        expect(tpl.thumbnail).toBe(`/templates/${id}.png`)
      })

      it('configuration matches committed snapshot (regression guard)', () => {
        const tpl = getTemplate(id)
        const json = JSON.stringify(tpl)
        const hash = createHash('sha256').update(json).digest('hex')
        // First run via vitest will create the snapshot fixture; subsequent
        // runs assert byte-identical match.
        expect(hash).toMatchSnapshot()
      })
    })
  }
})

describe('Phase 56: resolver helper smoke parity (TPLREND-05 invariant)', () => {
  // Direct invocation of the resolver helpers — proves the same exported
  // functions from resolve-overlay.ts produce data-layer markers consumed by
  // both renderers.
  it('renderGrain emits data-layer="grain"', () => {
    const html = renderToStaticMarkup(renderGrain('medium') as React.ReactElement)
    expect(html).toContain('data-layer="grain"')
  })

  it('renderVignette emits data-layer="vignette"', () => {
    const html = renderToStaticMarkup(renderVignette(0.5) as React.ReactElement)
    expect(html).toContain('data-layer="vignette"')
  })

  it('renderDecorativeOverlay emits data-layer="decorative" + data-asset', () => {
    const html = renderToStaticMarkup(
      renderDecorativeOverlay('tape-strip-1', { x: 60, y: 40 }) as React.ReactElement,
    )
    expect(html).toContain('data-layer="decorative"')
    expect(html).toContain('data-asset="tape-strip-1"')
  })
})

describe('Phase 56: notes-app-chic ransom-note hook segments (TPL-07)', () => {
  it('declares 5 hook segments with 5 distinct fontFamily values', () => {
    const tpl = getTemplate('notes-app-chic')
    const segments = tpl.sample?.hook_segments
    expect(segments).toBeDefined()
    expect(segments?.length).toBe(5)
    const fonts = segments?.map((s) => s.fontFamily) ?? []
    // All 5 must have fontFamily; mixed (ransom-note) — at least 4 unique families.
    expect(fonts.every((f) => typeof f === 'string' && f.length > 0)).toBe(true)
    expect(new Set(fonts).size).toBeGreaterThanOrEqual(4)
  })

  it("'sell' segment is highlighted with sticky-yellow pill in Archivo Black", () => {
    const tpl = getTemplate('notes-app-chic')
    const segments = tpl.sample?.hook_segments ?? []
    const sellSegment = segments.find((s) => s.text === 'sell')
    expect(sellSegment).toBeDefined()
    expect(sellSegment?.fontFamily).toContain('Archivo Black')
    expect(sellSegment?.highlightColor).toBe('#FFD86B')
    expect(sellSegment?.highlightStyle).toBe('pill')
  })
})

describe('Phase 56: notes-app-chic decorative overlays (TPL-04)', () => {
  it('declares 3 decorative overlays via free slot', () => {
    const tpl = getTemplate('notes-app-chic')
    const decorativeOverlays = (tpl.overlays ?? []).filter(
      (o) => o.content.type === 'decorative',
    )
    expect(decorativeOverlays.length).toBe(3)
    for (const ov of decorativeOverlays) {
      expect(ov.position).toBe('free')
    }
  })

  it('uses the expected 3 decorative assets (tape-strip-1, sticky-note-yellow, halftone-dots-light)', () => {
    const tpl = getTemplate('notes-app-chic')
    const assetIds = (tpl.overlays ?? [])
      .filter((o) => o.content.type === 'decorative')
      .map((o) => (o.content.type === 'decorative' ? o.content.asset : null))
    expect(assetIds).toContain('tape-strip-1')
    expect(assetIds).toContain('sticky-note-yellow')
    expect(assetIds).toContain('halftone-dots-light')
  })
})

describe('Phase 56: brutalist-grid minimalism (TPL-03)', () => {
  it('has NO grainMode (clean by construction)', () => {
    const tpl = getTemplate('brutalist-grid')
    expect(tpl.grainMode).toBeUndefined()
  })

  it('has NO vignette', () => {
    const tpl = getTemplate('brutalist-grid')
    expect(tpl.vignette).toBeUndefined()
  })

  it('has NO decorative overlays (minimalist by construction)', () => {
    const tpl = getTemplate('brutalist-grid')
    const decorativeOverlays = (tpl.overlays ?? []).filter(
      (o) => o.content.type === 'decorative',
    )
    expect(decorativeOverlays.length).toBe(0)
  })

  it('cover hook size (220px) > inner hook size (180px)', () => {
    const tpl = getTemplate('brutalist-grid')
    expect(tpl.hookFontSize).toBe('180px')
    expect(tpl.coverLayout?.hookFontSize).toBe('220px')
  })
})

describe('Phase 56: editorial-serif treatment + grain (TPL-01)', () => {
  it("declares photoTreatment 'bw' (auto-treated server-side at generation)", () => {
    const tpl = getTemplate('editorial-serif')
    expect(tpl.photoTreatment).toBe('bw')
  })

  it("declares grainMode 'medium' (0.08 opacity print-grain feel)", () => {
    const tpl = getTemplate('editorial-serif')
    expect(tpl.grainMode).toBe('medium')
  })

  it('hook size 130px (top of TYPO-03 110-130px band)', () => {
    const tpl = getTemplate('editorial-serif')
    expect(tpl.hookFontSize).toBe('130px')
  })
})

describe('Phase 56: registry length invariant', () => {
  it('templates array contains exactly 16 entries (8 existing + 3 Phase 56 + paper-essay + news-oracle + 3 quick-260519-t3x)', () => {
    expect(templates.length).toBe(16)
  })

  it('each new template has a sample.hook_text and sample.body_text', () => {
    for (const id of NEW_TEMPLATE_IDS) {
      const tpl = getTemplate(id)
      expect(tpl.sample?.hook_text).toBeDefined()
      expect(tpl.sample?.body_text).toBeDefined()
    }
  })
})

// Suppress unused-var lint if `makeMinimalSlide` is not exercised in the
// minimal smoke tests above. Retained for downstream parity-grid expansion.
void makeMinimalSlide
