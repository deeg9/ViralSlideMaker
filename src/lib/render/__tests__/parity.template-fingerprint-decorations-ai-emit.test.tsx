// Phase 71 Plan 03 (PARITY-10 / PTF17): AI-emit decoration parity fingerprint.
//
// PTF17 closes the v2.12 byte-identity surface — proves that an AI-EMITTED
// decoration (closed-enum DecorationEmitContent), after passing through the
// FULL Plan 71-01 ingest pipeline:
//
//   DecorationEmitSchema.safeParse → resolveAIDecoration → DecorationSchema.safeParse
//
// renders byte-identical between Satori PNG export (`buildSlideElement` →
// `renderToStaticMarkup`) and React DOM preview (`<SlidePreview />` →
// container.innerHTML), at the decoration-slice level. Every PTF17 test
// asserts BOTH:
//
//   1. expect(decoSlice(preview)).toBe(decoSlice(satori))  ← byte-identity equiv
//   2. expect(decoSlice(preview)).toMatchSnapshot()        ← committed baseline pin
//
// (Mirror of the PTF13/14/18 cross-renderer + snapshot defense-in-depth pattern;
// see parity.template-fingerprint-decorations.test.tsx file header for the
// full SCOPE rationale on why decoration-slice and not whole-slide.)
//
// Why pipe through the FULL ingest path (not just call resolveAIDecoration)?
// PTF17's contract is the AI-emit-end-to-end byte-identity invariant. An
// AI-suggested decoration must produce identical pixels in the published PNG
// AND in the live editor preview, after EVERY transformation the production
// ingest applies. Skipping any layer (closed-enum gate, resolver, final-shape
// gate) would leave a v2.12 byte-identity gap.
//
// Test fixture coverage (≥5 tests):
//   - Test 1 (PTF17-icon-accent):           icon emit, color: 'accent', position: 'top-right'
//   - Test 2 (PTF17-icon-palette-vibrant):  icon emit, color: 'palette-vibrant', position: 'top-left'
//   - Test 3 (PTF17-shape-accent):          shape emit (rect), color: 'accent', position: 'bottom-left'
//   - Test 4 (PTF17-shape-palette-vibrant): shape emit (circle), color: 'palette-vibrant', position: 'center'
//   - Test 5 (PTF17-multi-decoration):      icon + shape emits on the same slide; both slices byte-identical
//
// Locked derived_palette fixture for palette-token resolution:
//   ['#11AABB', '#22CCDD', '#33EEFF', '#44112233', '#5566FF77', '#778899']
// Index 0 (#11AABB) is what 'palette-vibrant' resolves to (Phase 56 node-vibrant
// ordering — Vibrant=index 0). Modifying these values requires regenerating
// __snapshots__/parity.template-fingerprint-decorations-ai-emit.test.tsx.snap.
//
// THROW-on-failure pipe-through helper (vs production silent-drop):
// `pipeAIEmitToDecoration` is a TEST-ONLY helper. Production ingest in
// generate-slides.ts silent-drops malformed entries; tests want LOUD failures
// on fixture mistakes (a typo'd lucideName here should fail CI immediately,
// not silently produce 0 decorations and then fail the byte-identity assertion
// with a confusing diff).
//
// Runtime PTF labels for verify-gate grep:
//   PTF17-icon-accent, PTF17-icon-palette-vibrant, PTF17-shape-accent,
//   PTF17-shape-palette-vibrant, PTF17-multi-decoration

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { templates } from '@/lib/render/templates'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { SlidePreview } from '@/components/slides/slide-preview'
import { resolveAIDecoration } from '@/lib/ai/resolve-ai-decoration'
import {
  DecorationEmitSchema,
  DecorationSchema,
  type DecorationEmitContent,
  type DecorationContent,
} from '@/lib/ai/schemas'
import {
  fingerprintFixtureSlide,
  computeStructuralFingerprint,
} from './__fixtures__/parity-fingerprint-fixtures'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates'

