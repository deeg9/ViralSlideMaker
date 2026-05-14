// Phase 75 Plan 01 (EXTRACT-01..03/06/07/08):
// Compile-time + light-runtime tests for the orchestrator's discriminated-union
// type contract. Mirrors the pattern of "type-shape gate via expectTypeOf"
// — these assertions fail at TS compile time when the contract drifts.
//
// quick 260511-flj: RefusalFlags re-export removed from extract-style-spec.types
// (refusal pre-pass module deleted entirely). Type test 6 deleted; Type test 3
// no longer asserts refusal_flags field.
//
// References:
//   - CONTEXT.md D-04 (error taxonomy)
//   - CONTEXT.md D-08 (telemetry shape)
//   - REQUIREMENTS.md EXTRACT-01 (endpoint signature)

import { describe, it, expect, expectTypeOf } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  ExtractInput,
  ExtractResult,
  ExtractSuccess,
  ExtractError,
  ExtractTelemetry,
} from '../extract-style-spec.types'
import type { StyleSpec } from '@/lib/types/style-spec'

describe('Phase 75 Plan 01: extract-style-spec.types — type contract', () => {
  it('Type test 1: ExtractInput shape', () => {
    const sample: ExtractInput = {
      projectId: 'p-1',
      userId: 'u-1',
      tier: 'free',
      referenceBytes: [Buffer.from('a')],
      admin: {} as unknown as SupabaseClient,
    }
    expectTypeOf(sample.projectId).toEqualTypeOf<string>()
    expectTypeOf(sample.userId).toEqualTypeOf<string>()
    expectTypeOf(sample.tier).toEqualTypeOf<'free' | 'paid'>()
    expectTypeOf(sample.referenceBytes).toEqualTypeOf<Buffer[]>()
    expectTypeOf(sample.admin).toEqualTypeOf<SupabaseClient>()
  })

  it('Type test 2: ExtractResult is a discriminated union on `ok`', () => {
    function consume(r: ExtractResult): string {
      // Discriminated narrowing on `ok` must compile.
      if (r.ok) {
        // Inside this branch we have ExtractSuccess fields available.
        return r.spec.schema_version === 2 ? 'success' : 'unexpected-version'
      }
      // Inside this branch we have ExtractError fields available.
      return r.error
    }
    expect(typeof consume).toBe('function')
  })

  it('Type test 3: ExtractSuccess shape (ok:true, spec, cached, telemetry)', () => {
    const success: ExtractSuccess = {
      ok: true,
      spec: {
        schema_version: 2,
        slideArchetype: 'full-bleed-text-overlay',
        palette: { mode: 'solid', primary: '#FFFFFF' },
        typography: {},
        layout: {},
        imagery: {},
        decorations: {},
        rhythm: {},
      } as StyleSpec,
      cached: true,
      telemetry: {
        vision_calls_count: 0,
        tokens_in: 0,
        tokens_out: 0,
        cache_hit: true,
        duration_ms: 0,
      },
    }
    expectTypeOf(success.ok).toEqualTypeOf<true>()
    expectTypeOf(success.spec).toEqualTypeOf<StyleSpec>()
    expectTypeOf(success.cached).toEqualTypeOf<boolean>()
    expectTypeOf(success.telemetry).toEqualTypeOf<ExtractTelemetry>()
  })

  it('Type test 4: ExtractError discriminated union covers all four error codes', () => {
    const e1: ExtractError = {
      ok: false,
      error: 'cap_reached',
      detail: {
        allowed: false,
        reason: 'daily_cap_reached',
        callsToday: 5,
        callsRemaining: 0,
        imagesPerCallCap: 3,
      },
      telemetry: {
        vision_calls_count: 0,
        tokens_in: 0,
        tokens_out: 0,
        cache_hit: false,
        duration_ms: 0,
      },
    }
    const e2: ExtractError = {
      ok: false,
      error: 'insufficient_credits',
      detail: 'check balance',
      telemetry: {
        vision_calls_count: 0,
        tokens_in: 0,
        tokens_out: 0,
        cache_hit: false,
        duration_ms: 0,
      },
    }
    const e3: ExtractError = {
      ok: false,
      error: 'safety_blocked',
      detail: { blockReason: 'SAFETY' },
      reason: 'SAFETY',
      recovery_suggestion: 'Try a different image.',
      telemetry: {
        vision_calls_count: 1,
        tokens_in: 100,
        tokens_out: 0,
        cache_hit: false,
        duration_ms: 1200,
        block_reason: 'SAFETY',
      },
    }
    const e4: ExtractError = {
      ok: false,
      error: 'extraction_failed',
      detail: 'Gemini timeout (10s)',
      telemetry: {
        vision_calls_count: 1,
        tokens_in: 100,
        tokens_out: 0,
        cache_hit: false,
        duration_ms: 10000,
      },
    }
    expect([e1.error, e2.error, e3.error, e4.error]).toEqual([
      'cap_reached',
      'insufficient_credits',
      'safety_blocked',
      'extraction_failed',
    ])
  })

  it('Type test 5: ExtractTelemetry shape (D-08)', () => {
    const t: ExtractTelemetry = {
      vision_calls_count: 1,
      tokens_in: 1500,
      tokens_out: 600,
      cache_hit: false,
      duration_ms: 3200,
      silent_drops: { 'palette.mode': 1 },
      block_reason: undefined,
    }
    expectTypeOf(t.vision_calls_count).toEqualTypeOf<number>()
    expectTypeOf(t.tokens_in).toEqualTypeOf<number>()
    expectTypeOf(t.tokens_out).toEqualTypeOf<number>()
    expectTypeOf(t.cache_hit).toEqualTypeOf<boolean>()
    expectTypeOf(t.duration_ms).toEqualTypeOf<number>()
    expectTypeOf(t.silent_drops).toEqualTypeOf<Record<string, number> | undefined>()
    expectTypeOf(t.block_reason).toEqualTypeOf<string | undefined>()
  })

  // Type test 6 (RefusalFlags re-export) — DELETED
  // quick 260511-flj: refusal pre-pass module deleted; RefusalFlags type
  // no longer exists.
})
