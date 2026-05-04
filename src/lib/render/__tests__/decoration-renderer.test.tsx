// Phase 69 (Plan 69-01) — decoration-renderer tests.
//
// Asserts the discriminated render-paths (icon vs shape; CSS-div shapes vs
// SVG-asset shapes), wrapper-style invariants (position/transform/opacity/
// box-shadow), and the WR-01 + TPLREND-05 contracts (opacity 0..1 direct,
// no filter / backdrop-filter / mix-blend-mode, no transform: undefined).
//
// Pattern mirrors parity tests: builds explicit Decoration fixtures, calls
// renderDecoration directly (pure function — no React tree mounting needed
// for style-object inspection), and inspects the returned React element's
// props.style + children.

import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderDecoration, type DecorationRenderCtx } from '../decoration-renderer'
import type {
  IconDecoration,
  ShapeDecoration,
  Decoration,
} from '@/lib/types/decoration'

const CTX: DecorationRenderCtx = { slideIndex: 0, totalSlides: 1 }

const baseFields = {
  position: { x: 10, y: 20, width: 30, height: 40 },
  rotation: 0,
  opacity: 1,
}

function makeIcon(over: Partial<IconDecoration> = {}): IconDecoration {
  return {
    id: 'icon-1',
    kind: 'icon',
    lucideName: 'Heart',
    color: '#FF0000',
    strokeWidth: 2,
    ...baseFields,
    ...over,
  }
}

function makeShape(over: Partial<ShapeDecoration> = {}): ShapeDecoration {
  return {
    id: 'shape-1',
    kind: 'shape',
    shapeKind: 'rect',
    fill: '#A8E0B0',
    cornerRadius: 8,
    ...baseFields,
    ...over,
  } as ShapeDecoration
}

// Helper to read the root element + style object from a renderDecoration result.
type RenderedElement = React.ReactElement<{
  style: React.CSSProperties
  children?: React.ReactNode
  'data-decoration-id'?: string
  'data-decoration-kind'?: string
  'data-shape-kind'?: string
}>

function rootOf(d: Decoration): RenderedElement | null {
  const node = renderDecoration(d, CTX)
  if (node === null) return null
  return node as RenderedElement
}

// ===========================================================================
// Icon path
// ===========================================================================

describe('renderDecoration — icon path', () => {
  it('returns null for null/empty input edge cases (defense)', () => {
    // Unknown lucideName → registry returns null → renderer returns null.
    const unknown = makeIcon({ lucideName: 'NotARealIconNameXYZ' })
    expect(renderDecoration(unknown, CTX)).toBeNull()
  })

  it('renders an absolute-positioned <div> wrapping an <img> with data:image/svg+xml', () => {
    const d = makeIcon({ color: '#FF0000', strokeWidth: 2 })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.type).toBe('div')
    expect(root!.props.style.position).toBe('absolute')

    // Child should be an <img> with a data-URI src.
    const child = React.Children.only(root!.props.children) as React.ReactElement<{
      src: string
      style: React.CSSProperties
    }>
    expect(child.type).toBe('img')
    expect(child.props.src).toMatch(/^data:image\/svg\+xml/)
    // URL-encoded hex (% then 23 then "FF0000") must appear in the data URI.
    // encodeURIComponent('#FF0000') === '%23FF0000'
    expect(child.props.src).toContain('%23FF0000')
  })

  it('emits data-decoration-id and data-decoration-kind="icon" attributes', () => {
    const d = makeIcon({ id: 'icon-abc' })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props['data-decoration-id']).toBe('icon-abc')
    expect(root!.props['data-decoration-kind']).toBe('icon')
  })

  it('all 10 PTF13 fixture icons produce non-null React elements', () => {
    const PTF13 = [
      'Heart', 'Star', 'Check', 'Zap', 'ArrowRight',
      'X', 'Plus', 'Crown', 'Sparkles', 'Circle',
    ]
    for (const name of PTF13) {
      const d = makeIcon({ lucideName: name })
      const root = rootOf(d)
      expect(root, `expected ${name} to render`).not.toBeNull()
    }
  })

  it('renderToStaticMarkup produces stable HTML for an icon decoration', () => {
    const d = makeIcon({ id: 'icon-stable', color: '#000000' })
    const node = renderDecoration(d, CTX)
    const html = renderToStaticMarkup(node as React.ReactElement)
    expect(html).toContain('data-decoration-id="icon-stable"')
    expect(html).toContain('data-decoration-kind="icon"')
    expect(html).toContain('data:image/svg+xml')
    // Static markup must NOT contain currentColor (substituted) or filter:.
    expect(html).not.toContain('currentColor')
    expect(html).not.toMatch(/filter\s*:/)
  })
})

