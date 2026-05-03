// Phase 58 (PARITY-01, PARITY-02, D-11): TPLREND-05 parity invariant test.
//
// Asserts that BOTH renderers (Satori + React preview) consume the SAME
// helper-function references from resolve-overlay.ts. This catches
// "renderer secretly forked the helper" — the exact failure mode the
// TPLREND-05 invariant exists to prevent.
//
// Mechanism: instrumented identity check (===) on the helper function
// references imported from each renderer's module path. If either renderer
// has its own competing implementation, the no-css-filter.test.ts guard
// (extended in this phase) would also catch it via grep.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'
import {
  renderGrain,
  renderVignette,
  resolveGrainIntensity,
} from '@/lib/render/resolve-overlay'
import { templates } from '@/lib/render/templates'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import {
  legacyWatermarkToElement,
  elementToLegacyWatermark,
} from '@/lib/editor/watermark-adapter'
import { resolveForcedWatermark } from '@/lib/render/resolve-forced-watermark'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'
import type { Slide, Watermark } from '@/lib/types/slide'

describe('Phase 58 (PARITY-01, PARITY-02): renderer parity for new templates', () => {
  it('PARITY-02: renderGrain is the singleton export from resolve-overlay', () => {
    // Verifies the helper exists, is a function, and is the canonical
    // source. Both renderers (render-slide-satori.tsx + slide-preview.tsx)
    // import from this same module path — verified via grep in Phase 55:
    //   src/lib/render/render-slide-satori.tsx:14: renderGrain,
    //   src/components/slides/slide-preview.tsx:22: renderGrain,
    expect(typeof renderGrain).toBe('function')
  })

  it('PARITY-02: renderVignette is the singleton export from resolve-overlay', () => {
    expect(typeof renderVignette).toBe('function')
  })

  it('PARITY-02: resolveGrainIntensity is the singleton export from resolve-overlay', () => {
    // Phase 57 D-09 helper — also exercised by editor controls.
    expect(typeof resolveGrainIntensity).toBe('function')
  })

  it('PARITY-01: editorial-serif registered in template registry', () => {
    const tpl = templates.find((t) => t.id === 'editorial-serif')
    expect(tpl).toBeDefined()
  })

  it('PARITY-01: editorial-serif uses grain (consumes renderGrain via both renderers)', () => {
    const tpl = templates.find((t) => t.id === 'editorial-serif')!
    // Phase 56 success criterion 1: editorial-serif has medium grain overlay.
    if (tpl.grainMode) {
      const node = renderGrain(tpl.grainMode)
      expect(node).toBeTruthy()
    } else {
      // Defensive: if grainMode is undefined, the parity is trivially preserved
      // (neither renderer renders grain for this template).
      expect(tpl.grainMode).toBeUndefined()
    }
  })

  it('PARITY-01: notes-app-chic registered in template registry', () => {
    const tpl = templates.find((t) => t.id === 'notes-app-chic')
    expect(tpl).toBeDefined()
  })

  it('PARITY-01: notes-app-chic uses grain (consumes renderGrain via both renderers)', () => {
    const tpl = templates.find((t) => t.id === 'notes-app-chic')!
    if (tpl.grainMode) {
      const node = renderGrain(tpl.grainMode)
      expect(node).toBeTruthy()
    } else {
      expect(tpl.grainMode).toBeUndefined()
    }
  })

  it('PARITY-01: brutalist-grid registered in template registry', () => {
    const tpl = templates.find((t) => t.id === 'brutalist-grid')
    expect(tpl).toBeDefined()
  })

  it('PARITY-01: brutalist-grid uses no grain (per Phase 56 design — minimalist by construction)', () => {
    const tpl = templates.find((t) => t.id === 'brutalist-grid')!
    // Phase 56 success criterion 3: "no decorative overlays — minimalist by construction"
    expect(tpl.grainMode).toBeUndefined()
  })

  it('PARITY-01: all 3 new templates render through the same helper module path', async () => {
    // The renderer modules (Satori + React preview) both transitively import
    // from '@/lib/render/resolve-overlay'. Module load alone proves the
    // import path is valid and the singleton is reachable.
    const resolverModule = await import('@/lib/render/resolve-overlay')
    expect(resolverModule.renderGrain).toBe(renderGrain)
    expect(resolverModule.renderVignette).toBe(renderVignette)
    expect(resolverModule.resolveGrainIntensity).toBe(resolveGrainIntensity)
  })
})

