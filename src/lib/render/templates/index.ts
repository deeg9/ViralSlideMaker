import type { TextSegment } from '@/lib/types/slide'
import { newsDrop } from './news-drop'
import { newsCyan } from './news-cyan'
import { highlightBar } from './highlight-bar'
import { y2kPop } from './y2k-pop'
import { boldYellow } from './bold-yellow'
import { magazineBold } from './magazine-bold'
import { tr3ndingNews } from './tr3nding-news'
import { documentary } from './documentary'
// Phase 56 (D-02): 3 new free-tier templates appended to preserve picker
// order for existing users.
import { editorialSerif } from './editorial-serif'
import { notesAppChic } from './notes-app-chic'
import { brutalistGrid } from './brutalist-grid'
import { validateTemplateRegistry } from './validate'

// Phase 44: overlay-zone schema. Named-slot positions map to fixed CSS layout in
// the Phase 45 renderer. Style block mirrors the CSS subset already used elsewhere.
export type OverlaySlot = 'top-left' | 'top-right' | 'mid' | 'bottom-card' | 'free'

// Phase 56 (TPL-04, D-13): decorative SVG/PNG asset library closed-enum.
// Assets live in public/overlays/{asset}.{svg|png}; halftone-dots-* are PNG,
// all others are SVG. Validator (templates/validate.ts) enforces this enum
// at module load. renderDecorativeOverlay (resolve-overlay.ts) renders.
//
// IMPORTANT: the type + constant live in a leaf module (decorative.ts) and
// are re-exported here. This avoids a TDZ import cycle between this file
// and templates/validate.ts (mirrors Phase 55's premium-tier.ts pattern,
// D-21 / D-Risk #5).
import type { DecorativeAsset } from './decorative'
export type { DecorativeAsset } from './decorative'
export { DECORATIVE_ASSETS } from './decorative'

// Discriminated union — content source for an overlay.
//   literal      → static text from the template config
//   page-counter → dynamic '{current}/{total}' rendered per slide (format string parsed by Phase 45 renderer)
//   slide-field  → reads from the active slide's render context; closed enum (no open keyof Slide)
//   decorative   → SVG/PNG asset from public/overlays/ (Phase 56 TPL-04, D-13)
export type OverlayContent =
  | { type: 'literal'; text: string }
  | { type: 'page-counter'; format?: string }
  | { type: 'slide-field'; field: 'topic' | 'hook_text' | 'body_text' }
  | { type: 'decorative'; asset: DecorativeAsset; rotation?: number; scale?: number; opacity?: number }

// Overlay declaration. `offset` is fine-tuning relative to the slot's anchor;
// `style` is an inline CSS subset applied by the renderer.
export interface TemplateOverlay {
  position: OverlaySlot
  content: OverlayContent
  offset?: { x: number; y: number }
  style?: {
    background?: string
    color?: string
    padding?: string
    borderRadius?: string | number
    fontSize?: string
    fontWeight?: string | number
    textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
  }
}

export interface SlideTemplate {
  id: string
  name: string
  thumbnail: string
  fontFamily: string
  // Optional separate heading/hook font (260427-bkt). Falls back to fontFamily.
  // Built-in templates leave this undefined → no behavior change.
  headingFontFamily?: string
  hookFontSize: string
  bodyFontSize: string
  textColor: string
  backgroundColor: string
  overlayColor: string
  overlayOpacity: number
  textAlign: 'left' | 'center' | 'right'
  textPosition: 'top' | 'center' | 'bottom'
  hookStyle: 'uppercase' | 'normal' | 'italic'
  // Optional accent color used by two-color news headlines (TextSegment.accent).
  // Falls back to textColor when not set.
  accentColor?: string
  // Optional preview sample used by the template picker to render a real
  // mini SlidePreview tile instead of a synthetic swatch.
  sample?: {
    hook_text: string
    body_text: string
    hook_segments?: TextSegment[]
    layout?: 'cover' | 'body'
  }
  // Phase 44: optional overlay zones composed on top of the base layout.
  // Renderer wiring lands in Phase 45; existing 5 templates leave this undefined.
  overlays?: TemplateOverlay[]
  // Phase 44: background composition mode. Defaults to 'color' (current flat-fill behavior)
  // when undefined, so existing 5 templates require no edits.
  backgroundMode?: 'color' | 'image-bleed' | 'image-with-bottom-card'
  // Phase 47 (TPLAI-04): optional one-line voice note injected into the AI
  // system prompt to nudge tone toward the template's aesthetic. Existing 5
  // legacy templates leave this undefined (no behavior change). NEWS_TEMPLATES
  // newsDropAddendum stays as-is — the two systems coexist.
  aiVoiceNote?: string

