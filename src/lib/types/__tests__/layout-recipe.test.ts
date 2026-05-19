// Phase 84 Plan 01 Task 2 (RECIPE-01):
// Type-level + tuple-shape tests for the LayoutRecipe contract.
//
// Locks: the closed-enum tuples are stable, the version literal is 1, the
// type composes with all 3 roles AND with a partial / empty roles keyset,
// and the recipe round-trips through JSON.

import { describe, it, expect } from 'vitest'

import type { LayoutRecipe } from '../layout-recipe'
import {
  LAYOUT_RECIPE_VERSION,
  RECIPE_ROLES,
  HOOK_POSITION_BANDS,
  HOOK_FONT_SIZE_BANDS,
  RECIPE_TEXT_ALIGNS,
  CAPTION_POSITIONS,
  ACCENT_CADENCES,
  ACCESSORY_LABEL_BANDS,
} from '../layout-recipe'

describe('Phase 84 LayoutRecipe type model', () => {
  it('LAYOUT_RECIPE_VERSION is the literal 1', () => {
    expect(LAYOUT_RECIPE_VERSION).toBe(1)
  })

  it('RECIPE_ROLES is the fixed cover/body/cta keyset', () => {
    expect(RECIPE_ROLES).toEqual(['cover', 'body', 'cta'])
  })

  it('every closed-enum tuple is a non-empty array of unique strings', () => {
    const tuples: Record<string, readonly string[]> = {
      HOOK_POSITION_BANDS,
      HOOK_FONT_SIZE_BANDS,
      RECIPE_TEXT_ALIGNS,
      CAPTION_POSITIONS,
      ACCENT_CADENCES,
      ACCESSORY_LABEL_BANDS,
    }
    for (const [name, tuple] of Object.entries(tuples)) {
      expect(tuple.length, `${name} non-empty`).toBeGreaterThan(0)
      expect(tuple.every((v) => typeof v === 'string'), `${name} all strings`).toBe(true)
      expect(new Set(tuple).size, `${name} unique`).toBe(tuple.length)
    }
  })

  it('RECIPE_TEXT_ALIGNS matches SlideStyleOverrides.text_align', () => {
    expect(RECIPE_TEXT_ALIGNS).toEqual(['left', 'center', 'right'])
  })

  it('CAPTION_POSITIONS matches caption_bar_position', () => {
    expect(CAPTION_POSITIONS).toEqual(['bottom', 'top'])
  })

  it('a full LayoutRecipe with all 3 roles satisfies the type and round-trips through JSON', () => {
    const recipe: LayoutRecipe = {
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
        },
      },
    }
    const round = JSON.parse(JSON.stringify(recipe)) as LayoutRecipe
    expect(round).toEqual(recipe)
    expect(round.roles.cover?.layout_mode).toBe('caption-bar-bottom')
  })

  it('a LayoutRecipe with an empty roles keyset compiles and round-trips', () => {
    const recipe: LayoutRecipe = {
      schema_version: 1,
      accent_cadence: 'none',
      roles: {},
    }
    expect(JSON.parse(JSON.stringify(recipe))).toEqual(recipe)
    expect(recipe.roles.cover).toBeUndefined()
  })

  it('a LayoutRecipe with only the body role compiles and round-trips', () => {
    const recipe: LayoutRecipe = {
      schema_version: 1,
      accent_cadence: 'sparse',
      roles: {
        body: { layout_mode: 'full-bleed-text-overlay' },
      },
    }
    expect(JSON.parse(JSON.stringify(recipe))).toEqual(recipe)
    expect(recipe.roles.body?.layout_mode).toBe('full-bleed-text-overlay')
    expect(recipe.roles.cover).toBeUndefined()
    expect(recipe.roles.cta).toBeUndefined()
  })
})
