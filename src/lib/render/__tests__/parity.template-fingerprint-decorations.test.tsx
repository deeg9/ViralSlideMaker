// Phase 69 Plan 03 (PARITY-06 / PARITY-07 / PARITY-11): PTF13/14/18 parity
// fingerprint suite — proves byte-identity across React preview + Satori PNG
// path for the decoration render layer (5.5).
//
// PTF13: 10 representative Lucide icons (Heart, Star, Check, Zap, ArrowRight,
//        X, Plus, Crown, Sparkles, Circle) — locked test set.
// PTF14: 8 shapeKinds × {filled, outlined} = 16 fingerprints.
// PTF18: 1 non-uniform-scale (1.5×1.0) Lucide icon — confirms width/height
//        respect independent of intrinsic SVG aspect ratio.
//
// CRITICAL — every PTF13/14/18 test asserts BOTH:
//   1. `expect(decoSlice(preview)).toBe(decoSlice(satori))`  ← byte-identity equiv (PARITY-06/07/11)
//   2. `expect(decoSlice(preview)).toMatchSnapshot()`        ← committed baseline pin
//
// SCOPE — what byte-identity is being asserted on:
// The equiv compares the DECORATION SLICE only (the `<div
// data-decoration-id="..." ...>...</div>` substring), NOT the whole slide HTML.
// Whole-slide HTML inherently differs between paths because:
//   - React DOM (testing-library/render → container.innerHTML) wraps the
//     slide in editor chrome (`data-testid="slide-preview"`, slide-number
//     badge at bottom, etc.).
//   - Satori path (renderToStaticMarkup) emits the raw slide element.
//   - JSDOM serialization (spaces in style values, attribute ordering, self-
//     closing tag form) differs from renderToStaticMarkup output even on
//     byte-identical React trees.
// These wrapper/serialization differences exist for ALL templates (PTF1..16
// take per-renderer snapshots independently for exactly this reason), so
// asserting whole-slide equiv would fail on every existing template too.
//
// What MATTERS for TPLREND-05 is that `renderDecoration(d, ctx)` produces
// IDENTICAL React-tree output regardless of which renderer consumes it —
// i.e. the DECORATION subtree is byte-identical. That's the merge gate:
// any future change to renderDecoration / registry / iteration sites that
// breaks decoration-slice equivalence FAILS CI within ~10 seconds with a
// visible string diff. The snapshot pin protects against silent regression
// of a *changed-but-still-equiv* fingerprint (defense in depth — both sides
// must equal the committed baseline).
//
// The decoration slice is also normalized through `computeStructuralFingerprint`
// (whitespace collapse + React-id strip + style-value space tolerance) so the
// two slices are compared on a level playing field — JSDOM's `style: "a; b;"`
// is normalized identically to renderToStaticMarkup's `style="a;b;"`.
//
// Runtime PTF labels for verify-gate grep:
//   PTF13-{name}, PTF14-{kind}-{filled|outlined}, PTF18

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { templates } from '@/lib/render/templates'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { SlidePreview } from '@/components/slides/slide-preview'
import {
  makeIconDecorationFixture,
  makeShapeDecorationFixture,
  makeNonUniformScaleIconFixture,
  computeStructuralFingerprint,
} from './__fixtures__/parity-fingerprint-fixtures'
import type { Slide } from '@/lib/types/slide'
import type { ShapeKind } from '@/lib/types/decoration'

// Use templates[0] for determinism — all PTF13/14/18 tests render the same
// underlying template so the diff focuses on the decoration layer.
const TEMPLATE = templates[0]

const PTF13_ICONS = [
  'Heart',
  'Star',
  'Check',
  'Zap',
  'ArrowRight',
  'X',
  'Plus',
  'Crown',
  'Sparkles',
  'Circle',
] as const

const PTF14_SHAPES: ShapeKind[] = [
  'rect',
  'circle',
  'ellipse',
  'triangle',
  'polygon',
  'star',
  'arrow',
  'line',
]

