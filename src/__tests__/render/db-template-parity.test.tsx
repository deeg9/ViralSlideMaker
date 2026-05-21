// Phase 83 (TSTORE-03): DB-backed template render parity.
//
// A DB-backed template must render consistently across all three render paths
// — canvas editor preview (SlidePreview), Satori PNG export (buildSlideElement),
// and HTML export (buildSlideHtml). Because all three paths take a SlideTemplate
// OBJECT (never an id) and the registry's resolveTemplate returns a
// SlideTemplate, a DB template flows through the exact same renderer code as a
// code template — this suite proves it.
//
// Hermetic: the DB row is injected via the registry test seam
// (__setDbTemplateFetcher). NO live DB connection.

import { describe, it, expect, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import {
  resolveTemplate,
  getDbTemplatesMap,
  __setDbTemplateFetcher,
  __resetDbTemplateRegistry,
} from '@/lib/render/templates/registry'
import type { DbTemplateRow } from '@/lib/render/templates/db-template-row'
import { getTemplate, templates } from '@/lib/render/templates'
import type { SlideTemplate } from '@/lib/render/templates'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { buildSlideHtml } from '@/lib/render/render-slide'
import { SlidePreview } from '@/components/slides/slide-preview'
import type { Slide } from '@/lib/types/slide'

// The code template whose flat style the DB fixture mirrors. Choosing an
// existing code template makes the fixture a realistic, fully-populated
// template AND lets the cross-path-parity test compare DB vs code output.
const SOURCE_CODE_ID = 'bold-yellow'
const DB_FIXTURE_ID = 'db-parity-fixture'

// Build the DB fixture's flat_style from the source code template's scalar
// fields (everything except id/name — the DB row carries those as columns).
function buildFlatStyleFrom(codeId: string): Record<string, unknown> {
  const src = getTemplate(codeId) as Record<string, unknown>
  const flat: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(src)) {
    if (k === 'id' || k === 'name') continue
    flat[k] = v
  }
  return flat
}

function makeFixtureRow(): DbTemplateRow {
  return {
    id: DB_FIXTURE_ID,
    name: 'DB Parity Fixture',
    category: 'news',
    flat_style: buildFlatStyleFrom(SOURCE_CODE_ID),
    layout_recipe: null,
    preview: null,
    created_by: null,
    created_at: '2026-05-18T00:00:00Z',
    updated_at: '2026-05-18T00:00:00Z',
  }
}

