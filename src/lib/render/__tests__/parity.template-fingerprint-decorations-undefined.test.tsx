// Phase 67 Plan 02 (PARITY-09): PTF16 idempotent-absence fingerprint suite.
//
// Per RESEARCH SUMMARY.md, the TPLREND-05 byte-identity invariant is the
// non-negotiable gate for v2.12: every registered template MUST render
// byte-identical PNG/DOM under `decorations === undefined` AND
// `decorations === []` after Plan 67-01's schema additions. PTF16 pins
// this contract via four snapshot families plus equivalence assertions
// across the entire registry × both renderers.
//
// PTF16-undef-Na: SlidePreview editable={false} + decorations === undefined
// PTF16-undef-Nb: Satori React tree + decorations === undefined
// PTF16-empty-Na: SlidePreview editable={false} + decorations === []
// PTF16-empty-Nb: Satori React tree + decorations === []
// PTF16-equiv-Na: undef.fingerprint === empty.fingerprint via SlidePreview path
// PTF16-equiv-Nb: undef.fingerprint === empty.fingerprint via Satori path
//
// The equivalence assertions use direct string equality (`expect(a).toBe(b)`),
// NOT snapshot matching — they prove idempotent absence directly without
// depending on the snapshot baseline. The strongest possible verification
// that the renderer's layer 5.5 stub (`(slide.decorations ?? []).filter(...).map(_d => null)`)
// cannot distinguish between the two boundary values.
//
// Runtime PTF16 labels generated via template literals — pinned here for
// the verify-gate grep (`PTF16-(undef|empty|equiv)-[0-9]+[ab]\b`):
//   PTF16-undef-1a, PTF16-undef-1b, PTF16-empty-1a, PTF16-empty-1b,
//   PTF16-equiv-1a, PTF16-equiv-1b … (12 templates × 6 = 72 tests +
//   1 registry sanity = 73 tests on v2.11 trailing edge.)
//
// Snapshot file committed at:
//   __snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap
//
// PHASE 68 GATE: This suite MUST be GREEN before reducer work begins.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { templates } from '@/lib/render/templates'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { SlidePreview } from '@/components/slides/slide-preview'
import {
  decorationsUndefinedFixtureSlide,
  decorationsEmptyArrayFixtureSlide,
  computeStructuralFingerprint,
} from './__fixtures__/parity-fingerprint-fixtures'

describe('Phase 67 Plan 02 (PARITY-09): PTF16 idempotent-absence fingerprint', () => {
  // Sanity floor — the registry must hold the v2.11 trailing-edge count so
  // the suite cannot silently skip templates if the registry is wiped or
  // mis-imported. Mirrors the PARITY-04 registry-sanity floor from
  // parity.template-fingerprint.test.tsx.
  it('PTF16 (registry sanity): templates registry holds the v2.11 trailing-edge count', () => {
    expect(templates.length).toBeGreaterThanOrEqual(11)
  })

  templates.forEach((template, idx) => {
    const ptfNum = idx + 1

    describe(`PTF16 (${template.id})`, () => {
      it(`PTF16-undef-${ptfNum}a: SlidePreview editable={false} renders stable fingerprint with decorations === undefined for ${template.id}`, () => {
        const slide = {
          ...decorationsUndefinedFixtureSlide,
          template_id_override: template.id,
        }
        const { container } = render(
          <SlidePreview
            slide={slide}
            template={template}
            index={0}
            editable={false}
          />,
        )
        const fingerprint = computeStructuralFingerprint(container.innerHTML)
        expect(fingerprint).toMatchSnapshot()
      })

      it(`PTF16-undef-${ptfNum}b: Satori React tree renders stable fingerprint with decorations === undefined for ${template.id}`, () => {
        const slide = {
          ...decorationsUndefinedFixtureSlide,
          template_id_override: template.id,
        }
        const html = renderToStaticMarkup(buildSlideElement(slide, template))
        const fingerprint = computeStructuralFingerprint(html)
        expect(fingerprint).toMatchSnapshot()
      })

      it(`PTF16-empty-${ptfNum}a: SlidePreview editable={false} renders stable fingerprint with decorations === [] for ${template.id}`, () => {
        const slide = {
          ...decorationsEmptyArrayFixtureSlide,
          template_id_override: template.id,
        }
        const { container } = render(
          <SlidePreview
            slide={slide}
            template={template}
            index={0}
            editable={false}
          />,
        )
        const fingerprint = computeStructuralFingerprint(container.innerHTML)
        expect(fingerprint).toMatchSnapshot()
      })

      it(`PTF16-empty-${ptfNum}b: Satori React tree renders stable fingerprint with decorations === [] for ${template.id}`, () => {
        const slide = {
          ...decorationsEmptyArrayFixtureSlide,
          template_id_override: template.id,
        }
        const html = renderToStaticMarkup(buildSlideElement(slide, template))
        const fingerprint = computeStructuralFingerprint(html)
        expect(fingerprint).toMatchSnapshot()
      })

      // KEY: idempotent-absence equivalence — direct string equality
      // (NOT snapshots). The renderer cannot distinguish between
      // `decorations === undefined` and `decorations === []`. This is
      // the strongest possible verification of layer 5.5's null-safe
      // iteration stub.
      it(`PTF16-equiv-${ptfNum}a: SlidePreview undef-fingerprint === empty-fingerprint for ${template.id}`, () => {
        const undefSlide = {
          ...decorationsUndefinedFixtureSlide,
          template_id_override: template.id,
        }
        const emptySlide = {
          ...decorationsEmptyArrayFixtureSlide,
          template_id_override: template.id,
        }
        const { container: undefContainer } = render(
          <SlidePreview
            slide={undefSlide}
            template={template}
            index={0}
            editable={false}
          />,
        )
        const { container: emptyContainer } = render(
          <SlidePreview
            slide={emptySlide}
            template={template}
            index={0}
            editable={false}
          />,
        )
        const undefFingerprint = computeStructuralFingerprint(
          undefContainer.innerHTML,
        )
        const emptyFingerprint = computeStructuralFingerprint(
          emptyContainer.innerHTML,
        )
        expect(undefFingerprint).toBe(emptyFingerprint)
      })

      it(`PTF16-equiv-${ptfNum}b: Satori undef-fingerprint === empty-fingerprint for ${template.id}`, () => {
        const undefSlide = {
          ...decorationsUndefinedFixtureSlide,
          template_id_override: template.id,
        }
        const emptySlide = {
          ...decorationsEmptyArrayFixtureSlide,
          template_id_override: template.id,
        }
        const undefHtml = renderToStaticMarkup(
          buildSlideElement(undefSlide, template),
        )
        const emptyHtml = renderToStaticMarkup(
          buildSlideElement(emptySlide, template),
        )
        const undefFingerprint = computeStructuralFingerprint(undefHtml)
        const emptyFingerprint = computeStructuralFingerprint(emptyHtml)
        expect(undefFingerprint).toBe(emptyFingerprint)
      })
    })
  })
})