// Use templates[0] for determinism — same template as PTF13/14/18 so the
// diff focuses on the decoration layer (and the AI-resolution layer above it).
const TEMPLATE = templates[0]

// Locked palette — derived_palette[0] = '#11AABB' is what palette-vibrant
// resolves to. The other entries are present so the schema is well-formed
// but only index 0 is referenced by these tests.
const LOCKED_DERIVED_PALETTE = [
  '#11AABB',
  '#22CCDD',
  '#33EEFF',
  '#44112233',
  '#5566FF77',
  '#778899',
] as const

/**
 * Extract the decoration subtree (`<div data-decoration-id="..." ...>...</div>`)
 * from a full slide HTML output. Copy of the PTF13/14/18 helper — duplicated
 * here per the plan's fallback option (acceptable; mirrors Phase 69 PTF16
 * copy-paste precedent in parity.template-fingerprint-decorations-undefined.test.tsx).
 *
 * Multi-decoration variant accepts a `decorationId` arg to extract a specific
 * slice — needed for PTF17-multi-decoration where two decorations land on the
 * same slide.
 */
function extractDecorationSlice(html: string, decorationId?: string): string {
  const openRe = decorationId
    ? new RegExp(`<div\\b[^>]*\\bdata-decoration-id="${decorationId}"[^>]*>`)
    : /<div\b[^>]*\bdata-decoration-id\b[^>]*>/
  const m = openRe.exec(html)
  if (!m) return ''
  const start = m.index
  let depth = 1
  let i = start + m[0].length
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 4
    } else {
      depth -= 1
      i = nextClose + 6
    }
  }
  return html.slice(start, i)
}

/**
 * Normalize a decoration slice for cross-renderer byte-identity comparison.
 * Identical to the PTF13/14/18 helper — see
 * parity.template-fingerprint-decorations.test.tsx for the rationale on each
 * normalization step (style spacing, rgb→hex, self-closing void tags, sorted
 * <img> attributes).
 */
function normalizeDecorationSlice(slice: string): string {
  let s = computeStructuralFingerprint(slice)

  s = s.replace(/style="([^"]*)"/g, (_match, body: string) => {
    const cleaned = body
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => part.replace(/\s*:\s*/, ':').replace(/\s+/g, ' '))
      .join(';')
    return `style="${cleaned}"`
  })

  s = s.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_m, r, g, b) => {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0').toUpperCase()
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  })

  s = s.replace(/<img\b([^>]*?)\s*\/>/g, '<img$1>')

  s = s.replace(/<img\b([^>]*)>/g, (_match, attrs: string) => {
    const parts = attrs.match(/\s+[a-zA-Z-]+(?:="[^"]*")?/g) ?? []
    const sorted = parts
      .map((p) => p.trim())
      .sort()
      .join(' ')
    return `<img${sorted ? ' ' + sorted : ''}>`
  })

  return s
}

/**
 * TEST-ONLY pipe-through helper. Validates the AI-emit shape, runs the
 * Plan 71-01 resolver, then validates the final canonical Decoration shape.
 * Throws on any validation failure — production code silent-drops; tests want
 * loud failures on fixture mistakes.
 */
function pipeAIEmitToDecoration(
  emit: unknown,
  slide: Slide,
  template: SlideTemplate,
  slideIndex = 0,
  decorationIndex = 0,
): DecorationContent {
  const emitParse = DecorationEmitSchema.safeParse(emit)
  if (!emitParse.success) {
    throw new Error(
      `PTF17 fixture invalid emit: ${JSON.stringify(emitParse.error.format())}`,
    )
  }
  const resolved = resolveAIDecoration(
    emitParse.data,
    slide,
    template,
    slideIndex,
    decorationIndex,
  )
  const finalParse = DecorationSchema.safeParse(resolved)
  if (!finalParse.success) {
    throw new Error(
      `PTF17 fixture failed final validation: ${JSON.stringify(
        finalParse.error.format(),
      )}`,
    )
  }
  return finalParse.data
}

