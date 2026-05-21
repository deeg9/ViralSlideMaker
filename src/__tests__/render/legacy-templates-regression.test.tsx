import { describe, it, expect } from 'vitest'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { getTemplate } from '@/lib/render/templates'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 46 — Legacy Template Regression Gate (TPLNEW-05)
 *
 * Snapshots all 5 existing templates (highlight-bar, news-drop, news-cyan,
 * y2k-pop, bold-yellow) through buildSlideElement with a fixed Slide fixture.
 * If the rendered tree changes by even a single byte vs. the v2.6 baseline
 * captured on first run, the test fails LOUD. This guards against silent
 * regressions when Phase 46+ adds new templates / overlay logic.
 *
 * The 5 legacy templates leave `overlays` and `backgroundMode` undefined,
 * so they take the legacy NEWS_LAYOUT path through buildSlideElement —
 * NO bottom-card, NO overlay zones, NO highlight pills.
 *
 * Important: the fixture below is INTENTIONALLY simple — no hook_segments,
 * no custom_texts, no custom_images, no style_overrides — to keep the
 * baseline stable and the regression signal clear. This is a structural
 * regression gate, NOT a content-coverage test.
 */

const fixtureSlide: Slide = {
  hook_text: 'REGRESSION FIXTURE HOOK',
  body_text: 'Regression fixture body copy held intentionally simple.',
  image_query: 'fixture',
  is_cta: false,
  background_url: 'https://example.com/fixture.jpg',
  pexels_photo_id: null,
}

const fixtureCtx = { slideIndex: 0, totalSlides: 1, topic: undefined }

const LEGACY_TEMPLATE_IDS = [
  'highlight-bar',
  'news-drop',
  'news-cyan',
  'y2k-pop',
  'bold-yellow',
] as const

describe('Phase 46 — legacy template regression gate (TPLNEW-05)', () => {
  for (const id of LEGACY_TEMPLATE_IDS) {
    it(`${id}: renders byte-identical to v2.6 baseline`, () => {
      const template = getTemplate(id)
      // Sanity: getTemplate(id) returned the right template (not the fallback).
      expect(template.id).toBe(id)
      // Sanity: legacy templates have no overlays.
      expect(template.overlays).toBeUndefined()
      // quick-260519-pbg: y2k-pop + bold-yellow now declare
      // `backgroundMode: 'color'` (color-block kill-switch — suppresses any
      // persisted slide.background_url so the solid color stays the canvas).
      // The other 3 legacy templates keep backgroundMode undefined.
      if (id === 'y2k-pop' || id === 'bold-yellow') {
        expect(template.backgroundMode).toBe('color')
      } else {
        expect(template.backgroundMode).toBeUndefined()
      }

      const element = buildSlideElement(
        fixtureSlide,
        template,
        'free',
        'http://localhost',
        fixtureCtx,
      )
      expect(element).toMatchSnapshot(`legacy-${id}`)
    })
  }
})
