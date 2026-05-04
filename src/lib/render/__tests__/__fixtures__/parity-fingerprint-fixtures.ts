// Phase 65 Plan 03 (PARITY-04): per-template structural-fingerprint fixtures.
//
// The `fingerprintFixtureSlide` is a minimal-but-content-rich slide reused
// across every registered template. Tests override `template_id_override` to
// point at the template under test; the renderer reads geometry / hook /
// body / custom_image / custom_text / watermark fields from this fixture.
//
// `normalizeFingerprint` strips dynamic noise (React SSR ids, ephemeral
// classes, whitespace, helmet markers) so the fingerprint is stable across
// repeat runs and across React 19 renderer versions.
//
// `computeStructuralFingerprint` returns the normalized HTML directly. Vitest
// snapshots (`.snap` files) handle the resulting strings cleanly — no need
// for a SHA hash. Snapshot files committed alongside the tests ARE the
// v2.11-trailing-edge baseline; future milestones diff against them.

import type { Slide } from '@/lib/types/slide'
import type {
  IconDecoration,
  ShapeDecoration,
  ShapeKind,
} from '@/lib/types/decoration'

/**
 * Single fixture slide reused across every template. Contains:
 *   - 1 hook text-box (top anchor)
 *   - 1 body text-box (bottom anchor)
 *   - 1 custom_image (mid-canvas, deterministic geometry)
 *   - 1 watermark (bottom-right, enabled — exercises the resolver)
 *   - background_url + pexels_photo_id
 *
 * Geometry chosen to land inside every template's safe zone so no template
 * "no-ops" with empty output (which would defeat the purpose of fingerprinting).
 */
export const fingerprintFixtureSlide: Slide = {
  hook_text: 'Fingerprint hook',
  body_text: 'Fingerprint body text for parity baseline',
  image_query: 'parity-fixture',
  is_cta: false,
  background_url: 'https://example.com/fingerprint-bg.jpg',
  pexels_photo_id: 9999,
  custom_images: [
    {
      id: 'ci-fp-1',
      url: 'https://example.com/fingerprint-img.jpg',
      x: 10,
      y: 50,
      width: 30,
      height: 20,
      opacity: 100,
    },
  ],
  text_boxes: [
    {
      id: 'tb-fp-hook',
      role: 'hook',
      text: 'Fingerprint hook',
      position: { anchor: 'top' },
    },
    {
      id: 'tb-fp-body',
      role: 'body',
      text: 'Fingerprint body text for parity baseline',
      position: { anchor: 'bottom' },
    },
  ],
  watermark: {
    id: 'w_0',
    enabled: true,
    customText: 'FP',
    position: 'bottom-right',
  },
}

/**
 * quick-260503-0f2: long-hook + cover-layout fixture for the news-* templates.
 *
 * The original `fingerprintFixtureSlide` exercises a 16-char hook with no
 * `style_overrides.layout`, which (a) keeps `hookFontSize` at the template's
 * declared base size (no auto-shrink) and (b) routes the renderer through the
 * SAFE_ZONE 'bottom' preset (hookY=48% / bodyY=62%) instead of the news-zone
 * 'cover' layout (hookY=60% / bodyY=80%, image clipped to top 0..55%).
 *
 * This fixture pins the OPPOSITE corner of the matrix: a 40-char hook with
 * 7 segments + 3 body segments + `style_overrides.layout: 'cover'`. It triggers:
 *   - hook-fit auto-shrink: news-cyan/news-drop step 4 (maxChars 48 → scale 0.52)
 *     so hookFontSize collapses from 110px → 57px, exercising the rounding path
 *     in BOTH renderers. Any future drift in `parseInt(template.hookFontSize)` /
 *     `getHookFontSize` between Satori (truthy-check) and React preview
 *     (?? nullish-check) will now diverge the snapshot.
 *   - news-zone cover layout: hookY=60%, bodyY=80%, image confined to 0..55%.
 *     This is the path the user's "exported PNG diverges from live preview"
 *     bug lives at — the original PARITY-04 fixture never reached it.
 *   - multi-segment hook + body with `accent: true` segments: exercises the
 *     shared `renderSegments` helper (and post-pw8 `renderTextBlock` fast path
 *     when `list_type` and `list_indent` are unset) at all three text sites.
 *
 * Tied to the news templates (news-cyan, news-drop) via the parity test —
 * those are the only templates whose `hook-fit` registry entries this fixture
 * meaningfully exercises and whose `cover` layout produces visible image-top +
 * text-bottom output. Other templates either lack `hook-fit` (no auto-shrink)
 * or use `backgroundMode: 'image-with-bottom-card'` (which forces newsZone off
 * via the `isTemplateBgMode` guard in both renderers).
 */
