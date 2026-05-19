// quick-260519-hym — coverage for the caption-card text-snap helper +
// the generate-slides snap-pass wiring.
//
// Task 1 (Tests 1-6): the pure `computeCaptionCardTextPositions` geometry helper.
// Task 2 (Tests 7-12 + adapter integration): `snapHeadlineToCaptionCard` slide pass.

import { describe, it, expect } from 'vitest'
import {
  computeCaptionCardTextPositions,
  snapHeadlineToCaptionCard,
} from '../caption-card-text-snap'
import {
  computeCaptionBarBottomPositions,
  CAPTION_BAR_BOTTOM_X,
  CAPTION_BAR_BOTTOM_WIDTH,
} from '../style-spec-projector-constants'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

describe('computeCaptionCardTextPositions', () => {
  it('Test 1 — bottom card, default 38% height: hook 25% / body 60% into the card', () => {
    const r = computeCaptionCardTextPositions({
      heightPct: 38,
      cardTopY: 62,
      position: 'bottom',
    })
    // 62 + 38*0.25 = 71.5 ; 62 + 38*0.60 = 84.8
    expect(r.hook.y).toBe(71.5)
    expect(r.body.y).toBe(84.8)
    expect(r.hook.x).toBe(CAPTION_BAR_BOTTOM_X)
    expect(r.body.x).toBe(CAPTION_BAR_BOTTOM_X)
    expect(r.hook.x).toBe(11)
    expect(r.hook.width).toBe(CAPTION_BAR_BOTTOM_WIDTH)
    expect(r.body.width).toBe(CAPTION_BAR_BOTTOM_WIDTH)
    expect(r.hook.width).toBe(78)
  })

  it('Test 2 — parity with the existing projector positioner (bottom card)', () => {
    for (const heightPct of [38, 40]) {
      const cardTopY = 100 - heightPct
      const helper = computeCaptionCardTextPositions({
        heightPct,
        cardTopY,
        position: 'bottom',
      })
      const projector = computeCaptionBarBottomPositions(heightPct / 100)
      expect(helper).toEqual(projector)
    }
  })

  it('Test 3 — top card mirrors the hook-top / body-below relationship', () => {
    const r = computeCaptionCardTextPositions({
      heightPct: 38,
      cardTopY: 0,
      position: 'top',
    })
    // 0 + 38*0.25 = 9.5 ; 0 + 38*0.60 = 22.8
    expect(r.hook.y).toBe(9.5)
    expect(r.body.y).toBe(22.8)
    expect(r.hook.y).toBeLessThan(r.body.y)
  })

  it('Test 4 — explicit caption_bar_y drives the in-card offsets', () => {
    const r = computeCaptionCardTextPositions({
      heightPct: 40,
      cardTopY: 50,
      position: 'bottom',
    })
    // 50 + 40*0.25 = 60
    expect(r.hook.y).toBe(60)
    // 50 + 40*0.60 = 74
    expect(r.body.y).toBe(74)
  })

  it('Test 5 — output y values land inside the card span', () => {
    const cases: Array<{ heightPct: number; cardTopY: number; position: 'bottom' | 'top' }> = [
      { heightPct: 38, cardTopY: 62, position: 'bottom' },
      { heightPct: 38, cardTopY: 0, position: 'top' },
      { heightPct: 90, cardTopY: 10, position: 'bottom' },
      { heightPct: 10, cardTopY: 0, position: 'top' },
      { heightPct: 40, cardTopY: 50, position: 'bottom' },
    ]
    for (const geom of cases) {
      const r = computeCaptionCardTextPositions(geom)
      const lo = geom.cardTopY
      const hi = geom.cardTopY + geom.heightPct
      expect(r.hook.y).toBeGreaterThanOrEqual(lo)
      expect(r.hook.y).toBeLessThanOrEqual(hi)
      expect(r.body.y).toBeGreaterThanOrEqual(lo)
      expect(r.body.y).toBeLessThanOrEqual(hi)
    }
  })

  it('Test 6 — pure / deterministic, does not mutate its argument', () => {
    const geom = { heightPct: 38, cardTopY: 62, position: 'bottom' as const }
    const snapshot = { ...geom }
    const a = computeCaptionCardTextPositions(geom)
    const b = computeCaptionCardTextPositions(geom)
    expect(a).toEqual(b)
    expect(geom).toEqual(snapshot)
  })
})

