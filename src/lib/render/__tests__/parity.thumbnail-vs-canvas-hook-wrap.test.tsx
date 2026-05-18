import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 82 — R10 round 3, Gap F: thumbnail vs canvas headline-wrap parity.
 *
 * ===========================================================================
 * What this test pins
 * ===========================================================================
 * The editor renders the same News headline through two `SlidePreview`
 * branches that are MEANT to be the same canonical 1080x1920 layout, just
 * scaled:
 *
 *   - the read-only left thumbnail strip — `<SlidePreview editable={false}>`
 *   - the editable main centre canvas    — `<SlidePreview editable>`
 *
 * Plus a third path — the Satori PNG export (`buildSlideElement`).
 *
 * Gap F (confirmed via live DOM): all three render the headline at the same
 * font with the same words, but the editable canvas placed line breaks
 * differently ("APPROVES MASSIVE" on one line in the thumbnail, two lines on
 * the canvas). ROOT CAUSE: the editable branch wraps the headline inside a
 * draggable `<Rnd>` whose inner `hook-text-wrapper` div applies
 * `padding: '4px 8px'`. The 8px horizontal padding each side narrowed the
 * headline's flex-wrap container by 16px relative to the read-only branch's
 * plain `width: hookWidth%` div and the Satori `pxX(hookWidth)` box — same
 * font + words, narrower container, different flex-wrap break points.
 *
 * The 82-10 fix (`HOOK_WRAPPER_PAD_X`): the editable headline `<Rnd>` is
 * widened by `2 * HOOK_WRAPPER_PAD_X` so the inner wrapper's content box
 * (after subtracting the `4px 8px` padding) is exactly `hookWidthPx` — the
 * same flex-wrap container width as the other two paths.
 *
 * ===========================================================================
 * What this test catches
 * ===========================================================================
 * Reverting the padding compensation (removing the `+ 2 * HOOK_WRAPPER_PAD_X`
 * widening of the editable hook `<Rnd>`) turns this red — the editable
 * headline's effective text width drops 16px below the read-only / Satori
 * width and the wrap divergence returns.
 */

// Horizontal padding (px each side) the editable hook-text-wrapper applies via
// `padding: '4px 8px'`. Mirrors HOOK_WRAPPER_PAD_X in slide-preview.tsx.
const HOOK_WRAPPER_PAD_X = 8
const REF_WIDTH = 1080

// A News headline long enough to wrap at the news caption-card width — the
// exact headline from the Gap F live-DOM repro.
const NEWS_HEADLINE = 'CITY COUNCIL APPROVES MASSIVE DOWNTOWN TRANSIT UPGRADE'

function makeNewsSlide(): Slide {
  const slide: Slide = {
    hook_text: NEWS_HEADLINE,
    image_query: 'city transit',
    is_cta: false,
    background_url: 'https://example.com/news-photo.jpg',
    pexels_photo_id: null,
    style_overrides: undefined,
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return slide
}

// Resolve a News-category template; fall back to any registered template if the
// canonical id changes (the parity logic is template-agnostic).
function newsTemplate() {
  for (const id of ['news-drop', 'news-cyan', 'highlight-bar']) {
    try {
      return getTemplate(id)
    } catch {
      /* try next */
    }
  }
  throw new Error('no template available for parity fixture')
}

// Parse a width style value into canvas px. Accepts "NN%" or "NNpx" / number.
function widthToPx(width: string | number | undefined): number {
  if (width == null) return NaN
  const s = String(width).trim()
  if (s.endsWith('%')) return (parseFloat(s) / 100) * REF_WIDTH
  return parseFloat(s) // strips "px"
}

// Walk a Satori element tree.
function walk(node: unknown): unknown[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) {
    const out: unknown[] = []
    for (const k of node) out.push(...walk(k))
    return out
  }
  const out: unknown[] = [node]
  const kids = (node as { props?: { children?: unknown } }).props?.children
  if (Array.isArray(kids)) {
    for (const k of kids) out.push(...walk(k))
  } else if (kids != null) {
    out.push(...walk(kids))
  }
  return out
}

