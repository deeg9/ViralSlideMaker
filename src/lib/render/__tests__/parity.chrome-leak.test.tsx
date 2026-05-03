// Phase 65 Plan 03 (PARITY-02): comprehensive chrome-leak scan — TPLREND-05
// invariant for the entire v2.11 surface.
//
// Two-layer gate per chrome surface:
//   1) Runtime DOM scan — render SlidePreview editable={false} with a fixture
//      that WOULD trigger the chrome surface in editable={true}; assert the
//      resulting DOM contains zero matching nodes / attributes.
//   2) Source-code grep gate (defense-in-depth) — read render-slide-satori.tsx
//      as raw text, strip line comments, and assert ZERO literal occurrences
//      of the chrome class / data-testid string. Catches dynamically-injected
//      class names that the runtime scan might miss with the wrong fixture.
//
// Chrome surfaces scanned (10):
//   PCL1  — multi-selection-ring   (Plan 60-05)
//   PCL2  — marquee-overlay/rect   (Plan 61-01/02)
//   PCL3  — group-bounding-ring    (Plan 62-02)
//   PCL4  — floating-alignment-toolbar (Plan 63-02/03)
//   PCL5  — smart-guide-overlay    (Plan 63-04/05)
//   PCL6  — lock-icon              (Plan 64-01)
//   PCL7  — data-locked attribute  (Plan 64-01 react-rnd outer-node marker)
//   PCL8  — layers-panel           (Plan 65-01 — lives outside SlidePreview;
//                                    pinned for completeness)
//   PCL9  — layer-chip             (Plan 65-01 — same)
//   PCL10 — combined sweep         (every chrome simultaneously absent)
//
// PCL10 is runtime-only (the combined-sweep fixture has nothing to grep).

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Read render-slide-satori.tsx as raw text and strip JS line comments. Block
 * comments are intentionally NOT stripped because the file uses // line
 * comments throughout (verified by inspection); the line-comment strip alone
 * suffices to silence documentation-prose false positives. Mirror of the
 * Plan 64-03 ZA16 z-order purity gate pattern.
 */
