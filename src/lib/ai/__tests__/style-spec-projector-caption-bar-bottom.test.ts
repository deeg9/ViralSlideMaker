// quick-260515-i56: projector-side enforcement that for spec.slideArchetype ===
// 'caption-bar-bottom', the emitted style_overrides centers hook + body text
// inside the lower caption bar. The AI prompt's stated y-ranges and the
// projector's computed y values both pull from style-spec-projector-constants.ts —
// any drift between prompt and projector trips this suite via the constants
// import.
//
// Six tests:
//   1. caption-bar-bottom (heightFraction omitted) → hook/body positions emitted
//      with x=11, width=78, y = computeCaptionBarBottomPositions(undefined).
//   2. heightFraction=0.4 → hook/body y values inside the published constant ranges.
//   3. full-bleed-text-overlay + caption-bar-top → no hook_position / body_position
//      emit (TPLREND-05 byte-identity preserved for non-caption-bar branches).
//   4. spec with slideArchetype intentionally unset (legacy payload) — DEFAULT_FALLBACK_ARCHETYPE
//      is 'full-bleed-text-overlay', NOT caption-bar-bottom, so the new branch must
//      remain quiescent.
//   5. anchor='custom' preservation — legacyToTextBoxes on a synthesized slide
//      carrying projector output yields anchor='custom' for both hook and body, so
//      separateOverlappingTextBoxes (the just-shipped helper) sees them as
//      participating in the layout pass.
//   6. defensive: spec whose archetype is 'caption-bar-bottom' but `caption` slot
//      is undefined entirely — projector must NOT throw; falls back to the
//      constants module's CAPTION_BAR_BOTTOM_DEFAULT_HEIGHT_FRACTION (0.38).

import { describe, it, expect } from 'vitest'
import { projectStyleSpecToSlideOverrides } from '@/lib/ai/style-spec-projector'
import {
  CAPTION_BAR_BOTTOM_DEFAULT_HEIGHT_FRACTION,
  CAPTION_BAR_BOTTOM_HOOK_Y_RANGE,
  CAPTION_BAR_BOTTOM_BODY_Y_RANGE,
  CAPTION_BAR_BOTTOM_X,
  CAPTION_BAR_BOTTOM_WIDTH,
  computeCaptionBarBottomPositions,
} from '@/lib/ai/style-spec-projector-constants'
import { getTemplate } from '@/lib/render/templates'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { SlideArchetype } from '@/lib/types/style-spec-archetypes'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { Slide } from '@/lib/types/slide'

// magazine-bold is the archetype's resolved template_id (ARCHETYPE_TO_TEMPLATE),
// which makes it the right template arg for these tests. The projector ignores
// the template arg today but using the canonical one keeps intent clear.
const tmpl = getTemplate('magazine-bold')

