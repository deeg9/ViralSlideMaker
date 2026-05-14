// Phase 74 Plan 01 Task 1 (STYLESPEC-10, PARITY-03):
// RED → GREEN tests for createSilentDropCounter.
//
// The counter is the observability primitive that turns silent enum drops at
// the AI-ingest boundary into structured, countable events. Per CONTEXT.md
// specifics, the counter increments per stripped FIELD (not per parse call)
// — granular telemetry. Default behaviour is a single-line JSON via
// console.warn so tests + ops can grep for `style_spec_drop` without a
// dedicated telemetry sink.

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createSilentDropCounter,
  type SilentDropCounter,
  type SilentDropEvent,
} from '../silent-drop-counter'

describe('Phase 74 (STYLESPEC-10, PARITY-03): createSilentDropCounter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Test 1: returns a counter exposing increment + getCount + getEvents', () => {
    const counter: SilentDropCounter = createSilentDropCounter()
    expect(typeof counter.increment).toBe('function')
    expect(typeof counter.getCount).toBe('function')
    expect(typeof counter.getEvents).toBe('function')
    expect(counter.getCount()).toBe(0)
    expect(counter.getEvents()).toEqual([])
  })

  it('Test 2: increment(event) raises getCount() by exactly 1 per call (granular per stripped field)', () => {
    // Suppress default console.warn noise from the default hook.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const counter = createSilentDropCounter()
    counter.increment({
      field: 'typography.hookFontCategory',
      reason: 'unknown_enum_value',
      schema_version: 1,
    })
    expect(counter.getCount()).toBe(1)
    counter.increment({
      field: 'decorations.preferredLucide[0]',
      reason: 'unknown_enum_value',
      schema_version: 1,
    })
    expect(counter.getCount()).toBe(2)
    counter.increment({
      field: 'palette.extra_field',
      reason: 'unknown_field',
      schema_version: 1,
    })
    expect(counter.getCount()).toBe(3)
  })

  it('Test 3: getEvents() returns frozen / readonly array of all increments in order', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const counter = createSilentDropCounter()
    const ev1: SilentDropEvent = {
      field: 'a',
      reason: 'unknown_field',
      schema_version: 1,
    }
    const ev2: SilentDropEvent = {
      field: 'b',
      reason: 'unknown_enum_value',
      schema_version: 1,
    }
    counter.increment(ev1)
    counter.increment(ev2)
    const events = counter.getEvents()
    expect(events.length).toBe(2)
    expect(events[0]?.field).toBe('a')
    expect(events[1]?.field).toBe('b')
    // Frozen / readonly: attempt to mutate should NOT change subsequent reads.
    expect(() => {
      ;(events as unknown as SilentDropEvent[]).push({
        field: 'c',
        reason: 'parse_error',
        schema_version: 1,
      })
    }).toThrow()
    // Even if the throw was swallowed, the canonical events must be unchanged.
    expect(counter.getEvents().length).toBe(2)
  })

  it('Test 4: default hook emits a single-line JSON to console.warn with field + reason + schema_version', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const counter = createSilentDropCounter()
    counter.increment({
      field: 'typography.hookFontCategory',
      reason: 'unknown_enum_value',
      schema_version: 1,
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const arg = warnSpy.mock.calls[0]?.[0]
    expect(typeof arg).toBe('string')
    // Must be single-line (no newlines).
    expect((arg as string).includes('\n')).toBe(false)
    // Must be valid JSON.
    const parsed = JSON.parse(arg as string)
    expect(parsed.field).toBe('typography.hookFontCategory')
    expect(parsed.reason).toBe('unknown_enum_value')
    expect(parsed.schema_version).toBe(1)
  })

  it('Test 5: when onDrop hook is provided, default console.warn is NOT called; the hook receives the event verbatim', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onDrop = vi.fn()
    const counter = createSilentDropCounter({ onDrop })
    const event: SilentDropEvent = {
      field: 'palette.mode',
      reason: 'unknown_enum_value',
      raw_value: 'rainbow',
      schema_version: 1,
    }
    counter.increment(event)
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop).toHaveBeenCalledWith(event)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('Test 6: SilentDropEvent.raw_value is truncated to <=200 chars when stringified (defends against prompt-injection log spam)', () => {
    const onDrop = vi.fn()
    const counter = createSilentDropCounter({ onDrop })
    const huge = 'A'.repeat(5000)
    counter.increment({
      field: 'voice_note',
      reason: 'sanitization',
      raw_value: huge,
      schema_version: 1,
    })
    expect(onDrop).toHaveBeenCalledTimes(1)
    const event = onDrop.mock.calls[0]?.[0] as SilentDropEvent
    const serialized = JSON.stringify(event.raw_value)
    expect(serialized.length).toBeLessThanOrEqual(200)
  })

  it('Test 7: default hook does not throw when console.warn throws (defense-in-depth)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {
      throw new Error('logger blew up')
    })
    const counter = createSilentDropCounter()
    expect(() =>
      counter.increment({
        field: 'palette.mode',
        reason: 'unknown_enum_value',
        schema_version: 1,
      }),
    ).not.toThrow()
    // Counter still updates even if the hook crashed.
    expect(counter.getCount()).toBe(1)
  })

  it('Test 7b: SilentDropEvent.reason is restricted to the closed union (compile-time gate; Phase 74 + Phase 80 reasons)', () => {
    const _bad: SilentDropEvent = {
      field: 'a',
      // @ts-expect-error 'random_string' is NOT assignable to SilentDropEvent.reason
      reason: 'random_string',
      schema_version: 1,
    }
    // Phase 74 valid values compile cleanly.
    const a: SilentDropEvent = { field: 'a', reason: 'unknown_field', schema_version: 1 }
    const b: SilentDropEvent = { field: 'a', reason: 'unknown_enum_value', schema_version: 1 }
    const c: SilentDropEvent = { field: 'a', reason: 'sanitization', schema_version: 1 }
    const d: SilentDropEvent = { field: 'a', reason: 'parse_error', schema_version: 1 }
    // Phase 80 reasons compile cleanly (composition-aware extraction; Plan 02 firewall).
    const e: SilentDropEvent = { field: 'a', reason: 'schema_version_rejected', schema_version: 2 }
    const f: SilentDropEvent = { field: 'a', reason: 'archetype_fallback', schema_version: 2 }
    const g: SilentDropEvent = { field: 'a', reason: 'archetype_slot_mismatch', schema_version: 2 }
    expect([a, b, c, d, e, f, g, _bad].length).toBe(8)
  })

  it('Test 8: per-instance, not singleton — two counters track independently', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c1 = createSilentDropCounter()
    const c2 = createSilentDropCounter()
    c1.increment({ field: 'x', reason: 'unknown_field', schema_version: 1 })
    expect(c1.getCount()).toBe(1)
    expect(c2.getCount()).toBe(0)
  })
})