/**
 * Build a slide carrying the locked derived_palette + the supplied decorations,
 * spread on top of the canonical fingerprintFixtureSlide so surrounding
 * template content (hook / body / custom_image / watermark) matches PTF13/14/18.
 */
function buildSlideWithDecorations(decorations: DecorationContent[]): Slide {
  return {
    ...fingerprintFixtureSlide,
    style_overrides: {
      ...fingerprintFixtureSlide.style_overrides,
      derived_palette: [...LOCKED_DERIVED_PALETTE],
    },
    decorations,
  }
}

/**
 * Render the slide through both paths and return both decoration slices,
 * normalized. For multi-decoration slides, supply a `decorationId` to target
 * a specific decoration; otherwise extracts the first.
 */
function fingerprintBoth(
  slide: Slide,
  decorationId?: string,
): { preview: string; satori: string } {
  const { container } = render(
    <SlidePreview
      slide={slide}
      template={TEMPLATE}
      index={0}
      editable={false}
    />,
  )
  const previewHtml = container.innerHTML
  const satoriHtml = renderToStaticMarkup(buildSlideElement(slide, TEMPLATE))
  return {
    preview: normalizeDecorationSlice(extractDecorationSlice(previewHtml, decorationId)),
    satori: normalizeDecorationSlice(extractDecorationSlice(satoriHtml, decorationId)),
  }
}