function makeSpec(
  slideArchetype: SlideArchetype,
  overrides: Partial<StyleSpec> = {},
): StyleSpec {
  return {
    schema_version: 2,
    slideArchetype,
    palette: { mode: 'solid', primary: '#000000', accent: '#FFFFFF' },
    typography: { hookFontCategory: 'display', bodyFontCategory: 'sans-serif' },
    layout: { hookPosition: 'bottom', density: 'tight' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { preferredLucide: [], preferredShapes: [], density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'editorial',
    ...overrides,
  } as StyleSpec
}

describe('quick-260515-i56: projector caption-bar-bottom y-override', () => {
  it('Test 1: caption-bar-bottom (heightFraction omitted) → hook + body positions emitted with default fraction', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('caption-bar-bottom'), tmpl)
    const expected = computeCaptionBarBottomPositions(undefined)
    expect(r.style_overrides.hook_position).toEqual({ x: expected.hook.x, y: expected.hook.y })
    expect(r.style_overrides.body_position).toEqual({ x: expected.body.x, y: expected.body.y })
    expect(r.style_overrides.hook_width).toBe(expected.hook.width)
    expect(r.style_overrides.body_width).toBe(expected.body.width)
    // Sanity: matches the constants module's published x/width (no magic numbers).
    expect(expected.hook.x).toBe(CAPTION_BAR_BOTTOM_X)
    expect(expected.body.x).toBe(CAPTION_BAR_BOTTOM_X)
    expect(expected.hook.width).toBe(CAPTION_BAR_BOTTOM_WIDTH)
    expect(expected.body.width).toBe(CAPTION_BAR_BOTTOM_WIDTH)
    // Default-fraction sanity: 0.38 → barTopY=62 → hookY = 62 + 38*0.25 = 71.5, bodyY = 62 + 38*0.6 = 84.8.
    expect(CAPTION_BAR_BOTTOM_DEFAULT_HEIGHT_FRACTION).toBe(0.38)
    expect(expected.hook.y).toBe(71.5)
    expect(expected.body.y).toBe(84.8)
  })

  it('Test 2: heightFraction=0.4 produces hook + body y values inside the published ranges', () => {
    const spec = makeSpec('caption-bar-bottom', {
      // CaptionBarSlots-style narrowing on the discriminated union.
      caption: { heightFraction: 0.4 },
    } as unknown as Partial<StyleSpec>)
    const r = projectStyleSpecToSlideOverrides(spec, tmpl)
    const expected = computeCaptionBarBottomPositions(0.4)
    expect(r.style_overrides.hook_position).toEqual({ x: expected.hook.x, y: expected.hook.y })
    expect(r.style_overrides.body_position).toEqual({ x: expected.body.x, y: expected.body.y })
    // Band-membership invariant: the projector's computed y values MUST sit inside the
    // ranges the AI prompt advertises — single source of truth.
    expect(r.style_overrides.hook_position!.y).toBeGreaterThanOrEqual(CAPTION_BAR_BOTTOM_HOOK_Y_RANGE[0])
    expect(r.style_overrides.hook_position!.y).toBeLessThanOrEqual(CAPTION_BAR_BOTTOM_HOOK_Y_RANGE[1])
    expect(r.style_overrides.body_position!.y).toBeGreaterThanOrEqual(CAPTION_BAR_BOTTOM_BODY_Y_RANGE[0])
    expect(r.style_overrides.body_position!.y).toBeLessThanOrEqual(CAPTION_BAR_BOTTOM_BODY_Y_RANGE[1])
    // Numerical pin: for hf=0.4 → barTopY=60, hookY=70.0, bodyY=84.0.
    expect(expected.hook.y).toBe(70.0)
    expect(expected.body.y).toBe(84.0)
  })

  it('Test 3a: full-bleed-text-overlay → no hook_position / body_position emit', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('full-bleed-text-overlay'), tmpl)
    expect(r.style_overrides.hook_position).toBeUndefined()
    expect(r.style_overrides.body_position).toBeUndefined()
    expect(r.style_overrides.hook_width).toBeUndefined()
    expect(r.style_overrides.body_width).toBeUndefined()
    // Sanity: existing projected fields still flow through.
    expect(r.style_overrides.template_id_override).toBe('news-drop')
  })

  it('Test 3b: caption-bar-top → no hook_position / body_position emit (different archetype)', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('caption-bar-top'), tmpl)
    expect(r.style_overrides.hook_position).toBeUndefined()
    expect(r.style_overrides.body_position).toBeUndefined()
    expect(r.style_overrides.hook_width).toBeUndefined()
    expect(r.style_overrides.body_width).toBeUndefined()
    // Sanity: caption-bar-top still gets its layout='cover' + template override.
    expect(r.style_overrides.template_id_override).toBe('magazine-bold')
    expect(r.style_overrides.layout).toBe('cover')
  })

  it('Test 4: legacy spec with slideArchetype unset → no caption-bar-bottom emit (TPLREND-05 byte-identity)', () => {
    const spec = makeSpec('full-bleed-text-overlay')
    delete (spec as { slideArchetype?: unknown }).slideArchetype
    const r = projectStyleSpecToSlideOverrides(spec as unknown as StyleSpec, tmpl)
    // DEFAULT_FALLBACK_ARCHETYPE is 'full-bleed-text-overlay', NOT caption-bar-bottom.
    // The new branch must remain quiescent.
    expect(r.style_overrides.hook_position).toBeUndefined()
    expect(r.style_overrides.body_position).toBeUndefined()
    expect(r.style_overrides.hook_width).toBeUndefined()
    expect(r.style_overrides.body_width).toBeUndefined()
  })

  it("Test 5: anchor='custom' preserved through legacyToTextBoxes (separateOverlappingTextBoxes compat)", () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('caption-bar-bottom'), tmpl)
    // Synthesize a minimal Slide carrying the projector output. Cast through unknown
    // because the test fixture only populates what the adapter reads — the rest of
    // the Slide shape is irrelevant.
    const slide: Slide = {
      id: 's1',
      slide_number: 1,
      hook_text: 'x',
      body_text: 'y',
      image_query: '',
      style_overrides: r.style_overrides,
    } as unknown as Slide
    const boxes = legacyToTextBoxes(slide)
    expect(boxes[0].position.anchor).toBe('custom')
    expect(boxes[1].position.anchor).toBe('custom')
    // x/y/width preservation through the adapter.
    expect(boxes[0].position.x).toBe(r.style_overrides.hook_position!.x)
    expect(boxes[0].position.y).toBe(r.style_overrides.hook_position!.y)
    expect(boxes[0].position.width).toBe(r.style_overrides.hook_width)
    expect(boxes[1].position.x).toBe(r.style_overrides.body_position!.x)
    expect(boxes[1].position.y).toBe(r.style_overrides.body_position!.y)
    expect(boxes[1].position.width).toBe(r.style_overrides.body_width)
  })

  it('Test 6: caption-bar-bottom spec missing `caption` slot entirely → does not throw; uses default fraction', () => {
    // Phase B validator should fill caption, but the projector must not depend on that.
    const spec = makeSpec('caption-bar-bottom') as StyleSpec & { caption?: unknown }
    // Remove the caption slot if any helper ever sets it.
    delete (spec as { caption?: unknown }).caption
    expect(() => projectStyleSpecToSlideOverrides(spec, tmpl)).not.toThrow()
    const r = projectStyleSpecToSlideOverrides(spec, tmpl)
    const defaultExpected = computeCaptionBarBottomPositions(undefined)
    expect(r.style_overrides.hook_position).toEqual({ x: defaultExpected.hook.x, y: defaultExpected.hook.y })
    expect(r.style_overrides.body_position).toEqual({ x: defaultExpected.body.x, y: defaultExpected.body.y })
  })
})
