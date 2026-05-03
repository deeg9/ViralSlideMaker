export interface TextPosition {
  x: number  // percentage 0-100, from left
  y: number  // percentage 0-100, from top
}

// Per-word/per-run color spans for two-color news headlines.
// `accent: true` → renderer paints the run with template.accentColor; false → template.textColor.
// Phase 44: optional per-word highlight pill background (mint-pill aesthetic from Murphy reference).
// Distinct from TextHighlightEffect (per-text-effect) — these are per-segment background pills.
export interface TextSegment {
  text: string
  accent?: boolean
  highlightColor?: string
  highlightStyle?: 'pill' | 'block'
  /** Phase 56 (TPL-07, D-21): per-segment font family for ransom-note hooks
      (notes-app-chic template). When set, renderer applies this fontFamily
      via inline style on the segment's <span>. Falls back to template
      fontFamily when undefined. The font loader walks all referenced
      segment fontFamily values and registers them with Satori at render time. */
  fontFamily?: string
  /** quick-260502-pw8: per-segment bold mark (Word/Figma "select word, click B").
      When true, the segment renders at fontWeight 700 regardless of the parent
      text-box's font_weight. Toggled via the BoldWordsDisclosure chip wall in
      the right-rail Inspector. Renderers honor this via inline fontWeight on
      the segment's <span>. */
  bold?: boolean
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
  /** quick-260502-pw8: paragraph-level list type. Each line of `text`
      (\n-separated) becomes a list item with a literal-text marker prefix
      ("1. " for numbered, "• " for bulleted). Omit for plain text.
      Per-segment styling within list items is a v2 follow-up — list-mode
      renders each line as plain text. */
  list_type?: 'numbered' | 'bulleted'
  /** quick-260502-pw8: paragraph-level indent level (0..2 inclusive). Each
      level adds 32px paddingLeft at the 1080×1920 reference size. Renderer
      clamps; UI buttons enforce 0..2 at edit time. */
  list_indent?: number
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
  /** Phase 60 (WMARK-01 / future GROUP/LOCK/HIDE): additive multi-select fields.
      Behavior lands in Phase 62 (groups), Phase 64 (lock/hide). Phase 60 declares only. */
  groupId?: string
  locked?: boolean
  hidden?: boolean
  /** Phase 65 Plan 01 (LAYERS-04): user-supplied label override for the
      LEFT-rail layers panel. Optional, additive — when set, the layers
      panel displays this string instead of the URL-derived filename.
      Never required; renderers ignore this field. */
  name?: string
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

// Phase 49: Unified text-box model. Replaces the rigid hook_text + body_text + custom_texts
// trio with a single TextBox[] array. Legacy fields on Slide are retained for one milestone
// (sunset target: v2.9) so older clients/exports continue to function.
export type TextBoxRole = 'hook' | 'body' | 'custom'

export type TextBoxAnchor = 'top' | 'center' | 'bottom' | 'custom'

export interface TextBoxPosition {
  anchor: TextBoxAnchor
  x?: number       // percentage 0-100 (only when anchor='custom')
  y?: number       // percentage 0-100 (only when anchor='custom')
  width?: number   // percentage 0-100 (overrides symmetric calc)
}

export interface TextBox {
  id: string                    // crypto.randomUUID()
  role: TextBoxRole
  text: string
  segments?: TextSegment[]
  font_family?: string
  font_size?: number            // px in 1080x1920 reference
  font_weight?: number
  font_style?: 'normal' | 'italic'
  color?: string
  text_align?: 'left' | 'center' | 'right'
  effects?: TextEffects
  /** Phase 60 (WMARK-01 / future GROUP/LOCK/HIDE): additive multi-select fields.
      Behavior lands in Phase 62 (groups), Phase 64 (lock/hide). Phase 60 declares only. */
  groupId?: string
  locked?: boolean
  hidden?: boolean
  position: TextBoxPosition
  /** quick-260502-pw8: paragraph-level list type. Each line of `text`
      (\n-separated) becomes a list item with a literal-text marker prefix
      ("1. " for numbered, "• " for bulleted). Omit for plain text. */
  list_type?: 'numbered' | 'bulleted'
  /** quick-260502-pw8: paragraph-level indent level (0..2 inclusive). Each
      level adds 32px paddingLeft at the 1080×1920 reference size. */
  list_indent?: number
  /** Phase 65 Plan 01 (LAYERS-04): user-supplied label override for the
      LEFT-rail layers panel. Optional, additive — when set, the layers
      panel displays this string instead of the role/text-derived label.
      Never required; renderers ignore this field. */
  name?: string
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
  // Phase 55 (D-08): v2.9 visual quality additions.
  /** v2.9: dominant + cluster colors derived from the treated background photo
      (hex strings). Populated at generation time + on treatment override
      (Phase 56). Consumed by templates with paletteMode: 'palette-dominant'
      (Phase 57). */
  derived_palette?: string[]
  /** v2.9: descriptor of the treatment currently baked into background_url
      (preset descriptor or SHA-256 cache-key suffix). Editor surfaces in
      Phase 57 so users can see what's applied. */
  treatment_applied?: string
  /** Phase 57 (D-09, D-10): per-slide grain intensity override on top of
      template.grainMode. 'off' explicitly disables grain regardless of
      template default. Renderer-side only — NOT a sharp pre-bake.
      Resolved via resolveGrainIntensity(slide, template). */
  grain_intensity?: 'subtle' | 'medium' | 'heavy' | 'off'
  /** quick-260502-er5: per-slide watermark controls.
      Free tier ignores `enabled: false` (forced ViralSlideMaker watermark).
      Paid tier honors all fields. `customLogoUrl` overrides built-in mark. */
  watermark?: {
    enabled?: boolean
    customLogoUrl?: string
    customText?: string
    position?: 'top-left' | 'bottom-left' | 'bottom-right'
  }
}

/** Phase 60 (WMARK-01): Unified watermark element. Lifted from
    SlideStyleOverrides.watermark into an addressable element so it can
    participate in multi-select / group / lock / hide identically to
    TextBox and CustomImage. The legacy SlideStyleOverrides.watermark slot
    is RETAINED for back-compat (one-milestone bridge); Phase 60 mirrors
    between the two paths via watermark-adapter.ts (Plan 02).

    ID strategy: deterministic `w_${slideIndex}` (per RESEARCH Q2).
    Idempotent: legacyWatermarkToElement(legacyWatermarkToElement(slide))
    produces equal id values across both calls. */
export interface Watermark {
  id: string
  // Existing watermark config fields (mirrored from style_overrides.watermark)
  enabled?: boolean
  customLogoUrl?: string
  customText?: string
  position?: 'top-left' | 'bottom-left' | 'bottom-right'
  // Phase 60 additive fields (matches TextBox + CustomImage)
  groupId?: string
  locked?: boolean
  hidden?: boolean
}

export interface Slide {
  /** @deprecated v2.8 — use text_boxes. Retained for backward compat through v2.9. */
  hook_text: string
  /** @deprecated v2.8 — use text_boxes. Retained for backward compat through v2.9. */
  body_text: string
  /** @deprecated v2.8 — use text_boxes. */
  hook_segments?: TextSegment[]
  /** @deprecated v2.8 — use text_boxes. */
  body_segments?: TextSegment[]
  image_query: string
  is_cta: boolean
  background_url: string | null
  pexels_photo_id: number | null
  style_overrides?: SlideStyleOverrides
  /** @deprecated v2.8 — use text_boxes (role='custom' entries). */
  custom_texts?: CustomText[]
  custom_images?: CustomImage[]
  /** Phase 49: Unified text-box array. When absent, derived from legacy fields on load. */
  text_boxes?: TextBox[]
  /** Phase 60 (WMARK-01): Unified watermark element. When absent, derived
      from style_overrides.watermark via legacyWatermarkToElement on slide
      load (see use-slide-editor.ts createInitialState in Plan 02). Both
      renderers consume from this field when present, fall back to
      style_overrides.watermark when absent. Sunset target: v2.12+ post-PMF. */
  watermark?: Watermark
  // Phase 55 (D-08): v2.9 visual quality additions.
  /** v2.9: untreated source photo URL (Pexels/Imagen). Populated by Phase 56
      generation pipeline; consumed by treatment-override re-treat path so we
      never compound treatments on already-treated output. */
  original_source_url?: string
  /** v2.9: per-slide template override. When set, the renderer uses
      getTemplate(template_id_override) instead of project.template_id.
      Closed-enum at runtime via validateAndRepair (Phase 58 wires AI to
      populate); Phase 55 only declares the slot. */
  template_id_override?: string
}

export type SlideData = Slide[]

export type GenerationStatus = 'draft' | 'generating' | 'complete' | 'error'
