// Phase 67 (DECOR-01..04): Decoration types — discriminated union for icons + shapes.
// Schema is purely additive on Slide; both renderers iterate (slide.decorations ?? [])
// at layer 5.5 (between custom_images at 5.0 and watermark at 6.0). When the
// array is undefined, zero DOM nodes are emitted — byte-identical to pre-v2.12
// baseline. Actual rendering deferred to Phase 69 (decoration-renderer.tsx).
//
// Color fields are ALWAYS explicit hex (e.g. '#FF0000') — never 'currentColor',
// never CSS named colors, never CSS variables. PCL12 grep gate (Phase 69)
// enforces this in src/lib/render/. The Phase 71 AI-ingest pipeline will
// resolve named-token colors ('accent' / 'palette-vibrant') to hex server-side
// BEFORE any decoration reaches this type.

export type DecorationShadowEffect = {
  enabled: boolean
  color: string          // 8-digit hex e.g. '#00000080' (mirror v2.1 TextShadowEffect)
  size: 'sm' | 'md' | 'lg'
}

export interface DecorationEffects {
  shadow?: DecorationShadowEffect
}

export interface DecorationBase {
  id: string                       // crypto.randomUUID() — same as TextBox/CustomImage
  /** Position + size as % of canvas (0-100). 4-tuple matches CustomImage layout
      semantics. Both renderers translate to px at REF dimensions (1080x1920). */
  position: { x: number; y: number; width: number; height: number }
  /** Multi-select meta-fields — same shape as TextBox + CustomImage + Watermark.
      Reducer support extends in Phase 68. */
  groupId?: string
  locked?: boolean
  hidden?: boolean
  /** User-supplied label override for the layers panel. Mirrors LAYERS-04. */
  name?: string
  /** Rotation in degrees, default 0. CSS transform: rotate() at render time
      (Phase 69 wires renderer; Phase 72 wires interactive handle). */
  rotation?: number
  /** Opacity 0..1, default 1. CSS-native scale — DIFFERENT from CustomImage.opacity (0..100).
      Renderer uses this value directly as a CSS opacity; do NOT divide by 100.
      Zod guard: z.number().min(0).max(1) in schemas.ts (WR-01). */
  opacity?: number
  /** Effects (drop shadow only this milestone). CSS box-shadow on wrapping
      <div> at render time — never SVG <filter> (vercel/satori#573). */
  effects?: DecorationEffects
}

export interface IconDecoration extends DecorationBase {
  kind: 'icon'
  /** Closed-enum at AI-ingest boundary; OPEN in this type (UI picker emits
      arbitrary strings from the lucide registry; the Zod validator at the
      AI boundary in Phase 71 silently drops unknowns). */
  lucideName: string
  /** Explicit hex (e.g. '#1F2937'). Never 'currentColor' (vercel/satori#41). */
  color: string
  /** Stroke width in px (typical Lucide range 1-3). */
  strokeWidth: number
}

export type ShapeKind =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'star'
  | 'arrow'
  | 'line'

export interface DecorationStroke {
  color: string                    // explicit hex
  width: number                    // px
  style: 'solid' | 'dashed' | 'dotted'
}

export interface ShapeDecoration extends DecorationBase {
  kind: 'shape'
  shapeKind: ShapeKind
  /** Explicit hex fill (e.g. '#A8E0B0'). */
  fill: string
  stroke?: DecorationStroke
  /** Corner radius in px — only meaningful for shapeKind: 'rect'. Renderer
      ignores on other kinds. */
  cornerRadius?: number
  /** Vertex count — only meaningful for shapeKind: 'polygon' (5/6/8) or
      'star' (5/6 points). Renderer ignores on other kinds. */
  points?: number
}

export type Decoration = IconDecoration | ShapeDecoration
