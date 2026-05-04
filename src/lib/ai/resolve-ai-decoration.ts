// Phase 71 (AI-03, AI-04): server-side AI decoration resolvers.
//
// Pure functions / no side effects / never-throws — silent fallback on
// unknown tokens / anchors per the AI-04 silent-drop contract. The
// generate-slides.ts ingest adapter (Plan 71-01 Task 3) wraps these in
// a try/catch + outer DecorationSchema.safeParse layer for defense in
// depth (the triple-layer drop pattern documented in schemas.ts).
//
// AI_POSITION_RECTS values are LOCKED safe-zone offsets — modifying any
// rect requires updating Test 8 (exact equality assertion in
// resolve-ai-decoration.test.ts) AND the carry-forward downstream
// verification in Plan 71-03 PTF17 fixture.
//
// derived_palette index → role mapping (Phase 56 node-vibrant ordering,
// LOCKED):
//   0 = Vibrant
//   1 = LightVibrant
//   2 = DarkVibrant
//   3 = Muted
//   4 = DarkMuted
//   5 = LightMuted
// resolveAIColor consumes indices 0 (palette-vibrant), 4 (palette-dark-muted),
// and 5 (palette-light, chosen over LightVibrant which is too saturated).

import {
  AI_COLOR_TOKENS,
  AI_POSITION_ANCHORS,
  type AIColorToken,
  type AIPositionAnchor,
  type DecorationEmitContent,
  type DecorationContent,
  type IconDecorationContent,
  type ShapeDecorationContent,
} from './schemas'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates'

// Fixed contrast pair constants — used when AI signals 'on-light' / 'on-dark'.
// Matches the editor's text-on-surface defaults (slate-900 / slate-50 equivalent).
const ON_LIGHT_HEX = '#0F172A'
const ON_DARK_HEX = '#F8FAFC'

const COLOR_TOKEN_SET: ReadonlySet<string> = new Set(AI_COLOR_TOKENS)
const POSITION_ANCHOR_SET: ReadonlySet<string> = new Set(AI_POSITION_ANCHORS)

/**
 * Map a named color token to an explicit hex value via
 * template.accentColor + slide.style_overrides.derived_palette +
 * template.textColor. Unknown token → fall back to template.accentColor
 * (or template.textColor when accentColor is missing). Never throws.
 */
export function resolveAIColor(
  token: AIColorToken | string,
  slide: Slide,
  template: SlideTemplate,
): string {
  const palette = slide.style_overrides?.derived_palette
  const accentFallback = template.accentColor ?? template.textColor

  if (!COLOR_TOKEN_SET.has(token)) {
    return accentFallback
  }

  switch (token as AIColorToken) {
    case 'accent':
      return template.accentColor ?? template.textColor
    case 'palette-vibrant':
      return palette?.[0] ?? template.accentColor ?? template.textColor
    case 'palette-dark-muted':
      return palette?.[4] ?? template.textColor
    case 'palette-light':
      return palette?.[5] ?? '#FFFFFF'
    case 'on-light':
      return ON_LIGHT_HEX
    case 'on-dark':
      return ON_DARK_HEX
    default:
      // Unreachable given COLOR_TOKEN_SET gate above; defensive fallback.
      return accentFallback
  }
}

/**
 * Locked safe-zone % coord rects per anchor. Top/bottom rows occupy bands
 * 8..24% and 76..92% — outside the central 24..76% hook+body band on
 * default templates. Width 22% × height 16% gives a visible-but-not-
 * occluding decoration footprint. Center anchor is the fallback.
 *
 * MODIFICATION POLICY: changing any rect requires updating Test 8 in
 * resolve-ai-decoration.test.ts (exact equality) AND the PTF17 fixture
 * snapshot in Plan 71-03.
 */
export const AI_POSITION_RECTS: Record<AIPositionAnchor, { x: number; y: number; width: number; height: number }> = {
  'top-left':      { x: 8,  y: 8,  width: 22, height: 16 },
  'top-right':     { x: 70, y: 8,  width: 22, height: 16 },
  'top-center':    { x: 39, y: 8,  width: 22, height: 16 },
  'center':        { x: 39, y: 42, width: 22, height: 16 },
  'bottom-left':   { x: 8,  y: 76, width: 22, height: 16 },
  'bottom-right':  { x: 70, y: 76, width: 22, height: 16 },
  'bottom-center': { x: 39, y: 76, width: 22, height: 16 },
}

/**
 * Map a semantic anchor to its safe-zone % coord rect. Unknown anchor
 * falls back to center. Never throws.
 */
export function resolveAIPosition(
  anchor: AIPositionAnchor | string,
): { x: number; y: number; width: number; height: number } {
  if (POSITION_ANCHOR_SET.has(anchor)) {
    return AI_POSITION_RECTS[anchor as AIPositionAnchor]
  }
  return AI_POSITION_RECTS.center
}

/**
 * Deterministic id constructor — `ai-deco-${slideIndex}-${decorationIndex}`.
 * Required for stable React keys + idempotent re-render on identical AI
 * input. NO Math.random / no Date.now.
 */
export function buildAIDecorationId(slideIndex: number, decorationIndex: number): string {
  return `ai-deco-${slideIndex}-${decorationIndex}`
}

/**
 * Build a full Decoration from an AI-emitted closed-enum payload.
 * Resolves color token → hex, anchor → safe-zone rect, generates id.
 *
 * The result is structurally valid against the full Phase 67
 * DecorationSchema (caller layers an additional safeParse gate per
 * AI-04 silent-drop contract). Function never throws under valid
 * DecorationEmitContent input.
 */
export function resolveAIDecoration(
  emitted: DecorationEmitContent,
  slide: Slide,
  template: SlideTemplate,
  slideIndex: number,
  decorationIndex: number,
): DecorationContent {
  const position = resolveAIPosition(emitted.position)
  const color = resolveAIColor(emitted.color, slide, template)
  const id = buildAIDecorationId(slideIndex, decorationIndex)

  if (emitted.kind === 'icon') {
    const icon: IconDecorationContent = {
      kind: 'icon',
      id,
      position,
      lucideName: emitted.lucideName,
      color,
      strokeWidth: 2,
      ...(emitted.rotation !== undefined && { rotation: emitted.rotation }),
    }
    return icon
  }

  // shape — DecorationEmitSchema's z.enum widens to string at the type level;
  // narrow back to the closed-enum shapeKind expected by ShapeDecorationContent.
  const shape: ShapeDecorationContent = {
    kind: 'shape',
    id,
    position,
    shapeKind: emitted.shapeKind as ShapeDecorationContent['shapeKind'],
    fill: color,
    ...(emitted.cornerRadius !== undefined && { cornerRadius: emitted.cornerRadius }),
    ...(emitted.points !== undefined && { points: emitted.points }),
    ...(emitted.rotation !== undefined && { rotation: emitted.rotation }),
  }
  return shape
}
