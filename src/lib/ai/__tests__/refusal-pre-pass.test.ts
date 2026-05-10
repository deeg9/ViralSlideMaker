// Phase 75 (EXTRACT-05, EXTRACT-06): tests for refusal pre-pass.
// Mocks @google/genai — DOES NOT make real Gemini calls.
//
// Coverage:
//   - Test 1:  happy path, single reference, no flags
//   - Test 2:  happy path, multiple references, mixed flags, INDEX ALIGNMENT
//   - Test 3:  graceful degradation — Gemini throws network error
//   - Test 4:  graceful degradation — Gemini timeout via Promise.race
//   - Test 5:  graceful degradation — safety block on refusal call
//   - Test 6:  graceful degradation — malformed JSON
//   - Test 7:  graceful degradation — wrong-length array (length mismatch)
//   - Test 8:  graceful degradation — non-boolean fields (type mismatch)
//   - Test 9:  no-real-Gemini gate (no GEMINI_API_KEY in this file)
//   - Test 10: single Gemini call per batch (NOT N calls — efficiency invariant)
//   - Test 11: empty input — returns empty result without calling Gemini
//   - Test 12: function never throws (graceful degradation contract)

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { PreparedReference } from '@/lib/preprocessing/style-reference-prep'

// Hoisted mock — must be set up before importing the module under test.
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn<(...args: unknown[]) => Promise<{
    text?: string
    promptFeedback?: { blockReason?: string }
  }>>(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent }
    constructor() {}
  },
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    BOOLEAN: 'BOOLEAN',
    STRING: 'STRING',
    INTEGER: 'INTEGER',
  },
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: {
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
  },
}))

// Import AFTER mocks are set up.
import {
  runRefusalPrePass,
  REFUSAL_TIMEOUT_MS,
  REFUSAL_RESPONSE_SCHEMA,
  type RefusalFlags,
  type RefusalResult,
} from '../refusal-pre-pass'

function makePrepared(n: number): PreparedReference[] {
  return Array.from({ length: n }, (_, i) => ({
    bytes: Buffer.from(`fake-bytes-${i}`),
    sha256: `sha-${i}-${'0'.repeat(60)}`,
    width: 512,
    height: 768,
    mimeType: 'image/jpeg' as const,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateContent.mockReset()
})

describe('Phase 75 (EXTRACT-05): runRefusalPrePass — happy path + index alignment', () => {
  it('Test 1: single reference, no flags → errored=false with all-false', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        references: [
          { contains_logo: false, contains_face: false, contains_watermark: false },
        ],
      }),
    })
    const prepared = makePrepared(1)
    const result = await runRefusalPrePass(prepared)

    expect(result.errored).toBe(false)
    expect(result.flags_per_reference).toHaveLength(1)
    expect(result.flags_per_reference[0]).toEqual({
      contains_logo: false,
      contains_face: false,
      contains_watermark: false,
    })
    expect(typeof result.duration_ms).toBe('number')
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('Test 2: multiple references, mixed flags, INDEX ALIGNMENT preserved', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        references: [
          { contains_logo: false, contains_face: true, contains_watermark: false },
          { contains_logo: true, contains_face: false, contains_watermark: false },
          { contains_logo: false, contains_face: false, contains_watermark: true },
        ],
      }),
    })
    const prepared = makePrepared(3)
    const result = await runRefusalPrePass(prepared)

    expect(result.errored).toBe(false)
    expect(result.flags_per_reference).toHaveLength(3)
    // Explicit index-alignment assertions (input[i] flag corresponds to result[i]):
    expect(result.flags_per_reference[0].contains_face).toBe(true)
    expect(result.flags_per_reference[0].contains_logo).toBe(false)
    expect(result.flags_per_reference[1].contains_logo).toBe(true)
    expect(result.flags_per_reference[1].contains_face).toBe(false)
    expect(result.flags_per_reference[2].contains_watermark).toBe(true)
    expect(result.flags_per_reference[2].contains_face).toBe(false)
  })
})

