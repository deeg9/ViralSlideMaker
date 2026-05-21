// Phase 55 (D-26): byte-identical regression guard for the 5 legacy templates.
//
// Phase 55 added 6 new optional fields to SlideTemplate (bodyFontFamily, coverLayout,
// grainMode, vignette, photoTreatment, paletteMode). Premium templates declare some of
// them explicitly (bodyFontFamily, hook-size raises, tr3nding-news font swap). The 5
// LEGACY templates (highlight-bar, news-drop, news-cyan, y2k-pop, bold-yellow) MUST
// remain byte-identical — they declare none of the new fields, so JSON.stringify of
// each template object should hash to the same value as before Phase 55.
//
// Fixture (legacy-template-hashes.json) was generated BEFORE any Phase 55 source change
// (Plan 55-01 Task 1). If this test fails, a non-additive change snuck into a legacy
// template — investigate before regenerating the fixture.
//
// 90-02 regeneration: Phase 90 wires a `preview` URL (an OPTIONAL field that already
// exists on SlideTemplate since v2.14 Phase 86) onto every code template — including
// these 5 legacy ones. That is a purely additive change of exactly the kind this guard
// permits, so the fixture hashes were regenerated. The five diffs were verified to be a
// single `preview:` line each, nothing else.

import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { templates } from '@/lib/render/templates'
import fixture from './__fixtures__/legacy-template-hashes.json'

const LEGACY_IDS = ['highlight-bar', 'news-drop', 'news-cyan', 'y2k-pop', 'bold-yellow'] as const

describe('legacy 5 templates remain byte-identical (Phase 55 regression guard)', () => {
  for (const id of LEGACY_IDS) {
    it(`${id}: JSON.stringify hash matches committed fixture`, () => {
      const template = templates.find((t) => t.id === id)
      expect(template, `legacy template '${id}' missing from registry`).toBeDefined()

      const json = JSON.stringify(template)
      const hash = createHash('sha256').update(json).digest('hex')
      const expected = (fixture as Record<string, string>)[id]

      expect(expected, `fixture missing entry for '${id}' — regenerate per Plan 55-01 Task 1`).toBeDefined()
      expect(hash).toBe(expected)
    })
  }

  it('fixture covers exactly the 5 legacy templates (no orphan keys)', () => {
    const fixtureKeys = Object.keys(fixture as Record<string, string>).sort()
    expect(fixtureKeys).toEqual([...LEGACY_IDS].sort())
  })
})
