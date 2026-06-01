import { describe, it, expect } from 'vitest'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { renderDecorativeOverlay } from '@/lib/render/resolve-overlay'
import { CAROUSEL_FORMATS, scaleFontPx } from '@/lib/render/carousel-formats'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 90 — carousel output format render tests.
 *
 * Verifies buildSlideElement honors the `format` param: the root canvas is
 * sized to the format's {w,h}, percentage-positioned text scales with the
 * canvas height, and the default (no `format` arg) is byte-identical to
 * `tiktok` 1080×1920.
 */

const template: SlideTemplate = {
  id: 'fixture-format',
  name: 'Fixture Format',
  thumbnail: '',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '32px',
  textColor: '#111111',
  backgroundColor: '#222222',
  overlayColor: '#000000',
  overlayOpacity: 0.4,
  textAlign: 'left',
  textPosition: 'center', // hookY 30%, bodyY 48%
  hookStyle: 'uppercase',
}

const slide: Slide = {
  hook_text: 'FORMAT HOOK',
  body_text: 'Body copy for the format render test.',
  image_query: '',
  is_cta: false,
  background_url: null,
  pexels_photo_id: null,
}

// Recursive Satori element-tree flatten.
function walk(node: unknown): unknown[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) {
    return node.flatMap(walk)
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

function styleOf(node: unknown): Record<string, unknown> {
  return ((node as { props?: { style?: Record<string, unknown> } }).props?.style ?? {})
}

describe('Phase 90 — buildSlideElement output format', () => {
  it.each([
    ['tiktok', CAROUSEL_FORMATS.tiktok, 1080, 1920],
    ['instagram', CAROUSEL_FORMATS.instagram, 1080, 1350],
    ['square', CAROUSEL_FORMATS.square, 1080, 1080],
  ])('renders the root canvas at %s dimensions', (_id, format, w, h) => {
    const root = buildSlideElement(slide, template, 'free', undefined, undefined, undefined, format)
    const rootStyle = styleOf(root)
    expect(rootStyle.width).toBe(w)
    expect(rootStyle.height).toBe(h)
  })

  it('scales percentage-positioned text with the canvas height', () => {
    // hook sits at textPosition 'center' → hookY 30%. pxY(30) = round(h * 0.3).
    const findHookTop = (format: typeof CAROUSEL_FORMATS.tiktok): number => {
      const tree = buildSlideElement(slide, template, 'free', undefined, undefined, undefined, format)
      const hook = walk(tree).find((n) => {
        const s = styleOf(n)
        return s.position === 'absolute' && s.lineHeight === 1.1 && typeof s.top === 'number'
      })
      return styleOf(hook).top as number
    }
    expect(findHookTop(CAROUSEL_FORMATS.tiktok)).toBe(Math.round(1920 * 0.3))
    expect(findHookTop(CAROUSEL_FORMATS.instagram)).toBe(Math.round(1350 * 0.3))
    expect(findHookTop(CAROUSEL_FORMATS.square)).toBe(Math.round(1080 * 0.3))
  })

  it('scales the hook font size by the format height ratio', () => {
    const findHookFontSize = (format: typeof CAROUSEL_FORMATS.tiktok): number => {
      const tree = buildSlideElement(slide, template, 'free', undefined, undefined, undefined, format)
      const hook = walk(tree).find((n) => {
        const s = styleOf(n)
        return s.position === 'absolute' && s.lineHeight === 1.1 && typeof s.fontSize === 'number'
      })
      return styleOf(hook).fontSize as number
    }
    // template.hookFontSize is '110px'; no hook-fit registry entry for the fixture.
    expect(findHookFontSize(CAROUSEL_FORMATS.tiktok)).toBe(110)
    expect(findHookFontSize(CAROUSEL_FORMATS.instagram)).toBe(scaleFontPx(110, CAROUSEL_FORMATS.instagram))
    expect(findHookFontSize(CAROUSEL_FORMATS.square)).toBe(scaleFontPx(110, CAROUSEL_FORMATS.square))
  })

  it('renderDecorativeOverlay sizes the full-canvas paper-frame to the active format', () => {
    expect(styleOf(renderDecorativeOverlay('paper-frame', { x: 0, y: 0 }))).toMatchObject({
      width: 1080,
      height: 1920,
    })
    expect(
      styleOf(renderDecorativeOverlay('paper-frame', { x: 0, y: 0 }, undefined, undefined, { W: 1080, H: 1350 })),
    ).toMatchObject({ width: 1080, height: 1350 })

    // A partial-width strip is NOT a full-canvas asset — left untouched.
    expect(
      styleOf(renderDecorativeOverlay('paper-torn-edge', { x: 0, y: 0 }, undefined, undefined, { W: 1080, H: 1350 })),
    ).toMatchObject({ height: 40 })
  })

  it('defaults to tiktok 1080×1920 when no format arg is passed (byte-identity)', () => {
    const withoutArg = styleOf(buildSlideElement(slide, template))
    const withTiktok = styleOf(
      buildSlideElement(slide, template, undefined, undefined, undefined, undefined, CAROUSEL_FORMATS.tiktok),
    )
    expect(withoutArg.width).toBe(1080)
    expect(withoutArg.height).toBe(1920)
    expect(withoutArg).toEqual(withTiktok)
  })
})