describe('Phase 75 (EXTRACT-05): graceful degradation contract — function NEVER throws', () => {
  it('Test 3: Gemini throws network error → errored=true, all-false placeholders', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('fetch failed'))
    const prepared = makePrepared(1)

    let result: RefusalResult | null = null
    let threw = false
    try {
      result = await runRefusalPrePass(prepared)
    } catch {
      threw = true
    }

    expect(threw).toBe(false) // contract: never bubbles
    expect(result).not.toBeNull()
    expect(result!.errored).toBe(true)
    expect(result!.flags_per_reference).toHaveLength(1)
    expect(result!.flags_per_reference[0]).toEqual({
      contains_logo: false,
      contains_face: false,
      contains_watermark: false,
    })
  })

  it('Test 4: Gemini hang → 10s timeout via Promise.race → errored=true, all-false × 2', async () => {
    mockGenerateContent.mockImplementationOnce(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    )
    vi.useFakeTimers()
    const prepared = makePrepared(2)
    const promise = runRefusalPrePass(prepared)
    await vi.advanceTimersByTimeAsync(REFUSAL_TIMEOUT_MS + 1)
    let result: RefusalResult | null = null
    let threw = false
    try {
      result = await promise
    } catch {
      threw = true
    }
    vi.useRealTimers()

    expect(threw).toBe(false)
    expect(result).not.toBeNull()
    expect(result!.errored).toBe(true)
    expect(result!.flags_per_reference).toHaveLength(2)
    for (const flag of result!.flags_per_reference) {
      expect(flag).toEqual({
        contains_logo: false,
        contains_face: false,
        contains_watermark: false,
      })
    }
  })

  it('Test 5: safety block on refusal call → errored=true (graceful, NOT a hard error)', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '',
      promptFeedback: { blockReason: 'SAFETY' },
    })
    const prepared = makePrepared(1)
    const result = await runRefusalPrePass(prepared)

    expect(result.errored).toBe(true)
    expect(result.flags_per_reference).toHaveLength(1)
    expect(result.flags_per_reference[0]).toEqual({
      contains_logo: false,
      contains_face: false,
      contains_watermark: false,
    })
  })

  it('Test 6: malformed JSON → errored=true, all-false placeholders', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'not json' })
    const prepared = makePrepared(2)
    const result = await runRefusalPrePass(prepared)

    expect(result.errored).toBe(true)
    expect(result.flags_per_reference).toHaveLength(2)
    for (const flag of result.flags_per_reference) {
      expect(flag).toEqual({
        contains_logo: false,
        contains_face: false,
        contains_watermark: false,
      })
    }
  })

  it('Test 7: wrong-length array → errored=true, placeholders preserve INPUT length', async () => {
    // Input has 3, model returns 1.
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        references: [
          { contains_logo: false, contains_face: false, contains_watermark: false },
        ],
      }),
    })
    const prepared = makePrepared(3)
    const result = await runRefusalPrePass(prepared)

    expect(result.errored).toBe(true)
    expect(result.flags_per_reference).toHaveLength(3) // input length, NOT response length
    for (const flag of result.flags_per_reference) {
      expect(flag).toEqual({
        contains_logo: false,
        contains_face: false,
        contains_watermark: false,
      })
    }
  })

  it('Test 8: non-boolean fields → errored=true, all-false placeholders', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        references: [
          { contains_logo: 'yes', contains_face: 1, contains_watermark: null },
        ],
      }),
    })
    const prepared = makePrepared(1)
    const result = await runRefusalPrePass(prepared)

    expect(result.errored).toBe(true)
    expect(result.flags_per_reference).toHaveLength(1)
    expect(result.flags_per_reference[0]).toEqual({
      contains_logo: false,
      contains_face: false,
      contains_watermark: false,
    })
  })
})