/**
 * Extract the decoration subtree (the single `<div data-decoration-id="..."
 * data-decoration-kind="..." ...>...</div>` element + its children) from a
 * full slide HTML output. Returns "" if no decoration is present.
 *
 * Why a slice? See the file header — whole-slide HTML inherently differs
 * across paths due to editor-chrome wrappers + JSDOM/renderToStaticMarkup
 * serialization quirks; the TPLREND-05 byte-identity invariant is on the
 * DECORATION subtree, which is what `renderDecoration` actually produces.
 *
 * The regex matches the OPENING `<div ... data-decoration-id="...">` and
 * scans forward through balanced/well-nested children to the closing
 * `</div>`. Decorations contain at most one child <img> in this milestone,
 * so a single closing-`</div>` skip is sufficient (we balance by counting
 * opens and closes — defensive in case a future shapeKind nests deeper).
 */
function extractDecorationSlice(html: string): string {
  const openRe = /<div\b[^>]*\bdata-decoration-id\b[^>]*>/
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
      // Be careful — count opening <div tags (skip self-closing or void
      // <img>/<svg>); depth only increments on a real <div> open.
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
 * Layered on top of `computeStructuralFingerprint` (which handles React-id
 * noise + whitespace collapse) — adds JSDOM-specific normalizations:
 *   - style="a: b; c: d;" → style="a:b;c:d" (strip spaces around colons +
 *     trailing semicolons; JSDOM emits spaces, renderToStaticMarkup does not)
 *   - rgb(R, G, B) → #RRGGBB normalization (JSDOM serializes color values
 *     as `rgb(...)` regardless of source; renderToStaticMarkup preserves
 *     hex). Limited to fully-opaque colors — alpha-bearing rgba is rare in
 *     decoration output (only via box-shadow's color, which uses 8-digit hex).
 *   - <img a b /> ↔ <img a b> equivalence (self-closing void tags); both
 *     forms collapsed to the no-slash form.
 *   - Attribute order on <img>: collapse to a stable form (sort attributes
 *     alphabetically WITHIN <img> tags only — inner content untouched).
 *
 * The result is a deterministic string suitable for direct .toBe() comparison
 * across paths AND for snapshot pinning.
 */
function normalizeDecorationSlice(slice: string): string {
  let s = computeStructuralFingerprint(slice)

  // Style value spacing: " key : value ; " → "key:value;" (within style="...")
  s = s.replace(/style="([^"]*)"/g, (_match, body: string) => {
    const cleaned = body
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => part.replace(/\s*:\s*/, ':').replace(/\s+/g, ' '))
      .join(';')
    return `style="${cleaned}"`
  })

  // rgb(R, G, B) → #RRGGBB (JSDOM artifact)
  s = s.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_m, r, g, b) => {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0').toUpperCase()
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  })

  // <img ... /> → <img ...> (self-closing void normalization)
  s = s.replace(/<img\b([^>]*?)\s*\/>/g, '<img$1>')

  // Sort attributes alphabetically within <img> tags. Match: <img attr="..." attr="...">
  // Keep ordering stable and case-insensitive on attr names.
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
 * Render the same slide through both paths, extract the decoration slice
 * from each, normalize, and return both fingerprints. Caller asserts equiv
 * + snapshot.
 */
function fingerprintBoth(slide: Slide): { preview: string; satori: string } {
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
    preview: normalizeDecorationSlice(extractDecorationSlice(previewHtml)),
    satori: normalizeDecorationSlice(extractDecorationSlice(satoriHtml)),
  }
}

