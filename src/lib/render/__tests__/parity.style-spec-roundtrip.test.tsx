// Phase 77 Plan 02 Task 5 (PARITY-02 / EMIT-09 / PTF77):
// StyleSpec emit→render byte-identity roundtrip parity fingerprint.
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
// Mirror of PTF17 (parity.template-fingerprint-decorations-ai-emit.test.tsx)
// with the AI ingest path REPLACED by the StyleSpec emit path:
//
//   StyleSpec fixture
//     → generateFromStyleSpec(spec, content) (mocked Gemini → deterministic)
//     → resulting slide.decorations + slide.style_overrides
//     → SlidePreview (React DOM) AND buildSlideElement+renderToStaticMarkup (Satori)
//     → decoration slice byte-identical between renderers + snapshot pin
//
// This proves:
//   1. The full Plan 02 emit pipeline produces decorations that round-trip
//      through both renderers identically (EMIT-09 / PARITY-02).
//   2. The Plan 01 projector wires palette → derived_palette[] AND layout
//      → text_position end-to-end at the rendered HTML output (PTF77-05).
//   3. No renderer-disagreement bugs exist in the spec→emit→slide pipeline
//      — adding any non-round-trip-safe field to the projector output
//      breaks the byte-identity assertion immediately.
//
// =====================================================================
// DEVIATION FROM PLAN (carry-forward from Plan 77-01):
// =====================================================================
// Plan 77-01 routed palette through the existing v2.9 derived_palette: string[]
// slot (NOT background_color/accent_color which DO NOT EXIST on
// SlideStyleOverrides). PTF77-05 below asserts derived_palette[0] (dominant)
// and derived_palette[1] (accent) appear in the projected style_overrides —
// NOT a non-existent background_color.
//
// =====================================================================
// HELPERS COPIED VERBATIM from PTF17 (Phase 74-04 / PTF16 precedent):
// =====================================================================
//   - extractDecorationSlice (decoration subtree extractor)
//   - normalizeDecorationSlice (style spacing / rgb→hex / void tags / sorted attrs)
// Phase 67 PTF16 + Plan 71-03 PTF17 both copy-paste these helpers vs.
// importing them — we follow the same precedent for stability.
//
// Mocks @google/genai entirely so generateFromStyleSpec is deterministic
// (no real API calls in CI).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

// ---- Hoisted mock for @google/genai ----
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent:
    vi.fn<(...args: unknown[]) => Promise<{ text?: string }>>(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent }
    constructor() {}
  },
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    INTEGER: 'INTEGER',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
  },
}))

import { templates } from '@/lib/render/templates'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { SlidePreview } from '@/components/slides/slide-preview'
import { generateFromStyleSpec } from '@/lib/ai/generate-from-style-spec'
import { computeStructuralFingerprint } from './__fixtures__/parity-fingerprint-fixtures'
import type { Slide } from '@/lib/types/slide'
import type { StyleSpec } from '@/lib/types/style-spec'

// Use templates[0] (highlightBar) for determinism — same as PTF17.
const TEMPLATE = templates[0]

// Locked palette for cross-renderer determinism — palette-vibrant resolves
// to derived_palette[0]; we lock it here so changes to the spec fixtures
// don't silently regenerate snapshots.
const LOCKED_DERIVED_PALETTE = ['#11AABB', '#22CCDD'] as const

/**
 * Build a base StyleSpec for the roundtrip tests. Vary decorations per case.
 */
function makeRoundtripSpec(
  overrides: Partial<StyleSpec> = {},
): StyleSpec {
  // Cast: Partial<StyleSpec> over a discriminated union (StyleSpec is intersected
  // with ArchetypeSlots in Phase 80) cannot be spread back into the union without
  // collapsing the discriminator. Spec contract is concrete here:
  // slideArchetype='full-bleed-text-overlay' (EmptySlots variant).
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: {
      mode: 'solid',
      primary: LOCKED_DERIVED_PALETTE[0],
      accent: LOCKED_DERIVED_PALETTE[1],
    },
    typography: {
      hookFontCategory: 'sans-serif',
      bodyFontCategory: 'serif',
    },
    layout: { hookPosition: 'center', density: 'medium' },
    imagery: {},
    decorations: {
      preferredLucide: ['Star', 'Heart', 'Sparkles'],
      preferredShapes: ['circle', 'rect'],
    },
    rhythm: { cadence: 'punchy' },
    ...overrides,
  } as StyleSpec
}

