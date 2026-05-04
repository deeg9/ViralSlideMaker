// Phase 72 Plan 03 (PARITY-08 / PTF15): rotated-decoration parity fingerprint.
//
// PTF15 closes the LAST open v2.12 byte-identity gate — proves that a
// ROTATED decoration (CSS transform: rotate(<angle>deg) applied by
// decoration-renderer.tsx per Phase 69 RENDER-07) renders byte-identical
// between Satori PNG export (`buildSlideElement` → `renderToStaticMarkup`)
// and React DOM preview (`<SlidePreview />` → container.innerHTML), at the
// decoration-slice level.
//
// Every PTF15 test asserts BOTH:
//   1. expect(decoSlice(preview)).toBe(decoSlice(satori))  ← byte-identity equiv
//   2. expect(decoSlice(preview)).toMatchSnapshot()        ← committed baseline pin
//
// (Mirror of the PTF13/14/17/18 cross-renderer + snapshot defense-in-depth
// pattern; see parity.template-fingerprint-decorations.test.tsx file header
// for the full SCOPE rationale on why decoration-slice and not whole-slide.)
//
// PARITY-08 contract: a 45°-rotated arrow ShapeDecoration must produce
// identical rendered HTML across both renderers. Phase 69 RENDER-07 already
// emits CSS `transform: rotate(<n>deg)` on the wrapping <div> when
// `rotation` is set AND non-zero. Phase 72 Plans 72-01 (rotation-aware AABB
// reducer) and 72-02 (interactive handle UI) do NOT touch the renderer —
// they only add reducer + handle UI. So PTF15 is a verification test
// against the existing renderer behavior; if the test FAILS, the renderer
// has a regression to investigate.
//
// Test fixture coverage (7 tests):
//   - Test 1 (PTF15-arrow-45):    PRIMARY — 45°-rotated arrow byte-identical
//   - Test 2 (PTF15-arrow-30):    30°-rotated arrow (defense-in-depth at non-canonical angle)
//   - Test 3 (PTF15-arrow-90):    90°-rotated arrow (canonical right-angle case)
//   - Test 4 (PTF15-arrow-neg45): -45°-rotated arrow (negative angle case)
//   - Test 5 (PTF15-arrow-180):   180°-rotated arrow (180° symmetry case)
//   - Test 6 (PTF15-arrow-0):     rotation=0 arrow (sanity — already covered by
//                                  PTF14 but pinned here for self-contained file
//                                  to confirm the "transform omitted" branch)
//   - Test 7 (stability):          re-runs all snapshots through fingerprintBoth
//                                  twice and confirms the second run is byte-
//                                  identical to the first (CSS serialization is
//                                  deterministic across consecutive renders).
//
// Edge cases watched for:
//   - CSS property ordering in inline style strings: if Satori orders style
//     props differently from React DOM, the byte-identity check fails. Fix
//     would be normalizing serialization in decoration-renderer.tsx — that's
//     a Phase 69 reopen. Document in SUMMARY if observed; do NOT silently
//     work around with regex stripping (defeats the byte-identity invariant).
//   - Floating-point rotation serialization: 45.0 vs 45 — renderer uses
//     `${rotation}deg` (template literal) consistently; integer values stay
//     as integers, which is what the test fixtures use.
//
// Runtime PTF labels for verify-gate grep:
//   PTF15-arrow-45, PTF15-arrow-30, PTF15-arrow-90,
//   PTF15-arrow-neg45, PTF15-arrow-180, PTF15-arrow-0,
//   PTF15-stability

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
import type { Slide } from '@/lib/types/slide'
import type { ShapeDecoration } from '@/lib/types/decoration'

// Use templates[0] for determinism — same template as PTF13/14/17/18 so the
// diff focuses on the decoration layer (specifically the rotation transform).
const TEMPLATE = templates[0]

/**
 * Extract the decoration subtree (`<div data-decoration-id="..." ...>...</div>`)
 * from a full slide HTML output. Copy of the PTF13/14/17/18 helper —
 * duplicated here per the file-local convention (mirrors PTF16/PTF17 copy-
 * paste precedent).
 */
function extractDecorationSlice(html: string, decorationId?: string): string {
  const openRe = decorationId
    ? new RegExp(`<div\\b[^>]*\\bdata-decoration-id="${decorationId}"[^>]*>`)
    : /<div\b[^>]*\bdata-decoration-id\b[^>]*>/
  const m = openRe.exec(html)
  if (!m) return ''
  const start = m.index
  let depth = 1
  let i = start + m[0].length
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 4
    } else {
      depth -= 1
      i = nextClose + 6
    }
  }
  return html.slice(start, i)
}

/**
 * Normalize a decoration slice for cross-renderer byte-identity comparison.
 * Identical to the PTF13/14/17/18 helper — see
 * parity.template-fingerprint-decorations.test.tsx for the rationale on each
 * normalization step (style spacing, rgb→hex, self-closing void tags, sorted
 * <img> attributes).
 */
function normalizeDecorationSlice(slice: string): string {
  let s = computeStructuralFingerprint(slice)

  s = s.replace(/style="([^"]*)"/g, (_match, body: string) => {
    const cleaned = body
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => part.replace(/\s*:\s*/, ':').replace(/\s+/g, ' '))
      .join(';')
    return `style="${cleaned}"`
  })

  s = s.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_m, r, g, b) => {
    const toHex = (n: string) =>
      Number(n).toString(16).padStart(2, '0').toUpperCase()
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  })

  s = s.replace(/<img\b([^>]*?)\s*\/>/g, '<img$1>')

  s = s.replace(/<img\b([^>]*)>/g, (_match, attrs: string) => {
    const parts = attrs.match(/\s+[a-zA-Z-]+(?:="[^"]*")?/g) ?? []
    const sorted = parts
      .map((p) => p.trim())
      .sort()
      .join(' ')
    return `<img${sorted ? ' ' + sorted : ''}>`
  })

  return s
}

