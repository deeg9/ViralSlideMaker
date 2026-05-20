import type { TextSegment } from '@/lib/types/slide'
import { newsDrop } from './news-drop'
import { newsCyan } from './news-cyan'
// quick task 260518-jhg: Oracle-style news keeper for the marketing-launch picker.
import { newsOracle } from './news-oracle'
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
import { paperEssay } from './paper-essay'
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
  // Optional hook font weight (260503-0f2). Defaults to 900 in both renderers
  // when undefined. Templates using single-weight display fonts (e.g. Anton —
  // Google Fonts ships only weight 400) MUST set this to 400 to match
  // browser-DOM fallback behavior in Satori PNG export. Without this, Satori
  // and browser disagree on glyph metrics → exported PNG diverges from preview.
  hookFontWeight?: number
  // Optional accent color used by two-color news headlines (TextSegment.accent).
  // Falls back to textColor when not set.
  accentColor?: string
  // Phase 86 (ADMIN-02): optional public URL of a rendered cover-snapshot PNG.
  // Set by the admin Save-as-Template flow for DB templates; the 13 code
  // templates leave it undefined and render via <SlidePreview> (no behavior
  // change — render parity preserved).
  preview?: string
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

  /** quick-260519-cdf: per-template caption-card baseline that `resolveCaptionBar`
      prefers over the global constants when set. Lets a template ship a tuned
      card geometry (height / edge-blend / opacity) without forcing every slide to
      carry explicit overrides. User-explicit `caption_bar_*` keys on a slide
      still win — this only changes the FALLBACK. Legacy templates leaving it
      undefined behave byte-identically (no-color/no-opacity branch in
      resolveCaptionBar still routes to `bottomCardBackground`). */
  captionCardDefaults?: {
    heightPct?: number
    blendPct?: number
    opacity?: number
  }
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
  // Pure-typography editorial cream — no photo, restrained mindful-essay vibe.
  paperEssay,
  // quick task 260518-jhg: appended at the END so existing templates keep
  // their indices (registry-driven fingerprint test assigns this PTF13).
  newsOracle,
]

// Phase 44: fail fast at module load if any registered template is misconfigured.
validateTemplateRegistry(templates)

// Phase 58 (AIROLE-03, D-03): closed enum for AI template_id_override.
// Derived at module load — extends automatically when new templates land in
// the array above. Used by validate-slides.ts to silently strip invalid IDs
// from Gemini output (D-06, D-08).
export const TEMPLATE_IDS: readonly string[] = templates.map((t) => t.id)

// Templates kept in the registry (so legacy projects still render via
// getTemplate()) but hidden from the user-facing visual-style picker.
// Adding an ID here removes it from the picker without breaking existing
// projects whose template_id was assigned before the style was retired.
//
// Phase 82 (R8/R9): this set IS the user-approved cull list recorded in
// `82-KEEPER-SIGNOFF.md` (signed off 2026-05-17). The keeper-list curation is
// hide-not-delete — the ids below lose only their picker visibility; their
// renderer code and registry entries stay, so `getTemplate()` still resolves
// every culled id and the ~50 saved projects render byte-identically (v2.13
// render-parity invariant preserved). pickerTemplates (below) therefore yields
// exactly the 5 approved keepers: news-oracle, tr3nding-news, bold-yellow,
// editorial-serif, y2k-pop. Both shipping content categories (News, Facts) are
// covered by keepers — no category can resolve to a hidden template.
//
// quick task 260518-jhg: 'news-cyan' retired from the picker (non-destructive —
// news-cyan.ts unmodified, getTemplate('news-cyan') still resolves so the 3
// existing news-cyan carousels render byte-identically). The new picker-facing
// news keeper is 'news-oracle'.
export const HIDDEN_FROM_PICKER: ReadonlySet<string> = new Set([
  'highlight-bar',
  'news-drop',
  'news-cyan',
  'magazine-bold',
  'documentary',
  'notes-app-chic',
  'brutalist-grid',
  'paper-essay',
])

// Phase 82 (R8): the keeper-filtered picker list — exactly the 5 approved
// keepers (news-oracle, tr3nding-news, bold-yellow, editorial-serif, y2k-pop;
// see quick task 260518-jhg for the news-cyan -> news-oracle swap).
// Category->template coverage (every `templateIds` entry across all
// CATEGORIES modules must be a picker-visible keeper, so a category never
// resolves to a hidden template — SPEC R7) is asserted in the keeper-curation
// test: `templates/__tests__/keeper-curation.test.ts`. Importing the category
// registry here would create a render<->ai import cycle, so the invariant is
// enforced by that test rather than at module load.
export const pickerTemplates: SlideTemplate[] = templates.filter(
  (t) => !HIDDEN_FROM_PICKER.has(t.id),
)

export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
