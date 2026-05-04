// Phase 69 Plan 02: integration smoke tests for decoration-renderer.tsx
// wired into BOTH render paths (Satori + React preview).
//
// COVERAGE:
//   - SlidePreview editable={false} renders icon + shape decorations with
//     `data-decoration-id` + `data-decoration-kind` markers.
//   - buildSlideElement → renderToStaticMarkup emits the SAME data-attributes
//     (TPLREND-05 — both renderers route through `decoration-renderer.tsx`).
//   - Hidden decorations are filtered out at the iteration site.
//   - Undefined / empty `slide.decorations` emits ZERO decoration DOM nodes
//     (PTF16 byte-identity gate preserved).
//   - Triangle shape (SVG-asset path) emits `<img src="/shapes/triangle.svg">`
//     in BOTH renderers.
//   - Cross-renderer parity smoke: identical decoration-id set + ordering
//     produced by both render paths.
//
// NOT COVERED HERE (intentionally — Plan 69-03 owns these):
//   - Full byte-identity fingerprint snapshots (PTF13 / PTF14 / PTF18).
//   - PCL12 / PCL13 grep gates.
//
// Picks `templates[0]` (highlight-bar — first registered template; verified
// against the registry sanity floor in parity.template-fingerprint.test.tsx).

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { templates } from '@/lib/render/templates'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { SlidePreview } from '@/components/slides/slide-preview'
import {
  fingerprintFixtureSlide,
  computeStructuralFingerprint,
} from './__fixtures__/parity-fingerprint-fixtures'
import type { Decoration, IconDecoration, ShapeDecoration } from '@/lib/types/decoration'
import type { Slide } from '@/lib/types/slide'

// =====================================================================
// Fixture decorations
// =====================================================================

const iconDeco: IconDecoration = {
  kind: 'icon',
  id: 'deco-icon-1',
  lucideName: 'Heart',
  color: '#FF0000',
  strokeWidth: 2,
  position: { x: 10, y: 10, width: 10, height: 10 },
}

const rectDeco: ShapeDecoration = {
  kind: 'shape',
  id: 'deco-shape-1',
  shapeKind: 'rect',
  fill: '#00FF00',
  cornerRadius: 8,
  position: { x: 30, y: 30, width: 20, height: 20 },
}

const triangleDeco: ShapeDecoration = {
  kind: 'shape',
  id: 'deco-shape-2',
  shapeKind: 'triangle',
  fill: '#0000FF',
  position: { x: 50, y: 50, width: 15, height: 15 },
}

const hiddenDeco: ShapeDecoration = {
  kind: 'shape',
  id: 'deco-shape-hidden',
  shapeKind: 'rect',
  fill: '#FFFFFF',
  position: { x: 70, y: 70, width: 10, height: 10 },
  hidden: true,
}

const rotatedDeco: IconDecoration = {
  kind: 'icon',
  id: 'deco-icon-rotated',
  lucideName: 'Star',
  color: '#FFAA00',
  strokeWidth: 2,
  rotation: 45,
  position: { x: 60, y: 20, width: 10, height: 10 },
}

const lockedDeco: ShapeDecoration = {
  kind: 'shape',
  id: 'deco-shape-locked',
  shapeKind: 'rect',
  fill: '#888888',
  position: { x: 80, y: 80, width: 10, height: 10 },
  locked: true,
}

// Use templates[0] as the canonical fixture template — same convention as
// parity.template-fingerprint.test.tsx. Documented as a stable choice (idx 0
// is the first registered template; v2.11 = highlight-bar).
const TEMPLATE = templates[0]

function makeSlide(decorations?: Decoration[]): Slide {
  return {
    ...fingerprintFixtureSlide,
    template_id_override: TEMPLATE.id,
    decorations,
  }
}

function renderViaPreview(slide: Slide): string {
  const { container } = render(
    <SlidePreview
      slide={slide}
      template={TEMPLATE}
      index={0}
      editable={false}
    />,
  )
  return container.innerHTML
}