describe('snapHeadlineToCaptionCard', () => {
  it('Test 7 — enabled bottom card: headline + body snapped into the card', () => {
    const slides = [
      { style_overrides: { caption_bar_enabled: true, caption_bar_height_pct: 38 } },
    ]
    const out = snapHeadlineToCaptionCard(slides)
    const so = out[0].style_overrides as Record<string, { x: number; y: number }>
    expect(so.hook_position.y).toBe(71.5)
    expect(so.body_position.y).toBe(84.8)
    expect(so.hook_position.x).toBe(11)
    expect(so.body_position.x).toBe(11)
  })

  it('Test 8 — no caption card: slide untouched, no positions injected', () => {
    const slides = [{ style_overrides: { hook_font_size: 200 } }]
    const out = snapHeadlineToCaptionCard(slides)
    const so = out[0].style_overrides as Record<string, unknown>
    expect(so.hook_position).toBeUndefined()
    expect(so.body_position).toBeUndefined()
    expect(so.hook_font_size).toBe(200)
  })

  it('Test 9 — explicit caption_bar_enabled:false: no hook_position injected', () => {
    const slides = [{ style_overrides: { caption_bar_enabled: false } }]
    const out = snapHeadlineToCaptionCard(slides)
    const so = out[0].style_overrides as Record<string, unknown>
    expect(so.hook_position).toBeUndefined()
    expect(so.body_position).toBeUndefined()
  })

  it('Test 10 — top card: hook above body, both inside the top card span', () => {
    const slides = [
      {
        style_overrides: {
          caption_bar_enabled: true,
          caption_bar_position: 'top' as const,
          caption_bar_height_pct: 38,
        },
      },
    ]
    const out = snapHeadlineToCaptionCard(slides)
    const so = out[0].style_overrides as Record<string, { x: number; y: number }>
    expect(so.hook_position.y).toBeLessThan(so.body_position.y)
    expect(so.hook_position.y).toBeGreaterThanOrEqual(0)
    expect(so.body_position.y).toBeLessThanOrEqual(38)
  })

  it('Test 11 — explicit caption_bar_y wins over the position default', () => {
    const slides = [
      {
        style_overrides: {
          caption_bar_enabled: true,
          caption_bar_y: 50,
          caption_bar_height_pct: 40,
        },
      },
    ]
    const out = snapHeadlineToCaptionCard(slides)
    const so = out[0].style_overrides as Record<string, { x: number; y: number }>
    // 50 + 40*0.25 = 60
    expect(so.hook_position.y).toBe(60)
  })

  it('Test 12 — idempotent + non-mutating', () => {
    const input = [
      { style_overrides: { caption_bar_enabled: true, caption_bar_height_pct: 38 } },
    ]
    const inputSnapshot = JSON.parse(JSON.stringify(input))
    const once = snapHeadlineToCaptionCard(input)
    const twice = snapHeadlineToCaptionCard(once)
    expect(twice).toEqual(once)
    // The original input array's slide objects are not mutated.
    expect(input).toEqual(inputSnapshot)
  })

  it('news-stamp — stampNewsDefault enables the card on news slides without an explicit flag', () => {
    const slides = [
      { style_overrides: { hook_font_size: 200 } },
      { style_overrides: { caption_bar_enabled: false } },
    ]
    const out = snapHeadlineToCaptionCard(slides, { stampNewsDefault: true })
    const a = out[0].style_overrides as Record<string, unknown>
    const b = out[1].style_overrides as Record<string, unknown>
    // Slide 0 — no explicit flag → stamped true → snapped.
    expect(a.caption_bar_enabled).toBe(true)
    expect(a.hook_position).toBeDefined()
    // Slide 1 — explicit false → left untouched, no snap.
    expect(b.caption_bar_enabled).toBe(false)
    expect(b.hook_position).toBeUndefined()
  })

  it('adapter integration — snapped hook_position survives legacyToTextBoxes into text_boxes', () => {
    const newsSlide = {
      hook_text: 'Breaking news headline',
      body_text: 'Supporting detail line',
      style_overrides: { caption_bar_enabled: true, caption_bar_height_pct: 38 },
    }
    const [snapped] = snapHeadlineToCaptionCard([newsSlide])
    const boxes = legacyToTextBoxes(snapped as unknown as Slide)
    const hookBox = boxes.find((b) => b.role === 'hook')
    expect(hookBox).toBeDefined()
    expect(hookBox!.position.anchor).toBe('custom')
    if (hookBox!.position.anchor === 'custom') {
      expect(hookBox!.position.x).toBe(11)
      expect(hookBox!.position.y).toBe(71.5)
    }
  })
})
