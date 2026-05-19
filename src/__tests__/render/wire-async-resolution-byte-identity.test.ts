// Phase 88 (WIRE-06): sync-vs-async resolution byte-identity guard.
//
// WIRE-03 converts the render-path / publish / prompt / editor call sites from
// the sync code-only getTemplate(id) to the async DB-aware resolveTemplate(id).
// resolveTemplate is code-first — it resolves a code id from the SAME
// templates[] array getTemplate uses. This suite is the load-bearing proof
// that the conversion is behavior-neutral for the 13 code template ids:
//   A. resolveTemplate(id) === getTemplate(id) byte-identical (sha256 of JSON).
//   B. buildSlideHtml output is byte-identical whether the template came from
//      the sync or the async resolver — i.e. the render is unchanged.
//   C. An unknown id falls back to templates[0] identically on both paths.
//
// Hermetic: DB fetcher stubbed empty via the registry test seam. No live DB.

import { describe, it, expect, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  resolveTemplate,
  __setDbTemplateFetcher,
  __resetDbTemplateRegistry,
} from '@/lib/render/templates/registry'
import { getTemplate, TEMPLATE_IDS } from '@/lib/render/templates'
import { buildSlideHtml } from '@/lib/render/render-slide'
import type { Slide } from '@/lib/types/slide'

function sha(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function makeSlide(): Slide {
  return {
    hook_text: 'WIRE-06 GUARD HOOK',
    body_text: 'Sync and async resolution must render identically.',
    image_query: 'sample',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
}

afterEach(() => {
  __resetDbTemplateRegistry()
})

describe('Phase 88 WIRE-06: sync getTemplate vs async resolveTemplate byte-identity', () => {
  it('resolveTemplate returns every code template byte-identical to getTemplate', async () => {
    __setDbTemplateFetcher(async () => [])
    for (const id of TEMPLATE_IDS) {
      expect(
        sha(await resolveTemplate(id)),
        `code template '${id}' diverged sync vs async`,
      ).toBe(sha(getTemplate(id)))
    }
  })

  it('buildSlideHtml output is byte-identical for the sync- vs async-resolved code template', async () => {
    __setDbTemplateFetcher(async () => [])
    const slide = makeSlide()
    for (const id of TEMPLATE_IDS) {
      const syncHtml = buildSlideHtml(slide, getTemplate(id))
      const asyncHtml = buildSlideHtml(slide, await resolveTemplate(id))
      expect(asyncHtml, `HTML render for '${id}' diverged sync vs async`).toBe(syncHtml)
    }
  })

  it('an unknown id falls back to templates[0] on BOTH paths (getTemplate and resolveTemplate)', async () => {
    __setDbTemplateFetcher(async () => [])
    const syncFallback = getTemplate('definitely-not-a-real-template-id')
    const asyncFallback = await resolveTemplate('definitely-not-a-real-template-id')
    expect(sha(asyncFallback)).toBe(sha(syncFallback))
  })
})
