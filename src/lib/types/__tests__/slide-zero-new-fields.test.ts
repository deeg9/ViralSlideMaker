// Phase 74 Plan 04 (STYLESPEC-12): Slide-type zero-new-fields invariant.
//
// =====================================================================
// STYLESPEC-12 INVARIANT (load-bearing — defends TPLREND-05):
// =====================================================================
// Zero new fields on `Slide` during v2.13. The StyleSpec contract is
// consumed entirely server-side at emit time; no Slide-level field carries
// spec data. This is the structural reason TPLREND-05 byte-identity is
// preserved BY CONSTRUCTION (proven empirically by the companion PTF74
// fingerprint suite — parity.style-spec-absent-baseline.test.tsx).
//
// =====================================================================
// REGRESSION GATE:
// =====================================================================
// Any future Phase (75/76/77/78/79) that touches src/lib/types/slide.ts
// will trip this test, forcing an explicit review of whether the new field
// truly belongs on the Slide type or on the projects row (where StyleSpec
// + reference_assets live).
//
// Defense-in-depth: this test runs IN ADDITION TO Plan 74-01's PARITY-05
// CI grep gate (scripts/grep-gates/closed-enum-styleSpec.sh). The grep
// gate runs at lint-time; this test runs at unit-test-time. Both must
// flag any drift.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { Slide } from '@/lib/types/slide'

/**
 * Frozen field set captured at v2.12 trailing edge / Phase 73.
 *
 * Source of truth: src/lib/types/slide.ts at the `export interface Slide { ... }`
 * block as of Phase 74 plan execution. Verified by direct read at implementation
 * time (NOT the planning-time approximation in the PLAN.md).
 *
 * Phase-by-phase provenance:
 *   - hook_text, body_text: v1 (deprecated v2.8, retained for back-compat)
 *   - hook_segments, body_segments: v2.4 two-color news headlines (deprecated v2.8)
 *   - image_query, is_cta, background_url, pexels_photo_id: v1
 *   - style_overrides: v1 (per-slide overrides)
 *   - custom_texts: v1 (deprecated v2.8 → text_boxes role='custom')
 *   - custom_images: Phase 13 image overlays
 *   - text_boxes: Phase 49 unified text-box model
 *   - watermark: Phase 60 (WMARK-01) unified watermark element
 *   - original_source_url: Phase 55 (D-08) untreated-source URL for re-treat
 *   - template_id_override: Phase 55 (D-08) per-slide template override
 *   - decorations: Phase 67 (DECOR-01) icon/shape decoration array
 *
 * ANY ADDITION HERE MUST BE DELIBERATE + REVIEWED. Do NOT update casually
 * to make the test pass — the test failing IS the signal that an
 * unintended Slide field has landed.
 */
const V212_TRAILING_EDGE_SLIDE_FIELDS: readonly string[] = [
  'hook_text',
  'body_text',
  'hook_segments',
  'body_segments',
  'image_query',
  'is_cta',
  'background_url',
  'pexels_photo_id',
  'style_overrides',
  'custom_texts',
  'custom_images',
  'text_boxes',
  'watermark',
  'original_source_url',
  'template_id_override',
  'decorations',
]

/**
 * v2.13 spec fields that MUST live on `projects` (not on `Slide`):
 *   - style_spec / styleSpec: the StyleSpec contract from Plan 74-01
 *   - reference_assets / referenceAssets: the upload provenance from Plan 74-02
 *   - styleHints / styleHintsApplied: hypothetical future spec-derived hints
 *
 * If any of these strings appear in slide.ts (even commented-out as a
 * "future addition" reminder), this test fails. Comments are stripped before
 * matching to allow header-level documentation (this file's header IS allowed
 * to name the forbidden fields — they appear here, not in slide.ts).
 */
const FORBIDDEN_V213_SPEC_FIELDS_ON_SLIDE: readonly string[] = [
  'style_spec',
  'styleSpec',
  'reference_assets',
  'referenceAssets',
  'styleHints',
  'styleHintsApplied',
]

/**
 * Free-text fields the closed-enum invariant (D-01 / PARITY-05) forbids
 * EVERYWHERE in the schema:
 *   - reference_artist: legal exposure (named-artist style mimicry)
 *   - reference_brand: legal exposure (named-brand mimicry)
 *   - copy_exactly: prompt-injection landing zone
 *   - style_freetext: open free-text bypasses closed-enum invariant
 *
 * These appear NOWHERE in the codebase — defense-in-depth alongside
 * Plan 74-01's PARITY-05 grep gate.
 */
const FORBIDDEN_FREE_TEXT_FIELDS: readonly string[] = [
  'reference_artist',
  'reference_brand',
  'copy_exactly',
  'style_freetext',
]