describe('Phase 69 Plan 03 (PARITY-06 / PTF13): 10 representative Lucide icons byte-identical', () => {
  PTF13_ICONS.forEach((name) => {
    it(`PTF13-${name}: byte-identical Lucide icon fingerprint across renderers`, () => {
      const slide: Slide = {
        ...makeIconDecorationFixture(name),
        template_id_override: TEMPLATE.id,
      }
      const { preview, satori } = fingerprintBoth(slide)
      // PARITY-06 byte-identity equiv (the merge-gate assertion).
      expect(preview).toBe(satori)
      // Committed baseline pin (defense-in-depth).
      expect(preview).toMatchSnapshot()
    })
  })

  it('PTF13 sanity: covers exactly 10 representative Lucide icons in locked order', () => {
    expect(PTF13_ICONS).toEqual([
      'Heart',
      'Star',
      'Check',
      'Zap',
      'ArrowRight',
      'X',
      'Plus',
      'Crown',
      'Sparkles',
      'Circle',
    ])
    expect(PTF13_ICONS).toHaveLength(10)
  })

  it('PTF13 sanity: emitted HTML carries data-decoration-kind="icon" + the explicit hex color', () => {
    const slide: Slide = {
      ...makeIconDecorationFixture('Heart'),
      template_id_override: TEMPLATE.id,
    }
    const satoriHtml = renderToStaticMarkup(buildSlideElement(slide, TEMPLATE))
    expect(satoriHtml).toContain('data-decoration-kind="icon"')
    // Color may appear URL-encoded inside the data:image/svg+xml URI; accept either form.
    const containsHex =
      satoriHtml.includes('#FF0000') || satoriHtml.includes('%23FF0000')
    expect(containsHex).toBe(true)
  })
})

describe('Phase 69 Plan 03 (PARITY-07 / PTF14): 8 shapeKinds × {filled, outlined} byte-identical', () => {
  PTF14_SHAPES.forEach((shapeKind) => {
    it(`PTF14-${shapeKind}-filled: byte-identical filled shape fingerprint across renderers`, () => {
      const slide: Slide = {
        ...makeShapeDecorationFixture(shapeKind, { outlined: false }),
        template_id_override: TEMPLATE.id,
      }
      const { preview, satori } = fingerprintBoth(slide)
      expect(preview).toBe(satori)
      expect(preview).toMatchSnapshot()
    })

    it(`PTF14-${shapeKind}-outlined: byte-identical outlined shape fingerprint across renderers`, () => {
      const slide: Slide = {
        ...makeShapeDecorationFixture(shapeKind, { outlined: true }),
        template_id_override: TEMPLATE.id,
      }
      const { preview, satori } = fingerprintBoth(slide)
      expect(preview).toBe(satori)
      expect(preview).toMatchSnapshot()
    })
  })

  it('PTF14 sanity: covers all 8 shapeKinds × 2 variants = 16 fixtures', () => {
    expect(PTF14_SHAPES).toEqual([
      'rect',
      'circle',
      'ellipse',
      'triangle',
      'polygon',
      'star',
      'arrow',
      'line',
    ])
    expect(PTF14_SHAPES.length).toBe(8)
    expect(PTF14_SHAPES.length * 2).toBe(16)
  })
})

describe('Phase 69 Plan 03 (PARITY-11 / PTF18): non-uniform-scale Lucide icon byte-identical', () => {
  it('PTF18: 1.5×1.0 non-uniform-scale Heart icon byte-identical across renderers', () => {
    const slide: Slide = {
      ...makeNonUniformScaleIconFixture('Heart', { x: 1.5, y: 1.0 }),
      template_id_override: TEMPLATE.id,
    }
    const { preview, satori } = fingerprintBoth(slide)
    // The KEY assertion: width=15%, height=10% — square SVG stretched to 3:2 box
    // must produce IDENTICAL output across both renderers.
    expect(preview).toBe(satori)
    expect(preview).toMatchSnapshot()
  })

  it('PTF18 sanity: non-uniform-scale fixture has width !== height', () => {
    const slide = makeNonUniformScaleIconFixture('Heart', { x: 1.5, y: 1.0 })
    const deco = slide.decorations?.[0]
    expect(deco).toBeDefined()
    expect(deco!.position.width).not.toBe(deco!.position.height)
    expect(deco!.position.width).toBe(15)
    expect(deco!.position.height).toBe(10)
  })
})