// ===========================================================================
// Shape — CSS-div path (rect / circle / ellipse)
// ===========================================================================

describe('renderDecoration — shape (CSS-div) path', () => {
  it('rect: <div> with borderRadius from cornerRadius, background = fill, NO <img>', () => {
    const d = makeShape({ shapeKind: 'rect', fill: '#A8E0B0', cornerRadius: 12 })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.type).toBe('div')
    expect(root!.props.style.background).toBe('#A8E0B0')
    expect(root!.props.style.borderRadius).toBe('12px')
    // CSS-div path must not contain a child <img> or inline <svg>.
    expect(root!.props.children).toBeFalsy()
  })

  it('rect with no cornerRadius defaults to 0px', () => {
    const d = makeShape({ shapeKind: 'rect', fill: '#A8E0B0', cornerRadius: undefined })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.borderRadius).toBe('0px')
  })

  it('rect with stroke applies a CSS border shorthand', () => {
    const d = makeShape({
      shapeKind: 'rect',
      fill: '#A8E0B0',
      stroke: { color: '#000000', width: 3, style: 'dashed' },
    })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.border).toBe('3px dashed #000000')
  })

  it('circle: <div> with borderRadius "50%", NO <img>', () => {
    const d = makeShape({ shapeKind: 'circle', fill: '#FF00FF' })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.borderRadius).toBe('50%')
    expect(root!.props.style.background).toBe('#FF00FF')
    expect(root!.props.children).toBeFalsy()
  })

  it('ellipse: <div> with borderRadius "50%", NO <img>', () => {
    const d = makeShape({ shapeKind: 'ellipse', fill: '#0000FF' })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.borderRadius).toBe('50%')
    expect(root!.props.children).toBeFalsy()
  })

  it('emits data-decoration-kind="shape" and data-shape-kind for CSS-div shapes', () => {
    const d = makeShape({ shapeKind: 'circle' })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props['data-decoration-kind']).toBe('shape')
    expect(root!.props['data-shape-kind']).toBe('circle')
  })
})

// ===========================================================================
// Shape — SVG-asset path (triangle / polygon / star / arrow / line)
// ===========================================================================

describe('renderDecoration — shape (SVG-asset) path', () => {
  it('triangle: <div> wrapping <img src="/shapes/triangle.svg">', () => {
    const d = makeShape({ shapeKind: 'triangle', fill: '#FF0000' })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.type).toBe('div')
    const child = React.Children.only(root!.props.children) as React.ReactElement<{ src: string }>
    expect(child.type).toBe('img')
    expect(child.props.src).toBe('/shapes/triangle.svg')
  })

  it('polygon defaults to /shapes/polygon-5.svg when points undefined', () => {
    const d = makeShape({ shapeKind: 'polygon', fill: '#000' })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    const child = React.Children.only(root!.props.children) as React.ReactElement<{ src: string }>
    expect(child.props.src).toBe('/shapes/polygon-5.svg')
  })

  it('polygon with points=6 → /shapes/polygon-6.svg', () => {
    const d = makeShape({ shapeKind: 'polygon', points: 6 })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    const child = React.Children.only(root!.props.children) as React.ReactElement<{ src: string }>
    expect(child.props.src).toBe('/shapes/polygon-6.svg')
  })

  it('star defaults to /shapes/star-5.svg', () => {
    const d = makeShape({ shapeKind: 'star' })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    const child = React.Children.only(root!.props.children) as React.ReactElement<{ src: string }>
    expect(child.props.src).toBe('/shapes/star-5.svg')
  })

  it('arrow → /shapes/arrow.svg; line → /shapes/line.svg', () => {
    const arrow = rootOf(makeShape({ shapeKind: 'arrow' }))
    const line = rootOf(makeShape({ shapeKind: 'line' }))
    const arrowChild = React.Children.only((arrow as RenderedElement).props.children) as React.ReactElement<{ src: string }>
    const lineChild = React.Children.only((line as RenderedElement).props.children) as React.ReactElement<{ src: string }>
    expect(arrowChild.props.src).toBe('/shapes/arrow.svg')
    expect(lineChild.props.src).toBe('/shapes/line.svg')
  })

  it('SVG-asset path emits CSS color cascade (style.color = fill) for currentColor SVGs', () => {
    const d = makeShape({ shapeKind: 'triangle', fill: '#FF00AA' })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.color).toBe('#FF00AA')
  })
})

// ===========================================================================
// Wrapper-style invariants — position / transform / opacity / shadow
// ===========================================================================

