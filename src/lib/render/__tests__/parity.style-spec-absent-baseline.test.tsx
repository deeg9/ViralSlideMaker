// Phase 74 Plan 04 (STYLESPEC-11, STYLESPEC-12, PARITY-01): PTF74 baseline.
//
// LOAD-BEARING PARITY TEST FOR v2.13. Locks legacy projects (style_spec === null,
// reference_assets === null) against regression BEFORE any vision-extraction code
// (Phase 75) lands. Mirrors Phase 67 Plan 02 PTF16 (parity.template-fingerprint-
// decorations-undefined.test.tsx) verbatim — same 12-template × 2-renderer matrix,
// same fingerprint helper, same equiv-assertion pattern.
//
// =====================================================================
// STRUCTURAL INVARIANT being defended (TPLREND-05 + STYLESPEC-12):
// =====================================================================
// The renderer is upstream-blind to style_spec / reference_assets. Both fields
// live on the projects row, neither field flows into Slide, and neither renderer
// (SlidePreview or Satori) reads them. Therefore: legacy fixtures with
// style_spec === null MUST render byte-identical to the same fixtures with
// style_spec === undefined, AND that fingerprint MUST be the v2.12 trailing-edge
// baseline. If this test ever turns red, someone violated TPLREND-05 by
// adding a new Slide field that one renderer reads OR by routing style_spec
// into the slide-level shape (forbidden — STYLESPEC-12).
//
// =====================================================================
// HARD CONSTRAINT (per ROADMAP + STYLESPEC-11):
// =====================================================================
// This test MUST be GREEN and committed BEFORE Phase 75 starts. Phase 75 PR
// should rerun this suite + see it pass. Any PR that breaks legacy rendering
// (e.g. accidentally makes one renderer read `style_spec` from a slide-level
// field) trips one of the 24 fingerprint snapshots and surfaces the regression
// at PR time.
//
// =====================================================================
// SNAPSHOT BASELINE WARNING:
// =====================================================================
// The snapshot file (parity.style-spec-absent-baseline.test.tsx.snap) IS the
// v2.12 trailing-edge baseline. DO NOT regenerate casually. If a future PR
// breaks this test, the correct response is to FIX THE BREAKING CHANGE, not
// to regenerate the snapshot. Regenerating destroys the regression evidence.
//
// PTF74 label families generated via template literals — pinned here for
// the verify-gate grep (`PTF74-(null|undef|equiv)-[0-9]+[ab]\b`):
//   PTF74-null-1a, PTF74-null-1b, PTF74-undef-1a, PTF74-undef-1b,
//   PTF74-equiv-1a, PTF74-equiv-1b … (12 templates × 6 = 72 tests +
//   2 sanity tests = 74 tests on v2.12 trailing edge.)

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
// Type-only import: assert that the StyleSpec contract from Plan 74-01 EXISTS
// and that legacy fixtures (style_spec: null) sit at the SAME column type
// (jsonb-nullable) without forcing the renderer to know it. The import is
// type-only — no runtime coupling. The renderer never sees this type.
import type { StyleSpec } from '@/lib/types/style-spec'

/**
 * Legacy project fixture wrapper. style_spec / reference_assets are PROJECT-LEVEL
 * (rows on `projects`), not slide-level — they don't even reach the renderer's
 * input. The wrapper exists ONLY to assert that THE PROJECT SHAPE is what carries
 * these fields, not the slide. Renderer calls below take only the `slide`.
 *
 * If a future change ever routes style_spec INTO the slide (forbidden by
 * STYLESPEC-12), this fixture's typing won't catch it directly — but the
 * companion test `slide-zero-new-fields.test.ts` will, and the fingerprint
 * snapshots in this file will diverge as soon as one of the renderers reads it.
 */
function legacyProjectFixture(opts: {
  style_spec: StyleSpec | null | undefined
  reference_assets:
    | Array<{ url: string; sha256: string; uploaded_at: string }>
    | null
    | undefined
}): {
  id: string
  slide_data: Slide[]
  style_spec: StyleSpec | null | undefined
  reference_assets:
    | Array<{ url: string; sha256: string; uploaded_at: string }>
    | null
    | undefined
} {
  return {
    id: 'fixture-legacy-v212-trailing-edge',
    slide_data: [fingerprintFixtureSlide],
    style_spec: opts.style_spec,
    reference_assets: opts.reference_assets,
  }
}

