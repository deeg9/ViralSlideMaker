import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { getTemplate } from '@/lib/render/templates'
import { resolvePerSlideTemplate } from '@/lib/render/resolve-per-slide-template'
import { synthesizeBrandKitTemplate, BRAND_KIT_TEMPLATE_ID } from '@/lib/brand-kit/get-effective-template'
import type { Slide } from '@/lib/types/slide'
import type { BrandKit } from '@/lib/types/brand-kit'

/**
 * quick-260515-epn — integration coverage for per-slide template_id_override
 * across the SlidePreview (DOM) AND buildSlideElement (Satori VDOM) render
 * surfaces. The bottom-card div (magazine-bold's
 * backgroundMode='image-with-bottom-card' marker) is the load-bearing
 * locator: present when the override is honored, ABSENT when the slide
 * has no override and the project template is bold-yellow.
 *
 * TPLREND-05 byte-identity gate (Test 2 + Test 4): the override-absent
 * branches assert the legacy DOM/VDOM has NO bottom-card — proving the
 * helper does not silently rewrite legacy slides.
 */

// -----------------------------------------------------------------------------
// Tree-walk helpers (mirrors src/__tests__/render/premium-templates.test.tsx)
// -----------------------------------------------------------------------------

function walk(node: unknown): unknown[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) {
    const out: unknown[] = []
    for (const k of node) out.push(...walk(k))
    return out
  }
  const out: unknown[] = [node]
  const props = (node as { props?: { children?: unknown } }).props
  const kids = props?.children
  if (Array.isArray(kids)) {
    for (const k of kids) out.push(...walk(k))
  } else if (kids != null) {
    out.push(...walk(kids))
  }
  return out
}

function styleOf(node: unknown): Record<string, unknown> | null {
  const props = (node as { props?: { style?: Record<string, unknown> } }).props
  return props?.style ?? null
}

function findBottomCardNode(element: unknown): unknown | null {
  const nodes = walk(element)
  for (const n of nodes) {
    const s = styleOf(n)
    if (!s) continue
    // The Satori bottom-card is the only node that combines `position: 'absolute'`
    // with an explicit numeric top of 1190 (62% of 1920) AND height 730 (38% of
    // 1920) AND padding 80. Match on the top + padding + display:'flex' triple
    // which is unique to the bottom-card layer.
    if (
      s.position === 'absolute' &&
      s.top === Math.round(1920 * 0.62) &&
      s.padding === 80 &&
      s.display === 'flex'
    ) {
      return n
    }
  }
  return null
}

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const baseSlide: Slide = {
  hook_text: 'PER-SLIDE OVERRIDE HOOK',
  body_text: 'Per-slide override body copy.',
  image_query: '',
  is_cta: false,
  background_url: 'https://example.com/photo.jpg',
  pexels_photo_id: null,
}

const slideWithoutOverride: Slide = { ...baseSlide }
const slideWithOverride: Slide = {
  ...baseSlide,
  template_id_override: 'magazine-bold',
}

function makeBrandKit(): BrandKit {
  return {
    id: 'bk-1',
    user_id: 'u-1',
    name: 'Acme',
    created_at: '2026-05-15T00:00:00Z',
    updated_at: '2026-05-15T00:00:00Z',
  } as unknown as BrandKit
}

// -----------------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------------

