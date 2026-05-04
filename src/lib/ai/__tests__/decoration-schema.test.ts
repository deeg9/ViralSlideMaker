import { describe, it, expect } from 'vitest'
import {
  DecorationSchema,
  parseDecorationsArraySafe,
} from '../schemas'
import { DecorationSchema as DecorationSchemaFromGenerateSlides } from '../generate-slides'

const validIcon = {
  kind: 'icon' as const,
  id: 'a',
  position: { x: 0, y: 0, width: 10, height: 10 },
  lucideName: 'Heart',
  color: '#FF0000',
  strokeWidth: 2,
}

const validShape = {
  kind: 'shape' as const,
  id: 'b',
  position: { x: 0, y: 0, width: 10, height: 10 },
  shapeKind: 'rect' as const,
  fill: '#00FF00',
}

describe('Phase 67 (DECOR-05): DecorationSchema Zod validator', () => {
  it('Test 1: well-formed icon parses', () => {
    expect(DecorationSchema.safeParse(validIcon).success).toBe(true)
  })

  it('Test 2: well-formed shape parses', () => {
    expect(DecorationSchema.safeParse(validShape).success).toBe(true)
  })

  it('Test 3: unknown kind is rejected', () => {
    const result = DecorationSchema.safeParse({
      kind: 'banana',
      id: 'c',
      position: { x: 0, y: 0, width: 10, height: 10 },
    })
    expect(result.success).toBe(false)
  })

  it('Test 4: icon missing required fields is rejected', () => {
    const result = DecorationSchema.safeParse({
      kind: 'icon',
      id: 'd',
      position: { x: 0, y: 0, width: 10, height: 10 },
    })
    expect(result.success).toBe(false)
  })

  it('Test 5 (silent-drop): array helper filters malformed entries silently', () => {
    const out = parseDecorationsArraySafe([
      validIcon,
      { kind: 'icon', id: 'broken', position: { x: 0, y: 0, width: 10, height: 10 } },
      validShape,
    ])
    expect(out).toHaveLength(2)
    expect(out[0].kind).toBe('icon')
    expect(out[1].kind).toBe('shape')
  })

  it('Test 6 (silent-drop preserves order, never throws)', () => {
    const malformed = { kind: 'shape', id: 'broken' }
    const out = parseDecorationsArraySafe([malformed, validShape])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('b')
  })

  it('Test 7: DecorationSchema is reachable from generate-slides re-export', () => {
    expect(DecorationSchemaFromGenerateSlides).toBe(DecorationSchema)
  })

  it('Test 8: shadow effect parses', () => {
    const result = DecorationSchema.safeParse({
      ...validShape,
      effects: { shadow: { enabled: true, color: '#00000080', size: 'md' } },
    })
    expect(result.success).toBe(true)
  })

  it('Test 9: stroke style closed enum', () => {
    expect(
      DecorationSchema.safeParse({
        ...validShape,
        stroke: { color: '#000000', width: 1, style: 'rainbow' },
      }).success,
    ).toBe(false)
    expect(
      DecorationSchema.safeParse({
        ...validShape,
        stroke: { color: '#000000', width: 1, style: 'dashed' },
      }).success,
    ).toBe(true)
  })

  it('Test 10 (parity): non-array input returns empty array (silent-drop)', () => {
    expect(parseDecorationsArraySafe(null)).toEqual([])
    expect(parseDecorationsArraySafe(undefined)).toEqual([])
    expect(parseDecorationsArraySafe('not an array')).toEqual([])
  })

  // WR-01: DecorationBase.opacity Zod range guard (0..1 CSS-native scale)
  it('WR-01-A: opacity=0.5 accepted (valid CSS fraction)', () => {
    expect(DecorationSchema.safeParse({ ...validIcon, opacity: 0.5 }).success).toBe(true)
  })

  it('WR-01-B: opacity=0 accepted (fully transparent, boundary)', () => {
    expect(DecorationSchema.safeParse({ ...validIcon, opacity: 0 }).success).toBe(true)
  })

  it('WR-01-C: opacity=1 accepted (fully opaque, boundary)', () => {
    expect(DecorationSchema.safeParse({ ...validIcon, opacity: 1 }).success).toBe(true)
  })

  it('WR-01-D: opacity=1.5 rejected (exceeds 0..1 ceiling)', () => {
    expect(DecorationSchema.safeParse({ ...validIcon, opacity: 1.5 }).success).toBe(false)
  })

  it('WR-01-E: opacity=-0.1 rejected (below 0 floor)', () => {
    expect(DecorationSchema.safeParse({ ...validIcon, opacity: -0.1 }).success).toBe(false)
  })

  it('WR-01-F: opacity=undefined accepted (optional field)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { opacity: _op, ...withoutOpacity } = { ...validIcon, opacity: undefined }
    expect(DecorationSchema.safeParse(withoutOpacity).success).toBe(true)
  })

  // WR-02: Hex-only color guard — all Decoration color/fill fields
  it('WR-02-A: icon color #fff000 (6-digit) accepted', () => {
    expect(DecorationSchema.safeParse({ ...validIcon, color: '#fff000' }).success).toBe(true)
  })

  it('WR-02-B: shadow color #fff000ff (8-digit alpha form) accepted', () => {
    const result = DecorationSchema.safeParse({
      ...validShape,
      effects: { shadow: { enabled: true, color: '#fff000ff', size: 'md' } },
    })
    expect(result.success).toBe(true)
  })

  it('WR-02-C: shape fill #A8E0B0 (6-digit) accepted', () => {
    expect(DecorationSchema.safeParse({ ...validShape, fill: '#A8E0B0' }).success).toBe(true)
  })

  it('WR-02-D: icon color "currentColor" silently dropped via parseDecorationsArraySafe', () => {
    const out = parseDecorationsArraySafe([{ ...validIcon, color: 'currentColor' }, validShape])
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('shape')
  })

  it('WR-02-E: icon color "blue" (named color) silently dropped via parseDecorationsArraySafe', () => {
    const out = parseDecorationsArraySafe([{ ...validIcon, color: 'blue' }, validShape])
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('shape')
  })

  it('WR-02-F: shape fill "#fff" (3-digit shorthand) rejected — not allowed', () => {
    expect(DecorationSchema.safeParse({ ...validShape, fill: '#fff' }).success).toBe(false)
  })

  it('WR-02-G: stroke color "inherit" silently dropped via parseDecorationsArraySafe', () => {
    const out = parseDecorationsArraySafe([
      { ...validShape, stroke: { color: 'inherit', width: 1, style: 'solid' } },
      validIcon,
    ])
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('icon')
  })
})
