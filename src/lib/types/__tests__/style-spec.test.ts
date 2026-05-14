// Phase 74 Plan 01 Task 2 (STYLESPEC-01..09):
// Type-level + import-sanity tests for the StyleSpec contract.
//
// These tests are deliberately a mix of compile-time checks (@ts-expect-error
// fixtures) and runtime introspection (a sample object whose fields we
// inspect at runtime to verify shape). They lock the architectural
// invariant that EVERY string field MUST import its closed enum from an
// existing constants module — never redefine. The grep gate (Task 3)
// enforces this in CI; these tests are the planning-time canary.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { StyleSpec, StyleSpecVersion } from '../style-spec'
import type { FontEntry } from '@/lib/fonts/font-catalog'
import { LUCIDE_DECORATION_ALLOWLIST } from '@/lib/render/decorations/registry'
import type { ShapeKind } from '@/lib/types/decoration'
import type { BrandKitTextPosition } from '@/lib/types/brand-kit'
import type { TreatmentPreset } from '@/lib/photo-treatment/treat'

const STYLE_SPEC_PATH = resolve(__dirname, '../style-spec.ts')
const STYLE_SPEC_SOURCE = readFileSync(STYLE_SPEC_PATH, 'utf8')

/** Build a fully-populated StyleSpec literal for runtime introspection.
    Phase 80: StyleSpec is intersected with ArchetypeSlots, so the fixture
    MUST carry a valid `slideArchetype` discriminator. We pick
    'full-bleed-text-overlay' (the DEFAULT_FALLBACK_ARCHETYPE — its
    slot-param shape is EmptySlots, keeping the fixture minimal). */
function makeFixture(): StyleSpec {
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: {
      mode: 'duotone',
      primary: '#1F2937',
      secondary: '#A8E0B0',
      accent: '#FF6B6B',
    },
    typography: {
      hookFontCategory: 'sans-serif',
      bodyFontCategory: 'sans-serif',
    },
    layout: {
      hookPosition: 'top',
      density: 'medium',
    },
    imagery: {
      treatmentPreset: 'duotone-cream',
    },
    decorations: {
      preferredLucide: ['Heart', 'Star'],
      preferredShapes: ['rect', 'circle'],
      density: 'sparse',
    },
    rhythm: {
      cadence: 'punchy',
    },
    voice_note: 'Punchy, hopeful, short sentences.',
  }
}