/**
 * Build a fixture slide carrying a single rotated arrow ShapeDecoration.
 * Position is fixed (mid-canvas, square 20×20) so the only differential
 * across tests is the rotation angle. Color/stroke are explicit hex per
 * PCL12 invariant (no currentColor).
 */
function makeRotatedArrowFixture(rotation: number, id: string): Slide {
  const deco: ShapeDecoration = {
    kind: 'shape',
    id,
    shapeKind: 'arrow',
    fill: '#FF0000',
    position: { x: 40, y: 40, width: 20, height: 20 },
    rotation,
    stroke: {
      color: '#0000FF',
      width: 2,
      style: 'solid',
    },
  }
  return { ...fingerprintFixtureSlide, decorations: [deco] }
}

/**
 * Render the slide through both paths and return both decoration slices,
 * normalized.
 */
function fingerprintBoth(
  slide: Slide,
  decorationId?: string,
): { preview: string; satori: string } {
  const { container } = render(
    <SlidePreview
      slide={slide}
      template={TEMPLATE}
      index={0}
      editable={false}
    />,
  )
  const previewHtml = container.innerHTML
  const satoriHtml = renderToStaticMarkup(buildSlideElement(slide, TEMPLATE))
  return {
    preview: normalizeDecorationSlice(
      extractDecorationSlice(previewHtml, decorationId),
    ),
    satori: normalizeDecorationSlice(
      extractDecorationSlice(satoriHtml, decorationId),
    ),
  }
}

describe('Phase 72 Plan 03 (PARITY-08 / PTF15): rotated arrow ShapeDecoration byte-identity across renderers', () => {
  it('PTF15-arrow-45: PRIMARY — 45°-rotated arrow byte-identical (PARITY-08 contract)', () => {
    const slide = makeRotatedArrowFixture(45, 'rot-45-arrow')
    const { preview, satori } = fingerprintBoth(slide, 'rot-45-arrow')
    // PARITY-08 byte-identity equiv (the merge-gate assertion).
    expect(preview).toBe(satori)
    // Committed baseline pin (defense-in-depth).
    expect(preview).toMatchSnapshot()
    // Sanity: confirm the slice carries the expected transform.
    expect(preview).toContain('transform:rotate(45deg)')
  })

  it('PTF15-arrow-30: 30°-rotated arrow byte-identical (defense-in-depth, non-canonical angle)', () => {
    const slide = makeRotatedArrowFixture(30, 'rot-30-arrow')
    const { preview, satori } = fingerprintBoth(slide, 'rot-30-arrow')
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
    expect(preview).toContain('transform:rotate(30deg)')
  })

  it('PTF15-arrow-90: 90°-rotated arrow byte-identical (canonical right-angle case)', () => {
    const slide = makeRotatedArrowFixture(90, 'rot-90-arrow')
    const { preview, satori } = fingerprintBoth(slide, 'rot-90-arrow')
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
    expect(preview).toContain('transform:rotate(90deg)')
  })

  it('PTF15-arrow-neg45: -45°-rotated arrow byte-identical (negative-angle case)', () => {
    const slide = makeRotatedArrowFixture(-45, 'rot-neg45-arrow')
    const { preview, satori } = fingerprintBoth(slide, 'rot-neg45-arrow')
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
    expect(preview).toContain('transform:rotate(-45deg)')
  })

  it('PTF15-arrow-180: 180°-rotated arrow byte-identical (symmetry case)', () => {
    const slide = makeRotatedArrowFixture(180, 'rot-180-arrow')
    const { preview, satori } = fingerprintBoth(slide, 'rot-180-arrow')
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
    expect(preview).toContain('transform:rotate(180deg)')
  })

  it('PTF15-arrow-0: rotation=0 arrow byte-identical (sanity — transform omitted branch)', () => {
    // Renderer omits the `transform` style key entirely when rotation is 0
    // or undefined (Satori throws on `transform: undefined`). This test pins
    // the omitted-branch byte-identity for the same fixture geometry as the
    // rotated cases — establishes the rotation=0 baseline within this file.
    const slide = makeRotatedArrowFixture(0, 'rot-0-arrow')
    const { preview, satori } = fingerprintBoth(slide, 'rot-0-arrow')
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
    // Confirm the omitted-branch: NO transform key for rotation=0.
    expect(preview).not.toContain('transform:rotate')
  })

  it('PTF15-stability: rotated fingerprints stable across consecutive renders (no nondeterminism)', () => {
    // Re-runs the PRIMARY 45° fixture twice and confirms both runs return
    // the same normalized slice. Defends the snapshot pin against
    // reactor/jsx ordering nondeterminism — if this test FAILS the snapshot
    // assertions above are non-reproducible and the .snap file would drift
    // on every CI run.
    const slide = makeRotatedArrowFixture(45, 'rot-45-arrow')
    const run1 = fingerprintBoth(slide, 'rot-45-arrow')
    const run2 = fingerprintBoth(slide, 'rot-45-arrow')
    expect(run1.preview).toBe(run2.preview)
    expect(run1.satori).toBe(run2.satori)
  })
})
