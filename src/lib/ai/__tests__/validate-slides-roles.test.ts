// Phase 58 (AIROLE-04, D-06, D-08): tests for role default + template_id_override
// silent strip in validateAndRepair. Asserts never-throws contract preserved.

import { describe, it, expect } from 'vitest'
import { validateAndRepair } from '../validate-slides'

interface TestSlide {
  hook_text: string
  body_text: string
  hook_segments?: Array<{
    text: string
    accent: boolean
    highlightColor?: string
    highlightStyle?: 'pill'
  }>
  body_segments?: Array<{
    text: string
    accent: boolean
    highlightColor?: string
    highlightStyle?: 'pill'
  }>
  role?: string
  template_id_override?: string
}

function makeSlide(idx: number): TestSlide {
  return {
    hook_text: `Hook ${idx}`,
    body_text: `Body for slide ${idx} with enough words to avoid orphan flag`,
  }
}

describe('Phase 58 (AIROLE-04, D-06): role defaulting in validateAndRepair', () => {
  it('missing role on every slide is silently filled via assignSlideRoles', () => {
    const data = {
      slides: [makeSlide(0), makeSlide(1), makeSlide(2), makeSlide(3), makeSlide(4)],
    }
    const result = validateAndRepair(data)
    expect(result.data.slides[0].role).toBe('cover')
    expect(result.data.slides[4].role).toBe('close')
    // n=5 distribution: [cover, reframe, support, pivot, close]
    expect(result.data.slides[1].role).toBe('reframe')
    expect(result.data.slides[2].role).toBe('support')
    expect(result.data.slides[3].role).toBe('pivot')
    // No warnings emitted for role defaulting (D-06).
    const roleWarnings = result.warnings.filter((w) => w.includes('role'))
    expect(roleWarnings).toEqual([])
  })

  it('invalid role string is silently replaced with deterministic default', () => {
    const data = {
      slides: [
        { ...makeSlide(0), role: 'BANANA' }, // invalid
        { ...makeSlide(1), role: 'pivot' }, // valid — kept as-is per D-06? No: D-06 says default if missing/invalid; valid role is kept
        { ...makeSlide(2) },
      ],
    }
    const result = validateAndRepair(data)
    // n=3 distribution: [cover, support, close]
    expect(result.data.slides[0].role).toBe('cover') // overwritten (was invalid)
    expect(result.data.slides[1].role).toBe('pivot') // kept (was valid)
    expect(result.data.slides[2].role).toBe('close') // filled (was missing)
  })

  it('all valid roles kept as-is (validator does not override valid AI emit)', () => {
    const data = {
      slides: [
        { ...makeSlide(0), role: 'cover' },
        { ...makeSlide(1), role: 'reframe' },
        { ...makeSlide(2), role: 'close' },
      ],
    }
    const result = validateAndRepair(data)
    expect(result.data.slides[0].role).toBe('cover')
    expect(result.data.slides[1].role).toBe('reframe')
    expect(result.data.slides[2].role).toBe('close')
  })
})

describe('Phase 58 (AIROLE-03, D-06): template_id_override silent strip', () => {
  it('invalid template_id_override is silently stripped', () => {
    const data = {
      slides: [
        { ...makeSlide(0), template_id_override: 'highlight-bar' }, // valid
        { ...makeSlide(1), template_id_override: 'fake-template-xyz' }, // invalid
        { ...makeSlide(2), template_id_override: 'magazine-bold' }, // valid
      ],
    }
    const result = validateAndRepair(data)
    expect(result.data.slides[0].template_id_override).toBe('highlight-bar')
    expect(result.data.slides[1].template_id_override).toBeUndefined()
    expect(result.data.slides[2].template_id_override).toBe('magazine-bold')
    // No warnings for stripping (D-08 silent strip).
    const overrideWarnings = result.warnings.filter((w) =>
      w.includes('template_id_override'),
    )
    expect(overrideWarnings).toEqual([])
  })

  it('undefined template_id_override stays undefined (no strip)', () => {
    const data = {
      slides: [makeSlide(0), makeSlide(1), makeSlide(2)],
    }
    const result = validateAndRepair(data)
    result.data.slides.forEach((s) => {
      expect(s.template_id_override).toBeUndefined()
    })
  })

  it('empty-string template_id_override is treated as invalid (not in registry) and stripped', () => {
    const data = {
      slides: [
        { ...makeSlide(0), template_id_override: '' },
        { ...makeSlide(1) },
        { ...makeSlide(2) },
      ],
    }
    const result = validateAndRepair(data)
    expect(result.data.slides[0].template_id_override).toBeUndefined()
  })
})

describe('Phase 58 (AIROLE-04): never-throws contract preserved', () => {
  it('throws nothing on edge inputs', () => {
    expect(() => validateAndRepair({ slides: [] })).not.toThrow()
    expect(() =>
      validateAndRepair({
        slides: [{ ...makeSlide(0), role: undefined, template_id_override: undefined }],
      }),
    ).not.toThrow()
  })
})
