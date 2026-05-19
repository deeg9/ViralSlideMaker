import { getTemplate, TEMPLATE_IDS, type SlideTemplate } from './templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * quick-260515-epn — single source of truth for per-slide template resolution.
 *
 * Resolve the effective SlideTemplate for one slide given the project-level
 * template the caller already computed (post brand-kit synthesis OR registry
 * lookup by project.template_id). All five render surfaces (editor canvas,
 * editor thumbnails, Satori PNG export, HTML preview, explore / dashboard
 * SlidePreview wrappers) import this helper — no inlined
 * `getTemplate(slide.template_id_override)` patterns should drift across files.
 *
 * Precedence (most-specific first):
 *   1. slide.template_id_override (top-level — the generation pipeline lifts
 *      from style_overrides.template_id_override onto Slide.template_id_override
 *      after PROJECTOR FUSION).
 *   2. slide.style_overrides?.template_id_override (defensive read for the
 *      pre-fusion projector emit shape — generate-from-style-spec.ts is the
 *      lifter; readers honor BOTH slots so a slide that bypasses the lift
 *      still renders with the right archetype-matched template).
 *   3. projectTemplate (caller-resolved: brand-kit synthesis OR registry
 *      lookup by project.template_id — this helper is brand-kit-agnostic).
 *
 * Override resolution order (Phase 88 WIRE-04):
 *   - A code-template id (in the TEMPLATE_IDS closed enum) → `getTemplate`.
 *   - A DB-template id, when the optional `dbTemplates` map is supplied AND
 *     the id is a key of it → that DB template.
 *   - Any other override (a genuinely-unknown id, or a DB id when no map was
 *     supplied) → `projectTemplate`, silently.
 *
 * The silent fall-back to `projectTemplate` mirrors the STYLESPEC-10 / EMIT-08
 * / PARITY-03 silent-drop discipline from STATE.md — `getTemplate` itself is
 * forgiving and would return `templates[0]` (highlight-bar) for an unknown id,
 * which would WRONGLY override the project's choice. We resolve known ids
 * explicitly and return `projectTemplate` on miss so the project's template
 * stays in control.
 *
 * The optional `dbTemplates` map keeps this helper SYNCHRONOUS: the server
 * render routes pre-fetch the DB templates once (via
 * `registry.getDbTemplatesMap()`) and pass the map in, so the sync builders
 * (`buildSlideElement` / `buildSlideHtml`) and the seven client-component
 * callers never have to become async. Client callers omit the map — their
 * resolution is byte-identical to pre-Phase-88 (code-only).
 *
 * TPLREND-05 byte-identity: when both override slots are undefined, the
 * RETURN VALUE is the EXACT projectTemplate reference passed in. Tests assert
 * `===` to lock this; the helper does not clone, merge, or mutate.
 */
export function resolvePerSlideTemplate(
  slide: Pick<Slide, 'template_id_override' | 'style_overrides'>,
  projectTemplate: SlideTemplate,
  // Phase 88 (WIRE-04): an optional synchronous DB-template lookup. Server
  // render routes pre-fetch it via registry.getDbTemplatesMap() so a per-slide
  // override pointing at a DB template id resolves here. Client-component
  // callers omit it — they keep the code-only resolution, byte-identical to
  // pre-Phase-88. STYLESPEC-10 is preserved either way: an override that is
  // neither a code id nor a key of this map silently falls back to
  // projectTemplate.
  dbTemplates?: ReadonlyMap<string, SlideTemplate>,
): SlideTemplate {
  const override =
    slide.template_id_override ?? slide.style_overrides?.template_id_override
  if (!override) return projectTemplate
  if (TEMPLATE_IDS.includes(override)) return getTemplate(override)
  const dbMatch = dbTemplates?.get(override)
  if (dbMatch) return dbMatch
  return projectTemplate
}
