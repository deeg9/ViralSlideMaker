export interface SlideStyleOverrides {
  hook_font_size?: number
  body_font_size?: number
  text_color?: string
  text_position?: 'top' | 'center' | 'bottom'
}

export interface Slide {
  hook_text: string
  body_text: string
  image_query: string
  is_cta: boolean
  background_url: string | null
  pexels_photo_id: number | null
  style_overrides?: SlideStyleOverrides
}

export type SlideData = Slide[]

export type GenerationStatus = 'draft' | 'generating' | 'complete' | 'error'
