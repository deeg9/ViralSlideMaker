// Phase 77 Plan 01 (EMIT-07):
// Unit tests for projectStyleSpecToSlideOverrides + narrowDecorationAllowlist.
//
// 17 tests covering field mappings, neutral-aspect skip-emit semantics,
// allowlist narrowing (incl. silent-drop of unknowns), purity, source-grep
// firewall (zero React/Gemini/Supabase imports).

import { describe, it, expect, expectTypeOf } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  projectStyleSpecToSlideOverrides,
  narrowDecorationAllowlist,
} from '@/lib/ai/style-spec-projector'
import type {
  ProjectedSlideOverrides,
  NarrowedDecorationAllowlist,
  ProjectedSpec,
} from '@/lib/ai/style-spec-projector.types'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { SlideStyleOverrides } from '@/lib/types/slide'
import { AI_LUCIDE_ALLOWLIST, AI_SHAPE_KINDS } from '@/lib/ai/schemas'
import { getTemplate } from '@/lib/render/templates'

function buildSpec(): StyleSpec {
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: {
      mode: 'solid',
      primary: '#000000',
      secondary: '#FFFFFF',
      accent: '#A8E6CF',
    },
    typography: {
      hookFontCategory: 'display',
      bodyFontCategory: 'sans-serif',
    },
    layout: {
      hookPosition: 'bottom',
      density: 'tight',
    },
    imagery: {
      treatmentPreset: 'bw',
    },
    decorations: {
      preferredLucide: ['Star', 'Sparkles'],
      preferredShapes: ['circle', 'rect'],
      density: 'sparse',
    },
    rhythm: {
      cadence: 'punchy',
    },
    voice_note: 'editorial magazine bold',
  }
}

function neutralSpec(): StyleSpec {
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#FFFFFF' },
    typography: {},
    layout: {},
    imagery: {},
    decorations: { preferredLucide: [], preferredShapes: [] },
    rhythm: {},
  }
}

const template = getTemplate('highlight-bar')

