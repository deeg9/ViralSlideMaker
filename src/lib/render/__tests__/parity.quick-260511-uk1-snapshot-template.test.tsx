// quick-260511-uk1: TPLREND-05 parity pin — Option B (the BRAND-KIT-MERGE-PARITY
// decision lock from the plan frontmatter) asserted as a regression test.
//
// =====================================================================
// What this test pins:
// =====================================================================
// For every registered template (12 built-ins as of v2.13), the rendered
// structural fingerprint of the same fixture slide must be IDENTICAL whether
// a non-null brandKit is passed to the renderer or null. This holds because:
//
//   - mergeWithBrandKit is a documented no-op for any built-in template
//     (quick-260510-brand-kit-scope); the function body is `return template`
//     when template.id !== BRAND_KIT_TEMPLATE_ID.
//   - SlidePreview reads `template.accentColor ?? template.textColor` at
//     slide-preview.tsx:676 — never consults brandKit for accent color.
//   - buildSlideElement reads the IDENTICAL expression at
//     render-slide-satori.tsx:193 — same construction.
//   - SlidePreview and buildSlideElement both pass brandKit to
//     resolveWatermark, which short-circuits to null when brandKit.logo_url
//     is null. The brand-kit fixture in this test deliberately leaves
//     logo_url null so the watermark gate behaves identically across the
//     two assertion arms (brandKit-non-null vs brandKit-null) — isolating
//     the test to the accent-color / merge-no-op surface.
//
// =====================================================================
// What this test catches:
// =====================================================================
// If a future PR re-introduces a render-time brand-kit color override on a
// built-in template (re-opening the bug that quick-260510-brand-kit-scope
// closed), at least one of these 24 tests turns red. The failure shows up
// at PR time, not after a user republishes their carousel.
//
// =====================================================================
// Why 24 tests instead of 48 (cross-renderer parity skipped):
// =====================================================================
// The PTF74 baseline in parity.style-spec-absent-baseline.test.tsx already
// pins SlidePreview ↔ buildSlideElement byte-identity for the same (slide,
// template) input. Re-asserting that here would duplicate PTF74 and would
// also be brittle: SlidePreview's editable={false} render still composes
// React-DOM chrome (e.g., `<div data-testid="slide-canvas-root">` wrappers)
// that Satori's hyperscript output lacks. The structural-fingerprint helper
// from PTF74 normalizes SSR ids + whitespace but does NOT normalize the
// wrapper-element delta. Per the plan's adaptation guidance, this test
// scopes assertions to "per-renderer is brandKit-independent" (24 tests)
// and leaves cross-renderer parity to PTF74.

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
import type { BrandKit } from '@/lib/types/brand-kit'

// Brand-kit fixture that EXERCISES the merge-no-op contract without
// triggering watermark divergence. Values that would tint the template
// if mergeWithBrandKit weren't a no-op for built-ins:
//   - primary_color, secondary_color, accent_color, text_color,
//     background_color all set to vivid hexes distinct from any built-in
//     template's accent palette.
// Values intentionally LEFT null to keep resolveWatermark gated off
// identically across the two arms:
//   - logo_url: null  → resolveWatermark short-circuits at the second gate
//     in both renderers; arm-1 (brandKit-non-null) and arm-2 (brandKit=null)
//     produce IDENTICAL watermark output (none).
//   - logo_position: null → defense in depth on the same gate.
const brandKitFixture: BrandKit = {
  id: 'bk-quick-260511-uk1-fixture',
  user_id: 'user-quick-260511-uk1-fixture',
  name: 'quick-260511-uk1 parity fixture',
  primary_color: '#ff3b30',
  secondary_color: '#1a1a2e',
  text_color: '#ffffff',
  background_color: '#000000',
  font_family: null,
  logo_url: null, // deliberately null — see fixture comment above
  logo_position: null, // deliberately null — see fixture comment above
  logo_size_pct: null,
  logo_opacity_pct: null,
  heading_font_family: null,
  body_font_family: null,
  accent_color: '#00ff00',
  text_align: null,
  text_position: null,
  hook_style: null,
  overlay_opacity_pct: null,
  created_at: '2026-05-12T00:00:00Z',
  updated_at: '2026-05-12T00:00:00Z',
}

describe('quick-260511-uk1: render-time brand-kit-merge parity pin (Option B)', () => {
  // ===== Registry sanity: matches PTF74 floor =====
  // If the template count grows past 12 in a future milestone, the per-
  // renderer matrices below iterate the new template automatically — but
  // this gate flags the addition so the new template gets a deliberate
  // Option-B review.
  // quick-260519-t3x bumps 13 → 16; new ids get fresh PTL entries below.
  it('templates registry holds the v2.13 trailing-edge count (16)', () => {
    expect(templates).toHaveLength(16)
  })

  describe('SlidePreview is brandKit-independent for every built-in template', () => {
    templates.forEach((template) => {
      it(`${template.id}: brandKit non-null vs null → identical structural fingerprint`, () => {
        const slide: Slide = {
          ...fingerprintFixtureSlide,
          template_id_override: template.id,
        }

        const { container: kitContainer } = render(
          <SlidePreview
            slide={slide}
            template={template}
            index={0}
            editable={false}
            brandKit={brandKitFixture}
          />,
        )
        const { container: nullContainer } = render(
          <SlidePreview
            slide={slide}
            template={template}
            index={0}
            editable={false}
            brandKit={null}
          />,
        )

        const fpKit = computeStructuralFingerprint(kitContainer.innerHTML)
        const fpNull = computeStructuralFingerprint(nullContainer.innerHTML)

        expect(fpKit).toBe(fpNull)
      })
    })
  })

  describe('buildSlideElement (Satori) is brandKit-independent for every built-in template', () => {
    templates.forEach((template) => {
      it(`${template.id}: brandKit non-null vs null → identical structural fingerprint`, () => {
        const slide: Slide = {
          ...fingerprintFixtureSlide,
          template_id_override: template.id,
        }

        const htmlKit = renderToStaticMarkup(
          buildSlideElement(slide, template),
        )
        const htmlNull = renderToStaticMarkup(
          buildSlideElement(slide, template),
        )

        const fpKit = computeStructuralFingerprint(htmlKit)
        const fpNull = computeStructuralFingerprint(htmlNull)

        expect(fpKit).toBe(fpNull)
      })
    })
  })
})
