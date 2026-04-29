import type { TextSegment } from '@/lib/types/slide'
import { newsDrop } from './news-drop'
import { newsCyan } from './news-cyan'
import { highlightBar } from './highlight-bar'
import { y2kPop } from './y2k-pop'
import { boldYellow } from './bold-yellow'
import { magazineBold } from './magazine-bold'
import { tr3ndingNews } from './tr3nding-news'
import { documentary } from './documentary'
import { validateTemplateRegistry } from './validate'

// Phase 44: overlay-zone schema. Named-slot positions map to fixed CSS layout in
// the Phase 45 renderer. Style block mirrors the CSS subset already used elsewhere.
export type OverlaySlot = 'top-left' | 'top-right' | 'mid' | 'bottom-card' | 'free'

// Discriminated union — content source for an overlay.
//   literal      → static text from the template config
//   page-counter → dynamic '{current}/{total}' rendered per slide (format string parsed by Phase 45 renderer)
//   slide-field  → reads from the active slide's render context; closed enum (no open keyof Slide)
export type OverlayContent =
  | { type: 'literal'; text: string }
  | { type: 'page-counter'; format?: string }
  | { type: 'slide-field'; field: 'topic' | 'hook_text' | 'body_text' }

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
}

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
]

// Phase 44: fail fast at module load if any registered template is misconfigured.
validateTemplateRegistry(templates)

export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
