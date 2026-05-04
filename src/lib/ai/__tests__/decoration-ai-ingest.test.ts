// Phase 71 (AI-01..04): integration tests for the post-Zod-parse Gemini
// decoration ingest adapter. Mocks @google/genai's generateContent and
// asserts the silent-drop / clamp / hex-resolution pipeline:
//
//   raw Gemini JSON
//     → CarouselSchema.parse (Zod schema-level)
//     → DecorationEmitSchema.safeParse (per-entry, silent drop on fail)
//     → resolveAIDecoration (token + anchor resolution)
//     → DecorationSchema.safeParse (final closed-shape gate)
//     → max-2 slice (defense-in-depth post-resolve)
//     → silent-drop on any throw (try/catch wrapping)

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn<(...args: unknown[]) => Promise<{ text?: string }>>(),
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

import { generateSlideContent } from '../generate-slides'

interface RawSlide {
  hook_text: string
  body_text: string
  image_query: string
  is_cta: boolean
  role: 'cover' | 'reframe' | 'support' | 'pivot' | 'close'
  decorations?: unknown[]
  style_overrides?: { derived_palette?: string[] }
}

function buildCarousel(slides: RawSlide[], title = 'Test Carousel'): string {
  return JSON.stringify({ title, slides })
}

function baseSlide(overrides: Partial<RawSlide> = {}): RawSlide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'query',
    is_cta: false,
    role: 'support',
    ...overrides,
  }
}

describe('Phase 71 (AI-01..04): generate-slides decoration ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockReset()
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? 'test-key'
  })

  it('Test 1: no decorations emitted → result.slides[i].decorations === undefined', async () => {
    const slides: RawSlide[] = [
      baseSlide({ role: 'cover', hook_text: 'Cover' }),
      baseSlide({ role: 'support', hook_text: 'Support' }),
      baseSlide({ role: 'close', hook_text: 'Close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)

    for (const slide of result.slides) {
      expect(slide.decorations).toBeUndefined()
    }
  })

  it('Test 2: single valid icon emit → resolved hex + rect + deterministic id', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        decorations: [{ kind: 'icon', lucideName: 'Heart', color: 'accent', position: 'top-right' }],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    const decos = result.slides[0].decorations
    expect(Array.isArray(decos)).toBe(true)
    expect(decos).toHaveLength(1)
    if (!decos) return
    expect(decos[0].kind).toBe('icon')
    expect(decos[0].id).toBe('ai-deco-0-0')
    if (decos[0].kind === 'icon') {
      expect(decos[0].color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(decos[0].lucideName).toBe('Heart')
    }
    expect(decos[0].position).toEqual({ x: 70, y: 8, width: 22, height: 16 })
  })

  it('Test 3: single valid shape emit → fill hex + center rect; passes DecorationSchema', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        style_overrides: { derived_palette: ['#123456', '#1', '#2', '#3', '#4', '#5'] },
        decorations: [
          { kind: 'shape', shapeKind: 'circle', color: 'palette-vibrant', position: 'center' },
        ],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    const decos = result.slides[0].decorations
    expect(decos).toHaveLength(1)
    if (!decos || decos[0].kind !== 'shape') return
    expect(decos[0].fill).toBe('#123456')
    expect(decos[0].shapeKind).toBe('circle')
  })

  it('Test 4: unknown lucideName → silent drop (decorations === undefined when only entry)', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        decorations: [{ kind: 'icon', lucideName: 'PhosphorChart', color: 'accent', position: 'top-right' }],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    expect(result.slides[0].decorations).toBeUndefined()
  })

  it('Test 5: raw hex color from AI → silent drop', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        decorations: [{ kind: 'icon', lucideName: 'Heart', color: '#FF0000', position: 'top-right' }],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    expect(result.slides[0].decorations).toBeUndefined()
  })

  it('Test 6: raw coord position object from AI → silent drop', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        decorations: [
          {
            kind: 'icon',
            lucideName: 'Heart',
            color: 'accent',
            position: { x: 10, y: 20, width: 30, height: 40 },
          },
        ],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    expect(result.slides[0].decorations).toBeUndefined()
  })

  it('Test 7: server-side maxItems=2 clamp — first 2 valid kept', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        decorations: [
          { kind: 'icon', lucideName: 'Heart', color: 'accent', position: 'top-right' },
          { kind: 'icon', lucideName: 'Star', color: 'accent', position: 'top-left' },
          { kind: 'icon', lucideName: 'Check', color: 'accent', position: 'bottom-right' },
          { kind: 'icon', lucideName: 'Zap', color: 'accent', position: 'bottom-left' },
        ],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    expect(result.slides[0].decorations).toHaveLength(2)
    if (!result.slides[0].decorations) return
    if (result.slides[0].decorations[0].kind === 'icon') {
      expect(result.slides[0].decorations[0].lucideName).toBe('Heart')
    }
    if (result.slides[0].decorations[1].kind === 'icon') {
      expect(result.slides[0].decorations[1].lucideName).toBe('Star')
    }
  })

  it('Test 8: mixed valid + invalid → invalid silently dropped, then clamped to 2', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        decorations: [
          { kind: 'icon', lucideName: 'Heart', color: 'accent', position: 'top-right' }, // valid
          { kind: 'icon', lucideName: 'BogusName', color: 'accent', position: 'top-left' }, // invalid → drop
          { kind: 'shape', shapeKind: 'rect', color: 'accent', position: 'center' }, // valid
          { kind: 'shape', shapeKind: 'rect', color: 'accent', position: 'bottom-right' }, // valid
        ],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    expect(result.slides[0].decorations).toHaveLength(2)
    if (!result.slides[0].decorations) return
    expect(result.slides[0].decorations[0].kind).toBe('icon')
    expect(result.slides[0].decorations[1].kind).toBe('shape')
  })

  it('Test 9: malformed entries (string, null) silently dropped — never throws', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        decorations: [
          'garbage' as unknown,
          null,
          { kind: 'icon', lucideName: 'Heart', color: 'accent', position: 'top-right' },
        ],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    expect(result.slides[0].decorations).toHaveLength(1)
  })

  it('Test 10: rotation passthrough preserved', async () => {
    const slides: RawSlide[] = [
      baseSlide({
        role: 'cover',
        decorations: [
          { kind: 'icon', lucideName: 'Heart', color: 'accent', position: 'top-right', rotation: 45 },
        ],
      }),
      baseSlide({ role: 'support' }),
      baseSlide({ role: 'close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const result = await generateSlideContent('test topic', 3)
    expect(result.slides[0].decorations).toBeDefined()
    if (!result.slides[0].decorations) return
    expect(result.slides[0].decorations[0].rotation).toBe(45)
  })
})
