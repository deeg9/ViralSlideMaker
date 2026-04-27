import { boldMinimal } from './bold-minimal'
import { darkGradient } from './dark-gradient'
import { softPastel } from './soft-pastel'
import { neonPop } from './neon-pop'
import { cleanSerif } from './clean-serif'
import { newsDrop } from './news-drop'

export interface SlideTemplate {
  id: string
  name: string
  thumbnail: string
  fontFamily: string
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
}

export const templates: SlideTemplate[] = [
  boldMinimal,
  darkGradient,
  softPastel,
  neonPop,
  cleanSerif,
  newsDrop,
]

export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
