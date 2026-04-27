export type LogoPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type BrandKitTextAlign = 'left' | 'center' | 'right'
export type BrandKitTextPosition = 'top' | 'center' | 'bottom'
export type BrandKitHookStyle = 'uppercase' | 'normal' | 'italic'

export interface BrandKit {
  id: string
  user_id: string
  name: string
  primary_color: string | null
  secondary_color: string | null
  text_color: string | null
  background_color: string | null
  font_family: string | null  // Legacy single-font field; preserved for back-compat
  logo_url: string | null
  // Watermark settings (260427-hut)
  logo_position: LogoPosition | null
  logo_size_pct: number | null    // 4–20, default 10 (percent of canvas width)
  logo_opacity_pct: number | null // 10–100, default 60
  // Brand-kit-as-template fields (260427-bkt)
  heading_font_family: string | null
  body_font_family: string | null
  accent_color: string | null
  text_align: BrandKitTextAlign | null
  text_position: BrandKitTextPosition | null
  hook_style: BrandKitHookStyle | null
  overlay_opacity_pct: number | null  // 0–100
  created_at: string
  updated_at: string
}