export const longHookCoverFixtureSlide: Slide = {
  hook_text: 'YOUR BRAIN IS OUTSOURCING THINKING TO AI',
  body_text:
    'Researchers call it cognitive agency surrender — students who lean on AI for every prompt show measurable declines in independent reasoning.',
  hook_segments: [
    { text: 'YOUR' },
    { text: 'BRAIN', accent: true },
    { text: 'IS' },
    { text: 'OUTSOURCING', accent: true },
    { text: 'THINKING' },
    { text: 'TO' },
    { text: 'AI', accent: true },
  ],
  body_segments: [
    { text: 'Researchers call it' },
    { text: 'cognitive agency surrender', accent: true },
    {
      text: '— students who lean on AI for every prompt show measurable declines in independent reasoning.',
    },
  ],
  image_query: 'parity-long-hook-fixture',
  is_cta: false,
  background_url: 'https://example.com/fingerprint-bg.jpg',
  pexels_photo_id: 9999,
  style_overrides: {
    layout: 'cover',
  },
  text_boxes: [
    {
      id: 'tb-lh-hook',
      role: 'hook',
      text: 'YOUR BRAIN IS OUTSOURCING THINKING TO AI',
      segments: [
        { text: 'YOUR' },
        { text: 'BRAIN', accent: true },
        { text: 'IS' },
        { text: 'OUTSOURCING', accent: true },
        { text: 'THINKING' },
        { text: 'TO' },
        { text: 'AI', accent: true },
      ],
      position: { anchor: 'top' },
    },
    {
      id: 'tb-lh-body',
      role: 'body',
      text: 'Researchers call it cognitive agency surrender — students who lean on AI for every prompt show measurable declines in independent reasoning.',
      segments: [
        { text: 'Researchers call it' },
        { text: 'cognitive agency surrender', accent: true },
        {
          text: '— students who lean on AI for every prompt show measurable declines in independent reasoning.',
        },
      ],
      position: { anchor: 'bottom' },
    },
  ],
}

/**
 * Strip dynamic noise from rendered HTML so the fingerprint is stable across
 * repeat runs. Targets:
 *   - React SSR scoped ids: `_:r0:_`, `_:R1abcd:_` — replaced with literal `_:rN:_`
 *   - React useId() outputs: `:r0:`, `:R5:` — replaced with `:rN:`
 *   - Whitespace runs collapsed to single space (no newlines, no tabs)
 *   - react-helmet markers (data-react-helmet attribute on <title>/<meta>)
 *   - data-rh, data-reactroot leftovers
 *   - Trailing/leading whitespace
 *
 * The result is a deterministic string suitable for snapshot comparison.
 */
