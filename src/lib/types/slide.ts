export interface TextPosition {
  x: number  // percentage 0-100, from left
  y: number  // percentage 0-100, from top
}

export interface SlideStyleOverrides {
  hook_font_size?: number
  body_font_size?: number
  text_color?: string
  hook_text_color?: string
  body_text_color?: string
  text_position?: 'top' | 'center' | 'bottom'
  text_align?: 'left' | 'center' | 'right'
  hook_position?: TextPosition
  body_position?: TextPosition
  overlay_opacity?: number  // 0-100, overrides template overlayOpacity
  // Phase 11: Bold/italic
  hook_font_weight?: number
  body_font_weight?: number
  hook_font_style?: 'normal' | 'italic'
  body_font_style?: 'normal' | 'italic'
  // Phase 12: Font family
  hook_font_family?: string
  body_font_family?: string
  // Phase 13: Text box width
  hook_width?: number   // percentage 0-100, overrides symmetric width calc
  body_width?: number   // percentage 0-100, overrides symmetric width calc
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
