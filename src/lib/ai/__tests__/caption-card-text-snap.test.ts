// quick-260519-hym — coverage for the caption-card headline snap.
//
// The snap derives the headline text box ENTIRELY from the caption card:
// x/width inset by CAPTION_CARD_INSET_PX, y = the card's vertical centre
// (the renderers pair it with translateY(-50%)). `captionCardHeadlineBox`
// (hook-fit.ts) is the shared geometry helper.

import { describe, it, expect } from 'vitest'
import { snapHeadlineToCaptionCard } from '../caption-card-text-snap'
import { captionCardHeadlineBox } from '@/lib/render/hook-fit'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/** style_overrides of a returned slide. */
function so(slide: { style_overrides?: Record<string, unknown> }): Record<string, unknown> {
  return (slide.style_overrides ?? {}) as Record<string, unknown>
}
/** Read a TextPosition-shaped override without over-narrowing the object. */
function pos(o: Record<string, unknown>, key: string): { x: number; y: number } | undefined {
  return o[key] as { x: number; y: number } | undefined
}

describe('captionCardHeadlineBox', () => {
  it('default bottom card → inset x/width, card-centre y', () => {
    const b = captionCardHeadlineBox({ x: 0, y: 62, width: 100, heightPct: 38 })
    expect(b.xPct).toBe(7.4) // 80px inset / 1080
    expect(b.widthPct).toBe(85.2) // (1080 - 160) / 1080
    expect(b.yCenterPct).toBe(81) // 62 + 38/2
  })

  it('top card → centre y in the upper region', () => {
    const b = captionCardHeadlineBox({ x: 0, y: 0, width: 100, heightPct: 38 })
    expect(b.yCenterPct).toBe(19) // 0 + 38/2
  })

  it('shifted / narrower card → x and width track the card edges', () => {
    const b = captionCardHeadlineBox({ x: 10, y: 55, width: 80, heightPct: 30 })
    // xPx = 10%*1080 + 80 = 188 → 17.4% ; widthPx = 80%*1080 - 160 = 704 → 65.2%
    expect(b.xPct).toBe(17.4)
    expect(b.widthPct).toBe(65.2)
    expect(b.yCenterPct).toBe(70) // 55 + 30/2
  })

  it('headline box width equals the auto-fit box width (no overflow)', () => {
    // The headline must render exactly as wide as the box its font was fit to.
    const b = captionCardHeadlineBox({ x: 0, y: 62, width: 100, heightPct: 38 })
    // captionCardBox width for a full-width card is 1080-160 = 920px = 85.19%.
    expect(b.widthPct).toBeCloseTo((920 / 1080) * 100, 1)
  })
})

