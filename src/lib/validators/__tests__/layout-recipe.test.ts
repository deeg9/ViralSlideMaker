// Phase 84 Plan 02 Task 3 (RECIPE-01):
// parseLayoutRecipeSafe validator tests — closed-enum silent-drop,
// numeric range clamp, unknown-key stripping, skip-emit roles.

import { describe, it, expect } from 'vitest'

import { parseLayoutRecipeSafe } from '../layout-recipe'
import { createSilentDropCounter } from '../silent-drop-counter'

/** A reusable valid full recipe (3 roles). */
function makeFullRecipe() {
  return {
    schema_version: 1,
    accent_cadence: 'frequent',
    roles: {
      cover: {
        layout_mode: 'caption-bar-bottom',
        caption_card: {
          enabled: true,
          x: 0,
          y: 60,
          width: 100,
          height_pct: 40,
          blend_pct: 12,
          opacity: 0.9,
          position: 'bottom',
        },
        hook: { position_band: 'lower', font_size_band: 'xl', text_align: 'center' },
        accessory_label: { enabled: true, position_band: 'top' },
      },
      body: {
        layout_mode: 'full-bleed-text-overlay',
        hook: { position_band: 'center', font_size_band: 'lg', text_align: 'center' },
      },
      cta: {
        layout_mode: 'caption-bar-bottom',
        caption_card: {
          enabled: true,
          x: 0,
          y: 62,
          width: 100,
          height_pct: 38,
          blend_pct: 0,
          opacity: 0.85,
          position: 'bottom',
        },
        hook: { position_band: 'lower', font_size_band: 'lg', text_align: 'center' },
        accessory_label: { enabled: true, position_band: 'top' },
      },
    },
  }
}

describe('Phase 84 parseLayoutRecipeSafe', () => {
  it('accepts a valid full recipe and round-trips it', () => {
    const input = makeFullRecipe()
    const result = parseLayoutRecipeSafe(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.recipe).toEqual(input)
    }
  })

  it('accepts a recipe with an empty roles keyset', () => {
    const result = parseLayoutRecipeSafe({
      schema_version: 1,
      accent_cadence: 'none',
      roles: {},
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.recipe.roles).toEqual({})
  })

  it('accepts a recipe with only the body role (skip-emit other roles)', () => {
    const result = parseLayoutRecipeSafe({
      schema_version: 1,
      accent_cadence: 'sparse',
      roles: { body: { layout_mode: 'full-bleed-text-overlay' } },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.recipe.roles.body?.layout_mode).toBe('full-bleed-text-overlay')
      expect(result.recipe.roles.cover).toBeUndefined()
      expect(result.recipe.roles.cta).toBeUndefined()
    }
  })

  it('silent-drops an invalid layout_mode to DEFAULT_FALLBACK_ARCHETYPE', () => {
    const counter = createSilentDropCounter({ onDrop: () => {} })
    const result = parseLayoutRecipeSafe(
      {
        schema_version: 1,
        accent_cadence: 'none',
        roles: { cover: { layout_mode: 'bogus-archetype' } },
      },
      { counter },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.recipe.roles.cover?.layout_mode).toBe('full-bleed-text-overlay')
    }
    expect(counter.getCount()).toBeGreaterThan(0)
    expect(counter.getEvents().some((e) => e.field === 'roles.cover.layout_mode')).toBe(true)
  })

  it('clamps caption_card.opacity above range to 1 with a range_clamp event', () => {
    const counter = createSilentDropCounter({ onDrop: () => {} })
    const input = makeFullRecipe()
    input.roles.cover.caption_card.opacity = 5
    const result = parseLayoutRecipeSafe(input, { counter })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.recipe.roles.cover?.caption_card?.opacity).toBe(1)
    }
    expect(counter.getEvents().some((e) => e.reason === 'range_clamp')).toBe(true)
  })

  it('clamps caption_card.x below 0 to 0 and blend_pct above 50 to 50', () => {
    const input = makeFullRecipe()
    input.roles.cover.caption_card.x = -20
    input.roles.cover.caption_card.blend_pct = 200
    const result = parseLayoutRecipeSafe(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.recipe.roles.cover?.caption_card?.x).toBe(0)
      expect(result.recipe.roles.cover?.caption_card?.blend_pct).toBe(50)
    }
  })

  it('strips an unknown top-level key with an unknown_field event', () => {
    const counter = createSilentDropCounter({ onDrop: () => {} })
    const result = parseLayoutRecipeSafe(
      { schema_version: 1, accent_cadence: 'none', roles: {}, evil: '<script>' },
      { counter },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.recipe as unknown as Record<string, unknown>).evil).toBeUndefined()
    }
    expect(counter.getEvents().some((e) => e.reason === 'unknown_field' && e.field === 'evil')).toBe(true)
  })

  it('strips an unknown nested key inside a role', () => {
    const counter = createSilentDropCounter({ onDrop: () => {} })
    const result = parseLayoutRecipeSafe(
      {
        schema_version: 1,
        accent_cadence: 'none',
        roles: { cover: { layout_mode: 'full-bleed-text-overlay', injected: true } },
      },
      { counter },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.recipe.roles.cover as unknown as Record<string, unknown>).injected).toBeUndefined()
    }
    expect(counter.getEvents().some((e) => e.field === 'roles.cover.injected')).toBe(true)
  })

  it('defaults an invalid accent_cadence to none', () => {
    const counter = createSilentDropCounter({ onDrop: () => {} })
    const result = parseLayoutRecipeSafe(
      { schema_version: 1, accent_cadence: 'bogus', roles: {} },
      { counter },
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.recipe.accent_cadence).toBe('none')
    expect(counter.getEvents().some((e) => e.field === 'accent_cadence')).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(parseLayoutRecipeSafe(null).ok).toBe(false)
    expect(parseLayoutRecipeSafe(42).ok).toBe(false)
    expect(parseLayoutRecipeSafe('x').ok).toBe(false)
    expect(parseLayoutRecipeSafe(undefined).ok).toBe(false)
  })

  it('coerces a non-boolean caption_card.enabled to false', () => {
    const counter = createSilentDropCounter({ onDrop: () => {} })
    const input = makeFullRecipe() as unknown as Record<string, unknown>
    ;(input.roles as Record<string, { caption_card: Record<string, unknown> }>).cover.caption_card.enabled = 'yes'
    const result = parseLayoutRecipeSafe(input, { counter })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.recipe.roles.cover?.caption_card?.enabled).toBe(false)
    }
    expect(counter.getEvents().some((e) => e.field === 'roles.cover.caption_card.enabled')).toBe(true)
  })

  it('skip-emits a hook block with an invalid position_band', () => {
    const counter = createSilentDropCounter({ onDrop: () => {} })
    const result = parseLayoutRecipeSafe(
      {
        schema_version: 1,
        accent_cadence: 'none',
        roles: {
          cover: {
            layout_mode: 'full-bleed-text-overlay',
            hook: { position_band: 'sideways', font_size_band: 'lg', text_align: 'center' },
          },
        },
      },
      { counter },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.recipe.roles.cover?.hook).toBeUndefined()
    }
    expect(counter.getEvents().some((e) => e.field === 'roles.cover.hook.position_band')).toBe(true)
  })
})
