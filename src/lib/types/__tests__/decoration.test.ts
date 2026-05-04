import { describe, it, expect } from 'vitest'
import type {
  Decoration,
  IconDecoration,
  ShapeDecoration,
  ShapeKind,
} from '../decoration'
import type { Slide } from '../slide'

describe('Phase 67 (DECOR-01..04): Decoration discriminated union types', () => {
  it('Test 1: IconDecoration literal compiles and assigns to Decoration', () => {
    const iconDec: Decoration = {
      kind: 'icon',
      id: 'd1',
      position: { x: 10, y: 20, width: 15, height: 15 },
      lucideName: 'Heart',
      color: '#FF0000',
      strokeWidth: 2,
    }
    expect(iconDec.kind).toBe('icon')
  })

  it('Test 2: ShapeDecoration literal compiles and assigns to Decoration', () => {
    const shapeDec: Decoration = {
      kind: 'shape',
      id: 'd2',
      position: { x: 30, y: 30, width: 20, height: 20 },
      shapeKind: 'rect',
      fill: '#00FF00',
      stroke: { color: '#000000', width: 2, style: 'solid' },
      cornerRadius: 8,
    }
    expect(shapeDec.kind).toBe('shape')
  })

  it('Test 3: Slide accepts decorations array of mixed kinds', () => {
    const iconDec: IconDecoration = {
      kind: 'icon',
      id: 'd1',
      position: { x: 10, y: 20, width: 15, height: 15 },
      lucideName: 'Heart',
      color: '#FF0000',
      strokeWidth: 2,
    }
    const shapeDec: ShapeDecoration = {
      kind: 'shape',
      id: 'd2',
      position: { x: 30, y: 30, width: 20, height: 20 },
      shapeKind: 'circle',
      fill: '#0000FF',
    }
    const s: Slide = {
      hook_text: '',
      body_text: '',
      image_query: '',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      decorations: [iconDec, shapeDec],
    }
    expect(s.decorations).toHaveLength(2)
  })

  it('Test 4: Slide compiles with decorations omitted entirely (optional)', () => {
    const s: Slide = {
      hook_text: '',
      body_text: '',
      image_query: '',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
    }
    expect(s.decorations).toBeUndefined()
  })

  it('Test 5: Discriminated-union narrowing typechecks without casts', () => {
    function describeKind(d: Decoration): string {
      if (d.kind === 'icon') return d.lucideName
      return d.shapeKind
    }
    expect(
      describeKind({
        kind: 'icon',
        id: 'd1',
        position: { x: 0, y: 0, width: 10, height: 10 },
        lucideName: 'Star',
        color: '#000000',
        strokeWidth: 1,
      }),
    ).toBe('Star')
    expect(
      describeKind({
        kind: 'shape',
        id: 'd2',
        position: { x: 0, y: 0, width: 10, height: 10 },
        shapeKind: 'triangle',
        fill: '#FFFFFF',
      } satisfies ShapeDecoration),
    ).toBe('triangle')
  })

  it('Test 6: ShapeKind union covers all 8 declared primitives', () => {
    const kinds: ShapeKind[] = [
      'rect',
      'circle',
      'ellipse',
      'triangle',
      'polygon',
      'star',
      'arrow',
      'line',
    ]
    expect(kinds).toHaveLength(8)
  })
})
