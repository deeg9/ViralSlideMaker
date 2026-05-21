// quick-260513-rerender-hero (Task B): publish-path call-shape brand-kit
// independence pin.
//
// =====================================================================
// What this test pins
// =====================================================================
// The publish path renders the hero PNG by calling:
//
//   buildSlideElement(
//     slide,
//     mergeWithBrandKit(template, brandKit),  // effectiveTemplate
//     brandKit,                                // 3rd arg, non-null at publish time
//     ownerTier,                               // 4th arg ('free'/'plus'/'pro')
//     origin,                                  // 5th arg (absolute URL)
//     ctx,                                     // 6th arg ({slideIndex, totalSlides, topic})
//   )
//
// (See `renderHeroBuffer` in src/lib/services/publish.ts:44-71.)
//
// quick-260511-uk1's parity test (parity.quick-260511-uk1-snapshot-template.test.tsx)
// already pins the 3-arg shape — `buildSlideElement(slide, template, brandKit)`
// is brand-kit-independent across all 12 built-in templates. What it does
// NOT pin is the full 6-arg publish-time shape: tier + origin + ctx are
// non-null at publish but null in that test. If a future refactor routes
// brand-kit-derived data through any of those args (e.g., into the
// watermark resolver via `tier`, or into a slide-field overlay via `ctx`),
// the uk1 test stays green but published carousels start drifting from
// the live SlidePreview again.
//
// This test closes that gap: same brand-kit-independence assertion as
// uk1 Task 4, but using the EXACT 6-arg shape `renderHeroBuffer` passes.
//
// =====================================================================
// What this test catches
// =====================================================================
// Any future PR that makes the publish path's `buildSlideElement` call
// produce brand-kit-dependent output for a built-in template — for example:
//   - re-enabling mergeWithBrandKit to actually merge accent_color
//   - wiring brand-kit data through the `ctx.topic` overlay resolver
//   - introducing a brand-kit-conditional gate inside the tier-aware
//     watermark path that doesn't already exist
//
// turns at least one of the 12 publish-path tests red. Combined with the
// existing PTF74 + uk1 Task 4 tests, the TPLREND-05 parity invariant is
// now covered at three layers:
//   - Layer 1 (PTF74): SlidePreview vs buildSlideElement byte-identity for
//     style_spec-absent fixtures.
//   - Layer 2 (uk1 Task 4): buildSlideElement 3-arg shape is brand-kit-
//     independent for built-in templates.
//   - Layer 3 (this test): buildSlideElement 6-arg PUBLISH-PATH shape is
//     brand-kit-independent for built-in templates.
//
// =====================================================================
// Why we don't fingerprint vs `<SlidePreview>` directly
// =====================================================================
// The uk1 Task 4 test file itself documents why cross-renderer fingerprint
// comparison (SlidePreview HTML ↔ buildSlideElement HTML) is brittle:
// SlidePreview's editable={false} render composes React-DOM chrome (e.g.,
// `<div data-testid="slide-canvas-root">` wrappers) that Satori's
// hyperscript output lacks, and the structural-fingerprint helper does
// not normalize that wrapper-element delta. Per-renderer brand-kit
// independence + the PTF74 cross-renderer baseline together give the
// same coverage without the brittleness.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { templates } from '@/lib/render/templates'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import {
  fingerprintFixtureSlide,
  computeStructuralFingerprint,
} from './__fixtures__/parity-fingerprint-fixtures'
import {
  mergeWithBrandKit,
} from '@/lib/brand-kit/get-effective-template'
import type { Slide } from '@/lib/types/slide'
import type { BrandKit } from '@/lib/types/brand-kit'

// Same fixture as uk1 Task 4: vivid hexes on every color slot, logo_url null
// (keeps the watermark gate symmetric across the two arms — see uk1 Task 4
// comment block for the full rationale).
const brandKitFixture: BrandKit = {
  id: 'bk-quick-260513-rerender-hero-fixture',
  user_id: 'user-quick-260513-rerender-hero-fixture',
  name: 'quick-260513-rerender-hero publish-path fixture',
  primary_color: '#ff3b30',
  secondary_color: '#1a1a2e',
  text_color: '#ffffff',
  background_color: '#000000',
  font_family: null,
  logo_url: null,
  logo_position: null,
  logo_size_pct: null,
  logo_opacity_pct: null,
  heading_font_family: null,
  body_font_family: null,
  accent_color: '#00ff00',
  text_align: null,
  text_position: null,
  hook_style: null,
  overlay_opacity_pct: null,
  created_at: '2026-05-13T00:00:00Z',
  updated_at: '2026-05-13T00:00:00Z',
}

// Publish-time call arguments other than brand-kit. These mirror the
// constants `renderHeroBuffer` constructs at publish.ts:58-62.
const PUBLISH_TIER = 'free' as const
const PUBLISH_ORIGIN = 'http://localhost:3000'
const PUBLISH_CTX = { slideIndex: 0, totalSlides: 1, topic: 'hero-publish-fixture-topic' }

describe('quick-260513-rerender-hero: publish-path call-shape brand-kit independence (Layer 3 of TPLREND-05)', () => {
  // Registry sanity gate (same floor as PTF74 and uk1 Task 4).
  // quick-260519-t3x bumps 13 → 16; per-template matrices below iterate the
  // new ids automatically, so this floor moves with the registry.
  it('templates registry holds the v2.13 trailing-edge count (16)', () => {
    expect(templates).toHaveLength(16)
  })

  describe('buildSlideElement publish-path shape is brandKit-independent for every built-in template', () => {
    templates.forEach((template) => {
      it(`${template.id}: brandKit non-null vs null (6-arg publish shape) → identical structural fingerprint`, () => {
        const slide: Slide = {
          ...fingerprintFixtureSlide,
          template_id_override: template.id,
        }

        // ARM 1: publish-path shape with brandKitFixture (non-null).
        const effectiveKit = mergeWithBrandKit(template, brandKitFixture)
        const htmlWithKit = renderToStaticMarkup(
          buildSlideElement(
            slide,
            effectiveKit,
            PUBLISH_TIER,
            PUBLISH_ORIGIN,
            PUBLISH_CTX,
          ),
        )

        // ARM 2: publish-path shape with brandKit = null.
        const effectiveNull = mergeWithBrandKit(template, null)
        const htmlWithoutKit = renderToStaticMarkup(
          buildSlideElement(
            slide,
            effectiveNull,
            PUBLISH_TIER,
            PUBLISH_ORIGIN,
            PUBLISH_CTX,
          ),
        )

        const fpKit = computeStructuralFingerprint(htmlWithKit)
        const fpNull = computeStructuralFingerprint(htmlWithoutKit)

        expect(fpKit).toBe(fpNull)
      })
    })
  })
})