describe('quick-260515-epn — per-slide template_id_override across surfaces', () => {
  // ---------------------------------------------------------------------------
  // Test 1: Browser preview — override-active surfaces the bottom-card marker.
  // ---------------------------------------------------------------------------
  it('SlidePreview (DOM): override → renders magazine-bold bottom-card marker', () => {
    const projectTemplate = getTemplate('bold-yellow') // bold-yellow has no bottom-card
    const effective = resolvePerSlideTemplate(slideWithOverride, projectTemplate)
    expect(effective.id).toBe('magazine-bold') // sanity

    const { container } = render(
      <SlidePreview
        slide={slideWithOverride}
        template={effective}
        index={0}
        slideIndex={0}
        totalSlides={1}
      />,
    )
    // slide-preview.tsx line 183: data-testid="bottom-card" wraps the
    // image-with-bottom-card layer.
    expect(container.querySelector('[data-testid="bottom-card"]')).not.toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Test 2: Browser preview — override-absent does NOT render the bottom-card
  // (TPLREND-05 byte-identity — legacy bold-yellow slide still bold-yellow).
  // ---------------------------------------------------------------------------
  it('SlidePreview (DOM): no override → NO bottom-card; legacy template preserved', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const effective = resolvePerSlideTemplate(slideWithoutOverride, projectTemplate)
    // Byte-identity gate: same reference.
    expect(effective).toBe(projectTemplate)

    const { container } = render(
      <SlidePreview
        slide={slideWithoutOverride}
        template={effective}
        index={0}
        slideIndex={0}
        totalSlides={1}
      />,
    )
    expect(container.querySelector('[data-testid="bottom-card"]')).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Test 3: Satori VDOM — override-active produces the bottom-card div.
  // buildSlideElement re-resolves slide.template_id_override INTERNALLY; the
  // route layer keeps passing the project-level effectiveTemplate unchanged.
  // ---------------------------------------------------------------------------
  it('buildSlideElement (Satori): override → returned VDOM contains bottom-card div', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const element = buildSlideElement(
      slideWithOverride,
      projectTemplate, // passes the PROJECT template — helper re-resolves inside
      null,
      'free',
      'http://localhost',
      { slideIndex: 0, totalSlides: 1, topic: 'test' },
    )
    expect(findBottomCardNode(element)).not.toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Test 4: Satori VDOM — override-absent does NOT produce the bottom-card.
  // ---------------------------------------------------------------------------
  it('buildSlideElement (Satori): no override → returned VDOM has NO bottom-card div', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const element = buildSlideElement(
      slideWithoutOverride,
      projectTemplate,
      null,
      'free',
      'http://localhost',
      { slideIndex: 0, totalSlides: 1, topic: 'test' },
    )
    expect(findBottomCardNode(element)).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Test 5: Brand-kit + override — override wins; brand-kit + no override → brand-kit.
  // Locks the precedence chain at the renderer surface.
  // ---------------------------------------------------------------------------
  it('brand-kit precedence: override beats brand-kit; absence preserves brand-kit', () => {
    const brandKitTemplate = synthesizeBrandKitTemplate(makeBrandKit())
    expect(brandKitTemplate.id).toBe(BRAND_KIT_TEMPLATE_ID) // sanity

    // With override → magazine-bold wins.
    const overrideResolved = resolvePerSlideTemplate(slideWithOverride, brandKitTemplate)
    expect(overrideResolved.id).toBe('magazine-bold')

    // Without override → brand-kit by reference.
    const noOverrideResolved = resolvePerSlideTemplate(slideWithoutOverride, brandKitTemplate)
    expect(noOverrideResolved).toBe(brandKitTemplate)
  })

  // ---------------------------------------------------------------------------
  // Test 6: Explore-card contract — explore feed passes a project-level
  // `getTemplate(templateId)` result; the surface MUST resolve per-slide before
  // handing to SlidePreview, otherwise published carousels with per-slide
  // overrides drift from the original project's visual.
  // ---------------------------------------------------------------------------
  it('explore-card contract: published-carousel slide with override renders bottom-card', () => {
    // Simulate the explore-card resolution path — published snapshot's
    // `templateId` field returns a project-level template; the surface
    // applies the per-slide override before mounting SlidePreview.
    const projectTemplate = getTemplate('bold-yellow') // simulated published templateId
    const effective = resolvePerSlideTemplate(slideWithOverride, projectTemplate)
    expect(effective.id).toBe('magazine-bold')

    const { container } = render(
      <SlidePreview
        slide={slideWithOverride}
        template={effective}
        index={0}
        slideIndex={0}
        totalSlides={1}
        editable={false}
      />,
    )
    expect(container.querySelector('[data-testid="bottom-card"]')).not.toBeNull()
  })
})