function makeMinimalSlide(): Slide {
  return {
    hook_text: 'DB PARITY HOOK',
    body_text: 'A DB-backed template renders like a code one.',
    image_query: 'sample',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
}

afterEach(() => {
  __resetDbTemplateRegistry()
})

describe('Phase 83: DB-backed template render parity (TSTORE-03)', () => {
  it('resolveTemplate maps a DB row to a SlideTemplate with flat_style fields intact', async () => {
    __setDbTemplateFetcher(async () => [makeFixtureRow()])
    const tpl = await resolveTemplate(DB_FIXTURE_ID)
    const source = getTemplate(SOURCE_CODE_ID)
    expect(tpl.id).toBe(DB_FIXTURE_ID)
    // flat_style scalar fields flowed through the mapper.
    expect(tpl.backgroundColor).toBe(source.backgroundColor)
    expect(tpl.fontFamily).toBe(source.fontFamily)
    expect(tpl.hookFontSize).toBe(source.hookFontSize)
  })

  it('Satori PNG path: buildSlideElement renders the DB template without throwing', async () => {
    __setDbTemplateFetcher(async () => [makeFixtureRow()])
    const tpl = await resolveTemplate(DB_FIXTURE_ID)
    const slide = makeMinimalSlide()
    const element = buildSlideElement(slide, tpl)
    expect(React.isValidElement(element)).toBe(true)
    const markup = renderToStaticMarkup(element)
    expect(markup.length).toBeGreaterThan(0)
    expect(markup).toContain(slide.hook_text)
  })

  it('HTML export path: buildSlideHtml renders the DB template without throwing', async () => {
    __setDbTemplateFetcher(async () => [makeFixtureRow()])
    const tpl = await resolveTemplate(DB_FIXTURE_ID)
    const slide = makeMinimalSlide()
    const html = buildSlideHtml(slide, tpl)
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain(slide.hook_text)
  })

  it('cross-path parity: a DB template renders identically to its code-template equivalent', async () => {
    // The DB fixture's flat_style is copied verbatim from SOURCE_CODE_ID, so the
    // ONLY differences between the resolved DB template and the code template
    // are id and name. HTML export must therefore differ ONLY by those two.
    __setDbTemplateFetcher(async () => [makeFixtureRow()])
    const dbTemplate = await resolveTemplate(DB_FIXTURE_ID)
    const codeTemplate = getTemplate(SOURCE_CODE_ID)
    const slide = makeMinimalSlide()

    const dbHtml = buildSlideHtml(slide, dbTemplate)
    const codeHtml = buildSlideHtml(slide, codeTemplate)

    // Normalize the id/name out of both renders, then assert equality.
    const normalize = (html: string, tpl: SlideTemplate): string =>
      html.split(tpl.id).join('TPL_ID').split(tpl.name).join('TPL_NAME')

    expect(normalize(dbHtml, dbTemplate)).toBe(normalize(codeHtml, codeTemplate))
  })

  it('canvas-preview path: the resolved DB template renders via SlidePreview and is the same object fed to the export paths', async () => {
    __setDbTemplateFetcher(async () => [makeFixtureRow()])
    const tpl = await resolveTemplate(DB_FIXTURE_ID)
    const slide = makeMinimalSlide()

    // Canvas path — SlidePreview takes a `template: SlideTemplate` prop.
    const previewMarkup = renderToStaticMarkup(
      <SlidePreview slide={slide} template={tpl} index={0} />,
    )
    expect(previewMarkup.length).toBeGreaterThan(0)

    // Object-identity guarantee: the SAME resolved SlideTemplate object is the
    // one passed to all three render paths — there is no per-path divergence
    // introduced by DB storage. "One SlideTemplate, three consumers."
    const satoriEl = buildSlideElement(slide, tpl)
    const html = buildSlideHtml(slide, tpl)
    expect(React.isValidElement(satoriEl)).toBe(true)
    expect(typeof html).toBe('string')
    // tpl is not a code template (it is a DB-resolved object).
    expect(templates.some((t) => t === tpl)).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// Phase 88 (WIRE-04): per-slide template_id_override pointing at a DB template
// id. The DB fixture's flat_style is copied from 'bold-yellow' (backgroundColor
// #FFD600); the project template is 'news-cyan' (backgroundColor #0a0a0a). A
// slide carrying template_id_override = the DB id must render the DB fixture's
// #FFD600 when the builders are given the DB-template map, and fall back to the
// project template's #0a0a0a when the map is omitted (STYLESPEC-10).
// -----------------------------------------------------------------------------
describe('Phase 88 WIRE-04: per-slide DB template_id_override parity', () => {
  const DB_BG = '#FFD600' // bold-yellow — the DB fixture's backgroundColor
  const PROJECT_BG = '#0a0a0a' // news-cyan — the project template's backgroundColor

  function makeOverrideSlide(): Slide {
    return {
      ...makeMinimalSlide(),
      template_id_override: DB_FIXTURE_ID,
    }
  }

  it('buildSlideHtml resolves a per-slide DB override when the DB-template map is supplied', async () => {
    __setDbTemplateFetcher(async () => [makeFixtureRow()])
    const dbMap = await getDbTemplatesMap()
    const projectTemplate = getTemplate('news-cyan')
    const overrideSlide = makeOverrideSlide()

    const html = buildSlideHtml(overrideSlide, projectTemplate, undefined, dbMap)
    // The DB fixture's backgroundColor renders — the override resolved.
    expect(html).toContain(DB_BG)
    expect(html).not.toContain(PROJECT_BG)
  })

  it('buildSlideElement resolves a per-slide DB override when the DB-template map is supplied', async () => {
    __setDbTemplateFetcher(async () => [makeFixtureRow()])
    const dbMap = await getDbTemplatesMap()
    const projectTemplate = getTemplate('news-cyan')
    const overrideSlide = makeOverrideSlide()

    const markup = renderToStaticMarkup(
      buildSlideElement(overrideSlide, projectTemplate, undefined, undefined, undefined, dbMap),
    )
    expect(markup).toContain(DB_BG)
    expect(markup).not.toContain(PROJECT_BG)
  })

  it('falls back to the project template when no DB-template map is passed (STYLESPEC-10)', async () => {
    __setDbTemplateFetcher(async () => [makeFixtureRow()])
    const projectTemplate = getTemplate('news-cyan')
    const overrideSlide = makeOverrideSlide()

    // No map → the DB-id override is unresolvable → silent fallback to the
    // project template. The project template's backgroundColor renders.
    const html = buildSlideHtml(overrideSlide, projectTemplate)
    expect(html).toContain(PROJECT_BG)
    expect(html).not.toContain(DB_BG)
  })
})
