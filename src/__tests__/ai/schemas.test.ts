import { describe, it, expect } from 'vitest'
import { TextSegmentSchema } from '@/lib/ai/schemas'

// Phase 47-01 Task 2 (TPLAI-03): TextSegmentSchema accepts optional
// highlightColor (string) + highlightStyle (literal 'pill' for AI scope).
// AI authority is locked to pill-only — block style is reserved for the
// renderer/manual editor use of the wider TextSegment type.
describe('TextSegmentSchema (Phase 47 TPLAI-03)', () => {
  it('accepts a legacy segment with only { text, accent } (backward compat)', () => {
    const result = TextSegmentSchema.safeParse({
      text: 'FIGHTS BACK',
      accent: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a segment with text, accent, highlightColor, and highlightStyle: "pill"', () => {
    const result = TextSegmentSchema.safeParse({
      text: 'FIGHTS BACK',
      accent: true,
      highlightColor: '#A8E0B0',
      highlightStyle: 'pill',
    })
    expect(result.success).toBe(true)
  })

  it("rejects highlightStyle === 'block' (AI authority locked to pill-only)", () => {
    const result = TextSegmentSchema.safeParse({
      text: 'FIGHTS BACK',
      accent: true,
      highlightColor: '#A8E0B0',
      highlightStyle: 'block',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a segment with both highlightColor and highlightStyle undefined', () => {
    const result = TextSegmentSchema.safeParse({
      text: 'FIGHTS BACK',
      accent: false,
      highlightColor: undefined,
      highlightStyle: undefined,
    })
    expect(result.success).toBe(true)
  })
})
