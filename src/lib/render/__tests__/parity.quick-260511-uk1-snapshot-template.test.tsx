// quick-260511-uk1: TPLREND-05 parity pin — Option B (the merge-parity
// decision lock from the plan frontmatter) asserted as a regression test.
//
// Phase 89 (BKSHELVE-05/07): the brand-kit feature is shelved. This file
// originally pinned "render output is identical whether a non-null brand kit
// or null is passed" — with brand kit removed both arms are trivially equal.
// The file is retired entirely in a follow-up plan; this wave only strips the
// shelved-feature references so it compiles against the now-prop-free
// SlidePreview and the updated buildSlideElement signature.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { templates } from '@/lib/render/templates'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { SlidePreview } from '@/components/slides/slide-preview'
import {
  fingerprintFixtureSlide,
  computeStructuralFingerprint,
} from './__fixtures__/parity-fingerprint-fixtures'
import type { Slide } from '@/lib/types/slide'

describe('quick-260511-uk1: render-time merge parity pin (Option B)', () => {
  // ===== Registry sanity: matches PTF74 floor =====
  // quick-260519-t3x bumps 13 → 16.
  it('templates registry holds the v2.13 trailing-edge count (16)', () => {
    expect(templates).toHaveLength(16)
  })

  describe('SlidePreview renders a stable fingerprint for every built-in template', () => {
    templates.forEach((template) => {
      it(`${template.id}: render is stable across two passes`, () => {
        const slide: Slide = {
          ...fingerprintFixtureSlide,
          template_id_override: template.id,
        }

        const { container: firstContainer } = render(
          <SlidePreview
            slide={slide}
            template={template}
            index={0}
            editable={false}
          />,
        )
        const { container: secondContainer } = render(
          <SlidePreview
            slide={slide}
            template={template}
            index={0}
            editable={false}
          />,
        )

        const fpFirst = computeStructuralFingerprint(firstContainer.innerHTML)
        const fpSecond = computeStructuralFingerprint(secondContainer.innerHTML)

        expect(fpFirst).toBe(fpSecond)
      })
    })
  })

  describe('buildSlideElement (Satori) renders a stable fingerprint for every built-in template', () => {
    templates.forEach((template) => {
      it(`${template.id}: render is stable across two passes`, () => {
        const slide: Slide = {
          ...fingerprintFixtureSlide,
          template_id_override: template.id,
        }

        const htmlFirst = renderToStaticMarkup(
          buildSlideElement(slide, template),
        )
        const htmlSecond = renderToStaticMarkup(
          buildSlideElement(slide, template),
        )

        const fpFirst = computeStructuralFingerprint(htmlFirst)
        const fpSecond = computeStructuralFingerprint(htmlSecond)

        expect(fpFirst).toBe(fpSecond)
      })
    })
  })
})
