import { z } from 'zod'

// Per-word color spans. `accent: true` = highlight color, false = base color.
// The renderer maps `accent` to template.accentColor / textColor.
export const TextSegmentSchema = z.object({
  text: z.string().describe('A single run of text (typically one word)'),
  accent: z.boolean().describe('Highlight this run with the template accent color'),
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
})

export const CarouselSchema = z.object({
  title: z.string().describe('Carousel title/topic'),
  slides: z.array(SlideContentSchema).min(3).max(10),
})

export type TextSegmentContent = z.infer<typeof TextSegmentSchema>
export type SlideContent = z.infer<typeof SlideContentSchema>
export type Carousel = z.infer<typeof CarouselSchema>
