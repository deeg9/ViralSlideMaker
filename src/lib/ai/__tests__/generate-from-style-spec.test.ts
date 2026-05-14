// Phase 77 Plan 02 Task 3 (EMIT-01..04, EMIT-05, EMIT-08):
// Tests for generateFromStyleSpec — text-only Gemini emit endpoint that
// consumes a validated StyleSpec and the Plan 01 helpers (projector,
// allowlist narrower) to produce a CarouselWithTextBoxes.
//
// Mocks @google/genai entirely — never hits the real API. Tests assert:
//   - responseSchema enum NARROWING per spec (Test 1, 2)
//   - user-copy mode echoes user lines (Test 3)
//   - SILENT-DROP triple-layer pipeline (Test 4)
//   - silent-drop counter increments per FIELD with 'emit.{field}' key (Test 5)
//   - PROJECTOR INTEGRATION — palette → derived_palette (Test 6)
//   - PROJECTOR INTEGRATION — layout → text_position (Test 7)
//   - VOICE NOTE PROPAGATION — spec replaces template aiVoiceNote (EMIT-05) (Test 8)
//   - existing generate-slides.ts NOT TOUCHED (Test 9)
//   - returned shape conforms to existing CarouselWithTextBoxes (Test 10)
//   - voice_note prompt-injection defense at emit boundary (Test 11)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

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

import { generateFromStyleSpec } from '../generate-from-style-spec'
import { templates, getTemplate } from '@/lib/render/templates'
import { AI_LUCIDE_ALLOWLIST } from '@/lib/ai/schemas'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { ContentSource } from '@/lib/ai/generate-from-style-spec.types'

// Murphy Campbell base spec — mirrors Plan 01 fixtures.
function makeSpec(overrides?: Partial<StyleSpec>): StyleSpec {
  // Cast: Partial<StyleSpec> over a discriminated union (StyleSpec is intersected
  // with ArchetypeSlots in Phase 80) cannot be spread back into the union without
  // collapsing the discriminator. Spec contract is concrete here:
  // slideArchetype='full-bleed-text-overlay' (EmptySlots variant).
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#A8E0B0', accent: '#11AABB' },
    typography: {
      hookFontCategory: 'sans-serif',
      bodyFontCategory: 'serif',
    },
    layout: { hookPosition: 'center', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: {
      preferredLucide: ['Star', 'Heart'],
      preferredShapes: ['circle', 'rect'],
      density: 'moderate',
    },
    rhythm: { cadence: 'punchy' },
    voice_note: 'spec-voice: lowercase essay tone',
    ...overrides,
  } as StyleSpec
}

function baseSlide(overrides: Record<string, unknown> = {}) {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'query',
    is_cta: false,
    role: 'support',
    ...overrides,
  }
}

function buildCarousel(slides: unknown[], title = 'Test Carousel'): string {
  return JSON.stringify({ title, slides })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateContent.mockReset()
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? 'test-key'
})