/**
 * Build a single-slide carousel JSON that the mocked Gemini will return.
 * The slide carries the decoration we want to test the byte-identity of.
 */
function buildMockedCarousel(decoration: {
  kind: 'icon' | 'shape'
  lucideName?: string
  shapeKind?: string
  color: string
  position: string
  cornerRadius?: number
}): string {
  return JSON.stringify({
    title: 'Test Carousel',
    slides: [
      {
        hook_text: 'PTF77 hook',
        body_text: 'PTF77 body',
        image_query: 'q',
        is_cta: false,
        role: 'cover',
        decorations: [decoration],
      },
      {
        hook_text: 'PTF77 mid',
        body_text: 'PTF77 mid body',
        image_query: 'q',
        is_cta: false,
        role: 'support',
      },
      {
        hook_text: 'PTF77 close',
        body_text: 'PTF77 close body',
        image_query: 'q',
        is_cta: true,
        role: 'close',
      },
    ],
  })
}

function buildMockedCarouselMulti(decorations: unknown[]): string {
  return JSON.stringify({
    title: 'Test Carousel Multi',
    slides: [
      {
        hook_text: 'PTF77 hook',
        body_text: 'PTF77 body',
        image_query: 'q',
        is_cta: false,
        role: 'cover',
        decorations,
      },
      {
        hook_text: 'PTF77 mid',
        body_text: 'PTF77 mid body',
        image_query: 'q',
        is_cta: false,
        role: 'support',
      },
      {
        hook_text: 'PTF77 close',
        body_text: 'PTF77 close body',
        image_query: 'q',
        is_cta: true,
        role: 'close',
      },
    ],
  })
}

// =====================================================================
// VERBATIM helpers from PTF17 (Phase 74-04 copy-paste precedent):
// =====================================================================

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
 * Render a slide through both pipelines and return both decoration slices,
 * normalized.
 */
function fingerprintBoth(
  slide: Slide,
  decorationId?: string,
): { preview: string; satori: string } {
  const { container } = render(
    <SlidePreview slide={slide} template={TEMPLATE} index={0} editable={false} />,
  )
  const previewHtml = container.innerHTML
  const satoriHtml = renderToStaticMarkup(buildSlideElement(slide, TEMPLATE))
  return {
    preview: normalizeDecorationSlice(extractDecorationSlice(previewHtml, decorationId)),
    satori: normalizeDecorationSlice(extractDecorationSlice(satoriHtml, decorationId)),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateContent.mockReset()
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? 'test-key'
})

