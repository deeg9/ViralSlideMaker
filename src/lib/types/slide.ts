export interface TextPosition {
  x: number  // percentage 0-100, from left
  y: number  // percentage 0-100, from top
}

// Per-word/per-run color spans for two-color news headlines.
// `accent: true` → renderer paints the run with template.accentColor; false → template.textColor.
export interface TextSegment {
  text: string
  accent?: boolean
}

export interface CustomText {
  id: string
  text: string
  x: number        // percentage 0-100
  y: number        // percentage 0-100
  width: number    // percentage 0-100
  font_family?: string
  font_size?: number    // px in 1080x1920 reference
  font_weight?: number
  font_style?: 'normal' | 'italic'
  color?: string
  text_align?: 'left' | 'center' | 'right'
  text_effects?: TextEffects
  segments?: TextSegment[]
}

export interface CustomImage {
  id: string
  url: string           // image URL (Pexels, upload, or AI)
  x: number             // percentage 0-100
  y: number             // percentage 0-100
  width: number         // percentage 0-100
  height: number        // percentage 0-100
  opacity?: number      // 0-100, default 100
  border_radius?: number // px, for rounded corners
}

// Phase 19: Text effects
export interface TextShadowEffect {
  enabled: boolean
  color: string          // 8-digit hex e.g. '#00000080' (NOT rgba)
  size: 'sm' | 'md' | 'lg'
}

export interface TextOutlineEffect {
  enabled: boolean
  color: string          // hex e.g. '#000000'
  width: number          // 1-8 px
}

export interface TextHighlightEffect {
  enabled: boolean
  color: string          // 8-digit hex with alpha e.g. '#000000CC'
  style: 'tight' | 'full'
  padding: number        // 4-24 px
}

export interface TextEffects {
  shadow?: TextShadowEffect
  outline?: TextOutlineEffect
  highlight?: TextHighlightEffect
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
  // Phase 19: Text effects
  hook_text_effects?: TextEffects
  body_text_effects?: TextEffects
  // News-carousel: cover (image top, text bar bottom) vs body (text top, image bottom)
  layout?: 'cover' | 'body'
  // Per-slide watermark hide toggle (260427-hut)
  hide_watermark?: boolean
}

export interface Slide {
  hook_text: string
  body_text: string
  hook_segments?: TextSegment[]
  body_segments?: TextSegment[]
  image_query: string
  is_cta: boolean
  background_url: string | null
  pexels_photo_id: number | null
  style_overrides?: SlideStyleOverrides
  custom_texts?: CustomText[]
  custom_images?: CustomImage[]
}

export type SlideData = Slide[]

export type GenerationStatus = 'draft' | 'generating' | 'complete' | 'error'
