// Phase 76 Plan 02 (PREVIEW-04):
// LayoutSketch SVG schematic tests.
//
// 6 tests pin: SVG aspect ratio (9:16), hook position rect placement, body
// density line counts, decoration density icon counts, graceful-degradation
// frame-only fallback, and a11y aria-label for the SVG region.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LayoutSketch } from '../layout-sketch'

describe('Phase 76 Plan 02: LayoutSketch (PREVIEW-04)', () => {
  it('Test 1: renders an SVG with viewBox matching 9:16 aspect (90:160)', () => {
    const { container } = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'medium' }} decorationsDensity="sparse" />,
    )
    const svg = container.querySelector('svg[data-testid="layout-sketch-svg"]') as SVGElement | null
    expect(svg).toBeTruthy()
    const vb = svg?.getAttribute('viewBox') ?? ''
    expect(vb).toBe('0 0 90 160')
  })

  it('Test 2: hookPosition changes the y-coordinate of the hook rect (top vs center vs bottom)', () => {
    const top = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'medium' }} decorationsDensity="sparse" />,
    )
    const center = render(
      <LayoutSketch layout={{ hookPosition: 'center', density: 'medium' }} decorationsDensity="sparse" />,
    )
    const bottom = render(
      <LayoutSketch layout={{ hookPosition: 'bottom', density: 'medium' }} decorationsDensity="sparse" />,
    )
    const yOf = (rendered: ReturnType<typeof render>): number => {
      const rect = rendered.container.querySelector('[data-testid="hook-rect"]') as SVGRectElement | null
      expect(rect).toBeTruthy()
      return Number(rect!.getAttribute('y'))
    }
    const yTop = yOf(top)
    const yCenter = yOf(center)
    const yBottom = yOf(bottom)
    // Top must be < center must be < bottom
    expect(yTop).toBeLessThan(yCenter)
    expect(yCenter).toBeLessThan(yBottom)
    // Sanity-check the bands
    expect(yTop).toBeLessThanOrEqual(40)
    expect(yCenter).toBeGreaterThanOrEqual(60)
    expect(yCenter).toBeLessThanOrEqual(90)
    expect(yBottom).toBeGreaterThanOrEqual(110)
  })

  it('Test 3: layout.density controls body line count — tight=5, medium=3, airy=1', () => {
    const tight = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'tight' }} decorationsDensity="sparse" />,
    )
    const medium = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'medium' }} decorationsDensity="sparse" />,
    )
    const airy = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'airy' }} decorationsDensity="sparse" />,
    )
    const countLines = (rendered: ReturnType<typeof render>): number =>
      rendered.container.querySelectorAll('[data-testid="body-line"]').length
    expect(countLines(tight)).toBe(5)
    expect(countLines(medium)).toBe(3)
    expect(countLines(airy)).toBe(1)
  })

  it('Test 4: decorations density controls icon-circle count — dense=4, moderate=2, sparse=0', () => {
    const dense = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'medium' }} decorationsDensity="dense" />,
    )
    const moderate = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'medium' }} decorationsDensity="moderate" />,
    )
    const sparse = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'medium' }} decorationsDensity="sparse" />,
    )
    const count = (rendered: ReturnType<typeof render>): number =>
      rendered.container.querySelectorAll('[data-testid="decoration-icon"]').length
    expect(count(dense)).toBe(4)
    expect(count(moderate)).toBe(2)
    expect(count(sparse)).toBe(0)
  })

  it('Test 5: when layout fields all undefined, renders the 9:16 frame outline only — no rects/lines/icons', () => {
    const { container } = render(
      <LayoutSketch layout={{}} decorationsDensity={undefined} />,
    )
    expect(container.querySelector('svg[data-testid="layout-sketch-svg"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="hook-rect"]')).toBeNull()
    expect(container.querySelectorAll('[data-testid="body-line"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="decoration-icon"]')).toHaveLength(0)
    // Frame outline rect must still exist
    expect(container.querySelector('[data-testid="frame-outline"]')).toBeTruthy()
  })

  it('Test 6: SVG has aria-label="Layout sketch — schematic preview" for screen readers', () => {
    const { container } = render(
      <LayoutSketch layout={{ hookPosition: 'top', density: 'medium' }} decorationsDensity="sparse" />,
    )
    const svg = container.querySelector('svg[data-testid="layout-sketch-svg"]') as SVGElement | null
    expect(svg?.getAttribute('aria-label')).toBe('Layout sketch — schematic preview')
    expect(svg?.getAttribute('role')).toBe('img')
  })
})
