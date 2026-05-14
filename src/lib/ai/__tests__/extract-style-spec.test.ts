// Phase 75 Plan 01 (EXTRACT-01..03/06/07/08):
// Unit tests for the extract-style-spec orchestrator. Mocks @google/genai +
// every Phase 73/74 dependency — DOES NOT make real Gemini calls.
//
// quick 260511-flj: refusal pre-pass module deleted. Test 12 (refusal
// errored → ok:true with errored:true flag) is DELETED entirely. Parallel-
// dispatch assertions (refusalStarted / refusalDelayMs / Math.abs(...))
// in Test 2 are DELETED. `vi.mock('../refusal-pre-pass', ...)` block is
// DELETED. `visionCallsCount` expectations are 1 (was 2).
//
// Coverage (13 behavior tests + 1 source-grep firewall gate):
//   1.  cache hit short-circuit (no Gemini call, no charge)
//   2.  cache miss happy path + telemetry shape
//   3.  two-phase firewall — INJECTED extra keys stripped by Phase B
//   4.  rate-cap reached → no charge, no Gemini call
//   5.  insufficient credits → no Gemini call, no refund
//   6.  safety block → refund + safety_blocked + recovery_suggestion
//   7.  10s Promise.race timeout → refund + extraction_failed
//   8.  transient error → withSingleRetry → second attempt succeeds
//   9.  permanent error → no retry → refund + extraction_failed
//   10. schema-violation degraded spec — silent-drop counter populated
//   11. truly invalid JSON → refund + extraction_failed
//   13. telemetry duration_ms is real wall clock
//   14. no-real-Gemini gate (test file has zero GEMINI_API_KEY references)
//   15. source-grep firewall: rawGemini/rawObject only appear BEFORE parseStyleSpecSafe

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ------------------------------------------------------------------------- //
// Hoisted mocks                                                             //
// ------------------------------------------------------------------------- //

const {
  mockGenerateContent,
  mockPrepareForVision,
  mockLookupStyleSpec,
  mockPersistStyleSpec,
  mockCheckExtractionRateCap,
  mockChargeExtractionCredit,
  mockRefundExtractionCredit,
  mockExtractPaletteFromBytes,
  mockMergePalettes,
  mockParseStyleSpecSafe,
  mockCreateSilentDropCounter,
  mockWithSingleRetry,
} = vi.hoisted(() => ({
  mockGenerateContent: vi.fn<(...args: unknown[]) => Promise<{
    text?: string
    promptFeedback?: { blockReason?: string }
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }>>(),
  mockPrepareForVision: vi.fn(),
  mockLookupStyleSpec: vi.fn(),
  mockPersistStyleSpec: vi.fn(),
  mockCheckExtractionRateCap: vi.fn(),
  mockChargeExtractionCredit: vi.fn(),
  mockRefundExtractionCredit: vi.fn(),
  mockExtractPaletteFromBytes: vi.fn(),
  mockMergePalettes: vi.fn(),
  mockParseStyleSpecSafe: vi.fn(),
  mockCreateSilentDropCounter: vi.fn(),
  mockWithSingleRetry: vi.fn<(fn: () => Promise<unknown>) => Promise<unknown>>(),
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
    NUMBER: 'NUMBER',
  },
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: {
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
    BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
  },
}))

vi.mock('@/lib/preprocessing/style-reference-prep', () => ({
  prepareForVision: mockPrepareForVision,
}))

vi.mock('@/lib/cache/style-spec-cache', () => ({
  lookupStyleSpec: mockLookupStyleSpec,
  persistStyleSpec: mockPersistStyleSpec,
}))

vi.mock('@/lib/cost/style-extraction-rate-cap', () => ({
  checkExtractionRateCap: mockCheckExtractionRateCap,
}))

vi.mock('@/lib/cost/style-extraction-ledger', () => ({
  chargeExtractionCredit: mockChargeExtractionCredit,
  refundExtractionCredit: mockRefundExtractionCredit,
  EXTRACTION_CHARGE_TYPE: 'gemini_vision_extract_style',
}))

