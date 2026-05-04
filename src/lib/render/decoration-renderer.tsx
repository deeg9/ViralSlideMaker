// Phase 69 (Plan 69-01) — shared decoration renderer.
//
// TPLREND-05 INVARIANT: BOTH `render-slide-satori.tsx` AND
// `slide-preview.tsx` will import `renderDecoration` from this module
// starting Plan 69-02 — replacing the layer 5.5 stubs (`_d => null`) with
// `d => renderDecoration(d, ctx)`. This is the SINGLE source of truth for
// decoration → DOM markup; both renderers must produce byte-identical
// output for any given Decoration.
//
// PURE MODULE: no React hooks, no DOM access, no side effects. Safe to
// call from server-side `renderToStaticMarkup` (next/og embeds Satori,
// which calls into a pure-function React renderer; any hook usage here
// would break the OG path).
//
// CRITICAL CONTRACTS (locked here, enforced by tests + Plan 69-03 grep gates):
//
//   1. lucide-static — NEVER lucide-react. Resolver lives in
//      `decorations/registry.ts`; this module just consumes it.
//      (vercel/satori#570 — lucide-react is Satori-incompatible.)
//
//   2. CSS box-shadow — never SVG <filter> / <feGaussianBlur>.
//      (vercel/satori#573 — silently dropped in Satori.) Plan 69-03 PCL13
//      grep gate enforces zero `filter:` / `backdrop-filter:` /
//      `mix-blend-mode:` usage in this module.
//
//   3. Explicit hex everywhere — no `currentColor` literals in production
//      code. (vercel/satori#41 — `currentColor` cascade is unreliable.)
//      For ICON path: registry already substitutes; for SHAPE-ASSET path:
//      caller's `style.color` cascades to the SVG asset's `currentColor`
//      (this is the ONLY token Satori does honor on `<img src=...>` SVG
//      assets — verified in v2.9 overlay pattern).
//
//   4. WR-01: opacity is 0..1 directly — NEVER divide by 100.
//
//   5. Satori `transform: undefined` throws — when rotation is
//      0/undefined, OMIT the transform key entirely. (Mirror
//      resolve-overlay.ts:471 comment.)
//
// MODULE STAYS .tsx — uses React.createElement directly so it stays
// importable from any context (mirror resolve-overlay.ts pattern); the
// .tsx extension keeps testing/IDE ergonomics + the JSX-syntax option
// available to future contributors without forcing a renderer-side
// transform.

import * as React from 'react'
import type {
  Decoration,
  IconDecoration,
  ShapeDecoration,
  ShapeKind,
} from '@/lib/types/decoration'
import { resolveDecorationSvg } from './decorations/registry'

/**
 * Render context passed to renderDecoration. Reserved for future use
 * (slideIndex / totalSlides for AI advisory / parity-context lookups);
 * empty in Phase 69 but typed-and-passed-through so Plan 69-02 callers
 * thread the same shape both renderers expect.
 */
export interface DecorationRenderCtx {
  slideIndex?: number
  totalSlides?: number
}

// CSS box-shadow size mapping. Mirrors v2.1 TextShadowEffect orders of
// magnitude. Locked here — used by both renderers via this single module.
const SHADOW_SIZE_MAP: Record<'sm' | 'md' | 'lg', string> = {
  sm: '2px 2px 4px',
  md: '4px 4px 8px',
  lg: '6px 6px 16px',
}

// shapeKinds that render as a CSS-styled <div> with no <img> child.
const CSS_DIV_SHAPES: ReadonlySet<ShapeKind> = new Set([
  'rect',
  'circle',
  'ellipse',
])

// =====================================================================
// Wrapper-style builder — the one thing every render path emits.
// =====================================================================

/**
 * Build the absolute-positioned wrapper style for a decoration.
 *
 * Always present:
 *   - position: 'absolute'
 *   - left / top / width / height — % of canvas (0..100 → '0%..100%')
 *   - opacity — d.opacity ?? 1 (CSS-native 0..1, NEVER /100)
 *   - pointerEvents: 'none' — decorations are non-interactive in the
 *     renderer; Phase 70 wires click handlers on a SEPARATE outer
 *     wrapper (NOT here — keeps the renderer pure and TPLREND-05-safe).
 *
 * Conditional (omitted when not needed — Satori `transform: undefined`
 * throws):
 *   - transform — only when rotation is set AND non-zero
 *   - boxShadow — only when effects.shadow.enabled is true
 */
