import { z } from 'zod'

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
  body_text: z.string().describe('Supporting body copy'),
  body_segments: z
    .array(TextSegmentSchema)
    .optional()
    .describe('Optional: per-word color spans for body copy'),
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
})

export const CarouselSchema = z.object({
  title: z.string().describe('Carousel title/topic'),
  slides: z.array(SlideContentSchema).min(3).max(10),
})

export type TextSegmentContent = z.infer<typeof TextSegmentSchema>
export type SlideContent = z.infer<typeof SlideContentSchema>
export type Carousel = z.infer<typeof CarouselSchema>
