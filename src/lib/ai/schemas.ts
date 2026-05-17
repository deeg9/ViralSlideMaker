import { z } from 'zod'
import {
  LUCIDE_DECORATION_ALLOWLIST,
  type LucideDecorationName,
} from '@/lib/render/decorations/registry'

// Per-word color spans. `accent: true` = highlight color, false = base color.
// The renderer maps `accent` to template.accentColor / textColor.
//
// Phase 47 (TPLAI-03): widened with optional `highlightColor` (hex) and
// `highlightStyle` locked to z.literal('pill'). The renderer-side TextSegment
// type still permits 'pill' | 'block' for manual editor use; the AI is scoped
// to pill-only here so `block` cannot be smuggled in via the Gemini response.
export const TextSegmentSchema = z.object({
  text: z.string().describe('A single run of text (typically one word)'),
  accent: z.boolean().describe('Highlight this run with the template accent color'),
  highlightColor: z
    .string()
    .optional()
    .describe('Optional accent pill background hex — premium templates only (TPLAI-03)'),
  highlightStyle: z
    .literal('pill')
    .optional()
    .describe(
      'Optional pill style for highlightColor segments — only "pill" allowed for AI-emitted segments (TPLAI-03; block reserved for renderer/manual use)',
    ),
})

export const SlideContentSchema = z.object({
  hook_text: z.string().describe('Attention-grabbing hook for this slide'),
  hook_segments: z
    .array(TextSegmentSchema)
    .optional()
    .describe('Optional: per-word color spans for two-color news headlines'),
  // Phase 82 (R4): body_text is OPTIONAL — headline-only slides are first-class.
  // The property is KEPT (not renamed/removed) for back-compat with the ~50
  // saved projects and pre-Phase-82 carousels.
  body_text: z.string().optional().describe('Optional supporting body copy — omit for headline-only slides (Phase 82 R4)'),
  body_segments: z
    .array(TextSegmentSchema)
    .optional()
    .describe('Optional: per-word color spans for body copy'),
  // Phase 82 (R5): optional small accessory label — a kicker ("TRENDING NEWS")
  // or a one-liner ("This is crazy"). Sparse, never on every slide; the
  // headline stays the dominant element.
  accessory_label: z
    .string()
    .optional()
    .describe(
      'Optional small accessory label — a kicker ("TRENDING NEWS") or one-liner ("This is crazy"). Sparse, never on every slide; the headline stays dominant (Phase 82 R5).',
    ),
  image_query: z.string().describe('Pexels search query for background image'),
  layout: z
    .enum(['cover', 'body'])
    .optional()
    .describe('News-carousel layout: cover (image top, text bar bottom) or body (text top, image bottom)'),
  is_cta: z.boolean().describe('Whether this is the closing CTA slide'),
  // Phase 58 (AIROLE-01, AIROLE-04, D-01): optional in Zod (validator
  // backfills missing/invalid values via assignSlideRoles), required in
  // Gemini Type schema. Zod stays dependency-light — TEMPLATE_IDS validation
  // for template_id_override happens in validate-slides.ts.
  role: z
    .enum(['cover', 'reframe', 'support', 'pivot', 'close'])
    .optional()
    .describe('Slide role in the carousel arc — defaults via validator if missing/invalid (AIROLE-04)'),
  template_id_override: z
    .string()
    .optional()
    .describe(
      'Optional per-slide template_id override (closed enum from registry; invalid values silently stripped per D-08)',
    ),
  // Phase 71 (AI-01..04): raw passthrough — kept loose at the Zod-schema layer
  // so the ingest adapter in generate-slides.ts (which runs DecorationEmitSchema
  // safeParse + resolveAIDecoration + DecorationSchema safeParse) can apply the
  // triple-layer silent-drop without losing entries to a too-strict CarouselSchema
  // gate. The closed-enum AI emit shape is enforced by DecorationEmitSchema
  // immediately downstream (mirror v2.9 D-08 template_id_override pattern).
  decorations: z
    .array(z.unknown())
    .optional()
    .describe(
      'Optional 0..2 AI-emitted decorations (raw passthrough; DecorationEmitSchema validates per-entry post-parse)',
    ),
  // Phase 71 (AI-03): loose passthrough so resolveAIDecoration's color-token
  // resolver can read slide.style_overrides.derived_palette without Zod
  // stripping the field. The full SlideStyleOverrides shape is validated
  // elsewhere; this layer purely preserves the field for ingest.
  style_overrides: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Loose passthrough for downstream resolvers (Phase 71 AI-03 palette read)'),
})

export const CarouselSchema = z.object({
  title: z.string().describe('Carousel title/topic'),
  slides: z.array(SlideContentSchema).min(3).max(10),
})

export type TextSegmentContent = z.infer<typeof TextSegmentSchema>
export type SlideContent = z.infer<typeof SlideContentSchema>
export type Carousel = z.infer<typeof CarouselSchema>