function readSatoriSource(): string {
  const sourcePath = path.resolve(
    process.cwd(),
    'src/lib/render/render-slide-satori.tsx',
  )
  const raw = fs.readFileSync(sourcePath, 'utf-8')
  return raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

/**
 * Build a kitchen-sink slide that, in editable={true}, would surface every
 * v2.11 chrome surface simultaneously (multi-select ring + marquee + group
 * ring + alignment toolbar + smart-guide overlay + lock icon).
 */
function buildKitchenSinkSlide(): Slide {
  const slide: Slide = {
    hook_text: 'STOP SCROLLING',
    body_text: 'Body text here',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: { hook_font_size: 60, hook_width: 100 },
    watermark: {
      id: 'w_0',
      enabled: true,
      customText: 'Brand',
      position: 'bottom-right',
    },
    custom_images: [
      // 2 grouped — would form a group-bounding-ring
      { id: 'img-grp-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_x' },
      { id: 'img-grp-b', url: 'data:,', x: 35, y: 10, width: 20, height: 20, groupId: 'g_x' },
      // 1 locked — would surface lock-icon + data-locked attribute
      { id: 'img-locked', url: 'data:,', x: 60, y: 60, width: 15, height: 15, locked: true },
      // 1 hidden+locked — Phase 64 Plan 02 hidden takes precedence (absent in render)
      { id: 'img-hidden-locked', url: 'data:,', x: 80, y: 60, width: 10, height: 10, hidden: true, locked: true },
    ],
  }
  // Locked text_boxes too — surfaces lock-icon on hook AND body text wrappers
  slide.text_boxes = legacyToTextBoxes(slide).map((tb) =>
    tb.role === 'hook' ? { ...tb, locked: true } : tb,
  )
  return slide
}

// ────────────────────────────────────────────────────────────────────────────
// PCL1 — multi-selection-ring (Plan 60-05)
// ────────────────────────────────────────────────────────────────────────────

describe('Phase 65 Plan 03 (PARITY-02): comprehensive chrome-leak scan — TPLREND-05 invariant for the entire v2.11 surface', () => {
  describe('PCL1: multi-selection-ring (Plan 60-05)', () => {
    it('PCL1 runtime: SlidePreview editable={false} + N>=2 selection → zero multi-selection-ring DOM', () => {
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

    it('PCL1 source-grep: render-slide-satori.tsx contains zero "multi-selection-ring" literals (defense-in-depth)', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/multi-selection-ring/)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL2 — marquee-overlay / marquee-rect (Plan 61-01/02)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL2: marquee-overlay / marquee-rect (Plan 61-01/02)', () => {
    it('PCL2 runtime: SlidePreview editable={false} → zero marquee-overlay DOM (no transient marquee, but structurally gated)', () => {
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

    it('PCL2 source-grep: render-slide-satori.tsx contains zero "marquee" literals', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/marquee/i)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL3 — group-bounding-ring (Plan 62-02)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL3: group-bounding-ring (Plan 62-02)', () => {
    it('PCL3 runtime: SlidePreview editable={false} + grouped selection → zero group-bounding-ring DOM', () => {
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

    it('PCL3 source-grep: render-slide-satori.tsx contains zero "group-bounding-ring" literals', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/group-bounding-ring/)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL4 — floating-alignment-toolbar (Plan 63-02/03)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL4: floating-alignment-toolbar (Plan 63-02/03)', () => {
    it('PCL4 runtime: SlidePreview editable={false} + N>=2 + onAlign provided → zero floating-alignment-toolbar DOM', () => {
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
          { id: 'img-c', url: 'data:,', x: 50, y: 10, width: 15, height: 15 },
        ],
      }
      slide.text_boxes = legacyToTextBoxes(slide)
      const { container } = render(
        <SlidePreview
          slide={slide}
          template={getTemplate('highlight-bar')}
          index={0}
          editable={false}
          selection={{ ids: ['img-a', 'img-b', 'img-c'], primary: 'img-c' }}
          onAlign={() => {}}
        />,
      )
      expect(container.querySelector('[data-testid="floating-alignment-toolbar"]')).toBeNull()
      expect(container.innerHTML).not.toMatch(/floating-alignment-toolbar/)
    })

    it('PCL4 source-grep: render-slide-satori.tsx contains zero "floating-alignment-toolbar" literals', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/floating-alignment-toolbar/)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL5 — smart-guide-overlay (Plan 63-04/05)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL5: smart-guide-overlay (Plan 63-04/05)', () => {
    it('PCL5 runtime: SlidePreview editable={false} → zero smart-guide-overlay DOM (root + x/y/equal sub-pools)', () => {
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
      expect(container.innerHTML).not.toMatch(/smart-guide-overlay/)
      // Defensive: legacy alignment-guide testid (v2.10 useAlignmentGuides)
      // also absent — guards against future regressions.
      expect(container.innerHTML).not.toMatch(/alignment-guide/)
    })

    it('PCL5 source-grep: render-slide-satori.tsx contains zero "smart-guide" or "alignment-guide" literals', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/smart-guide/)
      expect(source).not.toMatch(/alignment-guide/)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL6 — lock-icon (Plan 64-01)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL6: lock-icon (Plan 64-01)', () => {
    it('PCL6 runtime: SlidePreview editable={false} + locked elements → zero lock-icon DOM', () => {
      const slide: Slide = {
        hook_text: 'H',
        body_text: 'B',
        image_query: 'q',
        is_cta: false,
        background_url: null,
        pexels_photo_id: null,
        custom_images: [
          { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, locked: true },
          { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25, locked: true },
        ],
      }
      // Lock the hook text-box too.
      slide.text_boxes = legacyToTextBoxes(slide).map((tb) =>
        tb.role === 'hook' ? { ...tb, locked: true } : tb,
      )
      const { container } = render(
        <SlidePreview
          slide={slide}
          template={getTemplate('highlight-bar')}
          index={0}
          editable={false}
        />,
      )
      expect(container.querySelector('[data-testid="lock-icon"]')).toBeNull()
      expect(container.innerHTML).not.toMatch(/data-testid="[^"]*lock-icon[^"]*"/)
    })

    it('PCL6 source-grep: render-slide-satori.tsx contains zero "lock-icon" literals', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/lock-icon/)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL7 — data-locked attribute (Plan 64-01 react-rnd outer-node marker)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL7: data-locked attribute (Plan 64-01 react-rnd outer-node marker)', () => {
    it('PCL7 runtime: SlidePreview editable={false} + locked elements → zero data-locked="true" attributes', () => {
      const slide: Slide = {
        hook_text: 'H',
        body_text: 'B',
        image_query: 'q',
        is_cta: false,
        background_url: null,
        pexels_photo_id: null,
        custom_images: [
          { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, locked: true },
        ],
        custom_texts: [
          { id: 'ct-a', text: 'CT', x: 10, y: 60, width: 30, color: '#fff' },
        ],
      }
      slide.text_boxes = [
        ...legacyToTextBoxes(slide).map((tb) =>
          tb.role === 'hook' ? { ...tb, locked: true } : { ...tb, locked: true },
        ),
        // ct-a mirror with locked
        { id: 'ct-a', role: 'custom', text: 'CT', position: { anchor: 'custom', x: 10, y: 60, width: 30 }, locked: true },
      ]
      const { container } = render(
        <SlidePreview
          slide={slide}
          template={getTemplate('highlight-bar')}
          index={0}
          editable={false}
        />,
      )
      expect(container.querySelector('[data-locked="true"]')).toBeNull()
      expect(container.innerHTML).not.toMatch(/data-locked="true"/)
    })

    it('PCL7 source-grep: render-slide-satori.tsx contains zero "data-locked" literals', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/data-locked/)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL8 — layers-panel (Plan 65-01 — lives OUTSIDE SlidePreview)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL8: layers-panel (Plan 65-01 — lives outside SlidePreview)', () => {
    it('PCL8 runtime: SlidePreview editable={false} → zero layers-panel DOM (structurally impossible; pinned for completeness)', () => {
      // The layers panel lives in slide-editor.tsx LEFT aside, NEVER inside
      // SlidePreview. This test pins the structural invariant: no matter what
      // fixture we pass, SlidePreview never emits layers-panel testid/class.
      const slide = buildKitchenSinkSlide()
      const { container: locked } = render(
        <SlidePreview
          slide={slide}
          template={getTemplate('highlight-bar')}
          index={0}
          editable={false}
          selection={{ ids: ['img-grp-a', 'img-grp-b'], primary: 'img-grp-b' }}
        />,
      )
      expect(locked.querySelector('[data-testid="layers-panel"]')).toBeNull()
      expect(locked.innerHTML).not.toMatch(/layers-panel/)
      // Also confirm editable=true SlidePreview doesn't leak the panel —
      // structurally impossible (panel is mounted by slide-editor.tsx).
      const { container: editable } = render(
        <SlidePreview
          slide={slide}
          template={getTemplate('highlight-bar')}
          index={0}
          editable={true}
          selection={{ ids: ['img-grp-a', 'img-grp-b'], primary: 'img-grp-b' }}
        />,
      )
      expect(editable.querySelector('[data-testid="layers-panel"]')).toBeNull()
      expect(editable.innerHTML).not.toMatch(/layers-panel/)
    })

    it('PCL8 source-grep: render-slide-satori.tsx contains zero "layers-panel" literals', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/layers-panel/)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL9 — layer-chip (Plan 65-01 — lives OUTSIDE SlidePreview)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL9: layer-chip (Plan 65-01 — lives outside SlidePreview)', () => {
    it('PCL9 runtime: SlidePreview editable={false} → zero layer-chip DOM (structurally impossible; pinned for completeness)', () => {
      const slide = buildKitchenSinkSlide()
      const { container } = render(
        <SlidePreview
          slide={slide}
          template={getTemplate('highlight-bar')}
          index={0}
          editable={false}
        />,
      )
      expect(container.querySelector('[data-testid="layer-chip"]')).toBeNull()
      expect(container.innerHTML).not.toMatch(/layer-chip/)
    })

    it('PCL9 source-grep: render-slide-satori.tsx contains zero "layer-chip" literals', () => {
      const source = readSatoriSource()
      expect(source).not.toMatch(/layer-chip/)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PCL10 — combined kitchen-sink sweep (runtime-only)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PCL10: combined kitchen-sink sweep — every chrome simultaneously absent in editable={false}', () => {
    it('PCL10 runtime: editable={false} with ALL chrome triggers active → union regex matches ZERO chrome surfaces', () => {
      const slide = buildKitchenSinkSlide()
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

      // Every per-surface testid — structurally absent.
      expect(container.querySelector('[data-testid="multi-selection-ring"]')).toBeNull()
      expect(container.querySelector('[data-testid="marquee-overlay"]')).toBeNull()
      expect(container.querySelector('[data-testid="group-bounding-ring"]')).toBeNull()
      expect(container.querySelector('[data-testid="floating-alignment-toolbar"]')).toBeNull()
      expect(container.querySelector('[data-testid="smart-guide-overlay-root"]')).toBeNull()
      expect(container.querySelector('[data-testid="smart-guide-overlay-x"]')).toBeNull()
      expect(container.querySelector('[data-testid="smart-guide-overlay-y"]')).toBeNull()
      expect(container.querySelector('[data-testid="smart-guide-overlay-equal"]')).toBeNull()
      expect(container.querySelector('[data-testid="lock-icon"]')).toBeNull()
      expect(container.querySelector('[data-locked="true"]')).toBeNull()
      expect(container.querySelector('[data-testid="layers-panel"]')).toBeNull()
      expect(container.querySelector('[data-testid="layer-chip"]')).toBeNull()

      // Single union-regex pinning the entire invariant in one assertion.
      const html = container.innerHTML
      expect(html).not.toMatch(
        /(selection-ring|marquee|guide-overlay|group-bounding|alignment-toolbar|lock-icon|layers-panel|layer-chip)/,
      )
      // Also check class-name fragments per the must_haves spec.
      expect(html).not.toMatch(/class="[^"]*\bselection\b[^"]*"/)
      expect(html).not.toMatch(/class="[^"]*\bmarquee\b[^"]*"/)
      expect(html).not.toMatch(/class="[^"]*\bguide\b[^"]*"/)
    })

    it('PCL10 positive control: same fixture editable={true} surfaces multiple chrome testids (proves PCL10 runtime is not vacuous)', () => {
      // Inverse fixture proof — if editable=true ALSO had no chrome, the
      // sweep above would be a false negative. This assertion confirms the
      // gate is real by surfacing at least 3 chrome testids in the editable
      // branch with the same fixture.
      const slide = buildKitchenSinkSlide()
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
      expect(container.querySelector('[data-testid="multi-selection-ring"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="group-bounding-ring"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="floating-alignment-toolbar"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="smart-guide-overlay-root"]')).not.toBeNull()
      // lock-icon present for the locked image (img-locked).
      expect(container.querySelector('[data-testid="lock-icon"]')).not.toBeNull()
    })
  })
})