function renderViaSatori(slide: Slide): string {
  return renderToStaticMarkup(buildSlideElement(slide, TEMPLATE))
}

// =====================================================================
// Tests
// =====================================================================

describe('Phase 69 Plan 02 (DECOR-INT): both renderers consume renderDecoration', () => {
  it('1. SlidePreview path renders icon + shape decorations with data-decoration-id markers', () => {
    const slide = makeSlide([iconDeco, rectDeco])
    const html = renderViaPreview(slide)
    expect(html).toContain('data-decoration-id="deco-icon-1"')
    expect(html).toContain('data-decoration-id="deco-shape-1"')
    expect(html).toContain('data-decoration-kind="icon"')
    expect(html).toContain('data-decoration-kind="shape"')
  })

  it('2. Satori path renders icon + shape decorations with the same data-decoration-id markers', () => {
    const slide = makeSlide([iconDeco, rectDeco])
    const html = renderViaSatori(slide)
    expect(html).toContain('data-decoration-id="deco-icon-1"')
    expect(html).toContain('data-decoration-id="deco-shape-1"')
    expect(html).toContain('data-decoration-kind="icon"')
    expect(html).toContain('data-decoration-kind="shape"')
  })

  it('3. SlidePreview path emits #00FF00 fill for rect shape (CSS-div path)', () => {
    const slide = makeSlide([rectDeco])
    const html = renderViaPreview(slide)
    // rectDeco uses CSS-div path — fill is the wrapper's `background` style.
    // jsdom normalizes #00FF00 → rgb(0, 255, 0); both forms are equivalent.
    // We accept either rendering since the renderer emits the literal hex
    // and jsdom round-trips through CSSStyleDeclaration. Satori
    // (renderToStaticMarkup, not jsdom-backed) preserves the literal hex.
    expect(html).toMatch(/#00ff00|#00FF00|rgb\(0,\s*255,\s*0\)/)
    expect(html).toContain('data-shape-kind="rect"')
  })

  it('4. Satori path emits #00FF00 fill for rect shape (CSS-div path)', () => {
    const slide = makeSlide([rectDeco])
    const html = renderViaSatori(slide)
    // Satori path goes through renderToStaticMarkup which preserves the literal
    // hex (no jsdom CSSStyleDeclaration normalization).
    expect(html.toLowerCase()).toContain('#00ff00')
    expect(html).toContain('data-shape-kind="rect"')
  })

  it('5. Triangle shape renders <img src="/shapes/triangle.svg"> in BOTH renderers (SVG-asset path)', () => {
    const slide = makeSlide([triangleDeco])
    const previewHtml = renderViaPreview(slide)
    const satoriHtml = renderViaSatori(slide)
    expect(previewHtml).toContain('/shapes/triangle.svg')
    expect(satoriHtml).toContain('/shapes/triangle.svg')
    expect(previewHtml).toContain('data-shape-kind="triangle"')
    expect(satoriHtml).toContain('data-shape-kind="triangle"')
  })

  it('6. Rotated decoration renders without throwing (rotation=45 → CSS transform)', () => {
    const slide = makeSlide([rotatedDeco])
    expect(() => renderViaPreview(slide)).not.toThrow()
    expect(() => renderViaSatori(slide)).not.toThrow()
    const previewHtml = renderViaPreview(slide)
    const satoriHtml = renderViaSatori(slide)
    // CSS rotate emitted on wrapper — both renderers must produce data-decoration-id
    // even though the JSX style attribute encodes transform differently per renderer.
    expect(previewHtml).toContain('data-decoration-id="deco-icon-rotated"')
    expect(satoriHtml).toContain('data-decoration-id="deco-icon-rotated"')
  })

  it('7. Locked decoration still renders (rendering ignores `locked` — editor-only flag)', () => {
    const slide = makeSlide([lockedDeco])
    const previewHtml = renderViaPreview(slide)
    const satoriHtml = renderViaSatori(slide)
    expect(previewHtml).toContain('data-decoration-id="deco-shape-locked"')
    expect(satoriHtml).toContain('data-decoration-id="deco-shape-locked"')
  })

  it('8. Hidden decoration is absent from output (filter d.hidden !== true at iteration site)', () => {
    const slide = makeSlide([iconDeco, hiddenDeco])
    const previewHtml = renderViaPreview(slide)
    const satoriHtml = renderViaSatori(slide)
    // Visible icon present
    expect(previewHtml).toContain('data-decoration-id="deco-icon-1"')
    expect(satoriHtml).toContain('data-decoration-id="deco-icon-1"')
    // Hidden shape ABSENT
    expect(previewHtml).not.toContain('data-decoration-id="deco-shape-hidden"')
    expect(satoriHtml).not.toContain('data-decoration-id="deco-shape-hidden"')
  })

  it('9. Undefined decorations → ZERO decoration DOM nodes in BOTH renderers (PTF16 invariant)', () => {
    const slide = makeSlide(undefined)
    const previewHtml = renderViaPreview(slide)
    const satoriHtml = renderViaSatori(slide)
    expect(previewHtml).not.toContain('data-decoration-id')
    expect(satoriHtml).not.toContain('data-decoration-id')
  })

  it('10. Empty decorations array → ZERO decoration DOM nodes in BOTH renderers', () => {
    const slide = makeSlide([])
    const previewHtml = renderViaPreview(slide)
    const satoriHtml = renderViaSatori(slide)
    expect(previewHtml).not.toContain('data-decoration-id')
    expect(satoriHtml).not.toContain('data-decoration-id')
  })

  it('11. Cross-renderer parity smoke: both renderers emit the SAME decoration-id set in the SAME order', () => {
    const slide = makeSlide([iconDeco, rectDeco, triangleDeco])
    const previewHtml = renderViaPreview(slide)
    const satoriHtml = renderViaSatori(slide)

    // Extract decoration ids in DOM order from each renderer.
    const idRegex = /data-decoration-id="([^"]+)"/g
    const previewIds = Array.from(previewHtml.matchAll(idRegex)).map((m) => m[1])
    const satoriIds = Array.from(satoriHtml.matchAll(idRegex)).map((m) => m[1])

    expect(previewIds).toEqual(['deco-icon-1', 'deco-shape-1', 'deco-shape-2'])
    expect(satoriIds).toEqual(['deco-icon-1', 'deco-shape-1', 'deco-shape-2'])
    // Both renderers emit the same ordering (TPLREND-05 prerequisite).
    expect(previewIds).toEqual(satoriIds)
  })

  it('12. Hidden-count parity: count of data-decoration-id === count of non-hidden decorations', () => {
    const slide = makeSlide([iconDeco, hiddenDeco, rectDeco, hiddenDeco])
    const previewHtml = renderViaPreview(slide)
    const satoriHtml = renderViaSatori(slide)
    const previewCount = (previewHtml.match(/data-decoration-id=/g) ?? []).length
    const satoriCount = (satoriHtml.match(/data-decoration-id=/g) ?? []).length
    // 4 total, 2 hidden → 2 visible
    expect(previewCount).toBe(2)
    expect(satoriCount).toBe(2)
  })

  it('13. Cross-renderer normalized fingerprints contain the same decoration-id set', () => {
    const slide = makeSlide([iconDeco, rectDeco])
    const previewFp = computeStructuralFingerprint(renderViaPreview(slide))
    const satoriFp = computeStructuralFingerprint(renderViaSatori(slide))
    // Both fingerprints reference both decoration ids — full byte-identity
    // is Plan 69-03's job (PTF13 / PTF14). Smoke level: both ids appear in both.
    expect(previewFp).toContain('deco-icon-1')
    expect(previewFp).toContain('deco-shape-1')
    expect(satoriFp).toContain('deco-icon-1')
    expect(satoriFp).toContain('deco-shape-1')
  })
})