describe('Phase 74 (STYLESPEC-01..09): StyleSpec type contract', () => {
  it('Test T1: StyleSpec exports include all 7 sections + schema_version: 2', () => {
    const spec = makeFixture()
    expect(spec.schema_version).toBe(2)
    expect(spec.palette).toBeDefined()
    expect(spec.typography).toBeDefined()
    expect(spec.layout).toBeDefined()
    expect(spec.imagery).toBeDefined()
    expect(spec.decorations).toBeDefined()
    expect(spec.rhythm).toBeDefined()
    expect(typeof spec.voice_note).toBe('string')
    // Compile-time: StyleSpecVersion is the literal 2 (Phase 80 bump).
    const v: StyleSpecVersion = 2
    expect(v).toBe(2)
  })

  it('Test T2: typography.hookFontCategory is assignable from FontEntry["category"] only', () => {
    const cats: FontEntry['category'][] = ['sans-serif', 'serif', 'display', 'handwriting']
    cats.forEach((cat) => {
      const spec = makeFixture()
      spec.typography.hookFontCategory = cat
      expect(spec.typography.hookFontCategory).toBe(cat)
    })
    // @ts-expect-error 'random' is NOT assignable to FontEntry['category']
    const _bad: StyleSpec['typography']['hookFontCategory'] = 'random'
    expect(_bad).toBe('random')
  })

  it('Test T3: decorations.preferredLucide items are assignable from LUCIDE_DECORATION_ALLOWLIST literals only', () => {
    const spec = makeFixture()
    spec.decorations.preferredLucide = ['Heart', 'Star', 'Check']
    expect(spec.decorations.preferredLucide.length).toBe(3)
    LUCIDE_DECORATION_ALLOWLIST.slice(0, 3).forEach((name) => {
      const single: StyleSpec['decorations']['preferredLucide'] = [name]
      expect(single[0]).toBe(name)
    })
    // @ts-expect-error 'NotARealLucideIcon' is NOT in LUCIDE_DECORATION_ALLOWLIST
    const _bad: NonNullable<StyleSpec['decorations']['preferredLucide']> = ['NotARealLucideIcon']
    expect(_bad[0]).toBe('NotARealLucideIcon')
  })

  it('Test T4: decorations.preferredShapes items are assignable from ShapeKind only', () => {
    const all: ShapeKind[] = [
      'rect', 'circle', 'ellipse', 'triangle',
      'polygon', 'star', 'arrow', 'line',
    ]
    const spec = makeFixture()
    spec.decorations.preferredShapes = all
    expect(spec.decorations.preferredShapes?.length).toBe(8)
    // @ts-expect-error 'blob' is NOT a ShapeKind
    const _bad: NonNullable<StyleSpec['decorations']['preferredShapes']> = ['blob']
    expect(_bad[0]).toBe('blob')
  })

  it('Test T5: layout.hookPosition is assignable from BrandKitTextPosition only', () => {
    const positions: BrandKitTextPosition[] = ['top', 'center', 'bottom']
    positions.forEach((p) => {
      const spec = makeFixture()
      spec.layout.hookPosition = p
      expect(spec.layout.hookPosition).toBe(p)
    })
    // @ts-expect-error 'top-left' is NOT a BrandKitTextPosition
    const _bad: StyleSpec['layout']['hookPosition'] = 'top-left'
    expect(_bad).toBe('top-left')
  })

  it('Test T6: imagery.treatmentPreset is assignable from TreatmentPreset["kind"] only', () => {
    const kinds: TreatmentPreset['kind'][] = [
      'bw', 'duotone-cream', 'duotone-cobalt', 'contrast-bump',
    ]
    kinds.forEach((k) => {
      const spec = makeFixture()
      spec.imagery.treatmentPreset = k
      expect(spec.imagery.treatmentPreset).toBe(k)
    })
    // @ts-expect-error 'sepia' is NOT a TreatmentPreset['kind']
    const _bad: StyleSpec['imagery']['treatmentPreset'] = 'sepia'
    expect(_bad).toBe('sepia')
  })

  it('Test T7: palette.mode is "solid" | "duotone" | "gradient" | "photo" (locked closed enum)', () => {
    const modes: StyleSpec['palette']['mode'][] = [
      'solid', 'duotone', 'gradient', 'photo',
    ]
    modes.forEach((m) => {
      const spec = makeFixture()
      spec.palette.mode = m
      expect(spec.palette.mode).toBe(m)
    })
    // @ts-expect-error 'rainbow' is not a palette.mode
    const _bad: StyleSpec['palette']['mode'] = 'rainbow'
    expect(_bad).toBe('rainbow')
  })

  it('Test T8: voice_note is string (the ONLY free-text field — STYLESPEC-09)', () => {
    const spec = makeFixture()
    spec.voice_note = 'Hello world.'
    expect(typeof spec.voice_note).toBe('string')
  })

  it('Test T9: source file does NOT contain hardcoded font family literals (must import from font-catalog)', () => {
    // The file MUST NOT redefine font family names; they live in font-catalog.
    const forbidden = /'(Anton|Plus Jakarta Sans|Helvetica|Inter|Roboto|Montserrat)'/
    expect(STYLE_SPEC_SOURCE).not.toMatch(forbidden)
  })

  it('Test T10: source file imports from all 5 closed-enum source modules (single source of truth)', () => {
    const expected = [
      /from\s+['"]@\/lib\/fonts\/font-catalog['"]/,
      /from\s+['"]@\/lib\/render\/decorations\/registry['"]/,
      /from\s+['"]@\/lib\/types\/decoration['"]/,
      /from\s+['"]@\/lib\/types\/brand-kit['"]/,
      /from\s+['"]@\/lib\/photo-treatment\/treat['"]/,
    ]
    expected.forEach((re) => {
      expect(STYLE_SPEC_SOURCE).toMatch(re)
    })
  })
})
