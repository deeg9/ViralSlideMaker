// Phase 70 Plan 05 (PARITY-12 / PCL11): chrome-leak grep gate on
// decoration render paths + Phase 70 picker/card surfaces.
//
// Extends the v2.11 PCL gate family (PCL1..PCL10 from Plan 65-03,
// PCL12/PCL13 from Plan 69-03). Comment-stripped grep audit on
// production code paths — fails CI if any forbidden token enters the
// decoration render paths or the Phase 70 picker/card surfaces.
//
// Forbidden tokens (className substrings, case-insensitive):
//   - sel{}ection (selection-ring, selection-overlay, etc.)
//   - mar{}quee (marquee-overlay, marquee-rect)
//   - gui{}de (smart-guide, alignment-guide, etc.)
//   - lock-i{}con (chrome-only lock indicator)
//   - decoration-r{}ing (decoration-specific selection chrome)
// (NOTE: tokens written with '{}' INSIDE this header comment so the
// audit doesn't self-match on its own description; the actual regex
// match happens against comment-stripped audited files.)
//
// Audited files:
//   - src/lib/render/render-slide-satori.tsx (Satori path — ZERO chrome)
//   - src/lib/render/decoration-renderer.tsx (pure renderer — ZERO chrome)
//   - src/components/editor/decoration-picker/lucide-picker.tsx (Phase 70 — ZERO)
//   - src/components/editor/decoration-picker/shape-picker.tsx (Phase 70 — ZERO)
//   - src/components/editor/text-rail/decoration-card.tsx (Phase 70 — ZERO)
//   - src/components/editor/text-rail/decoration-card-effects.tsx (Phase 70 — ZERO)
//   - src/components/slides/slide-preview.tsx NON-EDITABLE region (sliced via marker
//     comments shipped Phase 67/69) — ZERO. The editable region is permitted
//     to contain selection chrome (it powers click-to-select wires from
//     Plan 70-04) and is OUT of scope.
//
// METHODOLOGY: line + block comment-strip BEFORE grep. Mirrors
// Phase 65-03 PCL1..PCL10 + Phase 69-03 PCL12/PCL13 pattern. The
// audit MUST count tokens only in production code (not comment prose
// — many tokens appear in JSDoc legitimately, e.g. "selection chrome
// lives elsewhere").

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function stripComments(source: string): string {
  return source
    .replace(/\/\/.*$/gm, '') // single-line // comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // /* block */ comments
}

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')

// Build forbidden token names at runtime via concatenation so this test
// FILE itself doesn't match its own audit when a future regression sweep
// scans the test corpus. Production-code emissions must use the literal
// strings — never reconstruct them at runtime in render paths.
const FORBIDDEN_TOKENS = [
  'sel' + 'ection',
  'mar' + 'quee',
  'gu' + 'ide',
  'lock-' + 'icon',
  'decoration-' + 'ring',
] as const

const DECORATION_RENDER_PATH_FILES = [
  'src/lib/render/render-slide-satori.tsx',
  'src/lib/render/decoration-renderer.tsx',
  'src/components/editor/decoration-picker/lucide-picker.tsx',
  'src/components/editor/decoration-picker/shape-picker.tsx',
  'src/components/editor/text-rail/decoration-card.tsx',
  'src/components/editor/text-rail/decoration-card-effects.tsx',
] as const

const SLIDE_PREVIEW_PATH = 'src/components/slides/slide-preview.tsx'
// Marker comments demarcating the non-editable decoration iteration block.
// (Existing markers shipped Phase 67/69; layer 5.5 slot.)
const NON_EDITABLE_START_MARKER = 'decoration iteration site (non-editable)'
const EDITABLE_START_MARKER = 'decoration iteration site (editable view)'

function readSrc(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8')
}

function sliceNonEditableRegion(src: string): string {
  // Slice the NON-EDITABLE decoration iteration block — the small region
  // emitting decoration nodes in the non-editable render path. Bounded
  // by the start marker (Phase 67 (DECOR-01) layer 5.5: decoration iteration
  // site (non-editable)) and the closing of the .map() call.
  //
  // We ONLY want the decoration-emit block, NOT the entire span up to the
  // editable marker (which would include 1500+ unrelated lines of editor
  // chrome — selection overlays, smart-guide, marquee — none of which
  // affect the decoration render path).
  //
  // The block reliably ends with the closing `})}` of
  // `.filter(...).map(...)` returning the decoration nodes — followed by
  // the watermark comment. We grab a generous 800-char window (~30 LOC)
  // beyond the start marker; PCL11 only cares about the decoration
  // emission code, which fits in <30 LOC by Phase 67/69 design.
  const startIdx = src.indexOf(NON_EDITABLE_START_MARKER)
  if (startIdx === -1) {
    throw new Error(
      'PCL11 audit: non-editable marker comment missing in slide-preview.tsx — Phase 67/69 invariant broken',
    )
  }
  const editableIdx = src.indexOf(EDITABLE_START_MARKER)
  if (editableIdx === -1) {
    throw new Error(
      'PCL11 audit: editable marker comment missing in slide-preview.tsx — Phase 67/69 invariant broken',
    )
  }
  // 800-char window from non-editable marker; cap at editable marker to
  // be safe (will never reach it in practice — block is <30 LOC).
  const end = Math.min(startIdx + 800, editableIdx)
  return src.slice(startIdx, end)
}