describe('projectStyleSpecToSlideOverrides', () => {
  // Test 1 — TYPE CONFORMANCE (compile-time check via expectTypeOf)
  it('return type style_overrides is a strict subset of SlideStyleOverrides', () => {
    const result = projectStyleSpecToSlideOverrides(buildSpec(), template)
    // expectTypeOf is a compile-time check; runtime smoke check: every key
    // emitted by the projector exists on SlideStyleOverrides.
    expectTypeOf(result.style_overrides).toMatchTypeOf<Partial<SlideStyleOverrides>>()
    // Sanity: ProjectedSpec composite type exists and matches output.
    expectTypeOf(result).toMatchTypeOf<ProjectedSpec>()
  })

  // Test 2 — DEVIATION: SlideStyleOverrides has no background_color field.
  // Per v2.9 D-08, palette colors flow through derived_palette: string[]
  // (consumed by templates with paletteMode='palette-dominant'). The
  // primary lands at index 0 (dominant); accent (when present) at index 1.
  it('maps spec.palette.primary → style_overrides.derived_palette[0]', () => {
    const result = projectStyleSpecToSlideOverrides(buildSpec(), template)
    expect(result.style_overrides.derived_palette).toBeDefined()
    expect(result.style_overrides.derived_palette?.[0]).toBe('#000000')
  })

  // Test 3 — DEVIATION: spec.palette.accent lands at derived_palette[1].
  it('maps spec.palette.accent → style_overrides.derived_palette[1]', () => {
    const result = projectStyleSpecToSlideOverrides(buildSpec(), template)
    expect(result.style_overrides.derived_palette?.[1]).toBe('#A8E6CF')
  })

  // Test 3b — derived_palette omits accent when spec.palette.accent undefined
  it('emits derived_palette with only primary when spec.palette.accent undefined', () => {
    const spec = buildSpec()
    spec.palette = { mode: 'solid', primary: '#000000' }
    const result = projectStyleSpecToSlideOverrides(spec, template)
    expect(result.style_overrides.derived_palette).toEqual(['#000000'])
  })

  // Test 4
  it('resolves hookFontCategory=display → style_overrides.hook_font_family registered family', () => {
    const result = projectStyleSpecToSlideOverrides(buildSpec(), template)
    // First display family in catalog is "Bebas Neue" (deterministic)
    expect(result.style_overrides.hook_font_family).toBe('Bebas Neue')
  })

  // Test 5
  it('resolves bodyFontCategory=sans-serif → style_overrides.body_font_family registered family', () => {
    const result = projectStyleSpecToSlideOverrides(buildSpec(), template)
    expect(result.style_overrides.body_font_family).toBe('Inter')
  })

  // Test 6 — NEUTRAL TYPOGRAPHY: skip emit so template defaults win
  it('emits neither hook_font_family nor body_font_family when typography categories undefined', () => {
    const result = projectStyleSpecToSlideOverrides(neutralSpec(), template)
    expect(result.style_overrides.hook_font_family).toBeUndefined()
    expect(result.style_overrides.body_font_family).toBeUndefined()
  })

  // Test 7 — closed-enum exact match
  it('maps spec.layout.hookPosition=bottom → style_overrides.text_position=bottom', () => {
    const result = projectStyleSpecToSlideOverrides(buildSpec(), template)
    expect(result.style_overrides.text_position).toBe('bottom')
  })

  // Test 8
  it('maps spec.imagery.treatmentPreset=bw → style_overrides.treatment_applied=bw', () => {
    const result = projectStyleSpecToSlideOverrides(buildSpec(), template)
    expect(result.style_overrides.treatment_applied).toBe('bw')
  })

  // Test 9
  it('emits no treatment_applied when spec.imagery.treatmentPreset undefined (template default wins)', () => {
    const result = projectStyleSpecToSlideOverrides(neutralSpec(), template)
    expect(result.style_overrides.treatment_applied).toBeUndefined()
  })

  // Test 10 — narrowed allowlist subset
  it('narrowDecorationAllowlist preserves spec preferredLucide subset of AI_LUCIDE_ALLOWLIST', () => {
    const spec = buildSpec()
    spec.decorations.preferredLucide = ['Star', 'Zap', 'Heart']
    const narrowed = narrowDecorationAllowlist(spec)
    expect(narrowed.lucide).toEqual(['Star', 'Zap', 'Heart'])
  })

  // Test 11 — Phase 80 R7: empty preferences return EMPTY list (not full
  // corpus). Reverses the prior fall-back-to-full-corpus behavior which
  // caused spurious icons to appear when the reference had none (Meta-workers
  // regression). See style-spec-projector.ts narrowDecorationAllowlist
  // header for the rationale.
  it('narrowDecorationAllowlist returns empty list when preferredLucide empty (Phase 80 R7)', () => {
    const spec = buildSpec()
    spec.decorations.preferredLucide = []
    const narrowed = narrowDecorationAllowlist(spec)
    expect(narrowed.lucide).toEqual([])
    // Defense-in-depth: confirm the full corpus is NOT returned (regression guard).
    expect(narrowed.lucide.length).toBeLessThan(AI_LUCIDE_ALLOWLIST.length)
  })

  // Test 12 — silent-drop unknown lucide names
  it('narrowDecorationAllowlist silently drops names not in AI_LUCIDE_ALLOWLIST', () => {
    const spec = buildSpec()
    // Cast to any[] because preferredLucide is typed against
    // LucideDecorationName; this test verifies the runtime defense.
    spec.decorations.preferredLucide = ['Star', 'InvalidName' as never]
    const narrowed = narrowDecorationAllowlist(spec)
    expect(narrowed.lucide).toEqual(['Star'])
  })

  // Test 13 — same semantics for shapes (Phase 80 R7: empty → empty list).
  it('narrowDecorationAllowlist for preferredShapes: empty→empty, non-empty narrows, invalid drops', () => {
    const specEmpty = buildSpec()
    specEmpty.decorations.preferredShapes = []
    // Phase 80 R7: empty → empty list (was [...AI_SHAPE_KINDS] before R7 fix).
    expect(narrowDecorationAllowlist(specEmpty).shapes).toEqual([])
    expect(narrowDecorationAllowlist(specEmpty).shapes.length).toBeLessThan(AI_SHAPE_KINDS.length)

    const specNarrow = buildSpec()
    specNarrow.decorations.preferredShapes = ['circle', 'star']
    expect(narrowDecorationAllowlist(specNarrow).shapes).toEqual(['circle', 'star'])

    const specInvalid = buildSpec()
    // Cast to bypass type system; runtime defense.
    specInvalid.decorations.preferredShapes = ['circle', 'bogus' as never]
    expect(narrowDecorationAllowlist(specInvalid).shapes).toEqual(['circle'])
  })

  // Test 14 — projector NEVER references spec.voice_note (source grep)
  it('projector source has zero references to spec.voice_note', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/ai/style-spec-projector.ts'),
      'utf8',
    )
    expect(src).not.toMatch(/voice_note/)
  })

  // Test 15 — projector NEVER references spec.rhythm (source grep)
  it('projector source has zero references to spec.rhythm', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/ai/style-spec-projector.ts'),
      'utf8',
    )
    // `.rhythm` would access spec.rhythm; `rhythm:` would emit a key.
    // Either is forbidden. Comments stripped first.
    const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(stripped).not.toMatch(/rhythm/)
  })

  // Test 16 — PURITY
  it('projector returns byte-identical JSON across 10 calls; never mutates spec or template', () => {
    const spec = buildSpec()
    const specSnapshot = JSON.parse(JSON.stringify(spec))
    const tmpl = getTemplate('highlight-bar')
    const tmplSnapshot = JSON.parse(JSON.stringify(tmpl))
    const first = JSON.stringify(projectStyleSpecToSlideOverrides(spec, tmpl))
    for (let i = 0; i < 9; i += 1) {
      expect(JSON.stringify(projectStyleSpecToSlideOverrides(spec, tmpl))).toBe(first)
    }
    expect(spec).toEqual(specSnapshot)
    expect(tmpl).toEqual(tmplSnapshot)
  })

  // Test 17 — SOURCE-GREP FIREWALL
  it('projector source has zero React / Gemini SDK / Supabase imports', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/ai/style-spec-projector.ts'),
      'utf8',
    )
    expect(src).not.toMatch(/from 'react'/)
    expect(src).not.toMatch(/@google\/genai/)
    expect(src).not.toMatch(/@supabase/)
  })

  // Type-only: ensure NarrowedDecorationAllowlist + ProjectedSlideOverrides
  // are structurally exported (compile-time conformance).
  it('exports satisfy NarrowedDecorationAllowlist + ProjectedSlideOverrides shapes', () => {
    const result = projectStyleSpecToSlideOverrides(buildSpec(), template)
    expectTypeOf(result.decorations).toMatchTypeOf<NarrowedDecorationAllowlist>()
    expectTypeOf(result.style_overrides).toMatchTypeOf<ProjectedSlideOverrides>()
  })
})