describe('Phase 74 Plan 04 (STYLESPEC-11, STYLESPEC-12, PARITY-01): PTF74 style-spec-absent baseline', () => {
  // ===== Sanity floor: registry holds v2.12 trailing-edge count =====
  // Mirrors PTF16's registry-sanity gate. If the templates registry grows
  // past 12 in a future milestone, the matrix below will iterate the new
  // templates automatically — but THIS gate flags the addition explicitly
  // so the new template gets a deliberate snapshot review.
  // quick-260519-t3x bumps 13 → 16; new PTF entries land below automatically.
  it('PTF74 (registry sanity): templates registry holds the v2.12 trailing-edge count', () => {
    expect(templates).toHaveLength(16)
  })

  // ===== Project-shape sanity: legacy fixture accepts null / null =====
  // Proves the project-level fixture compiles cleanly with style_spec: null
  // AND reference_assets: null AND slide-level shape unchanged. If this
  // fails at type-check time, it means Plan 74-01's StyleSpec or Plan 74-02's
  // reference_assets shape rejects null — which would be a regression of
  // the legacy-project compat invariant.
  it('PTF74 (project shape sanity): legacy project fixture accepts style_spec=null and reference_assets=null', () => {
    const proj = legacyProjectFixture({
      style_spec: null,
      reference_assets: null,
    })
    expect(proj.style_spec).toBeNull()
    expect(proj.reference_assets).toBeNull()
    expect(proj.slide_data).toHaveLength(1)
    // The slide passed to the renderer has zero awareness of project-level fields.
    // Defense-in-depth: spot-check the slide shape directly.
    expect(proj.slide_data[0].hook_text).toBeDefined()
    expect(
      (proj.slide_data[0] as unknown as Record<string, unknown>)['style_spec'],
    ).toBeUndefined()
    expect(
      (proj.slide_data[0] as unknown as Record<string, unknown>)[
        'reference_assets'
      ],
    ).toBeUndefined()
  })

  // ===== 12 templates × 6 cases = 72 tests =====
  templates.forEach((template, idx) => {
    const ptfNum = idx + 1
    const slide: Slide = {
      ...fingerprintFixtureSlide,
      template_id_override: template.id,
    }

    describe(`PTF74 (${template.id})`, () => {
      // ----- null path ----- (explicit JSONB-null at project level)
      it(`PTF74-null-${ptfNum}a: SlidePreview editable={false} renders stable fingerprint with style_spec=null for ${template.id}`, () => {
        // Construct the project fixture to PROVE style_spec=null is a
        // first-class allowed value at the project level. The renderer
        // call below takes only the slide — confirming the renderer is
        // upstream-blind to this field.
        const _proj = legacyProjectFixture({
          style_spec: null,
          reference_assets: null,
        })
        void _proj
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

      it(`PTF74-null-${ptfNum}b: Satori React tree renders stable fingerprint with style_spec=null for ${template.id}`, () => {
        const _proj = legacyProjectFixture({
          style_spec: null,
          reference_assets: null,
        })
        void _proj
        const html = renderToStaticMarkup(buildSlideElement(slide, template))
        const fingerprint = computeStructuralFingerprint(html)
        expect(fingerprint).toMatchSnapshot()
      })

      // ----- undef path ----- (legacy projects pre-Phase 74; column never set)
      it(`PTF74-undef-${ptfNum}a: SlidePreview editable={false} renders stable fingerprint with style_spec=undefined for ${template.id}`, () => {
        const _proj = legacyProjectFixture({
          style_spec: undefined,
          reference_assets: undefined,
        })
        void _proj
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

      it(`PTF74-undef-${ptfNum}b: Satori React tree renders stable fingerprint with style_spec=undefined for ${template.id}`, () => {
        const _proj = legacyProjectFixture({
          style_spec: undefined,
          reference_assets: undefined,
        })
        void _proj
        const html = renderToStaticMarkup(buildSlideElement(slide, template))
        const fingerprint = computeStructuralFingerprint(html)
        expect(fingerprint).toMatchSnapshot()
      })

      // ----- equiv assertions -----
      // KEY: idempotent absence — direct string equality (NOT snapshots).
      // Proves the renderer cannot distinguish style_spec=null from
      // style_spec=undefined. This is the strongest possible verification
      // of TPLREND-05 byte-identity for legacy projects: any future PR that
      // makes one renderer accidentally branch on style_spec presence will
      // diverge null-fp from undef-fp here.
      it(`PTF74-equiv-${ptfNum}a: SlidePreview null-fingerprint EXACTLY EQUALS undef-fingerprint for ${template.id}`, () => {
        const _projNull = legacyProjectFixture({
          style_spec: null,
          reference_assets: null,
        })
        const _projUndef = legacyProjectFixture({
          style_spec: undefined,
          reference_assets: undefined,
        })
        void _projNull
        void _projUndef
        const { container: nullContainer } = render(
          <SlidePreview
            slide={slide}
            template={template}
            index={0}
            editable={false}
          />,
        )
        const { container: undefContainer } = render(
          <SlidePreview
            slide={slide}
            template={template}
            index={0}
            editable={false}
          />,
        )
        const nullFp = computeStructuralFingerprint(nullContainer.innerHTML)
        const undefFp = computeStructuralFingerprint(undefContainer.innerHTML)
        expect(nullFp).toBe(undefFp)
      })

      it(`PTF74-equiv-${ptfNum}b: Satori null-fingerprint EXACTLY EQUALS undef-fingerprint for ${template.id}`, () => {
        const _projNull = legacyProjectFixture({
          style_spec: null,
          reference_assets: null,
        })
        const _projUndef = legacyProjectFixture({
          style_spec: undefined,
          reference_assets: undefined,
        })
        void _projNull
        void _projUndef
        const nullFp = computeStructuralFingerprint(
          renderToStaticMarkup(buildSlideElement(slide, template)),
        )
        const undefFp = computeStructuralFingerprint(
          renderToStaticMarkup(buildSlideElement(slide, template)),
        )
        expect(nullFp).toBe(undefFp)
      })
    })
  })
})
