// Phase 55 (D-24, D-25, PARITY-04): lint-style guard.
//
// Server-side sharp pre-bake from Phase 54 is the ONLY path for photo
// treatment. CSS filter properties (filter:, backdrop-filter:,
// mix-blend-mode:) are silently dropped by Satori (vercel/satori#573)
// and would create preview/export drift.
//
// This test reads resolve-overlay.ts as raw text and asserts none of
// the forbidden property substrings appear. Comments are stripped before
// matching so JSDoc that DOCUMENTS the ban (e.g., "NO `filter:`") does
// not falsely trigger the guard.
//
// Phase 58 will extend this scan to the new template files and the
// parity test harness.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function stripComments(source: string): string {
  return source
    .replace(/\/\/.*$/gm, '')           // single-line // comments
    .replace(/\/\*[\s\S]*?\*\//g, '')   // /* block */ comments
}

describe('Phase 55 (D-24, D-25, PARITY-04): no CSS filter properties in resolver', () => {
  const resolverPath = resolve(__dirname, '..', 'resolve-overlay.ts')
  const source = readFileSync(resolverPath, 'utf8')
  const stripped = stripComments(source)

  it('resolve-overlay.ts does NOT contain "filter:" property usage', () => {
    // Negative-lookbehind for `backdrop-` so "backdrop-filter:" is checked separately.
    expect(stripped).not.toMatch(/(?<!backdrop-)filter\s*:/)
  })

  it('resolve-overlay.ts does NOT contain "backdrop-filter:" property usage', () => {
    expect(stripped).not.toMatch(/backdrop-filter\s*:/)
  })

  it('resolve-overlay.ts does NOT contain "mix-blend-mode:" property usage', () => {
    expect(stripped).not.toMatch(/mix-blend-mode\s*:/)
  })

  it('resolve-overlay.ts also does NOT contain JS-style camelCase variants in style objects', () => {
    // Catches: filter:, backdropFilter:, mixBlendMode: in inline style objects
    // (with whitespace tolerance for object-literal formatting).
    expect(stripped).not.toMatch(/\bfilter\s*:/)
    expect(stripped).not.toMatch(/\bbackdropFilter\s*:/)
    expect(stripped).not.toMatch(/\bmixBlendMode\s*:/)
  })
})
