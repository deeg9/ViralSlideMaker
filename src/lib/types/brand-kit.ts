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

export interface BrandKit {
  id: string
  user_id: string
  name: string
  primary_color: string | null
  secondary_color: string | null
  text_color: string | null
  background_color: string | null
  font_family: string | null
  logo_url: string | null
  // Watermark settings (260427-hut)
  logo_position: LogoPosition | null
  logo_size_pct: number | null    // 4–20, default 10 (percent of canvas width)
  logo_opacity_pct: number | null // 10–100, default 60
  created_at: string
  updated_at: string
}