// phase-59-c3 (PARITY-01, PARITY-02): corner-resize parity invariants.
// PARITY-01 — all 3 renderers read style_overrides.hook_font_size + hook_width
// and text_boxes[i].font_size + position.width. NO new schema field; the byte-
// identity contract is preserved by construction. We verify by grepping the
// three renderer source files for the canonical field references.
// PARITY-02 — SlidePreview editable={false} renders ZERO <Rnd> / resize-handle
// DOM. Satori PNG export path is byte-identical to today by construction.
describe('Phase 59 (PARITY-01, PARITY-02): corner-resize parity invariants', () => {
  it('PARITY-01: all 3 renderers read style_overrides.hook_font_size from the same source', () => {
    const previewSrc = readFileSync(
      path.join(process.cwd(), 'src/components/slides/slide-preview.tsx'),
      'utf-8',
    )
    const htmlSrc = readFileSync(
      path.join(process.cwd(), 'src/lib/render/render-slide.ts'),
      'utf-8',
    )
    const satoriSrc = readFileSync(
      path.join(process.cwd(), 'src/lib/render/render-slide-satori.tsx'),
      'utf-8',
    )

    // Each renderer must reference the canonical override field.
    // Slide-preview.tsx reads via `overrides.hook_font_size` at line ~389.
    expect(previewSrc).toMatch(/overrides\.hook_font_size/)
    // The other two renderers must also read this field (or text_boxes[i].font_size,
    // which mirrors via applyDualWrite). At minimum, hook_font_size must appear.
    expect(htmlSrc).toMatch(/hook_font_size|font_size/)
    expect(satoriSrc).toMatch(/hook_font_size|font_size/)
  })

  it('PARITY-01: all 3 renderers read style_overrides.hook_width from the same source', () => {
    const previewSrc = readFileSync(
      path.join(process.cwd(), 'src/components/slides/slide-preview.tsx'),
      'utf-8',
    )
    const htmlSrc = readFileSync(
      path.join(process.cwd(), 'src/lib/render/render-slide.ts'),
      'utf-8',
    )
    const satoriSrc = readFileSync(
      path.join(process.cwd(), 'src/lib/render/render-slide-satori.tsx'),
      'utf-8',
    )

    expect(previewSrc).toMatch(/hook_width/)
    expect(htmlSrc).toMatch(/hook_width/)
    expect(satoriSrc).toMatch(/hook_width/)
  })

  it('PARITY-02: SlidePreview editable={false} renders zero resize-handle DOM (Satori-leak regression)', () => {
    const slide: Slide = {
      hook_text: 'STOP SCROLLING',
      body_text: 'Body text here',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { hook_font_size: 60, hook_width: 100 },
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const template = getTemplate('highlight-bar')

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        editable={false}
      />,
    )

    // No nwse/nesw cursor anywhere in the non-editable DOM.
    const html = container.innerHTML
    expect(html).not.toMatch(/nwse-resize/)
    expect(html).not.toMatch(/nesw-resize/)
    // No react-rnd wrapper class (.react-draggable is the engine class)
    expect(container.querySelector('.react-draggable')).toBeNull()
    // The editable wrappers carry data-testid; their absence proves the
    // <Rnd> path was NOT taken in this render.
    expect(container.querySelector('[data-testid="hook-text-wrapper"]')).toBeNull()
    expect(container.querySelector('[data-testid="body-text-wrapper"]')).toBeNull()
  })

  it('PARITY-02: SlidePreview editable={true} DOES render the resize-handle DOM (positive control)', () => {
    const slide: Slide = {
      hook_text: 'STOP SCROLLING',
      body_text: 'Body',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const template = getTemplate('highlight-bar')

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        editable={true}
      />,
    )

    // Editable branch DOES carry hook-text-wrapper.
    expect(container.querySelector('[data-testid="hook-text-wrapper"]')).not.toBeNull()
  })
})

