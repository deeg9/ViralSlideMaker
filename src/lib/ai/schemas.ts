import { z } from 'zod'

export const SlideContentSchema = z.object({
  hook_text: z.string().describe('Attention-grabbing hook for this slide'),
  body_text: z.string().describe('Supporting body copy'),
  image_query: z.string().describe('Pexels search query for background image'),
  is_cta: z.boolean().describe('Whether this is the closing CTA slide'),
})

export const CarouselSchema = z.object({
  title: z.string().describe('Carousel title/topic'),
  slides: z.array(SlideContentSchema).min(3).max(10),
})

export type SlideContent = z.infer<typeof SlideContentSchema>
export type Carousel = z.infer<typeof CarouselSchema>