// Phase 67 (DECOR-05): Decoration discriminated-union Zod schema. Registered
// at the AI-ingest boundary; Phase 71 will wire Gemini emit to consume this.
// Plan 67-01 lands the schema only — no runtime consumer yet.
//
// Silent-drop pattern (mirrors v2.9 D-08 template_id_override): unknown
// lucideName (or any other malformed entry) is dropped from the array via
// parseDecorationsArraySafe — never throws. The closed-enum lucideName
// allowlist is a Phase 71 concern; this layer accepts any non-empty string.

// WR-02: Hex-only color guard. Accepts #rrggbb (6-digit) and #rrggbbaa (8-digit
// alpha form used by shadow color). Rejects 'currentColor', CSS named colors,
// CSS variables, and 3-digit shorthand — all invalid for vercel/satori (satori#41).
// Used for all Decoration color and fill fields.
const HexColorSchema = z.string().regex(
  /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/,
  { message: 'Color must be hex format (#rrggbb or #rrggbbaa)' },
)

export const DecorationPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

export const DecorationStrokeSchema = z.object({
  color: HexColorSchema,
  width: z.number(),
  style: z.enum(['solid', 'dashed', 'dotted']),
})

export const DecorationShadowEffectSchema = z.object({
  enabled: z.boolean(),
  color: HexColorSchema,
  size: z.enum(['sm', 'md', 'lg']),
})

export const DecorationEffectsSchema = z.object({
  shadow: DecorationShadowEffectSchema.optional(),
})

const DecorationBaseFields = {
  id: z.string(),
  position: DecorationPositionSchema,
  groupId: z.string().optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  name: z.string().optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  effects: DecorationEffectsSchema.optional(),
} as const

export const IconDecorationSchema = z.object({
  kind: z.literal('icon'),
  ...DecorationBaseFields,
  lucideName: z.string().min(1),
  color: HexColorSchema,
  strokeWidth: z.number(),
})

export const ShapeDecorationSchema = z.object({
  kind: z.literal('shape'),
  ...DecorationBaseFields,
  shapeKind: z.enum([
    'rect',
    'circle',
    'ellipse',
    'triangle',
    'polygon',
    'star',
    'arrow',
    'line',
  ]),
  fill: HexColorSchema,
  stroke: DecorationStrokeSchema.optional(),
  cornerRadius: z.number().optional(),
  points: z.number().optional(),
})

export const DecorationSchema = z.discriminatedUnion('kind', [
  IconDecorationSchema,
  ShapeDecorationSchema,
])

/**
 * Phase 67 (DECOR-05): silent-drop array parser. Per-entry safeParse; malformed
 * entries are filtered without throwing. Mirrors v2.9 D-08 template_id_override
 * defaulting pattern. Phase 71 will additionally clamp to maxItems: 2 and
 * gate lucideName against the closed-enum allowlist — both layered ON TOP of
 * this base validator.
 */
export function parseDecorationsArraySafe(
  input: unknown,
): z.infer<typeof DecorationSchema>[] {
  if (!Array.isArray(input)) return []
  const out: z.infer<typeof DecorationSchema>[] = []
  for (const entry of input) {
    const result = DecorationSchema.safeParse(entry)
    if (result.success) out.push(result.data)
    // else: silent drop — never throws (DECOR-05)
  }
  return out
}

export type DecorationContent = z.infer<typeof DecorationSchema>
export type IconDecorationContent = z.infer<typeof IconDecorationSchema>
export type ShapeDecorationContent = z.infer<typeof ShapeDecorationSchema>

// =====================================================================
// Phase 71 (AI-01..04): DecorationEmitSchema — closed-enum AI emit subset.
// =====================================================================
//
// Contracts (locked here; cross-ref Phase 71 CONTEXT.md decisions):
//
//   1. AI emits NAMED COLOR TOKENS, never raw hex. resolveAIColor
//      (src/lib/ai/resolve-ai-decoration.ts) maps tokens → hex via
//      template.accentColor + slide.style_overrides.derived_palette +
//      template.textColor. Closed enum prevents AI smuggling
//      template-clashing colors.
//
//   2. AI emits SEMANTIC POSITION ANCHORS, never raw % coords.
//      resolveAIPosition maps anchors → safe-zone % coords that
//      explicitly avoid the central 24..76% hook+body band.
//
//   3. lucideName is restricted to AI_LUCIDE_ALLOWLIST — a curated
//      ~100-icon PascalCase subset of Phase 69's 118-name registry
//      (LUCIDE_DECORATION_ALLOWLIST). Single source of truth — Plan
//      71-03 audits non-overlap. Modifying this list requires
//      updating Phase 70 picker AND Phase 71 ingest tests.
//
//   4. Triple-layer silent-drop at AI ingest:
//        DecorationEmitSchema.safeParse → resolveAIDecoration try/catch →
//        DecorationSchema.safeParse → max-2 slice (mirror v2.9 D-08
//        template_id_override defaulting pattern).

/**
 * Phase 71: Hand-curated PascalCase subset of LUCIDE_DECORATION_ALLOWLIST
 * (Phase 69, 118 names). Includes ALL 10 PTF13 fixtures + ~90 broadly
 * applicable names spanning all category clusters. NOT a programmatic
 * filter — explicit list is the source of truth Plan 71-03 audits against.
 *
 * Constraint (enforced by Test 10): every entry MUST appear in
 * LUCIDE_DECORATION_ALLOWLIST. Length within [80, 110] sanity band.
 */