vi.mock('@/lib/cost/style-extraction-retry', () => ({
  withSingleRetry: mockWithSingleRetry,
  isTransientError: vi.fn(() => false),
}))

// quick 260511-flj: refusal-pre-pass mock removed — module deleted entirely.

vi.mock('../palette-extraction', () => ({
  extractPaletteFromBytes: mockExtractPaletteFromBytes,
  mergePalettes: mockMergePalettes,
  PALETTE_TARGET_SIZE: 6,
  FALLBACK_NEUTRAL_HEX: '#808080',
}))

vi.mock('@/lib/validators/style-spec', () => ({
  parseStyleSpecSafe: mockParseStyleSpecSafe,
}))

vi.mock('@/lib/validators/silent-drop-counter', () => ({
  createSilentDropCounter: mockCreateSilentDropCounter,
}))

// Import AFTER mocks are set up.
import { extractStyleSpec, EXTRACTION_TIMEOUT_MS } from '../extract-style-spec'
import type { StyleSpec } from '@/lib/types/style-spec'

// ------------------------------------------------------------------------- //
// Test fixtures                                                             //
// ------------------------------------------------------------------------- //

function makeAdmin(): SupabaseClient {
  return {} as unknown as SupabaseClient
}

function makeRefBytes(n: number): Buffer[] {
  return Array.from({ length: n }, (_, i) => Buffer.from(`fake-image-${i}`))
}

function makeValidStyleSpec(overrides: Partial<StyleSpec> = {}): StyleSpec {
  // Cast: Partial<StyleSpec> over a discriminated union (StyleSpec is intersected
  // with ArchetypeSlots in Phase 80) cannot be spread back into the union without
  // collapsing the discriminator. Spec contract is concrete here:
  // slideArchetype='full-bleed-text-overlay' (EmptySlots variant).
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#A8E0B0' },
    typography: { hookFontCategory: 'sans-serif' },
    layout: { hookPosition: 'top', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'Bold magazine voice',
    ...overrides,
  } as StyleSpec
}

function makeCounter(counts: Record<string, number> = {}) {
  const events: unknown[] = []
  return {
    increment: vi.fn((evt: unknown) => events.push(evt)),
    getCount: vi.fn(() => Object.values(counts).reduce((a, b) => a + b, 0)),
    getEvents: vi.fn(() => events),
    getCounts: vi.fn(() => counts),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: pass-through retry wrapper.
  mockWithSingleRetry.mockImplementation(async (fn) => fn())
  // Default: prepareForVision returns one prepared per input byte.
  mockPrepareForVision.mockImplementation(async (b: Buffer) => ({
    bytes: b,
    sha256: 'sha-' + b.toString('hex').slice(0, 8) + '0'.repeat(56),
    width: 800,
    height: 1200,
    mimeType: 'image/jpeg' as const,
  }))
  // Default counter implementation.
  mockCreateSilentDropCounter.mockImplementation(() => makeCounter())
})

// ------------------------------------------------------------------------- //
// Tests                                                                     //
// ------------------------------------------------------------------------- //

