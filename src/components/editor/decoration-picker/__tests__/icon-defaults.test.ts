/**
 * Phase 70 Plan 02 Task 1: buildDefaultIconDecoration factory tests.
 *
 * Shared foundation: LucidePicker (this plan) and the I keyboard shortcut
 * (Plan 70-03) both consume this factory. Round-trips through Phase 67
 * DecorationSchema.
 */
import { describe, it, expect } from 'vitest'
import {
  buildDefaultIconDecoration,
  DEFAULT_ICON_COLOR,
  DEFAULT_ICON_SIZE_PCT,
  DEFAULT_ICON_STROKE_WIDTH,
} from '../icon-defaults'
import { DecorationSchema } from '@/lib/ai/schemas'
import { LUCIDE_DECORATION_ALLOWLIST } from '@/lib/render/decorations/registry'

describe('PICKER buildDefaultIconDecoration factory', () => {
  it('Test 9: Heart default — kind=icon, brand color, default stroke-width, 12%×12% centered', () => {
    const d = buildDefaultIconDecoration('Heart')
    expect(d).not.toBeNull()
    expect(d!.kind).toBe('icon')
    expect(d!.lucideName).toBe('Heart')
    expect(d!.color).toBe(DEFAULT_ICON_COLOR)
    expect(d!.color).toBe('#3D0000')
    expect(d!.strokeWidth).toBe(DEFAULT_ICON_STROKE_WIDTH)
    expect(d!.strokeWidth).toBe(2)
    expect(d!.position.width).toBe(DEFAULT_ICON_SIZE_PCT.width)
    expect(d!.position.height).toBe(DEFAULT_ICON_SIZE_PCT.height)
    // Centered at (50, 50) → bounding box top-left = (50 - w/2, 50 - h/2)
    expect(d!.position.x).toBe(50 - DEFAULT_ICON_SIZE_PCT.width / 2)
    expect(d!.position.y).toBe(50 - DEFAULT_ICON_SIZE_PCT.height / 2)
    expect(d!.opacity).toBe(1)
    expect(d!.rotation).toBeUndefined()
  })

  it('Test 10: unknown lucideName returns null (closed-enum guard)', () => {
    expect(buildDefaultIconDecoration('NotAnIcon')).toBeNull()
    expect(buildDefaultIconDecoration('')).toBeNull()
    expect(buildDefaultIconDecoration('heart' /* lowercase != PascalCase */)).toBeNull()
  })

  it('Test 11: each call returns a fresh id (crypto.randomUUID)', () => {
    const a = buildDefaultIconDecoration('Heart')
    const b = buildDefaultIconDecoration('Heart')
    const c = buildDefaultIconDecoration('Star')
    expect(a!.id).not.toBe(b!.id)
    expect(a!.id).not.toBe(c!.id)
    expect(b!.id).not.toBe(c!.id)
    expect(a!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('Test 12a: passing center positions the bounding box around it', () => {
    const d = buildDefaultIconDecoration('Heart', { center: { x: 30, y: 70 } })
    expect(d!.position.x).toBe(30 - DEFAULT_ICON_SIZE_PCT.width / 2) // 30 - 6 = 24
    expect(d!.position.y).toBe(70 - DEFAULT_ICON_SIZE_PCT.height / 2) // 70 - 6 = 64
  })

  it('Test 12b: center near right edge clamps bounding box into [0, 100 - size]', () => {
    const right = buildDefaultIconDecoration('Heart', { center: { x: 99, y: 50 } })
    expect(right!.position.x).toBeLessThanOrEqual(100 - right!.position.width)
    expect(right!.position.x).toBeGreaterThanOrEqual(0)
  })

  it('Test 12c: center beyond canvas (negative) clamps to 0', () => {
    const left = buildDefaultIconDecoration('Heart', { center: { x: 0, y: 0 } })
    expect(left!.position.x).toBe(0)
    expect(left!.position.y).toBe(0)
  })

  it('Test 13: every default icon round-trips through DecorationSchema', () => {
    // Test a representative sample of allowlist entries (full 118 round-trip is overkill)
    const sample = ['Heart', 'Star', 'ArrowRight', 'X', 'Plus', 'Crown', 'Sparkles', 'Circle']
    for (const name of sample) {
      const d = buildDefaultIconDecoration(name)
      expect(d, `${name}: factory returned null`).not.toBeNull()
      const parsed = DecorationSchema.safeParse(d)
      expect(
        parsed.success,
        parsed.success ? '' : `${name}: ${JSON.stringify(parsed.error?.issues)}`,
      ).toBe(true)
    }
  })

  it('Test 13b: every allowlist name produces a schema-valid IconDecoration (smoke)', () => {
    // Defensive: catch any future allowlist drift that breaks schema parse
    let parsedCount = 0
    for (const name of LUCIDE_DECORATION_ALLOWLIST) {
      const d = buildDefaultIconDecoration(name)
      expect(d, `${name}: factory returned null`).not.toBeNull()
      const parsed = DecorationSchema.safeParse(d)
      expect(parsed.success, `${name}: schema parse failed`).toBe(true)
      parsedCount++
    }
    expect(parsedCount).toBe(LUCIDE_DECORATION_ALLOWLIST.length)
  })
})