describe('snapHeadlineToCaptionCard', () => {
  it('enabled default card → headline box derived from the card geometry', () => {
    const out = snapHeadlineToCaptionCard([
      { style_overrides: { caption_bar_enabled: true, caption_bar_height_pct: 38 } },
    ])
    const o = so(out[0])
    expect(pos(o, 'hook_position')).toEqual({ x: 7.4, y: 81 })
    expect(o.hook_width).toBe(85.2)
  })

  it('no caption card → slide untouched, no positions injected', () => {
    const out = snapHeadlineToCaptionCard([{ style_overrides: { hook_font_size: 200 } }])
    const o = so(out[0])
    expect(o.hook_position).toBeUndefined()
    expect(o.hook_width).toBeUndefined()
    expect(o.hook_font_size).toBe(200)
  })

  it('explicit caption_bar_enabled:false → no snap', () => {
    const out = snapHeadlineToCaptionCard([{ style_overrides: { caption_bar_enabled: false } }])
    expect(so(out[0]).hook_position).toBeUndefined()
  })

  it('explicit caption_bar_y + height drive the vertical centre', () => {
    const out = snapHeadlineToCaptionCard([
      {
        style_overrides: {
          caption_bar_enabled: true,
          caption_bar_y: 50,
          caption_bar_height_pct: 40,
        },
      },
    ])
    // centre = caption_bar_y + height/2 = 50 + 20 = 70
    expect(pos(so(out[0]), 'hook_position')!.y).toBe(70)
  })

  it('top card → headline centred in the upper region', () => {
    const out = snapHeadlineToCaptionCard([
      {
        style_overrides: {
          caption_bar_enabled: true,
          caption_bar_position: 'top' as const,
          caption_bar_height_pct: 38,
        },
      },
    ])
    expect(pos(so(out[0]), 'hook_position')!.y).toBe(19)
  })

  it('idempotent + non-mutating', () => {
    const input = [
      { style_overrides: { caption_bar_enabled: true, caption_bar_height_pct: 38 } },
    ]
    const inputSnapshot = JSON.parse(JSON.stringify(input))
    const once = snapHeadlineToCaptionCard(input)
    const twice = snapHeadlineToCaptionCard(once)
    expect(twice).toEqual(once)
    expect(input).toEqual(inputSnapshot)
  })

  it('stampNewsDefault enables the card on news slides without an explicit flag', () => {
    const out = snapHeadlineToCaptionCard(
      [
        { style_overrides: { hook_font_size: 200 } },
        { style_overrides: { caption_bar_enabled: false } },
      ],
      { stampNewsDefault: true },
    )
    const a = so(out[0])
    const b = so(out[1])
    // Slide 0 — no explicit flag → stamped true → snapped.
    expect(a.caption_bar_enabled).toBe(true)
    expect(a.hook_position).toBeDefined()
    // Slide 1 — explicit false → left untouched, no snap.
    expect(b.caption_bar_enabled).toBe(false)
    expect(b.hook_position).toBeUndefined()
  })

  it('template captionCardDefaults.heightPct drives the centre when the per-slide override is absent', () => {
    // news-oracle / chrome-pulse ship heightPct: 42. The snap MUST consult
    // this so the hook lands at the actual card centre the renderer paints
    // (without it, the snap centred against a 38% card → hook 2% below the
    // 42% card centre, ~38px low on the 1920 reference frame). vy2-class fix.
    const out = snapHeadlineToCaptionCard(
      [{ style_overrides: { caption_bar_enabled: true } }],
      { template: { captionCardDefaults: { heightPct: 42 } } },
    )
    // cardTop = 100 - 42 = 58 ; centre = 58 + 42/2 = 79 (was 81 before fix)
    expect(pos(so(out[0]), 'hook_position')!.y).toBe(79)
  })

  it('per-slide caption_bar_height_pct still wins over template default', () => {
    const out = snapHeadlineToCaptionCard(
      [
        {
          style_overrides: {
            caption_bar_enabled: true,
            caption_bar_height_pct: 50,
          },
        },
      ],
      { template: { captionCardDefaults: { heightPct: 42 } } },
    )
    // Per-slide 50 wins → centre = 75
    expect(pos(so(out[0]), 'hook_position')!.y).toBe(75)
  })

  it('omitted template → behavior byte-identical to pre-fix (falls back to 38)', () => {
    const out = snapHeadlineToCaptionCard([
      { style_overrides: { caption_bar_enabled: true } },
    ])
    // No template, no per-slide override → 38 default → centre = 81
    expect(pos(so(out[0]), 'hook_position')!.y).toBe(81)
  })

  it('adapter integration — snapped hook_position survives legacyToTextBoxes', () => {
    const newsSlide = {
      hook_text: 'Breaking news headline',
      style_overrides: { caption_bar_enabled: true, caption_bar_height_pct: 38 },
    }
    const [snapped] = snapHeadlineToCaptionCard([newsSlide])
    const boxes = legacyToTextBoxes(snapped as unknown as Slide)
    const hookBox = boxes.find((b) => b.role === 'hook')
    expect(hookBox).toBeDefined()
    expect(hookBox!.position.anchor).toBe('custom')
    if (hookBox!.position.anchor === 'custom') {
      expect(hookBox!.position.x).toBe(7.4)
      expect(hookBox!.position.y).toBe(81)
    }
  })
})
