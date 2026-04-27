import type { TextSegment } from '@/lib/types/slide'
import { boldMinimal } from './bold-minimal'
import { darkGradient } from './dark-gradient'
import { softPastel } from './soft-pastel'
import { neonPop } from './neon-pop'
import { cleanSerif } from './clean-serif'
import { newsDrop } from './news-drop'
import { newsCyan } from './news-cyan'
import { highlightBar } from './highlight-bar'
import { magazine } from './magazine'
import { quoteCard } from './quote-card'
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

export const templates: SlideTemplate[] = [
  boldMinimal,
  darkGradient,
  softPastel,
  neonPop,
  cleanSerif,
  newsDrop,
  newsCyan,
  highlightBar,
  magazine,
  quoteCard,
  y2kPop,
  boldYellow,
]

export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