describe('Phase 74 Plan 04 (STYLESPEC-12): Slide zero-new-fields invariant', () => {
  const slidePath = path.join(process.cwd(), 'src/lib/types/slide.ts')
  const source = fs.readFileSync(slidePath, 'utf-8')

  it('Slide interface field set matches v2.12 trailing edge (no new fields added during Phase 74)', () => {
    // Extract field names from the `export interface Slide { ... }` block
    const m = source.match(/export interface Slide\s*\{([\s\S]*?)\n\}/)
    expect(m, 'must find `export interface Slide { ... }` block').toBeTruthy()
    const block = m![1]
    // Field names: lines matching /^\s*(\w+)\??\s*:/m (skip TS comments)
    // Pre-strip line and block comments so commented-out field lines don't
    // pollute the field set.
    const codeOnly = block
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const fields = Array.from(codeOnly.matchAll(/^\s*(\w+)\??\s*:/gm)).map(
      (mm) => mm[1],
    )
    // Order-insensitive comparison — Set equality.
    const actualSet = new Set(fields)
    const expectedSet = new Set(V212_TRAILING_EDGE_SLIDE_FIELDS)
    // Compute missing + extra for clearer error message on drift
    const missing = [...expectedSet].filter((f) => !actualSet.has(f))
    const extra = [...actualSet].filter((f) => !expectedSet.has(f))
    expect(
      { missing, extra },
      `Slide field-set drift detected. Expected ${expectedSet.size} fields, got ${actualSet.size}.`,
    ).toEqual({ missing: [], extra: [] })
  })

  it('Slide interface field count matches v2.12 trailing edge (16 fields)', () => {
    const m = source.match(/export interface Slide\s*\{([\s\S]*?)\n\}/)
    expect(m).toBeTruthy()
    const block = m![1]
    const codeOnly = block
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const fields = Array.from(codeOnly.matchAll(/^\s*(\w+)\??\s*:/gm)).map(
      (mm) => mm[1],
    )
    expect(fields).toHaveLength(V212_TRAILING_EDGE_SLIDE_FIELDS.length)
  })

  it.each(FORBIDDEN_V213_SPEC_FIELDS_ON_SLIDE)(
    'Slide source MUST NOT mention forbidden v2.13 spec field "%s" (STYLESPEC-12)',
    (field) => {
      // Strip line + block comments first to allow header documentation
      // to discuss these fields (and to allow `@deprecated` annotations
      // to mention them later if needed).
      const codeOnly = source
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      expect(codeOnly).not.toMatch(new RegExp(`\\b${field}\\b`))
    },
  )

  it.each(FORBIDDEN_FREE_TEXT_FIELDS)(
    'Slide source MUST NOT mention forbidden free-text field "%s" (D-01 closed-enum invariant)',
    (field) => {
      const codeOnly = source
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      expect(codeOnly).not.toMatch(new RegExp(`\\b${field}\\b`))
    },
  )

  it('Type-level: a fixture with only v2.12 trailing-edge fields is assignable to Slide', () => {
    // Constructive proof: every field in V212_TRAILING_EDGE_SLIDE_FIELDS is
    // either present on Slide as required (3 required: hook_text, body_text,
    // image_query, is_cta, background_url, pexels_photo_id) or accepted as
    // optional. If any required field changes, this fixture stops compiling
    // — caught at type-check time, not runtime.
    const fixture: Slide = {
      hook_text: 'h',
      body_text: 'b',
      image_query: 'q',
      is_cta: false,
      background_url: 'u',
      pexels_photo_id: 1,
    }
    expect(fixture.hook_text).toBe('h')
    expect(fixture.body_text).toBe('b')
    expect(fixture.image_query).toBe('q')
    expect(fixture.is_cta).toBe(false)
    expect(fixture.background_url).toBe('u')
    expect(fixture.pexels_photo_id).toBe(1)
  })

  it('Type-level: spec fields are NOT assignable to Slide (compile-time gate)', () => {
    // The @ts-expect-error annotations BELOW are the load-bearing assertions:
    // each one will START failing the moment its corresponding spec field
    // becomes a valid Slide property — flipping the compile-time gate green
    // (which @ts-expect-error treats as a test failure). This catches drift
    // even if the source-grep tests above somehow miss it.
    //
    // Note: each @ts-expect-error must be on the line IMMEDIATELY before the
    // offending property. We use one fixture per forbidden field rather than
    // one mega-fixture to keep error attribution precise.

    const _bad1: Slide = {
      hook_text: 'h',
      body_text: 'b',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      // @ts-expect-error STYLESPEC-12: style_spec MUST NOT be assignable to Slide
      style_spec: { schema_version: 1 },
    }
    void _bad1

    const _bad2: Slide = {
      hook_text: 'h',
      body_text: 'b',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      // @ts-expect-error STYLESPEC-12: reference_assets MUST NOT be assignable to Slide
      reference_assets: [],
    }
    void _bad2

    const _bad3: Slide = {
      hook_text: 'h',
      body_text: 'b',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      // @ts-expect-error STYLESPEC-12: styleHints MUST NOT be assignable to Slide
      styleHints: {},
    }
    void _bad3

    const _bad4: Slide = {
      hook_text: 'h',
      body_text: 'b',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      // @ts-expect-error D-01 closed-enum: reference_artist MUST NOT be assignable to Slide
      reference_artist: 'forbidden',
    }
    void _bad4

    // Sentinel: this test passes when all four @ts-expect-error annotations
    // successfully suppress real type errors. If any annotation becomes
    // "unused" (i.e. the underlying error disappears because the field
    // became valid), TypeScript will surface "Unused @ts-expect-error
    // directive" — which fails this test at compile time.
    expect(true).toBe(true)
  })

  it('Phase-stamp: this test guards Phase 74 → Phase 75+ transition', () => {
    // Sentinel test that documents the LOAD-BEARING constraint in the test
    // output itself. If a verifier runs this suite and sees this test name,
    // they know the STYLESPEC-12 invariant is being enforced.
    expect(V212_TRAILING_EDGE_SLIDE_FIELDS.length).toBe(16)
    expect(FORBIDDEN_V213_SPEC_FIELDS_ON_SLIDE.length).toBe(6)
    expect(FORBIDDEN_FREE_TEXT_FIELDS.length).toBe(4)
  })
})