function countForbiddenHits(stripped: string): { token: string; count: number }[] {
  const hits: { token: string; count: number }[] = []
  for (const token of FORBIDDEN_TOKENS) {
    const re = new RegExp(token, 'gi')
    const m = stripped.match(re)
    if (m && m.length > 0) hits.push({ token, count: m.length })
  }
  return hits
}

describe('PARITY-12 / PCL11: chrome-leak grep gate — decoration render paths + Phase 70 picker/card surfaces', () => {
  // ─── per-file audit (Test 1..6) ────────────────────────────────────

  DECORATION_RENDER_PATH_FILES.forEach((relPath) => {
    it(`PCL11: ${relPath} contains zero chrome-leak tokens in non-comment code`, () => {
      const fullPath = resolve(REPO_ROOT, relPath)
      expect(existsSync(fullPath), `expected ${relPath} to exist`).toBe(true)
      const stripped = stripComments(readSrc(relPath))
      const hits = countForbiddenHits(stripped)
      expect(
        hits,
        `${relPath}: forbidden tokens leaked into production code: ${JSON.stringify(hits)}`,
      ).toEqual([])
    })
  })

  // ─── slide-preview.tsx non-editable region (Test 7) ────────────────

  it('PCL11: slide-preview.tsx NON-EDITABLE decoration region contains zero chrome-leak tokens', () => {
    const src = readSrc(SLIDE_PREVIEW_PATH)
    const region = sliceNonEditableRegion(src)
    const stripped = stripComments(region)
    const hits = countForbiddenHits(stripped)
    expect(
      hits,
      `non-editable decoration region: forbidden tokens leaked: ${JSON.stringify(hits)}`,
    ).toEqual([])
  })

  // ─── slide-preview.tsx EDITABLE region — chrome PERMITTED (Test 8) ─

  it('PCL11: slide-preview.tsx EDITABLE region permitted to contain selection chrome (gated by editable={true})', () => {
    // Sanity assertion: the editable region marker exists. Chrome IS allowed
    // here — the click-target overlay from Plan 70-04 lives at this site.
    const src = readSrc(SLIDE_PREVIEW_PATH)
    expect(src.indexOf(EDITABLE_START_MARKER)).toBeGreaterThan(-1)
  })

  // ─── aggregate (Test 9) ────────────────────────────────────────────

  it('PCL11: aggregate — sum of forbidden token mentions across all audited files === 0', () => {
    let total = 0
    for (const relPath of DECORATION_RENDER_PATH_FILES) {
      const stripped = stripComments(readSrc(relPath))
      for (const token of FORBIDDEN_TOKENS) {
        const m = stripped.match(new RegExp(token, 'gi'))
        if (m) total += m.length
      }
    }
    // Plus non-editable slide-preview region
    const region = sliceNonEditableRegion(readSrc(SLIDE_PREVIEW_PATH))
    const stripped = stripComments(region)
    for (const token of FORBIDDEN_TOKENS) {
      const m = stripped.match(new RegExp(token, 'gi'))
      if (m) total += m.length
    }
    expect(total).toBe(0)
  })

  // ─── SELF-CTRL-1: positive control on stripper + matcher (Test 10) ─

  it('PCL11 SELF-CTRL-1: audit detects deliberate violation in test fixture (positive control)', () => {
    const fakeSrc = `
      // sel${'ection'} mention in a comment — should be stripped and NOT counted
      const x = "sel${'ection'}-ring-fake-violation"
      const y = "mar${'quee'}-overlay-leaked"
    `
    const stripped = stripComments(fakeSrc)
    const hits = countForbiddenHits(stripped)
    // Comment mention stripped → only the two const lines count.
    // 1 sel{}ection + 1 mar{}quee = 2 distinct tokens with 1 match each.
    const tokenList = hits.map((h) => h.token).sort()
    expect(tokenList).toEqual(
      ['mar' + 'quee', 'sel' + 'ection'].sort(),
    )
  })

  // ─── SELF-CTRL-2: comment-stripping behavior pin (Test 11) ─────────

  it('PCL11 SELF-CTRL-2: comment-stripping does NOT count tokens in line OR block comments', () => {
    const fakeSrc = `
      // sel${'ection'} in a // line comment
      /* sel${'ection'} in a /* block */ comment */
      // mar${'quee'} in a // line comment
      const noViolation = "ok"
    `
    const stripped = stripComments(fakeSrc)
    const hits = countForbiddenHits(stripped)
    expect(hits).toEqual([])
  })

  // ─── PCL12 + PCL13 cross-suite existence (Test 12) ─────────────────

  it('PCL11: PCL12 + PCL13 audit files (Phase 69 Plan 03) still present in test corpus', () => {
    expect(
      existsSync(
        resolve(REPO_ROOT, 'src/lib/render/__tests__/no-current-color-in-render.test.ts'),
      ),
    ).toBe(true)
    expect(
      existsSync(
        resolve(REPO_ROOT, 'src/lib/render/__tests__/no-css-filter-on-decoration.test.ts'),
      ),
    ).toBe(true)
  })
})