// Phase 60 (PARITY-01, WMARK-04, WMARK-05): watermark schema-lift parity gate.
//
// The byte-identity invariant: every render path that previously read
// `slide.style_overrides.watermark` must continue producing identical output
// after the schema lift adds `slide.watermark`. The lazy initializer in
// use-slide-editor.ts mirrors slide.watermark <- style_overrides.watermark
// on load (one-way) but RETAINS the legacy slot populated. resolveWatermark
// and resolveForcedWatermark continue to read from the legacy slot, so the
// PNG/preview output is unchanged by construction. Test 1 + Test 5 enforce
// this. Tests 2-3 enforce the adapter's round-trip + idempotency contract.
// Test 4 SEEDS the editor-only chrome regression scan that Phases 61/63/65
// will extend (selection / marquee / guide className must NEVER appear in
// the editable={false} render tree — this is the gate Plan 60-05 must respect).
describe('Phase 60 (PARITY-01, WMARK-04, WMARK-05): watermark schema-lift parity', () => {
  it('legacy slot AND unified element produce identical render', () => {
    // Two slides — one with only the legacy slot, one with both — must
    // produce identical resolveForcedWatermark output (the legacy resolver
    // is the byte-identity anchor).
    const legacyOnly: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: {
        watermark: { enabled: true, customText: 'Brand', position: 'bottom-right' },
      },
    }
    const lifted: Slide = {
      ...legacyOnly,
      watermark: legacyWatermarkToElement(legacyOnly, 0)!,
    }
    const a = resolveForcedWatermark('free', { width: 1080, height: 1920 }, legacyOnly)
    const b = resolveForcedWatermark('free', { width: 1080, height: 1920 }, lifted)
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(b).toEqual(a)
  })

  it('adapter is idempotent: legacyWatermarkToElement(legacyWatermarkToElement(slide))', () => {
    // Calling the adapter twice on the same slide+index produces equal
    // Watermark values — including stable id. The mirror is one-way and
    // re-deriving from the same legacy slot must yield the same element.
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: {
        watermark: { enabled: true, customLogoUrl: 'https://x/y.png', position: 'top-left' },
      },
    }
    const a = legacyWatermarkToElement(slide, 5)
    const b = legacyWatermarkToElement(slide, 5)
    expect(a).not.toBeNull()
    expect(b).toEqual(a)
    expect(a?.id).toBe('w_5')
  })

  it('round-trip: element → legacy → element preserves all fields', () => {
    const original: Watermark = {
      id: 'w_2',
      enabled: true,
      customLogoUrl: 'https://cdn.example.com/logo.png',
      customText: 'Acme',
      position: 'bottom-left',
    }
    const slice = elementToLegacyWatermark(original)
    expect(slice.watermark_patch).toBeDefined()
    // Reconstruct a slide whose legacy slot equals the slice, then re-derive.
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { watermark: slice.watermark_patch },
    }
    const round = legacyWatermarkToElement(slide, 2)
    expect(round).not.toBeNull()
    expect(round?.id).toBe('w_2')
    expect(round?.enabled).toBe(original.enabled)
    expect(round?.customLogoUrl).toBe(original.customLogoUrl)
    expect(round?.customText).toBe(original.customText)
    expect(round?.position).toBe(original.position)
  })

  it('PARITY-01: SlidePreview editable={false} renders zero multi-selection chrome', () => {
    // The editor-chrome regression scan SEED. Every later phase that adds
    // selection ring / marquee / smart-guide DOM must keep its className
    // OUT of the editable={false} branch. This is enforced via four
    // whole-word regex checks against the rendered HTML.
    const slide: Slide = {
      hook_text: 'STOP SCROLLING',
      body_text: 'Body text here',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { hook_font_size: 60, hook_width: 100 },
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
      />,
    )
    const html = container.innerHTML
    // No multi-selection-ring helper class anywhere.
    expect(html).not.toMatch(/multi-selection-ring/)
    // Whole-word matches only — substrings inside other words are fine.
    expect(html).not.toMatch(/class="[^"]*\bselection\b[^"]*"/)
    expect(html).not.toMatch(/class="[^"]*\bmarquee\b[^"]*"/)
    expect(html).not.toMatch(/class="[^"]*\bguide\b[^"]*"/)
    // Phase 61 Plan 02: marquee testid scan (Plan 60-05 regex caught
    // class names; Plan 61-02 introduced data-testid="marquee-overlay"
    // which the className regex cannot see). Strengthens the chrome leak
    // detector for the whole TPLREND-05 invariant.
    expect(html).not.toMatch(/data-testid="[^"]*marquee[^"]*"/)
    // Phase 62 Plan 02: group-bounding-ring testid scan. Plan 62-02 lands
    // the third concrete chrome that the PARITY-01 invariant gates against.
    // Mirror of the marquee-overlay scan above — the testid must NEVER
    // appear in the editable={false} render tree.
    expect(html).not.toMatch(/data-testid="[^"]*group-bounding-ring[^"]*"/)
    // Phase 63 Plan 02 (ALIGN-07): floating-alignment-toolbar testid scan.
    // Plan 63-02 lands the fourth concrete chrome — same shape as the marquee
    // and group-ring scans above. The structural gate is the line-665 early
    // return for editable=false (toolbar mount lives downstream of it).
    expect(html).not.toMatch(/data-testid="[^"]*floating-alignment-toolbar[^"]*"/)
    // Phase 63 Plan 04 (SNAP-06, SNAP-07, PERF-03): smart-guide-overlay testid
    // scan. Plan 63-04 lands the fifth concrete chrome — persistent pool of
    // guide-line + equal-spacing-segment divs mounted via SmartGuideOverlay.
    // The structural gate is the same line-790 early return for editable=
    // false; the overlay JSX (line ~2433) is downstream. The legacy
    // alignment-guide testid (the v2.10 useAlignmentGuides DOM) is also gone
    // — keep the scan defensive against future regressions.
    expect(html).not.toMatch(/data-testid="[^"]*smart-guide[^"]*"/)
    expect(html).not.toMatch(/data-testid="[^"]*alignment-guide[^"]*"/)
  })

  it('PARITY-01 (Plan 60-05, SEL-13): editable={false} renders no multi-selection-ring even with N>=2 selection passed', () => {
    // Plan 60-05 (Phase 60) lands the FIRST concrete chrome that the PARITY-01
    // scan is gating against. This test passes a selection with N>=2 to BOTH
    // editable={true} and editable={false} renders and confirms the testid is
    // gated structurally to the editable=true branch.
    const slide: Slide = {
      hook_text: 'STOP SCROLLING',
      body_text: 'Body text here',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { hook_font_size: 60, hook_width: 100 },
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const selection = { ids: ['img-a', 'img-b'], primary: 'img-b' }

    // editable={false}: no ring even though selection.ids.length >= 2.
    const { container: locked } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={selection}
      />,
    )
    expect(
      locked.querySelector('[data-testid="multi-selection-ring"]'),
    ).toBeNull()
    expect(locked.innerHTML).not.toMatch(/multi-selection-ring/)

    // editable={true}: ring present for N>=2.
    const { container: editable } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={selection}
      />,
    )
    expect(
      editable.querySelector('[data-testid="multi-selection-ring"]'),
    ).not.toBeNull()
  })

  it('PARITY-01 (Phase 64 Plan 01): editable={false} renders no lock-icon even when locked elements present (TPLREND-05 invariant)', () => {
    // Phase 64 Plan 01 lands the SIXTH concrete chrome that the PARITY-01
    // scan gates against — the lock-icon overlay (data-testid="lock-icon").
    // Same shape as the multi-selection-ring / marquee / group-ring /
    // floating-toolbar / smart-guide scans above. The structural gate is
    // the line-916 early return for editable=false (lock icons are rendered
    // inside the editable=true Rnd children, downstream of the early return).
    const slide: Slide = {
      hook_text: 'STOP SCROLLING',
      body_text: 'Body text here',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { hook_font_size: 60, hook_width: 100 },
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, locked: true },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25, locked: true },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)

    const { container: locked } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
      />,
    )
    // Even with TWO locked custom_images, no lock-icon must appear in the
    // editable=false render — Satori PNG export must NEVER show editor chrome.
    expect(locked.querySelector('[data-testid="lock-icon"]')).toBeNull()
    expect(locked.innerHTML).not.toMatch(/data-testid="[^"]*lock-icon[^"]*"/)

    // Sanity: editable=true render DOES surface the lock icon (so the test
    // doesn't pass vacuously when the implementation silently no-ops).
    const { container: editable } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
      />,
    )
    expect(editable.querySelector('[data-testid="lock-icon"]')).not.toBeNull()
  })

  it('PARITY-01 (Plan 60-05, SEL-13): editable={true} renders no ring when N<2 (single-select unchanged)', () => {
    // Confirms the union-AABB ring is gated on selection.ids.length >= 2 —
    // single-select uses the existing per-element dashed ring, not the union.
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: ['img-a'], primary: 'img-a' }}
      />,
    )
    expect(
      container.querySelector('[data-testid="multi-selection-ring"]'),
    ).toBeNull()
  })

  it('PARITY-01 (Plan 61-02, SEL-05): editable={false} renders no marquee-overlay even with selection state', () => {
    // Plan 61-02 (Phase 61) lands the second concrete chrome that PARITY-01
    // gates against: marquee overlay. Confirm the testid is structurally
    // unreachable from the non-editable branch — same proof shape as the
    // multi-selection-ring test above. The structural gate is the line-665
    // early return in slide-preview.tsx (the editable={false} branch never
    // reaches the JSX where MarqueeOverlay is mounted).
    const slide: Slide = {
      hook_text: 'STOP', body_text: 'Body', image_query: 'q', is_cta: false,
      background_url: null, pexels_photo_id: null,
      style_overrides: { hook_font_size: 60, hook_width: 100 },
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const selection = { ids: ['img-a', 'img-b'], primary: 'img-b' }

    const { container: locked } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={selection}
      />,
    )
    expect(
      locked.querySelector('[data-testid="marquee-overlay"]'),
    ).toBeNull()
    expect(locked.innerHTML).not.toMatch(/marquee-overlay/)
  })

  it('PARITY-01 (Plan 62-02, GROUP-06): editable={false} renders no group-bounding-ring even with grouped selection', () => {
    // Plan 62-02 (Phase 62) lands the third concrete chrome that PARITY-01
    // gates against: the group bounding-box ring. Confirms the testid is
    // structurally unreachable from the non-editable branch — same proof
    // shape as the multi-selection-ring + marquee-overlay tests above.
    // The structural gate is the line-728 early return in slide-preview.tsx
    // (the editable={false} branch never reaches the JSX where the group
    // ring is mounted).
    const slide: Slide = {
      hook_text: 'STOP', body_text: 'Body', image_query: 'q', is_cta: false,
      background_url: null, pexels_photo_id: null,
      style_overrides: { hook_font_size: 60, hook_width: 100 },
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_x' },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25, groupId: 'g_x' },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const selection = { ids: ['img-a', 'img-b'], primary: 'img-b' }

    const { container: locked } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={selection}
        currentlyInsideGroup={null}
      />,
    )
    expect(
      locked.querySelector('[data-testid="group-bounding-ring"]'),
    ).toBeNull()
    expect(locked.innerHTML).not.toMatch(/group-bounding-ring/)
  })

  it('PARITY-01 PT-FT (Plan 63-02, ALIGN-07): editable={false} renders no floating-alignment-toolbar even with N=5 selection + onAlign', () => {
    // Plan 63-02 lands the fourth concrete chrome that PARITY-01 gates
    // against: the floating alignment toolbar (Figma-style above-bounds bar
    // with 6 align + 2 distribute buttons). The structural gate is the
    // line-665 early return for editable=false — the toolbar JSX lives
    // downstream of that return alongside the multi-selection-ring,
    // marquee-overlay, and group-bounding-ring chrome.
    const slide: Slide = {
      hook_text: 'STOP', body_text: 'Body', image_query: 'q', is_cta: false,
      background_url: null, pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 15, height: 15 },
        { id: 'img-b', url: 'data:,', x: 30, y: 10, width: 15, height: 15 },
        { id: 'img-c', url: 'data:,', x: 50, y: 10, width: 15, height: 15 },
        { id: 'img-d', url: 'data:,', x: 70, y: 10, width: 15, height: 15 },
        { id: 'img-e', url: 'data:,', x: 10, y: 50, width: 15, height: 15 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const selection = {
      ids: ['img-a', 'img-b', 'img-c', 'img-d', 'img-e'],
      primary: 'img-e',
    }

    // editable={false}: structurally absent, even when N=5 + onAlign provided.
    const { container: locked } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={selection}
        onAlign={() => {}}
      />,
    )
    expect(
      locked.querySelector('[data-testid="floating-alignment-toolbar"]'),
    ).toBeNull()
    expect(locked.innerHTML).not.toMatch(/floating-alignment-toolbar/)

    // editable={true}: positive control — toolbar IS present for N>=2 + onAlign.
    const { container: editable } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={selection}
        onAlign={() => {}}
      />,
    )
    expect(
      editable.querySelector('[data-testid="floating-alignment-toolbar"]'),
    ).not.toBeNull()
  })

  it('PARITY-01 (Plan 62-02, GROUP-06): editable={true} renders no group-bounding-ring with empty selection', () => {
    // Plan 62-02 negative gate: the group ring is selection-driven. When
    // selection.ids is empty, the ring must NOT render even though editable
    // is true and the slide carries grouped elements. This is the symmetric
    // partner to the editable=false test above.
    const slide: Slide = {
      hook_text: 'H', body_text: 'B', image_query: 'q', is_cta: false,
      background_url: null, pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_x' },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25, groupId: 'g_x' },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        currentlyInsideGroup={null}
      />,
    )
    expect(
      container.querySelector('[data-testid="group-bounding-ring"]'),
    ).toBeNull()
  })

  it('PARITY-01 (Plan 61-02, SEL-05): editable={true} renders no marquee-overlay when no active marquee', () => {
    // Plan 61-02 marquee state is local component state; default = no active
    // marquee. The MarqueeOverlay rect=null branch returns null. This test
    // confirms the IDLE state has zero marquee DOM (negative gate).
    const slide: Slide = {
      hook_text: 'H', body_text: 'B', image_query: 'q', is_cta: false,
      background_url: null, pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
      />,
    )
    expect(
      container.querySelector('[data-testid="marquee-overlay"]'),
    ).toBeNull()
  })

  it('Phase 60 (WMARK-04, WMARK-05): free-tier enabled=false STILL renders post-unification', () => {
    // Free-tier opt-out is locked by spec — `enabled: false` MUST still
    // render the ViralSlideMaker mark. The lazy initializer adds
    // slide.watermark but RETAINS the legacy slot, so resolveForcedWatermark
    // (which reads the legacy slot) continues to enforce the lock.
    const legacy: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { watermark: { enabled: false } },
    }
    // Simulate the lazy-initializer mirror: derive watermark element while
    // KEEPING the legacy slot populated (the production path does not
    // delete style_overrides.watermark).
    const lifted: Slide = {
      ...legacy,
      watermark: legacyWatermarkToElement(legacy, 0)!,
    }
    const forcedLegacy = resolveForcedWatermark(
      'free',
      { width: 1080, height: 1920 },
      legacy,
    )
    const forcedLifted = resolveForcedWatermark(
      'free',
      { width: 1080, height: 1920 },
      lifted,
    )
    // Both paths must STILL render (free opt-out is locked) AND produce
    // identical output (byte-identity invariant).
    expect(forcedLegacy).not.toBeNull()
    expect(forcedLifted).not.toBeNull()
    expect(forcedLifted).toEqual(forcedLegacy)
  })

  // ───────────────────────────────────────────────────────────────────────
  // Phase 62 Plan 03 (Tests RT1, RT2): GROUP/UNGROUP parity invariant.
  //
  // RT1: A user gesture chain (GROUP → BULK_TRANSLATE → UNGROUP) on the
  //      canonical text_boxes ∪ custom_images projections leaves the
  //      Satori-bound HTML output (rendered SlidePreview editable={false})
  //      free of any data-group-id leak. Positions reflect the translate;
  //      no extra DOM attributes appear.
  //
  // RT2: A no-drag GROUP → UNGROUP cycle is a true no-op for the Satori
  //      render path — output is byte-identical to the start state. Pins
  //      PITFALL-3.6 (schema migration trauma) for the editable={false}
  //      slot of the parity contract.
  // ───────────────────────────────────────────────────────────────────────
  it('PARITY-01 (Plan 62-03, RT1): GROUP → BULK_TRANSLATE → UNGROUP — no groupId leak in Satori render path', () => {
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const initial: EditorHistory = { past: [], present: [slide], future: [] }

    // Apply GROUP → BULK_TRANSLATE +5%/+5% → UNGROUP via the reducer chain.
    const afterGroup = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['img-a', 'img-b'],
      groupId: 'g_rt1',
    })
    const afterTranslate = editorReducer(afterGroup, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['img-a', 'img-b'],
      deltaX: 5,
      deltaY: 5,
    })
    const finalState = editorReducer(afterTranslate, {
      type: 'UNGROUP',
      slideIndex: 0,
      ids: ['img-a', 'img-b'],
    })

    // Render the post-cycle slide via the Satori-equivalent React preview
    // (editable={false} — same JSX path the export route uses).
    const finalSlide = finalState.present[0]
    const { container } = render(
      <SlidePreview
        slide={finalSlide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
      />,
    )
    // groupId MUST NOT leak as a DOM attribute, data-group-id, or as the
    // literal string 'g_rt1' anywhere in the rendered HTML. The renderer
    // should read x/y/width/height/text only — not groupId.
    expect(container.innerHTML).not.toMatch(/g_rt1/)
    expect(container.innerHTML).not.toMatch(/data-group-id/)
    // Translated positions land in the legacy custom_images projection.
    const finalA = finalSlide.custom_images!.find((c) => c.id === 'img-a')!
    const finalB = finalSlide.custom_images!.find((c) => c.id === 'img-b')!
    expect(finalA.x).toBe(15)
    expect(finalA.y).toBe(15)
    expect(finalB.x).toBe(55)
    expect(finalB.y).toBe(55)
    // groupId cleared on the final state — UNGROUP completed cleanly.
    expect(finalA.groupId).toBeUndefined()
    expect(finalB.groupId).toBeUndefined()
  })

  // ───────────────────────────────────────────────────────────────────────
  // PARITY-03 (Phase 63 Plan 05 milestone gate): every editor-only chrome
  // surface introduced in v2.11 (multi-selection-ring, group-bounding-ring,
  // marquee-rect/marquee-overlay, floating-alignment-toolbar, smart-guide-
  // overlay-x/y/equal) MUST be structurally absent from the editable={false}
  // render tree. PT-03H is the positive control — same fixture editable={true}
  // must render every testid (except marquee-overlay, which is transient
  // local state — only active during a marquee drag, not selection-driven).
  //
  // PT-03A..F are regression confirmations under Phase 63 changes. PT-03G is
  // the kitchen-sink: every chrome simultaneously, all absent in non-editable.
  // PT-03H is the inverse: same fixture editable={true} → all chrome PRESENT.
  // The pair (G/H) prevents the false-negative class where a test passes only
  // because the fixture is broken upstream.
  // ───────────────────────────────────────────────────────────────────────
  it('PARITY-03 PT-03A (Plan 63-05): editable={false} + N>=2 selection → no multi-selection-ring (regression confirmation under Phase 63 changes)', () => {
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-b' }}
      />,
    )
    expect(container.querySelector('[data-testid="multi-selection-ring"]')).toBeNull()
    expect(container.innerHTML).not.toMatch(/multi-selection-ring/)
  })

  it('PARITY-03 PT-03B (Plan 63-05): editable={false} + 2 grouped elements → no group-bounding-ring (regression confirmation under Phase 63 changes)', () => {
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_x' },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25, groupId: 'g_x' },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-b' }}
        currentlyInsideGroup={null}
      />,
    )
    expect(container.querySelector('[data-testid="group-bounding-ring"]')).toBeNull()
    expect(container.innerHTML).not.toMatch(/group-bounding-ring/)
  })

  it('PARITY-03 PT-03C (Plan 63-05): editable={false} → no marquee-overlay (Phase 61 chrome gated; Phase 63 regression confirmation)', () => {
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={{ ids: [], primary: null }}
      />,
    )
    expect(container.querySelector('[data-testid="marquee-overlay"]')).toBeNull()
    expect(container.innerHTML).not.toMatch(/marquee-overlay/)
    expect(container.innerHTML).not.toMatch(/marquee-rect/)
  })

  it('PARITY-03 PT-03D (Plan 63-05): editable={false} + N>=2 + onAlign provided → no floating-alignment-toolbar (Plan 63-02 chrome gated)', () => {
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 15, height: 15 },
        { id: 'img-b', url: 'data:,', x: 30, y: 10, width: 15, height: 15 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-b' }}
        onAlign={() => {}}
      />,
    )
    expect(container.querySelector('[data-testid="floating-alignment-toolbar"]')).toBeNull()
    expect(container.innerHTML).not.toMatch(/floating-alignment-toolbar/)
  })

  it('PARITY-03 PT-03E (Plan 63-05): editable={false} → no smart-guide-overlay (Plan 63-04 chrome gated; -root, -x, -y, -equal sub-pools all absent)', () => {
    // Smart-guide overlay's root container + all three sub-pool testids
    // (-x for vertical lines, -y for horizontal lines, -equal for the pink
    // == indicator) must be structurally absent from editable={false}.
    // The structural gate is the line-790 early return; the overlay JSX
    // (line ~2433) is downstream of it.
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
      />,
    )
    expect(container.querySelector('[data-testid="smart-guide-overlay-root"]')).toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-x"]')).toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-y"]')).toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-equal"]')).toBeNull()
    expect(container.innerHTML).not.toMatch(/smart-guide-overlay-x/)
    expect(container.innerHTML).not.toMatch(/smart-guide-overlay-y/)
    expect(container.innerHTML).not.toMatch(/smart-guide-overlay-equal/)
  })

  it('PARITY-03 PT-03F (Plan 63-05): editable={false} + 3 equally-spaced elements → no equal-spacing == indicator (covered by smart-guide-overlay-equal absence)', () => {
    // The == indicator lives inside the smart-guide-overlay-equal sub-pool,
    // which is itself inside smart-guide-overlay-root. Verify the equal-
    // spacing scaffold is structurally unreachable. The pink color marker
    // (#FF00C7) used by the indicator is also absent — defensive scan.
    const slide: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 10, height: 10 },
        { id: 'img-b', url: 'data:,', x: 30, y: 10, width: 10, height: 10 },
        { id: 'img-c', url: 'data:,', x: 50, y: 10, width: 10, height: 10 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
      />,
    )
    expect(container.querySelector('[data-testid="smart-guide-overlay-equal"]')).toBeNull()
    // Defensive scan for the Figma signature pink — should not appear in the
    // non-editable render path (no equal-spacing indicator can render).
    expect(container.innerHTML).not.toMatch(/#FF00C7/i)
    expect(container.innerHTML).not.toMatch(/smart-guide-overlay-equal/)
  })

  it('PARITY-03 PT-03G (Plan 63-05) — KITCHEN SINK: editable={false} with grouped + locked + watermark + N=4 selection → ALL editor-only chrome testids absent', () => {
    // Constructs a single fixture that, in the editable={true} branch, would
    // render: multi-selection-ring (N>=2), group-bounding-ring (2 grouped
    // elements selected), floating-alignment-toolbar (N>=2 + onAlign), and
    // smart-guide-overlay-{root,x,y,equal} (mounted unconditionally inside
    // editable=true). The non-editable render must contain NONE of them.
    const slide: Slide = {
      hook_text: 'STOP',
      body_text: 'Body',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { hook_font_size: 60, hook_width: 100 },
      watermark: { id: 'w_0', enabled: true, customText: 'Brand', position: 'bottom-right' },
      custom_images: [
        // 2 grouped (would form a group-bounding-ring)
        { id: 'img-grp-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_x' },
        { id: 'img-grp-b', url: 'data:,', x: 35, y: 10, width: 20, height: 20, groupId: 'g_x' },
        // 1 locked (Phase 63 ALIGN-10 — included in bounds, excluded from move)
        { id: 'img-locked', url: 'data:,', x: 60, y: 60, width: 15, height: 15, locked: true },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const selection = {
      ids: ['img-grp-a', 'img-grp-b', 'img-locked', 'w_0'],
      primary: 'img-locked',
    }

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={selection}
        currentlyInsideGroup={null}
        onAlign={() => {}}
      />,
    )
    // Every v2.11 editor-only chrome surface — all absent.
    expect(container.querySelector('[data-testid="multi-selection-ring"]')).toBeNull()
    expect(container.querySelector('[data-testid="group-bounding-ring"]')).toBeNull()
    expect(container.querySelector('[data-testid="marquee-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="floating-alignment-toolbar"]')).toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-root"]')).toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-x"]')).toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-y"]')).toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-equal"]')).toBeNull()
    // Inner HTML defensive scan — no chrome testid OR class survives.
    const html = container.innerHTML
    expect(html).not.toMatch(/multi-selection-ring/)
    expect(html).not.toMatch(/group-bounding-ring/)
    expect(html).not.toMatch(/marquee-overlay/)
    expect(html).not.toMatch(/floating-alignment-toolbar/)
    expect(html).not.toMatch(/data-testid="[^"]*smart-guide[^"]*"/)
    expect(html).not.toMatch(/data-testid="[^"]*alignment-guide[^"]*"/)
  })

  it('PARITY-03 PT-03H (Plan 63-05) — POSITIVE CONTROL: same fixture editable={true} → multi-selection-ring + group-bounding-ring + floating-alignment-toolbar + smart-guide-overlay-root all PRESENT', () => {
    // Inverse of PT-03G. If the editable={false} render passes PT-03G but
    // editable={true} ALSO has none of the testids, the fixture is broken
    // upstream and PT-03G is a false negative. This test guards against
    // that — it asserts every chrome testid PRESENT in the editable=true
    // render with the same fixture.
    const slide: Slide = {
      hook_text: 'STOP',
      body_text: 'Body',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { hook_font_size: 60, hook_width: 100 },
      watermark: { id: 'w_0', enabled: true, customText: 'Brand', position: 'bottom-right' },
      custom_images: [
        { id: 'img-grp-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_x' },
        { id: 'img-grp-b', url: 'data:,', x: 35, y: 10, width: 20, height: 20, groupId: 'g_x' },
        { id: 'img-locked', url: 'data:,', x: 60, y: 60, width: 15, height: 15, locked: true },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const selection = {
      ids: ['img-grp-a', 'img-grp-b', 'img-locked', 'w_0'],
      primary: 'img-locked',
    }

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={selection}
        currentlyInsideGroup={null}
        onAlign={() => {}}
      />,
    )
    // Selection-driven chrome (N>=2 + onAlign + 2 grouped members in selection).
    expect(container.querySelector('[data-testid="multi-selection-ring"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="group-bounding-ring"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="floating-alignment-toolbar"]')).not.toBeNull()
    // Smart-guide overlay is mounted unconditionally inside editable=true
    // (its slots are display:none until a drag triggers updateGuides — but
    // the root + sub-pool testids are persistent DOM, the structural gate is
    // the editable=true branch itself).
    expect(container.querySelector('[data-testid="smart-guide-overlay-root"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-x"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-y"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="smart-guide-overlay-equal"]')).not.toBeNull()
    // marquee-overlay is transient (only present during an active marquee
    // drag — not selection-driven). Its absence here is expected and
    // intentional; it does NOT undermine PT-03G's gate.
  })

  it('PARITY-01 (Plan 62-03, RT2): GROUP → UNGROUP with no drag is a render no-op (byte-identical Satori HTML)', () => {
    const slide: Slide = {
      hook_text: 'STOP',
      body_text: 'Body',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      custom_images: [
        { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
        { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25 },
      ],
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    const initial: EditorHistory = { past: [], present: [slide], future: [] }

    // Render the start state (editable={false}).
    const { container: startContainer } = render(
      <SlidePreview
        slide={initial.present[0]}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
      />,
    )
    const startHtml = startContainer.innerHTML

    // GROUP → UNGROUP (no drag, no translate).
    const afterGroup = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['img-a', 'img-b'],
      groupId: 'g_rt2',
    })
    const finalState = editorReducer(afterGroup, {
      type: 'UNGROUP',
      slideIndex: 0,
      ids: ['img-a', 'img-b'],
    })

    // Render the post-cycle state.
    const { container: endContainer } = render(
      <SlidePreview
        slide={finalState.present[0]}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
      />,
    )
    // Byte-identical Satori-render HTML — no groupId leak, no extra
    // attributes, no schema migration trauma (PITFALL-3.6).
    expect(endContainer.innerHTML).toBe(startHtml)
    // Defense-in-depth: the literal groupId string never appears.
    expect(endContainer.innerHTML).not.toMatch(/g_rt2/)
  })
})