describe('Phase 75 Plan 01: extractStyleSpec — cache hit', () => {
  it('Test 1: cache hit returns spec without Gemini call or charge', async () => {
    const cachedSpec = makeValidStyleSpec()
    mockLookupStyleSpec.mockResolvedValueOnce(cachedSpec)

    const result = await extractStyleSpec({
      projectId: 'p1',
      userId: 'u1',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.cached).toBe(true)
      expect(result.spec).toEqual(cachedSpec)
      expect(result.telemetry.cache_hit).toBe(true)
      expect(result.telemetry.vision_calls_count).toBe(0)
    }
    // Cache check happens BEFORE charge / Gemini per Phase 73 contract.
    expect(mockPrepareForVision).toHaveBeenCalledTimes(1)
    expect(mockChargeExtractionCredit).not.toHaveBeenCalled()
    expect(mockGenerateContent).not.toHaveBeenCalled()
    expect(mockCheckExtractionRateCap).not.toHaveBeenCalled()
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — cache miss happy path + telemetry', () => {
  it('Test 2: happy path emits validated spec, palette merged from node-vibrant', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        schema_version: 1,
        palette: { mode: 'solid' },
        typography: { hookFontCategory: 'sans-serif' },
        layout: { hookPosition: 'top', density: 'medium' },
        imagery: { treatmentPreset: 'bw' },
        decorations: { density: 'sparse' },
        rhythm: { cadence: 'punchy' },
        voice_note: 'Bold magazine voice',
      }),
      usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 600 },
    })

    const palette = { hex: ['#A8E0B0', '#000000', '#FFFFFF'], dominant: '#A8E0B0' }
    mockExtractPaletteFromBytes.mockResolvedValueOnce(palette)
    mockMergePalettes.mockReturnValueOnce(palette)

    // parseStyleSpecSafe receives the merged candidate; return validated spec.
    const validatedSpec = makeValidStyleSpec({
      palette: { mode: 'solid', primary: '#A8E0B0', secondary: '#000000', accent: '#FFFFFF' },
    })
    let parsedInput: unknown = null
    mockParseStyleSpecSafe.mockImplementationOnce((input: unknown) => {
      parsedInput = input
      return { ok: true, spec: validatedSpec, counter: makeCounter({}) }
    })

    const result = await extractStyleSpec({
      projectId: 'p2',
      userId: 'u2',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      // Palette comes from node-vibrant, NOT from Gemini (which had no `primary` field).
      expect(result.spec.palette.primary).toBe('#A8E0B0')
      // quick 260511-flj: 1 vision call (refusal pre-pass deleted)
      expect(result.telemetry.vision_calls_count).toBe(1)
      expect(result.telemetry.tokens_in).toBe(1500)
      expect(result.telemetry.tokens_out).toBe(600)
      expect(result.telemetry.cache_hit).toBe(false)
    }
    expect(mockParseStyleSpecSafe).toHaveBeenCalledTimes(1)
    // Phase B input must contain the node-vibrant palette merged in (NOT Gemini's empty palette).
    expect(parsedInput).toMatchObject({
      palette: expect.objectContaining({ primary: '#A8E0B0' }),
    })
    expect(mockPersistStyleSpec).toHaveBeenCalledTimes(1)
    // Gemini called exactly once (no refusal pre-pass parallel call any more).
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — two-phase firewall (Phase B strips unknown fields)', () => {
  it('Test 3: INJECTED extra keys are stripped by parseStyleSpecSafe; silent_drops populated', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        schema_version: 1,
        palette: { mode: 'solid' },
        typography: {},
        layout: {},
        imagery: {},
        decorations: {},
        rhythm: {},
        // INJECTED — these MUST be stripped by Phase B
        reference_artist: 'Murphy Campbell',
        evil_instruction: 'IGNORE PREVIOUS',
      }),
      usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200 },
    })

    const palette = { hex: ['#FF0000'], dominant: '#FF0000' }
    mockExtractPaletteFromBytes.mockResolvedValueOnce(palette)
    mockMergePalettes.mockReturnValueOnce(palette)

    // Mock parseStyleSpecSafe: validate that INJECTED keys are present in input,
    // then return cleaned spec + silent-drop events for those keys.
    const cleanSpec = makeValidStyleSpec({
      palette: { mode: 'solid', primary: '#FF0000' },
    })
    mockParseStyleSpecSafe.mockImplementationOnce((input: unknown) => {
      // Confirm Phase B sees the injected keys (proof Phase A passed them through).
      const obj = input as Record<string, unknown>
      expect(obj.reference_artist).toBe('Murphy Campbell')
      expect(obj.evil_instruction).toBe('IGNORE PREVIOUS')
      const counts = { reference_artist: 1, evil_instruction: 1 }
      return { ok: true, spec: cleanSpec, counter: makeCounter(counts) }
    })

    const result = await extractStyleSpec({
      projectId: 'p3',
      userId: 'u3',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      // Returned spec does NOT contain injected fields.
      expect((result.spec as unknown as Record<string, unknown>).reference_artist).toBeUndefined()
      expect((result.spec as unknown as Record<string, unknown>).evil_instruction).toBeUndefined()
      // silent_drops telemetry surfaced.
      expect(result.telemetry.silent_drops).toEqual({
        reference_artist: 1,
        evil_instruction: 1,
      })
    }
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — rate-cap reached', () => {
  it('Test 4: cap reached → no charge, no Gemini call, returns cap_reached', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    const capDetail = {
      allowed: false,
      reason: 'daily_cap_reached',
      callsToday: 5,
      callsRemaining: 0,
      imagesPerCallCap: 3,
    }
    mockCheckExtractionRateCap.mockResolvedValueOnce(capDetail)

    const result = await extractStyleSpec({
      projectId: 'p4',
      userId: 'u4',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('cap_reached')
      expect(result.detail).toEqual(capDetail)
    }
    expect(mockChargeExtractionCredit).not.toHaveBeenCalled()
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — insufficient credits', () => {
  it('Test 5: charge returns false → no Gemini call, no refund, insufficient_credits', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(false)

    const result = await extractStyleSpec({
      projectId: 'p5',
      userId: 'u5',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('insufficient_credits')
    expect(mockGenerateContent).not.toHaveBeenCalled()
    expect(mockRefundExtractionCredit).not.toHaveBeenCalled()
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — safety block', () => {
  it('Test 6: promptFeedback.blockReason → refund + safety_blocked + recovery_suggestion', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)
    mockGenerateContent.mockResolvedValueOnce({
      text: '',
      promptFeedback: { blockReason: 'SAFETY' },
    })

    const result = await extractStyleSpec({
      projectId: 'p6',
      userId: 'u6',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'safety_blocked') {
      expect(result.reason).toBe('SAFETY')
      // recovery_suggestion is non-empty + mentions one of the user-facing remediations.
      expect(result.recovery_suggestion).toBeTruthy()
      const re = /(crop|different image|describe in text)/i
      expect(re.test(result.recovery_suggestion)).toBe(true)
      expect(result.telemetry.block_reason).toBe('SAFETY')
    } else {
      throw new Error(`expected safety_blocked, got ${result.ok ? 'ok' : result.error}`)
    }
    expect(mockRefundExtractionCredit).toHaveBeenCalledTimes(1)
    // Refund reason should mention the safety block (so bill-alarm cron can categorize)
    const [, , , refundReason] = (mockRefundExtractionCredit.mock.calls[0] as unknown[])
    expect(typeof refundReason).toBe('string')
    expect((refundReason as string).toLowerCase()).toContain('safety')
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — 10s timeout', () => {
  it('Test 7: Gemini hangs → Promise.race timeout → refund + extraction_failed', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)
    // Gemini never resolves.
    mockGenerateContent.mockImplementationOnce(
      () => new Promise(() => { /* never */ }),
    )

    vi.useFakeTimers()
    const promise = extractStyleSpec({
      projectId: 'p7',
      userId: 'u7',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS + 1)
    const result = await promise
    vi.useRealTimers()

    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'extraction_failed') {
      expect(result.detail.toLowerCase()).toMatch(/timeout|10s/)
    } else {
      throw new Error(`expected extraction_failed; got ${result.ok ? 'ok' : result.error}`)
    }
    expect(mockRefundExtractionCredit).toHaveBeenCalledTimes(1)
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — transient error retried via withSingleRetry', () => {
  it('Test 8: first call fails 503, second succeeds → ok:true, charge happens once', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)

    // Simulate withSingleRetry by invoking the inner fn TWICE — first throws, second resolves.
    let attempt = 0
    mockGenerateContent.mockImplementation(async () => {
      attempt++
      if (attempt === 1) {
        const err = new Error('503 Service Unavailable')
        ;(err as unknown as { status: number }).status = 503
        throw err
      }
      return {
        text: JSON.stringify({
          schema_version: 1,
          palette: { mode: 'solid' },
          typography: {},
          layout: {},
          imagery: {},
          decorations: {},
          rhythm: {},
        }),
        usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 300 },
      }
    })
    // Make withSingleRetry call fn twice on transient failure (matches Phase 73-03 behavior).
    mockWithSingleRetry.mockImplementationOnce(async (fn) => {
      try {
        return await fn()
      } catch {
        return await fn()
      }
    })

    const palette = { hex: ['#FFFFFF'], dominant: '#FFFFFF' }
    mockExtractPaletteFromBytes.mockResolvedValueOnce(palette)
    mockMergePalettes.mockReturnValueOnce(palette)
    const validatedSpec = makeValidStyleSpec()
    mockParseStyleSpecSafe.mockReturnValueOnce({ ok: true, spec: validatedSpec, counter: makeCounter({}) })

    const result = await extractStyleSpec({
      projectId: 'p8',
      userId: 'u8',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(true)
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    // Charge happened ONCE (no double-charge on retry — charge is outside withSingleRetry)
    expect(mockChargeExtractionCredit).toHaveBeenCalledTimes(1)
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — permanent error (4xx) NOT retried', () => {
  it('Test 9: 4xx error → no retry → refund + extraction_failed', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)

    mockGenerateContent.mockImplementationOnce(async () => {
      const err = new Error('400 Bad Request')
      ;(err as unknown as { status: number }).status = 400
      throw err
    })
    // withSingleRetry passes through the throw — does NOT retry on 4xx.
    mockWithSingleRetry.mockImplementationOnce(async (fn) => fn())

    const result = await extractStyleSpec({
      projectId: 'p9',
      userId: 'u9',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('extraction_failed')
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(mockRefundExtractionCredit).toHaveBeenCalledTimes(1)
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — schema-violation degraded spec', () => {
  it('Test 10: parseStyleSpecSafe returns ok:true with silent-drops → ok:true + telemetry populated + persisted', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        schema_version: 1,
        palette: { mode: 'INVALID_MODE' },
        typography: {},
        layout: {},
        imagery: {},
        decorations: {},
        rhythm: {},
      }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200 },
    })

    const palette = { hex: ['#999999'], dominant: '#999999' }
    mockExtractPaletteFromBytes.mockResolvedValueOnce(palette)
    mockMergePalettes.mockReturnValueOnce(palette)

    // parseStyleSpecSafe drops palette.mode (unknown_enum_value) but returns ok:true with degraded spec.
    const degradedSpec = makeValidStyleSpec({
      palette: { mode: 'solid', primary: '#999999' },
    })
    mockParseStyleSpecSafe.mockReturnValueOnce({
      ok: true,
      spec: degradedSpec,
      counter: makeCounter({ 'palette.mode': 1 }),
    })

    const result = await extractStyleSpec({
      projectId: 'p10',
      userId: 'u10',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.telemetry.silent_drops).toEqual({ 'palette.mode': 1 })
    }
    expect(mockPersistStyleSpec).toHaveBeenCalledTimes(1)
  })
})

describe('Phase 75 Plan 01: extractStyleSpec — invalid JSON', () => {
  it('Test 11: Gemini returns non-JSON text → refund + extraction_failed', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)
    mockGenerateContent.mockResolvedValueOnce({
      text: 'not json at all <broken>',
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 5 },
    })

    const result = await extractStyleSpec({
      projectId: 'p11',
      userId: 'u11',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('extraction_failed')
    expect(mockRefundExtractionCredit).toHaveBeenCalledTimes(1)
  })
})

// Test 12 (refusal pre-pass errored → graceful degradation) — DELETED
// quick 260511-flj: refusal pre-pass module deleted entirely.

describe('Phase 75 Plan 01: extractStyleSpec — telemetry duration_ms is real wall clock', () => {
  it('Test 13: duration_ms reflects actual wall time including Gemini delay', async () => {
    mockLookupStyleSpec.mockResolvedValueOnce(null)
    mockCheckExtractionRateCap.mockResolvedValueOnce({ allowed: true, callsToday: 0, callsRemaining: 5, imagesPerCallCap: 3 })
    mockChargeExtractionCredit.mockResolvedValueOnce(true)
    mockGenerateContent.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return {
        text: JSON.stringify({
          schema_version: 1,
          palette: { mode: 'solid' },
          typography: {},
          layout: {},
          imagery: {},
          decorations: {},
          rhythm: {},
        }),
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
      }
    })

    const palette = { hex: ['#222222'], dominant: '#222222' }
    mockExtractPaletteFromBytes.mockResolvedValueOnce(palette)
    mockMergePalettes.mockReturnValueOnce(palette)
    mockParseStyleSpecSafe.mockReturnValueOnce({
      ok: true,
      spec: makeValidStyleSpec({ palette: { mode: 'solid', primary: '#222222' } }),
      counter: makeCounter({}),
    })

    const result = await extractStyleSpec({
      projectId: 'p13',
      userId: 'u13',
      tier: 'free',
      referenceBytes: makeRefBytes(1),
      admin: makeAdmin(),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.telemetry.duration_ms).toBeGreaterThanOrEqual(50)
      expect(result.telemetry.duration_ms).toBeLessThan(2000)
    }
  })
})