function buildWrapperStyle(d: Decoration): React.CSSProperties {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${d.position.x}%`,
    top: `${d.position.y}%`,
    width: `${d.position.width}%`,
    height: `${d.position.height}%`,
    opacity: d.opacity ?? 1, // WR-01: never divide by 100
    pointerEvents: 'none',
  }

  // Rotation: ONLY emit transform when rotation is set AND non-zero. Satori
  // throws on `transform: undefined` (mirror resolve-overlay.ts:471 comment).
  if (typeof d.rotation === 'number' && d.rotation !== 0) {
    style.transform = `rotate(${d.rotation}deg)`
  }

  // Shadow: CSS box-shadow only. NEVER filter / backdropFilter / mixBlendMode
  // (vercel/satori#573). PCL13 grep gate enforces.
  const shadow = d.effects?.shadow
  if (shadow?.enabled === true) {
    const sizeStr = SHADOW_SIZE_MAP[shadow.size]
    style.boxShadow = `${sizeStr} ${shadow.color}`
  }

  return style
}

// =====================================================================
// Icon path — data:image/svg+xml URI wrapping
// =====================================================================

function renderIcon(d: IconDecoration, _ctx: DecorationRenderCtx): React.ReactNode {
  const svg = resolveDecorationSvg(d.lucideName, d.color, d.strokeWidth)
  if (svg === null) return null // unknown name → silent drop (closed-enum guard)

  // Documented Satori-safe inline-SVG path: data-URI <img>.
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

  const wrapperStyle = buildWrapperStyle(d)
  const imgStyle: React.CSSProperties = { width: '100%', height: '100%' }

  return React.createElement(
    'div',
    {
      style: wrapperStyle,
      'data-decoration-id': d.id,
      'data-decoration-kind': 'icon',
    },
    React.createElement('img', { src, style: imgStyle }),
  )
}

// =====================================================================
// Shape path — discriminated CSS-div vs SVG-asset
// =====================================================================

function shapeAssetPath(d: ShapeDecoration): string {
  switch (d.shapeKind) {
    case 'triangle':
      return '/shapes/triangle.svg'
    case 'polygon':
      return `/shapes/polygon-${d.points ?? 5}.svg`
    case 'star':
      return `/shapes/star-${d.points ?? 5}.svg`
    case 'arrow':
      return '/shapes/arrow.svg'
    case 'line':
      return '/shapes/line.svg'
    // CSS-div shapes never reach here — guarded by CSS_DIV_SHAPES check.
    default:
      return `/shapes/${d.shapeKind}.svg`
  }
}

function renderShapeCssDiv(d: ShapeDecoration, _ctx: DecorationRenderCtx): React.ReactNode {
  const wrapperStyle = buildWrapperStyle(d)
  const style: React.CSSProperties = {
    ...wrapperStyle,
    background: d.fill,
  }

  if (d.shapeKind === 'rect') {
    style.borderRadius = `${d.cornerRadius ?? 0}px`
  } else {
    // circle + ellipse — borderRadius:50% gives a perfect circle when
    // width === height and an ellipse otherwise (relies on the wrapper's
    // %-based width/height already applied by buildWrapperStyle).
    style.borderRadius = '50%'
  }

  if (d.stroke) {
    // CSS shorthand — width style color (e.g. "3px dashed #000000")
    style.border = `${d.stroke.width}px ${d.stroke.style} ${d.stroke.color}`
  }

  return React.createElement('div', {
    style,
    'data-decoration-id': d.id,
    'data-decoration-kind': 'shape',
    'data-shape-kind': d.shapeKind,
  })
}

function renderShapeAsset(d: ShapeDecoration, _ctx: DecorationRenderCtx): React.ReactNode {
  const wrapperStyle = buildWrapperStyle(d)
  // CSS color cascade — public/shapes/*.svg assets (Plan 69-02) use
  // `currentColor` for fill/stroke. Satori honors `style.color` cascade
  // through to the SVG asset (verified in v2.9 overlay pattern at
  // resolve-overlay.ts:466).
  const style: React.CSSProperties = {
    ...wrapperStyle,
    color: d.fill,
  }
  const imgStyle: React.CSSProperties = { width: '100%', height: '100%' }

  return React.createElement(
    'div',
    {
      style,
      'data-decoration-id': d.id,
      'data-decoration-kind': 'shape',
      'data-shape-kind': d.shapeKind,
    },
    React.createElement('img', { src: shapeAssetPath(d), style: imgStyle }),
  )
}

function renderShape(d: ShapeDecoration, ctx: DecorationRenderCtx): React.ReactNode {
  if (CSS_DIV_SHAPES.has(d.shapeKind)) {
    return renderShapeCssDiv(d, ctx)
  }
  return renderShapeAsset(d, ctx)
}

// =====================================================================
// Public entry point — discriminated dispatch
// =====================================================================

/**
 * Render a Decoration to a React element tree. Pure function; safe for
 * both Satori (server) and React DOM (client) render paths.
 *
 * Returns null when the decoration cannot be rendered (e.g. icon name not
 * in the closed-enum allowlist) — caller emits zero DOM nodes in that
 * case (silent drop matches v2.9 overlay graceful-fallback pattern).
 *
 * NOTE: callers (slide-preview.tsx, render-slide-satori.tsx — Plan 69-02)
 * are responsible for filtering `hidden=true` decorations BEFORE calling
 * this function. The renderer itself does not skip on `hidden` (mirrors
 * the v2.9 layer-5 custom-image pattern: filtering lives at the iteration
 * site, not the per-element renderer).
 */
export function renderDecoration(
  d: Decoration,
  ctx: DecorationRenderCtx,
): React.ReactNode {
  if (d.kind === 'icon') return renderIcon(d, ctx)
  if (d.kind === 'shape') return renderShape(d, ctx)
  // Discriminated-union exhaustiveness — TypeScript guarantees no other
  // kinds; defensive null return for runtime safety.
  return null
}