describe('renderDecoration — wrapper style invariants', () => {
  it('position translates to %-based left/top/width/height', () => {
    const d = makeIcon({ position: { x: 10, y: 20, width: 30, height: 40 } })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.left).toBe('10%')
    expect(root!.props.style.top).toBe('20%')
    expect(root!.props.style.width).toBe('30%')
    expect(root!.props.style.height).toBe('40%')
  })

  it('rotation: 45 → style.transform === "rotate(45deg)"', () => {
    const d = makeIcon({ rotation: 45 })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.transform).toBe('rotate(45deg)')
  })

  it('rotation undefined → style.transform key is absent (Satori transform: undefined throws)', () => {
    const d = makeIcon({ rotation: undefined })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect('transform' in root!.props.style).toBe(false)
  })

  it('rotation: 0 → style.transform key is absent', () => {
    const d = makeIcon({ rotation: 0 })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect('transform' in root!.props.style).toBe(false)
  })

  it('opacity: 0.5 → style.opacity === 0.5 (NOT divided by 100 — WR-01)', () => {
    const d = makeIcon({ opacity: 0.5 })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.opacity).toBe(0.5)
  })

  it('opacity undefined → style.opacity === 1 (default)', () => {
    const d = makeIcon({ opacity: undefined })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(root!.props.style.opacity).toBe(1)
  })

  it('shadow enabled: style.boxShadow contains the color hex; filter / backdropFilter NEVER set', () => {
    const d = makeIcon({
      effects: { shadow: { enabled: true, color: '#00000080', size: 'md' } },
    })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect(typeof root!.props.style.boxShadow).toBe('string')
    expect(root!.props.style.boxShadow!).toContain('#00000080')
    expect('filter' in root!.props.style).toBe(false)
    expect('backdropFilter' in root!.props.style).toBe(false)
    expect('mixBlendMode' in root!.props.style).toBe(false)
  })

  it('shadow size sm/md/lg map to distinct box-shadow values', () => {
    const sm = rootOf(makeIcon({ effects: { shadow: { enabled: true, color: '#000', size: 'sm' } } }))
    const md = rootOf(makeIcon({ effects: { shadow: { enabled: true, color: '#000', size: 'md' } } }))
    const lg = rootOf(makeIcon({ effects: { shadow: { enabled: true, color: '#000', size: 'lg' } } }))
    expect(sm!.props.style.boxShadow).not.toEqual(md!.props.style.boxShadow)
    expect(md!.props.style.boxShadow).not.toEqual(lg!.props.style.boxShadow)
  })

  it('shadow disabled: style.boxShadow is undefined (key absent)', () => {
    const d = makeIcon({ effects: { shadow: { enabled: false, color: '#000', size: 'md' } } })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect('boxShadow' in root!.props.style).toBe(false)
  })

  it('effects undefined: no boxShadow, no filter', () => {
    const d = makeIcon({ effects: undefined })
    const root = rootOf(d)
    expect(root).not.toBeNull()
    expect('boxShadow' in root!.props.style).toBe(false)
    expect('filter' in root!.props.style).toBe(false)
  })

  it('hidden=true renders normally — visibility filtering is the caller’s job', () => {
    // Renderer is pure: callers (slide-preview / render-slide-satori) filter
    // hidden decorations BEFORE calling renderDecoration. The renderer itself
    // does not skip on `hidden` (this matches v2.9 overlay pattern).
    const d = makeIcon({ hidden: true })
    const root = rootOf(d)
    expect(root).not.toBeNull()
  })

  it('locked=true renders normally — locked is an editor-only guard', () => {
    const d = makeIcon({ locked: true })
    const root = rootOf(d)
    expect(root).not.toBeNull()
  })

  it('all 8 shapeKinds produce a non-null React element (smoke)', () => {
    const kinds: ShapeDecoration['shapeKind'][] = [
      'rect', 'circle', 'ellipse', 'triangle', 'polygon', 'star', 'arrow', 'line',
    ]
    for (const k of kinds) {
      const d = makeShape({ shapeKind: k })
      const root = rootOf(d)
      expect(root, `${k} returned null`).not.toBeNull()
    }
  })
})

// ===========================================================================
// Purity — no React hooks, no DOM access; calling twice returns equivalent trees
// ===========================================================================

describe('renderDecoration — purity', () => {
  it('produces equivalent markup on repeat calls (deterministic)', () => {
    const d = makeIcon({ id: 'icon-pure' })
    const a = renderToStaticMarkup(renderDecoration(d, CTX) as React.ReactElement)
    const b = renderToStaticMarkup(renderDecoration(d, CTX) as React.ReactElement)
    expect(a).toBe(b)
  })

  it('does not throw when called with arbitrary RenderCtx', () => {
    const d = makeIcon()
    expect(() => renderDecoration(d, {})).not.toThrow()
    expect(() => renderDecoration(d, { slideIndex: 5, totalSlides: 10 })).not.toThrow()
  })
})