describe('Phase 75 (EXTRACT-06): efficiency + invariants', () => {
  it('Test 10: input has 5 references → exactly ONE generateContent call (single round-trip)', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        references: Array.from({ length: 5 }, () => ({
          contains_logo: false,
          contains_face: false,
          contains_watermark: false,
        })),
      }),
    })
    const prepared = makePrepared(5)
    await runRefusalPrePass(prepared)
    expect(mockGenerateContent).toHaveBeenCalledOnce()
  })

  it('Test 11: empty input → returns {flags_per_reference: [], errored: false} without calling Gemini', async () => {
    const result = await runRefusalPrePass([])
    expect(result.errored).toBe(false)
    expect(result.flags_per_reference).toEqual([])
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })

  it('Test 12: never-throws contract — every error path returns RefusalResult shape', async () => {
    // Synthetic error inside the try block
    mockGenerateContent.mockImplementationOnce(() => {
      throw new Error('synchronous explosion inside generateContent')
    })
    const prepared = makePrepared(4)
    let threw = false
    let result: RefusalResult | null = null
    try {
      result = await runRefusalPrePass(prepared)
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
    expect(result).not.toBeNull()
    expect(result!.errored).toBe(true)
    expect(result!.flags_per_reference).toHaveLength(4)
  })

  it('passes the right model + safetySettings + responseSchema to generateContent', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        references: [
          { contains_logo: false, contains_face: false, contains_watermark: false },
        ],
      }),
    })
    const prepared = makePrepared(1)
    await runRefusalPrePass(prepared)

    const callArg = mockGenerateContent.mock.calls[0][0] as {
      model: string
      contents: Array<{ role: string; parts: unknown[] }>
      config: {
        responseMimeType: string
        responseSchema: unknown
        safetySettings: Array<{ category: string; threshold: string }>
      }
    }
    expect(callArg.model).toBe('gemini-2.5-flash')
    expect(callArg.config.responseMimeType).toBe('application/json')
    expect(callArg.config.responseSchema).toBe(REFUSAL_RESPONSE_SCHEMA)
    expect(callArg.config.safetySettings).toHaveLength(4)
    const categories = callArg.config.safetySettings.map((s) => s.category).sort()
    expect(categories).toEqual([
      'HARM_CATEGORY_DANGEROUS_CONTENT',
      'HARM_CATEGORY_HARASSMENT',
      'HARM_CATEGORY_HATE_SPEECH',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    ])
    for (const s of callArg.config.safetySettings) {
      expect(s.threshold).toBe('BLOCK_ONLY_HIGH')
    }
  })

  it('builds parts with one inlineData per prepared reference (single batch)', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        references: Array.from({ length: 3 }, () => ({
          contains_logo: false,
          contains_face: false,
          contains_watermark: false,
        })),
      }),
    })
    const prepared = makePrepared(3)
    await runRefusalPrePass(prepared)

    const callArg = mockGenerateContent.mock.calls[0][0] as {
      contents: Array<{
        role: string
        parts: Array<
          | { text: string }
          | { inlineData: { mimeType: string; data: string } }
        >
      }>
    }
    const parts = callArg.contents[0].parts
    const inlineParts = parts.filter(
      (p): p is { inlineData: { mimeType: string; data: string } } =>
        'inlineData' in p,
    )
    expect(inlineParts).toHaveLength(3)
    for (const p of inlineParts) {
      expect(p.inlineData.mimeType).toBe('image/jpeg')
      expect(typeof p.inlineData.data).toBe('string')
    }
  })

  it('exports the correct RefusalFlags type shape (compile-time + runtime sanity)', () => {
    const sample: RefusalFlags = {
      contains_logo: false,
      contains_face: false,
      contains_watermark: false,
    }
    expect(sample.contains_logo).toBe(false)
    expect(sample.contains_face).toBe(false)
    expect(sample.contains_watermark).toBe(false)
  })

  it('exports REFUSAL_TIMEOUT_MS as 10_000', () => {
    expect(REFUSAL_TIMEOUT_MS).toBe(10_000)
  })

  it('exports REFUSAL_RESPONSE_SCHEMA as a closed-enum boolean schema (no STRING fields)', () => {
    // Walk the schema; ensure no Type.STRING anywhere.
    const schemaJson = JSON.stringify(REFUSAL_RESPONSE_SCHEMA)
    expect(schemaJson).not.toContain('STRING')
  })

  it('opts.timeoutMs override is honored (test the injection surface)', async () => {
    mockGenerateContent.mockImplementationOnce(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    )
    vi.useFakeTimers()
    const prepared = makePrepared(1)
    const promise = runRefusalPrePass(prepared, { timeoutMs: 50 })
    await vi.advanceTimersByTimeAsync(60)
    const result = await promise
    vi.useRealTimers()
    expect(result.errored).toBe(true)
  })
})