export function normalizeFingerprint(html: string): string {
  return html
    // React SSR scoped ids — pattern `_:r…:_` (with optional capital R + alnum)
    .replace(/_:r[a-zA-Z0-9]+:_/g, '_:rN:_')
    // React useId() outputs — pattern `:r…:` or `:R…:` standalone
    .replace(/:[rR][a-zA-Z0-9]+:/g, ':rN:')
    // react-helmet noise
    .replace(/\s*data-react-helmet="[^"]*"/g, '')
    .replace(/\s*data-rh="[^"]*"/g, '')
    .replace(/\s*data-reactroot=""?/g, '')
    // Collapse whitespace runs
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns the normalized HTML directly. Wraps `normalizeFingerprint` to give
 * tests a single named entry-point — keeps callsites tidy and lets us swap
 * to a SHA hash later without changing test code if .snap files balloon.
 */
export function computeStructuralFingerprint(html: string): string {
  return normalizeFingerprint(html)
}

/**
 * Phase 67 Plan 02 (PARITY-09 / PTF16): idempotent-absence fixtures.
 *
 * Both fixtures derive from `fingerprintFixtureSlide` and EXPLICITLY set
 * `decorations` to two boundary values:
 *   - `undefined` (the natural state for all 53+ existing projects per MIGR-02)
 *   - `[]`        (the baseline a freshly-created Phase 68+ project may emit)
 *
 * The renderer's null-safe `(slide.decorations ?? []).filter(...).map(...)`
 * stub at layer 5.5 (Plan 67-01) MUST emit zero DOM nodes for both cases.
 * PTF16 pins the byte-identity invariant for both — establishing the
 * pre-v2.12 baseline that v2.12 cannot regress.
 *
 * The two fixtures are intentionally OBJECT-LITERAL spreads (not deep clones)
 * so any future change to the parent fixture (text_boxes / custom_images / etc)
 * propagates to both PTF16 derivatives automatically — keeping PTF16 in sync
 * with PTF1..12 over time.
 */
export const decorationsUndefinedFixtureSlide: Slide = {
  ...fingerprintFixtureSlide,
  decorations: undefined,
}

export const decorationsEmptyArrayFixtureSlide: Slide = {
  ...fingerprintFixtureSlide,
  decorations: [],
}

// =====================================================================
// Phase 69 Plan 03 (PARITY-06 / PARITY-07 / PARITY-11): decoration-bearing
// fixture builders for PTF13 (10 Lucide icons), PTF14 (8 shapeKinds × 2
// variants), and PTF18 (non-uniform 1.5×1.0 scale icon).
//
// All builders compose on top of `fingerprintFixtureSlide` so the surrounding
// template content (hook / body / custom_image / watermark) is identical
// across every PTF13/14/18 fixture — the ONLY differential is the appended
// decoration. This keeps the fingerprint diff focused on the decoration's
// rendering byte-identity (TPLREND-05 invariant under test).
// =====================================================================

/**
 * Phase 69 Plan 03 (PARITY-06 / PTF13): build a fixture slide carrying a single
 * IconDecoration whose lucideName, color, strokeWidth, position are caller-controlled.
 * Spread on top of fingerprintFixtureSlide so existing template content is unchanged.
 *
 * Defaults aim for visible-but-deterministic output:
 *   - color: '#FF0000' (red — distinct from any template accent color)
 *   - strokeWidth: 2 (Lucide default)
 *   - position: { x: 40, y: 40, width: 20, height: 20 } (mid-canvas, square)
 */
export function makeIconDecorationFixture(
  lucideName: string,
  opts: {
    color?: string
    strokeWidth?: number
    position?: { x: number; y: number; width: number; height: number }
    id?: string
  } = {},
): Slide {
  const deco: IconDecoration = {
    kind: 'icon',
    id: opts.id ?? `ptf13-${lucideName}`,
    lucideName,
    color: opts.color ?? '#FF0000',
    strokeWidth: opts.strokeWidth ?? 2,
    position: opts.position ?? { x: 40, y: 40, width: 20, height: 20 },
  }
  return { ...fingerprintFixtureSlide, decorations: [deco] }
}

/**
 * Phase 69 Plan 03 (PARITY-07 / PTF14): build a fixture slide carrying a single
 * ShapeDecoration. `outlined: true` adds a stroke; `outlined: false` leaves
 * stroke undefined. Defaults aim for visible-but-deterministic output:
 *   - fill: '#00FF00' (green)
 *   - strokeColor: '#0000FF' (blue), strokeWidth: 4 (when outlined)
 *   - position: { x: 30, y: 30, width: 25, height: 25 }
 *
 * Per-shapeKind defaults:
 *   - rect: cornerRadius=8 (visible rounding, not extreme)
 *   - polygon: points=5 (one of picker-allowed values)
 *   - star: points=5 (one of picker-allowed values)
 */
export function makeShapeDecorationFixture(
  shapeKind: ShapeKind,
  opts: {
    outlined: boolean
    fill?: string
    strokeColor?: string
    strokeWidth?: number
    cornerRadius?: number
    points?: number
    position?: { x: number; y: number; width: number; height: number }
    id?: string
  },
): Slide {
  const base: ShapeDecoration = {
    kind: 'shape',
    id: opts.id ?? `ptf14-${shapeKind}-${opts.outlined ? 'outlined' : 'filled'}`,
    shapeKind,
    fill: opts.fill ?? '#00FF00',
    position: opts.position ?? { x: 30, y: 30, width: 25, height: 25 },
    ...(shapeKind === 'rect' ? { cornerRadius: opts.cornerRadius ?? 8 } : {}),
    ...(shapeKind === 'polygon' || shapeKind === 'star'
      ? { points: opts.points ?? 5 }
      : {}),
  }
  if (opts.outlined) {
    base.stroke = {
      color: opts.strokeColor ?? '#0000FF',
      width: opts.strokeWidth ?? 4,
      style: 'solid',
    }
  }
  return { ...fingerprintFixtureSlide, decorations: [base] }
}

/**
 * Phase 69 Plan 03 (PARITY-11 / PTF18): non-uniform-scale icon fixture.
 *
 * `scale.x: 1.5, scale.y: 1.0` translates to position width=1.5*base,
 * height=1.0*base with a square base of 10 (so width=15, height=10) — confirms
 * the renderer respects width and height % independently of intrinsic SVG
 * aspect ratio. The KEY POINT is width !== height — a square Lucide icon
 * (24×24 viewBox) stretched to a 3:2 box must produce identical fingerprints
 * across both render paths.
 */
export function makeNonUniformScaleIconFixture(
  lucideName: string,
  scale: { x: number; y: number },
): Slide {
  const base = 10
  return makeIconDecorationFixture(lucideName, {
    id: `ptf18-${lucideName}-scale-${scale.x}x${scale.y}`,
    position: { x: 40, y: 40, width: base * scale.x, height: base * scale.y },
  })
}