describe('Phase 82 Gap F — thumbnail/canvas/export headline-wrap parity', () => {
  it('read-only thumbnail headline box width === canvas headline text-container width', () => {
    const slide = makeNewsSlide()
    const template = newsTemplate()

    // --- READ-ONLY branch (left thumbnail strip) ---------------------------
    const ro = render(
      <SlidePreview slide={slide} template={template} index={0} editable={false} />,
    )
    // The read-only headline lives in a positioned <div> whose inline `width`
    // is `${hookWidth}%`. Walk up from the headline text to the first ancestor
    // carrying a `%` width — that is the headline box.
    // The read-only headline box is the `position: absolute` ancestor whose
    // inline `width` is `${hookWidth}%`. Walk up past the inner
    // renderTextBlock `width: 100%` div to the absolutely-positioned hook box.
    let roBox: HTMLElement | null = screen.getByText(/CITY COUNCIL/i) as HTMLElement
    while (
      roBox &&
      !(
        roBox.style?.position === 'absolute' &&
        roBox.style?.width &&
        roBox.style.width.endsWith('%')
      )
    ) {
      roBox = roBox.parentElement
    }
    expect(roBox, 'read-only headline box with a % width').not.toBeNull()
    const readOnlyHeadlineWidthPx = widthToPx(roBox!.style.width)
    ro.unmount()

    // --- EDITABLE branch (main centre canvas) ------------------------------
    const ed = render(
      <SlidePreview slide={slide} template={template} index={0} editable />,
    )
    // The editable headline sits inside the `hook-text-wrapper` div, itself
    // inside the draggable <Rnd>. The <Rnd> root carries an inline px `width`.
    const wrapper = screen.getByTestId('hook-text-wrapper')
    let rnd: HTMLElement | null = wrapper.parentElement
    while (rnd && !(rnd.style?.width && /px|\d/.test(rnd.style.width))) {
      rnd = rnd.parentElement
    }
    expect(rnd, 'editable headline <Rnd> with a px width').not.toBeNull()
    const rndWidthPx = widthToPx(rnd!.style.width)

    // The headline's flex-wrap container inside the editable branch is the
    // <Rnd> width minus the wrapper's horizontal padding (8px each side).
    const editableHeadlineTextWidthPx = rndWidthPx - 2 * HOOK_WRAPPER_PAD_X
    ed.unmount()

    // PARITY: the editable headline's text-container width must equal the
    // read-only headline box width. If the 82-10 padding compensation is
    // reverted, rndWidthPx loses the +16 and this drops 16px short.
    expect(editableHeadlineTextWidthPx).toBeCloseTo(readOnlyHeadlineWidthPx, 1)
  })

  it('Satori PNG export headline box width === read-only thumbnail headline box width', () => {
    const slide = makeNewsSlide()
    const template = newsTemplate()

    // Satori hook box — the only absolutely-positioned flex-wrap node holding
    // the headline; its `width` is `pxX(hookWidth)` (no padding).
    const tree = buildSlideElement(slide, template)
    const hookNode = walk(tree).find((n) => {
      const style = (n as { props?: { style?: Record<string, unknown> } }).props
        ?.style
      return (
        style != null &&
        style.display === 'flex' &&
        style.flexWrap === 'wrap' &&
        style.position === 'absolute' &&
        typeof style.width === 'number'
      )
    }) as { props: { style: Record<string, unknown> } } | undefined
    expect(hookNode, 'Satori hook flex-wrap node').toBeDefined()
    const satoriHeadlineWidthPx = hookNode!.props.style.width as number

    // Read-only branch headline box width (canonical).
    const ro = render(
      <SlidePreview slide={slide} template={template} index={0} editable={false} />,
    )
    // The read-only headline box is the `position: absolute` ancestor whose
    // inline `width` is `${hookWidth}%`. Walk up past the inner
    // renderTextBlock `width: 100%` div to the absolutely-positioned hook box.
    let roBox: HTMLElement | null = screen.getByText(/CITY COUNCIL/i) as HTMLElement
    while (
      roBox &&
      !(
        roBox.style?.position === 'absolute' &&
        roBox.style?.width &&
        roBox.style.width.endsWith('%')
      )
    ) {
      roBox = roBox.parentElement
    }
    expect(roBox).not.toBeNull()
    const readOnlyHeadlineWidthPx = widthToPx(roBox!.style.width)
    ro.unmount()

    // All three paths (thumbnail / canvas / export) agree on the headline's
    // flex-wrap container width — so they wrap the headline identically.
    expect(satoriHeadlineWidthPx).toBeCloseTo(readOnlyHeadlineWidthPx, 0)
  })
})
