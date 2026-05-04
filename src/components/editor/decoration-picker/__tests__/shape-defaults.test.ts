/**
 * SHAPES-01 (Phase 70 Plan 01 Task 3): buildDefaultShapeDecoration factory tests.
 *
 * Shared foundation: ShapePicker (this plan) and R/C/L direct-insert (Plan 70-03)
 * both consume this factory. Round-trips through Phase 67 DecorationSchema.
 */
import { describe, it, expect } from 'vitest'
import {
  buildDefaultShapeDecoration,
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_SIZE_PCT,
} from '../shape-defaults'
import { DecorationSchema } from '@/lib/ai/schemas'

describe('SHAPES-01 buildDefaultShapeDecoration factory', () => {
  it('Test 1: rect default — centered 20%×20%, opacity 1, no stroke, brand fill', () => {
    const d = buildDefaultShapeDecoration('rect')
    expect(d.kind).toBe('shape')
    expect(d.shapeKind).toBe('rect')
    expect(d.fill).toBe(DEFAULT_SHAPE_FILL)
    expect(d.opacity).toBe(1)
    expect(d.stroke).toBeUndefined()
    expect(d.position.width).toBe(DEFAULT_SHAPE_SIZE_PCT.width)
    expect(d.position.height).toBe(DEFAULT_SHAPE_SIZE_PCT.height)
    expect(d.position.x).toBe(50 - DEFAULT_SHAPE_SIZE_PCT.width / 2)
    expect(d.position.y).toBe(50 - DEFAULT_SHAPE_SIZE_PCT.height / 2)
    expect(d.cornerRadius).toBe(0)
    expect(d.rotation).toBeUndefined()
  })

  it('Test 2: circle default — 20%×20% size at center', () => {
    const d = buildDefaultShapeDecoration('circle')
    expect(d.shapeKind).toBe('circle')
    expect(d.position.width).toBe(20)
    expect(d.position.height).toBe(20)
    expect(d.points).toBeUndefined()
  })

  it('Test 3a: polygon default — points=5', () => {
    const d = buildDefaultShapeDecoration('polygon')
    expect(d.shapeKind).toBe('polygon')
    expect(d.points).toBe(5)
  })

  it('Test 3b: star default — points=5', () => {
    const d = buildDefaultShapeDecoration('star')
    expect(d.shapeKind).toBe('star')
    expect(d.points).toBe(5)
  })

  it('Test 3c: triangle default — no points (closed shape; renderer ignores)', () => {
    const d = buildDefaultShapeDecoration('triangle')
    expect(d.shapeKind).toBe('triangle')
    expect(d.points).toBeUndefined()
  })

  it('Test 4: line default — narrow 30%×4% bounding box (PITFALLS I.1: non-zero box)', () => {
    const d = buildDefaultShapeDecoration('line')
    expect(d.shapeKind).toBe('line')
    expect(d.position.width).toBe(30)
    expect(d.position.height).toBe(4)
    expect(d.position.height).toBeGreaterThan(0)
  })

  it('Test 5: each call returns a fresh id (crypto.randomUUID)', () => {
    const a = buildDefaultShapeDecoration('rect')
    const b = buildDefaultShapeDecoration('rect')
    const c = buildDefaultShapeDecoration('circle')
    expect(a.id).not.toBe(b.id)
    expect(a.id).not.toBe(c.id)
    expect(b.id).not.toBe(c.id)
    // UUID v4 shape: 36 chars total, with 4 dashes
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('Test 6a: passing center positions the bounding box around it', () => {
    const d = buildDefaultShapeDecoration('rect', { center: { x: 30, y: 70 } })
    expect(d.position.x).toBe(30 - 20 / 2) // 20
    expect(d.position.y).toBe(70 - 20 / 2) // 60
  })

  it('Test 6b: center near canvas edge clamps the bounding box into [0, 100 - size]', () => {
    // Far right edge — bounding box would overflow, must clamp.
    const right = buildDefaultShapeDecoration('rect', { center: { x: 95, y: 50 } })
    expect(right.position.x).toBeLessThanOrEqual(100 - right.position.width)
    expect(right.position.x).toBeGreaterThanOrEqual(0)

    // Far left — bounding box would have negative x, must clamp to 0.
    const left = buildDefaultShapeDecoration('rect', { center: { x: 0, y: 0 } })
    expect(left.position.x).toBe(0)
    expect(left.position.y).toBe(0)
  })

  it('Test 6c: line center clamps with the line-specific narrow box', () => {
    const d = buildDefaultShapeDecoration('line', { center: { x: 50, y: 50 } })
    expect(d.position.width).toBe(30)
    expect(d.position.x).toBe(50 - 30 / 2) // 35
    expect(d.position.y).toBe(50 - 4 / 2) // 48
  })

  it('Test 7: every default decoration round-trips through DecorationSchema', () => {
    const kinds = [
      'rect',
      'circle',
      'ellipse',
      'triangle',
      'polygon',
      'star',
      'arrow',
      'line',
    ] as const
    for (const k of kinds) {
      const d = buildDefaultShapeDecoration(k)
      const parsed = DecorationSchema.safeParse(d)
      expect(
        parsed.success,
        parsed.success ? '' : `${k}: ${JSON.stringify(parsed.error?.issues)}`,
      ).toBe(true)
    }
  })

  it('Test 8: passing points override threads through (manifest hexagon/octagon path)', () => {
    const hex = buildDefaultShapeDecoration('polygon', { points: 6 })
    expect(hex.points).toBe(6)
    const oct = buildDefaultShapeDecoration('polygon', { points: 8 })
    expect(oct.points).toBe(8)
    const star6 = buildDefaultShapeDecoration('star', { points: 6 })
    expect(star6.points).toBe(6)
  })
})