export const AI_LUCIDE_ALLOWLIST = [
  // PTF13 fixtures (10) — locked test set
  'Heart', 'Star', 'Check', 'Zap', 'ArrowRight', 'X', 'Plus', 'Crown', 'Sparkles', 'Circle',
  // Status / nav (12)
  'CheckCheck', 'CircleCheck', 'XCircle', 'Minus', 'Info', 'HelpCircle', 'AlertCircle',
  'AlertTriangle', 'Eye', 'Lock', 'Unlock', 'Key',
  // Arrows + direction (10)
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowUpRight', 'ChevronUp', 'ChevronDown',
  'ChevronLeft', 'ChevronRight', 'MoveUp', 'MoveDown',
  // Shapes (6)
  'Square', 'Triangle', 'Diamond', 'Hexagon', 'StarHalf', 'Sparkle',
  // Weather (7)
  'Sun', 'Moon', 'Cloud', 'CloudRain', 'Flame', 'Snowflake', 'Droplet',
  // People / social (8)
  'Smile', 'ThumbsUp', 'ThumbsDown', 'Hand', 'User', 'Users',
  'MessageCircle', 'MessageSquare',
  // Comms (5)
  'Send', 'Mail', 'Phone', 'Bell', 'Megaphone',
  // Media (7)
  'Music', 'Headphones', 'Mic', 'Camera', 'Image', 'Video', 'Play',
  // Awards / celebration (5)
  'Award', 'Trophy', 'Medal', 'Gift', 'PartyPopper',
  // Nature (4)
  'Leaf', 'Flower', 'TreePine', 'Sprout',
  // Travel / commerce (7)
  'MapPin', 'Globe', 'Home', 'ShoppingCart', 'ShoppingBag', 'Package', 'Coffee',
  // Editing / files (8)
  'Pen', 'Pencil', 'Edit', 'Brush', 'Palette', 'Save', 'Folder', 'FileText',
  // Time (3)
  'Calendar', 'Clock', 'Timer',
  // Charts (4)
  'TrendingUp', 'TrendingDown', 'BarChart', 'PieChart',
  // Misc productivity (4)
  'Target', 'Lightbulb', 'Search', 'Tag',
] as const satisfies readonly LucideDecorationName[]

export type AILucideName = (typeof AI_LUCIDE_ALLOWLIST)[number]

/**
 * Phase 71: 6 named color tokens AI may emit. Server-side resolveAIColor
 * maps these to explicit hex via template.accentColor +
 * slide.style_overrides.derived_palette + template.textColor.
 */
export const AI_COLOR_TOKENS = [
  'accent',
  'palette-vibrant',
  'palette-dark-muted',
  'palette-light',
  'on-light',
  'on-dark',
] as const

export type AIColorToken = (typeof AI_COLOR_TOKENS)[number]

/**
 * Phase 71: 7 semantic position anchors AI may emit. Server-side
 * resolveAIPosition maps these to safe-zone % coord rects that
 * explicitly do NOT occlude the central 24..76% hook+body text band.
 */
export const AI_POSITION_ANCHORS = [
  'top-left',
  'top-right',
  'top-center',
  'center',
  'bottom-left',
  'bottom-right',
  'bottom-center',
] as const

export type AIPositionAnchor = (typeof AI_POSITION_ANCHORS)[number]

// Closed-enum shape kinds — mirror full DecorationSchema's ShapeDecorationSchema.shapeKind.
export const AI_SHAPE_KINDS = [
  'rect',
  'circle',
  'ellipse',
  'triangle',
  'polygon',
  'star',
  'arrow',
  'line',
] as const

export const IconDecorationEmitSchema = z.object({
  kind: z.literal('icon'),
  lucideName: z.enum(AI_LUCIDE_ALLOWLIST as unknown as [string, ...string[]]),
  color: z.enum(AI_COLOR_TOKENS as unknown as [string, ...string[]]),
  position: z.enum(AI_POSITION_ANCHORS as unknown as [string, ...string[]]),
  rotation: z.number().optional(),
})

export const ShapeDecorationEmitSchema = z.object({
  kind: z.literal('shape'),
  shapeKind: z.enum(AI_SHAPE_KINDS as unknown as [string, ...string[]]),
  color: z.enum(AI_COLOR_TOKENS as unknown as [string, ...string[]]),
  position: z.enum(AI_POSITION_ANCHORS as unknown as [string, ...string[]]),
  cornerRadius: z.number().optional(),
  points: z.number().optional(),
  rotation: z.number().optional(),
})

export const DecorationEmitSchema = z.discriminatedUnion('kind', [
  IconDecorationEmitSchema,
  ShapeDecorationEmitSchema,
])

export type DecorationEmitContent = z.infer<typeof DecorationEmitSchema>
export type IconDecorationEmitContent = z.infer<typeof IconDecorationEmitSchema>
export type ShapeDecorationEmitContent = z.infer<typeof ShapeDecorationEmitSchema>