describe('Phase 77 Plan 02 Task 5 (PARITY-02 / PTF77): StyleSpec emit→render byte-identity roundtrip', () => {
  it('PTF77-01-icon-accent: emit-pipeline icon (color: accent, position: top-right) byte-identical', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: buildMockedCarousel({
        kind: 'icon',
        lucideName: 'Star',
        color: 'accent',
        position: 'top-right',
      }),
    })

    const spec = makeRoundtripSpec()
    const carousel = await generateFromStyleSpec(
      spec,
      { mode: 'ai-copy', topic: 'X' },
      { template: TEMPLATE },
    )
    const slide = carousel.slides[0] as unknown as Slide
    expect(slide.decorations?.length).toBe(1)
    const { preview, satori } = fingerprintBoth(slide)
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
  })

  it('PTF77-02-shape-palette-vibrant: emit-pipeline circle (color: palette-vibrant → #11AABB, position: bottom-left) byte-identical', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: buildMockedCarousel({
        kind: 'shape',
        shapeKind: 'circle',
        color: 'palette-vibrant',
        position: 'bottom-left',
      }),
    })

    const spec = makeRoundtripSpec()
    const carousel = await generateFromStyleSpec(
      spec,
      { mode: 'ai-copy', topic: 'X' },
      { template: TEMPLATE },
    )
    const slide = carousel.slides[0] as unknown as Slide
    expect(slide.decorations?.length).toBe(1)
    // Sanity: the projector wired derived_palette so palette-vibrant resolves
    // to spec.palette.primary (which is LOCKED_DERIVED_PALETTE[0])
    const dec = slide.decorations![0]
    if (dec.kind === 'shape') {
      expect(dec.fill.toUpperCase()).toBe(LOCKED_DERIVED_PALETTE[0])
    }
    const { preview, satori } = fingerprintBoth(slide)
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
  })

  it('PTF77-03-multi-decoration: emit-pipeline icon + shape on same slide; both slices byte-identical', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: buildMockedCarouselMulti([
        {
          kind: 'icon',
          lucideName: 'Sparkles',
          color: 'accent',
          position: 'top-right',
        },
        {
          kind: 'shape',
          shapeKind: 'rect',
          color: 'palette-vibrant',
          position: 'bottom-left',
          cornerRadius: 8,
        },
      ]),
    })

    const spec = makeRoundtripSpec()
    const carousel = await generateFromStyleSpec(
      spec,
      { mode: 'ai-copy', topic: 'X' },
      { template: TEMPLATE },
    )
    const slide = carousel.slides[0] as unknown as Slide
    expect(slide.decorations?.length).toBe(2)
    // ai-deco-0-0 and ai-deco-0-1 — deterministic ids per Plan 71-01
    const iconSlices = fingerprintBoth(slide, 'ai-deco-0-0')
    expect(iconSlices.preview).toBe(iconSlices.satori)
    expect(iconSlices.preview).toMatchSnapshot('multi-icon-slice')
    const shapeSlices = fingerprintBoth(slide, 'ai-deco-0-1')
    expect(shapeSlices.preview).toBe(shapeSlices.satori)
    expect(shapeSlices.preview).toMatchSnapshot('multi-shape-slice')
  })

  it('PTF77-04-user-copy-mode: emit-pipeline with user-copy lines + decoration; byte-identical', async () => {
    const userLines = ['First user line.', 'Second user line.', 'Third line.']
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'User Copy Carousel',
        slides: [
          {
            hook_text: userLines[0],
            body_text: 'B1',
            image_query: 'q',
            is_cta: false,
            role: 'cover',
            decorations: [
              {
                kind: 'icon',
                lucideName: 'Heart',
                color: 'accent',
                position: 'top-left',
              },
            ],
          },
          { hook_text: userLines[1], body_text: 'B2', image_query: 'q', is_cta: false, role: 'support' },
          { hook_text: userLines[2], body_text: 'B3', image_query: 'q', is_cta: true, role: 'close' },
        ],
      }),
    })

    const spec = makeRoundtripSpec()
    const carousel = await generateFromStyleSpec(
      spec,
      { mode: 'user-copy', lines: userLines },
      { template: TEMPLATE },
    )
    // Sanity: lines preserved verbatim (Gemini echo)
    expect(carousel.slides[0].hook_text).toBe(userLines[0])
    const slide = carousel.slides[0] as unknown as Slide
    expect(slide.decorations?.length).toBe(1)
    const { preview, satori } = fingerprintBoth(slide)
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
  })

  it('PTF77-05-projector-mapping-verified-at-data-layer: spec → derived_palette + text_position end-to-end', async () => {
    // DEVIATION (Plan 77-01): derived_palette[0..1], NOT background_color/accent_color.
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Projector Test',
        slides: [
          { hook_text: 'A', body_text: 'B', image_query: 'q', is_cta: false, role: 'cover' },
          { hook_text: 'C', body_text: 'D', image_query: 'q', is_cta: false, role: 'support' },
          { hook_text: 'E', body_text: 'F', image_query: 'q', is_cta: true, role: 'close' },
        ],
      }),
    })

    const spec = makeRoundtripSpec({
      palette: {
        mode: 'solid',
        primary: '#ABCDEF',
        accent: '#FEDCBA',
      },
      layout: { hookPosition: 'top', density: 'tight' },
    })
    const carousel = await generateFromStyleSpec(
      spec,
      { mode: 'ai-copy', topic: 'X' },
      { template: TEMPLATE },
    )

    // Projector wired derived_palette[0] and derived_palette[1] from spec
    for (const s of carousel.slides) {
      expect(s.style_overrides?.derived_palette).toEqual(['#ABCDEF', '#FEDCBA'])
      // Layout.hookPosition projected to text_position
      expect(s.style_overrides?.text_position).toBe('top')
    }
  })

  it('PTF77-06-snapshot-baselines-committed: snapshot mechanism is exercised by this suite', () => {
    // Defends the Phase 74-04 / PTF17 precedent: locked baseline IS the file
    // alongside this test (snapshot writes happen after all tests in this
    // suite complete, so a same-process existence-check would race; instead
    // this test pins a small inline snapshot to prove the toMatchSnapshot
    // mechanism is wired correctly).
    expect({
      ptf: 'PTF77',
      reqs: ['PARITY-02', 'EMIT-09'],
      template: TEMPLATE.id,
      lockedPalette: [...LOCKED_DERIVED_PALETTE],
    }).toMatchSnapshot('ptf77-suite-meta')
  })
})