describe('Phase 71 Plan 03 (PARITY-10 / PTF17): AI-emit decoration byte-identity across renderers', () => {
  it('PTF17-icon-accent: AI-emitted Heart icon (color: accent, position: top-right) byte-identical', () => {
    // Build the slide first WITHOUT decorations so the resolver can read style_overrides
    const baseSlide = buildSlideWithDecorations([])
    const emit: DecorationEmitContent = {
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'top-right',
    }
    const decoration = pipeAIEmitToDecoration(emit, baseSlide, TEMPLATE)
    const slide = buildSlideWithDecorations([decoration])
    const { preview, satori } = fingerprintBoth(slide)
    // PARITY-10 byte-identity equiv (the merge-gate assertion).
    expect(preview).toBe(satori)
    // Committed baseline pin (defense-in-depth).
    expect(preview).toMatchSnapshot()
  })

  it('PTF17-icon-palette-vibrant: AI-emitted Star icon (color: palette-vibrant → #11AABB, position: top-left) byte-identical', () => {
    const baseSlide = buildSlideWithDecorations([])
    const emit: DecorationEmitContent = {
      kind: 'icon',
      lucideName: 'Star',
      color: 'palette-vibrant',
      position: 'top-left',
    }
    const decoration = pipeAIEmitToDecoration(emit, baseSlide, TEMPLATE)
    // Sanity: confirm the resolver picked derived_palette[0] = '#11AABB'
    expect(decoration.kind).toBe('icon')
    if (decoration.kind === 'icon') {
      expect(decoration.color).toBe('#11AABB')
    }
    const slide = buildSlideWithDecorations([decoration])
    const { preview, satori } = fingerprintBoth(slide)
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
  })

  it('PTF17-shape-accent: AI-emitted rect shape (color: accent, position: bottom-left, cornerRadius: 8) byte-identical', () => {
    const baseSlide = buildSlideWithDecorations([])
    const emit: DecorationEmitContent = {
      kind: 'shape',
      shapeKind: 'rect',
      color: 'accent',
      position: 'bottom-left',
      cornerRadius: 8,
    }
    const decoration = pipeAIEmitToDecoration(emit, baseSlide, TEMPLATE)
    expect(decoration.kind).toBe('shape')
    const slide = buildSlideWithDecorations([decoration])
    const { preview, satori } = fingerprintBoth(slide)
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
  })

  it('PTF17-shape-palette-vibrant: AI-emitted circle shape (color: palette-vibrant → #11AABB, position: center) byte-identical', () => {
    const baseSlide = buildSlideWithDecorations([])
    const emit: DecorationEmitContent = {
      kind: 'shape',
      shapeKind: 'circle',
      color: 'palette-vibrant',
      position: 'center',
    }
    const decoration = pipeAIEmitToDecoration(emit, baseSlide, TEMPLATE)
    expect(decoration.kind).toBe('shape')
    if (decoration.kind === 'shape') {
      expect(decoration.fill).toBe('#11AABB')
    }
    const slide = buildSlideWithDecorations([decoration])
    const { preview, satori } = fingerprintBoth(slide)
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
  })

  it('PTF17-multi-decoration: AI-emitted icon + shape on the same slide; both slices byte-identical', () => {
    const baseSlide = buildSlideWithDecorations([])
    const iconEmit: DecorationEmitContent = {
      kind: 'icon',
      lucideName: 'Sparkles',
      color: 'accent',
      position: 'top-right',
    }
    const shapeEmit: DecorationEmitContent = {
      kind: 'shape',
      shapeKind: 'rect',
      color: 'palette-vibrant',
      position: 'bottom-left',
      cornerRadius: 8,
    }
    const iconDeco = pipeAIEmitToDecoration(iconEmit, baseSlide, TEMPLATE, 0, 0)
    const shapeDeco = pipeAIEmitToDecoration(shapeEmit, baseSlide, TEMPLATE, 0, 1)
    // Sanity: deterministic ids per Plan 71-01 buildAIDecorationId
    expect(iconDeco.id).toBe('ai-deco-0-0')
    expect(shapeDeco.id).toBe('ai-deco-0-1')

    const slide = buildSlideWithDecorations([iconDeco, shapeDeco])

    // Each decoration's slice must be byte-identical across renderers
    const iconSlices = fingerprintBoth(slide, 'ai-deco-0-0')
    expect(iconSlices.preview).toBe(iconSlices.satori)
    expect(iconSlices.preview).toMatchSnapshot('multi-decoration-icon-slice')

    const shapeSlices = fingerprintBoth(slide, 'ai-deco-0-1')
    expect(shapeSlices.preview).toBe(shapeSlices.satori)
    expect(shapeSlices.preview).toMatchSnapshot('multi-decoration-shape-slice')
  })

  it('PTF17 sanity: AI_POSITION_RECTS values are reflected in the resolved decoration position', () => {
    // Defends the locked safe-zone offsets (Plan 71-01 AI_POSITION_RECTS).
    // Any future change to those rects breaks PTF17 snapshots — this test
    // gives a faster signal that the rect contract changed (vs reading the
    // diff between rendered slices).
    const baseSlide = buildSlideWithDecorations([])
    const emit: DecorationEmitContent = {
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'top-right',
    }
    const decoration = pipeAIEmitToDecoration(emit, baseSlide, TEMPLATE)
    // Locked: top-right rect is { x: 70, y: 8, width: 22, height: 16 }.
    expect(decoration.position).toEqual({ x: 70, y: 8, width: 22, height: 16 })
  })

  it('PTF17 sanity: resolver produces structurally valid Decoration that survives DecorationSchema.safeParse', () => {
    // Smoke test for the pipe-through helper's final-shape gate. If
    // resolveAIDecoration's output drifts away from the canonical
    // DecorationSchema (e.g. forgotten field after a future edit), this fires
    // before any byte-identity test.
    const baseSlide = buildSlideWithDecorations([])
    const iconEmit: DecorationEmitContent = {
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'top-right',
    }
    const shapeEmit: DecorationEmitContent = {
      kind: 'shape',
      shapeKind: 'circle',
      color: 'palette-vibrant',
      position: 'center',
    }
    expect(() => pipeAIEmitToDecoration(iconEmit, baseSlide, TEMPLATE)).not.toThrow()
    expect(() => pipeAIEmitToDecoration(shapeEmit, baseSlide, TEMPLATE)).not.toThrow()
  })
})
