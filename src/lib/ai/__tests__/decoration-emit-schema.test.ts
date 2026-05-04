import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  DecorationEmitSchema,
  AI_LUCIDE_ALLOWLIST,
  AI_COLOR_TOKENS,
  AI_POSITION_ANCHORS,
  type DecorationEmitContent,
} from '../schemas'
import { LUCIDE_DECORATION_ALLOWLIST } from '@/lib/render/decorations/registry'

/**
 * Phase 71 (AI-01..04): DecorationEmitSchema is the closed-enum SUBSET of the
 * full DecorationSchema that Gemini's responseSchema emits. AI is constrained
 * to NAMED COLOR TOKENS (never raw hex) + SEMANTIC POSITION ANCHORS (never
 * raw % coords) + an explicit ~100-icon PascalCase allowlist (subset of
 * Phase 69's 118-name registry). Server-side resolveAIDecoration maps tokens
 * → hex + anchors → safe-zone % coords; this layer purely enforces the AI's
 * input shape.
 */
describe('Phase 71 (AI-01..04): DecorationEmitSchema closed-enum AI emit', () => {
  it('Test 1: valid icon emit with named color token + anchor parses', () => {
    const result = DecorationEmitSchema.safeParse({
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'top-right',
    })
    expect(result.success).toBe(true)
  })

  it('Test 2: valid shape emit with palette-vibrant + center parses', () => {
    const result = DecorationEmitSchema.safeParse({
      kind: 'shape',
      shapeKind: 'rect',
      color: 'palette-vibrant',
      position: 'center',
    })
    expect(result.success).toBe(true)
  })

  it('Test 3: unknown lucideName (Phosphor naming) rejected', () => {
    const result = DecorationEmitSchema.safeParse({
      kind: 'icon',
      lucideName: 'arrow-right-circle-fill',
      color: 'accent',
      position: 'top-right',
    })
    expect(result.success).toBe(false)
  })

  it('Test 4: raw hex color rejected — only AI_COLOR_TOKENS allowed', () => {
    const result = DecorationEmitSchema.safeParse({
      kind: 'icon',
      lucideName: 'Heart',
      color: '#FF0000',
      position: 'top-right',
    })
    expect(result.success).toBe(false)
  })

  it('Test 5: raw coord position object rejected', () => {
    const result = DecorationEmitSchema.safeParse({
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: { x: 10, y: 20, width: 30, height: 40 },
    })
    expect(result.success).toBe(false)
  })

  it('Test 6: unknown anchor rejected', () => {
    const result = DecorationEmitSchema.safeParse({
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'middle-left',
    })
    expect(result.success).toBe(false)
  })

  it('Test 7: unknown shapeKind rejected', () => {
    const result = DecorationEmitSchema.safeParse({
      kind: 'shape',
      shapeKind: 'hexagon',
      color: 'accent',
      position: 'center',
    })
    expect(result.success).toBe(false)
  })

  it('Test 8: rotation optional, accepts in-range and out-of-range (clamp downstream)', () => {
    const r1 = DecorationEmitSchema.safeParse({
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'top-right',
      rotation: 45,
    })
    const r2 = DecorationEmitSchema.safeParse({
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'top-right',
      rotation: 200,
    })
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
  })

  it('Test 9: cornerRadius accepted on shape rect', () => {
    const result = DecorationEmitSchema.safeParse({
      kind: 'shape',
      shapeKind: 'rect',
      color: 'palette-vibrant',
      position: 'center',
      cornerRadius: 8,
    })
    expect(result.success).toBe(true)
  })

  it('Test 10: AI_LUCIDE_ALLOWLIST is a strict subset of LUCIDE_DECORATION_ALLOWLIST and within [80, 110] band', () => {
    const registrySet = new Set<string>(LUCIDE_DECORATION_ALLOWLIST)
    for (const name of AI_LUCIDE_ALLOWLIST) {
      expect(registrySet.has(name)).toBe(true)
    }
    expect(AI_LUCIDE_ALLOWLIST.length).toBeGreaterThanOrEqual(80)
    expect(AI_LUCIDE_ALLOWLIST.length).toBeLessThanOrEqual(110)
  })

  it('Test 11: AI_LUCIDE_ALLOWLIST contains all 10 PTF13 fixtures', () => {
    const ptf13 = ['Heart', 'Star', 'Check', 'Zap', 'ArrowRight', 'X', 'Plus', 'Crown', 'Sparkles', 'Circle']
    const aiSet = new Set<string>(AI_LUCIDE_ALLOWLIST)
    for (const name of ptf13) {
      expect(aiSet.has(name)).toBe(true)
    }
  })

  it('Test 12: DecorationEmitContent type export matches schema inferred type', () => {
    // Compile-time check: a well-typed icon-emit fixture is assignable to DecorationEmitContent
    const iconEmit: DecorationEmitContent = {
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'top-right',
    }
    const shapeEmit: DecorationEmitContent = {
      kind: 'shape',
      shapeKind: 'rect',
      color: 'palette-vibrant',
      position: 'center',
      cornerRadius: 8,
    }
    expect(iconEmit.kind).toBe('icon')
    expect(shapeEmit.kind).toBe('shape')
    // Type-level check: ensure DecorationEmitContent is the inferred z.infer of DecorationEmitSchema
    expectTypeOf<DecorationEmitContent>().toMatchTypeOf<{ kind: 'icon' | 'shape' }>()
  })

  // Sanity assertions on closed-enum constants
  it('AI_COLOR_TOKENS is exactly the 6 documented tokens', () => {
    expect([...AI_COLOR_TOKENS].sort()).toEqual(
      ['accent', 'palette-vibrant', 'palette-dark-muted', 'palette-light', 'on-light', 'on-dark'].sort(),
    )
  })

  it('AI_POSITION_ANCHORS is exactly the 7 documented anchors', () => {
    expect([...AI_POSITION_ANCHORS].sort()).toEqual(
      ['top-left', 'top-right', 'top-center', 'center', 'bottom-left', 'bottom-right', 'bottom-center'].sort(),
    )
  })
})