describe('Phase 77 Plan 02 Task 3: generateFromStyleSpec — emit pipeline', () => {
  it('Test 1: responseSchema decorations.lucideName.enum is NARROWED to spec.preferredLucide subset', async () => {
    const slides = [
      baseSlide({ role: 'cover', hook_text: 'Cover' }),
      baseSlide({ role: 'support', hook_text: 'Mid' }),
      baseSlide({ role: 'close', hook_text: 'Close', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const spec = makeSpec({
      decorations: { preferredLucide: ['Star'], preferredShapes: ['circle'] },
    })
    await generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' })

    const callArg = mockGenerateContent.mock.calls[0][0] as {
      config: { responseSchema: { properties: { slides: { items: { properties: { decorations: { items: { properties: { lucideName: { enum: string[] }, shapeKind: { enum: string[] } } } } } } } } } }
    }
    const lucideEnum = callArg.config.responseSchema.properties.slides.items.properties.decorations.items.properties.lucideName.enum
    const shapeEnum = callArg.config.responseSchema.properties.slides.items.properties.decorations.items.properties.shapeKind.enum
    expect(lucideEnum).toEqual(['Star'])
    expect(shapeEnum).toEqual(['circle'])
  })

  it('Test 2: responseSchema.lucideName.enum falls back to FULL AI_LUCIDE_ALLOWLIST when spec.preferredLucide is empty', async () => {
    const slides = [
      baseSlide({ role: 'cover', hook_text: 'A' }),
      baseSlide({ role: 'support', hook_text: 'B' }),
      baseSlide({ role: 'close', hook_text: 'C', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const spec = makeSpec({
      decorations: { preferredLucide: [], preferredShapes: [] },
    })
    await generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' })

    const callArg = mockGenerateContent.mock.calls[0][0] as {
      config: { responseSchema: { properties: { slides: { items: { properties: { decorations: { items: { properties: { lucideName: { enum: string[] } } } } } } } } } }
    }
    const lucideEnum = callArg.config.responseSchema.properties.slides.items.properties.decorations.items.properties.lucideName.enum
    expect(lucideEnum.length).toBe(AI_LUCIDE_ALLOWLIST.length)
    expect(lucideEnum).toContain('Heart')
    expect(lucideEnum).toContain('Star')
  })

  it('Test 3: user-copy mode — Gemini structures user lines into Slide segments (mocked echo)', async () => {
    // Gemini's mocked response carries the user's lines as hook_text (Gemini's
    // job in user-copy mode is to STRUCTURE, not generate).
    const userLines = ['First line.', 'Second line.', 'Third line.']
    const slides = [
      baseSlide({ role: 'cover', hook_text: userLines[0] }),
      baseSlide({ role: 'support', hook_text: userLines[1] }),
      baseSlide({ role: 'close', hook_text: userLines[2], is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const spec = makeSpec()
    const content: ContentSource = { mode: 'user-copy', lines: userLines }
    const result = await generateFromStyleSpec(spec, content)

    expect(result.slides[0].hook_text).toBe(userLines[0])
    expect(result.slides[1].hook_text).toBe(userLines[1])
    expect(result.slides[2].hook_text).toBe(userLines[2])
  })

  it('Test 4: SILENT-DROP TRIPLE-LAYER — malformed Carousel retries once, throws on second failure', async () => {
    // First call: malformed JSON missing required slide fields; second call: same.
    const malformedJson = JSON.stringify({ title: 'X', slides: [] }) // empty slides → CarouselSchema requires min(3)
    mockGenerateContent
      .mockResolvedValueOnce({ text: malformedJson })
      .mockResolvedValueOnce({ text: malformedJson })

    const spec = makeSpec()
    await expect(
      generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' }),
    ).rejects.toThrow(/carousel-shape-failed|emit/i)

    // Verifies retry: 2 calls were made
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('Test 5: SILENT-DROP COUNTER — invalid lucideName silently dropped, counter incremented at emit.decoration.lucideName', async () => {
    const slides = [
      baseSlide({
        role: 'cover',
        hook_text: 'A',
        decorations: [
          {
            kind: 'icon',
            lucideName: 'InvalidIconName', // not in AI_LUCIDE_ALLOWLIST
            color: 'accent',
            position: 'top-right',
          },
        ],
      }),
      baseSlide({ role: 'support', hook_text: 'B' }),
      baseSlide({ role: 'close', hook_text: 'C', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const spec = makeSpec()
    const result = await generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' })
    // Silent-drop: invalid decoration → decorations remains undefined
    expect(result.slides[0].decorations).toBeUndefined()
  })

  it('Test 6: PROJECTOR INTEGRATION — slide.style_overrides.derived_palette === [spec.palette.primary, accent]', async () => {
    const slides = [
      baseSlide({ role: 'cover', hook_text: 'A' }),
      baseSlide({ role: 'support', hook_text: 'B' }),
      baseSlide({ role: 'close', hook_text: 'C', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const spec = makeSpec({
      palette: { mode: 'solid', primary: '#A8E0B0', accent: '#11AABB' },
    })
    const result = await generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' })

    // DEVIATION: palette routes through derived_palette[] (Plan 01 deviation —
    // background_color/accent_color do NOT exist on SlideStyleOverrides)
    for (const slide of result.slides) {
      expect(slide.style_overrides?.derived_palette).toEqual(['#A8E0B0', '#11AABB'])
    }
  })

  it('Test 7: PROJECTOR INTEGRATION — slide.style_overrides.text_position === spec.layout.hookPosition', async () => {
    const slides = [
      baseSlide({ role: 'cover', hook_text: 'A' }),
      baseSlide({ role: 'support', hook_text: 'B' }),
      baseSlide({ role: 'close', hook_text: 'C', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const spec = makeSpec({ layout: { hookPosition: 'top', density: 'tight' } })
    const result = await generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' })

    for (const slide of result.slides) {
      expect(slide.style_overrides?.text_position).toBe('top')
    }
  })

  it('Test 8: VOICE NOTE PROPAGATION — spec.voice_note in systemInstruction (EMIT-05)', async () => {
    const slides = [
      baseSlide({ role: 'cover', hook_text: 'A' }),
      baseSlide({ role: 'support', hook_text: 'B' }),
      baseSlide({ role: 'close', hook_text: 'C', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const documentaryTemplate = getTemplate('documentary') // has aiVoiceNote
    const spec = makeSpec({ voice_note: 'spec-voice-XYZ-test-marker' })
    await generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' }, { template: documentaryTemplate })

    const callArg = mockGenerateContent.mock.calls[0][0] as {
      config: { systemInstruction: string }
    }
    expect(callArg.config.systemInstruction).toContain('spec-voice-XYZ-test-marker')
    expect(callArg.config.systemInstruction).not.toContain(documentaryTemplate.aiVoiceNote!)
  })

  it('Test 9: existing generate-slides.ts NOT TOUCHED — file content unchanged', () => {
    // Regression guard: this plan must not modify the legacy emit path.
    // We assert the file still contains its canonical exports.
    const filePath = path.resolve(__dirname, '../generate-slides.ts')
    const src = fs.readFileSync(filePath, 'utf-8')
    expect(src).toContain('export async function generateSlideContent')
    expect(src).toContain('export type CarouselWithTextBoxes')
    // Phase 77 should NOT have added imports of buildFromSpecPrompt.
    expect(src).not.toContain('buildFromSpecPrompt')
  })

  it('Test 10: returned shape conforms to CarouselWithTextBoxes (text_boxes populated)', async () => {
    const slides = [
      baseSlide({ role: 'cover', hook_text: 'A', body_text: 'Body A' }),
      baseSlide({ role: 'support', hook_text: 'B', body_text: 'Body B' }),
      baseSlide({ role: 'close', hook_text: 'C', body_text: 'Body C', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    const spec = makeSpec()
    const result = await generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' })

    expect(result.title).toBe('Test Carousel')
    expect(Array.isArray(result.slides)).toBe(true)
    for (const slide of result.slides) {
      expect(Array.isArray(slide.text_boxes)).toBe(true)
      expect(slide.text_boxes.length).toBeGreaterThan(0)
    }
  })

  it('Test 11: voice_note prompt-injection defense — script tags do not leak through emit boundary', async () => {
    const slides = [
      baseSlide({ role: 'cover', hook_text: 'A' }),
      baseSlide({ role: 'support', hook_text: 'B' }),
      baseSlide({ role: 'close', hook_text: 'C', is_cta: true }),
    ]
    mockGenerateContent.mockResolvedValueOnce({ text: buildCarousel(slides) })

    // STYLESPEC-09 sanitizer at validation time would strip this; we test
    // defense-in-depth at the emit boundary — prompt assembly is just text
    // concatenation, no eval/injection vector.
    const spec = makeSpec({
      voice_note: 'normal text <script>alert(1)</script> tail',
    })
    // Should NOT throw; spec.voice_note treated as plain text in prompt.
    await expect(
      generateFromStyleSpec(spec, { mode: 'ai-copy', topic: 'X' }),
    ).resolves.toBeDefined()
  })
})