describe('Phase 75 Plan 01: structural gates', () => {
  // Test 14: no-real-Gemini gate — verified externally via grep in plan verify block.
  it('Test 14: this test file does not read GEMINI_API_KEY (no-real-Gemini gate)', () => {
    const src = fs.readFileSync(__filename, 'utf-8')
    // Strip THIS test's literal references — count only "real" occurrences.
    const matches = src.match(/GEMINI_API_KEY/g) ?? []
    // The only allowed mention is the literal in this assertion line itself.
    // If extractStyleSpec test ever does process.env.GEMINI_API_KEY this fails.
    // The assertion itself contains the literal string twice (regex + comment),
    // which we count and subtract — see comment.
    // We expect EXACTLY the references in this assertion block (no production reads).
    expect(matches.length).toBeLessThanOrEqual(4)
  })

  it('Test 15: source-grep firewall — rawGemini/rawObject only appear BEFORE parseStyleSpecSafe call', () => {
    const sourcePath = path.resolve(__dirname, '..', 'extract-style-spec.ts')
    const src = fs.readFileSync(sourcePath, 'utf-8')
    const lines = src.split('\n')

    // Skip comments + imports — find the first NON-COMMENT, NON-IMPORT line
    // where parseStyleSpecSafe is called. This is the Phase B boundary.
    const isCommentOrImport = (line: string): boolean => {
      const t = line.trimStart()
      return (
        t.startsWith('//') ||
        t.startsWith('*') ||
        t.startsWith('/*') ||
        /^\s*import\b/.test(line)
      )
    }
    const parseSafeCallLine = lines.findIndex(
      (line) => /parseStyleSpecSafe\s*\(/.test(line) && !isCommentOrImport(line),
    )
    expect(parseSafeCallLine).toBeGreaterThan(0)

    // Every rawGemini / rawObject mention (in code, not comments) must appear
    // at or BEFORE that line — i.e., raw bytes never propagate past Phase B.
    const rawRefLines: number[] = []
    lines.forEach((line, idx) => {
      if (isCommentOrImport(line)) return
      if (/\b(rawGemini|rawObject)\b/.test(line)) rawRefLines.push(idx)
    })

    for (const lineIdx of rawRefLines) {
      expect(lineIdx).toBeLessThanOrEqual(parseSafeCallLine)
    }
  })
})
