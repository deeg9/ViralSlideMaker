import type { TextSegment } from '@/lib/types/slide'
import { newsDrop } from './news-drop'
import { newsCyan } from './news-cyan'
import { highlightBar } from './highlight-bar'
import { y2kPop } from './y2k-pop'
import { boldYellow } from './bold-yellow'

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
}

// highlight-bar leads the list so it serves as the default fallback for any
// legacy template_id values from before the v2.5 trim.
export const templates: SlideTemplate[] = [
  highlightBar,
  newsDrop,
  newsCyan,
  y2kPop,
  boldYellow,
]

export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