  // ====== Phase 55 v2.9 schema additions ======
  // All new fields are OPTIONAL on the type. bodyFontFamily is RUNTIME-REQUIRED
  // on premium-tier templates via validateTemplateRegistry (SLOP-03).

  /** SLOP-03: explicit body font for premium-tier templates. Optional on the type;
      runtime-required for any template in PREMIUM_TEMPLATE_IDS via the validator.
      Legacy 5 templates leave this undefined (their single fontFamily covers body). */
  bodyFontFamily?: string

  /** TPL-06 schema slot (Phase 56 consumes): per-template cover-slide layout overrides.
      Renderer applies these only when slideIndex === 0. Existing 8 templates leave
      undefined → cover slide uses default layout (zero behavior change). */
  coverLayout?: {
    textPosition?: 'top' | 'center' | 'bottom'
    textAlign?: 'left' | 'center' | 'right'
    hookFontSize?: string
    hookStyle?: 'uppercase' | 'normal' | 'italic'
  }

  /** v2.9 visual layer 1.5 (Phase 56 templates consume): grain/noise overlay.
      Resolver helper renderGrain(intensity) returns an <img> pointing to
      /textures/grain-${intensity}.png. Existing 8 templates leave undefined. */
  grainMode?: 'subtle' | 'medium' | 'heavy' | 'paper' | 'xerox'

  /** v2.9 visual layer 2.5 (Phase 56 templates consume): radial vignette.
      Resolver helper renderVignette(strength) returns a div with radial-gradient.
      strength is 0-1 (0 = off). Existing 8 templates leave undefined. */
  vignette?: { strength: number }

  /** v2.9 photo-treatment declaration (Phase 56 generation pipeline maps to TreatmentPreset).
      Closed-enum string deliberately — typing as TreatmentPreset would import sharp into
      the client bundle (Pitfall #5). Existing 8 templates leave undefined. */
  photoTreatment?: 'bw' | 'duotone-cream' | 'duotone-cobalt' | 'contrast-bump'

  /** v2.9 palette mode (Phase 57 consumer logic ships):
      'fixed' = use template.accentColor verbatim (default behavior when undefined);
      'palette-dominant' = pick from slide.style_overrides.derived_palette. */
  paletteMode?: 'fixed' | 'palette-dominant'
}

// Phase 55 (D-21, SLOP-03): PREMIUM_TEMPLATE_IDS lives in `./premium-tier` (leaf
// module) to avoid the validate.ts ↔ index.ts import cycle. Re-exported here for
// public-API stability — external consumers can keep importing from `@/lib/render/templates`.
export { PREMIUM_TEMPLATE_IDS, type PremiumTemplateId } from './premium-tier'

// highlight-bar leads the list so it serves as the default fallback for any
// legacy template_id values from before the v2.5 trim.
export const templates: SlideTemplate[] = [
  highlightBar,
  newsDrop,
  newsCyan,
  y2kPop,
  boldYellow,
  magazineBold,    // new — Phase 46
  tr3ndingNews,    // new — Phase 46
  documentary,     // new — Phase 46
  // Phase 56 (D-02): 3 new free-tier templates
  editorialSerif,
  notesAppChic,
  brutalistGrid,
]

// Phase 44: fail fast at module load if any registered template is misconfigured.
validateTemplateRegistry(templates)

// Phase 58 (AIROLE-03, D-03): closed enum for AI template_id_override.
// Derived at module load — extends automatically when new templates land in
// the array above. Used by validate-slides.ts to silently strip invalid IDs
// from Gemini output (D-06, D-08).
export const TEMPLATE_IDS: readonly string[] = templates.map((t) => t.id)

export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
