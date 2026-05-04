// Phase 69 Plan 03 (PARITY-13 / PCL12): currentColor zero-hit gate.
//
// Decoration color values MUST be explicit hex everywhere in src/lib/render/
// production code. Any `currentColor` literal in production code (NOT in
// comments) constitutes a TPLREND-05 risk per vercel/satori#41 — Satori's
// CSS subset does NOT reliably resolve currentColor across the SVG boundary,
// and a leak would manifest as silent renderer divergence (React preview
// tints correctly via browser CSS cascade; Satori PNG renders black or
// invisible).
//
// The decoration registry's resolveDecorationSvg() substitutes currentColor
// → explicit hex BEFORE any decoration string reaches a renderer. This gate
// enforces the invariant going forward.
//
// SCOPE: src/lib/render/**/*.{ts,tsx} EXCLUDING:
//   - any /__tests__/ subdirs and any .test.ts(x) file
//   - decorations/registry.ts — the resolver CONSUMES currentColor as a
//     regex token to substitute it OUT of the lucide-static SVG output;
//     the registry's own substitute() result is verified by the registry's
//     own unit tests (substitution result MUST be hex). Including it here
//     would force a workaround (e.g. an exception comment) that defeats the
//     gate's "no exceptions" intent.
//   - static asset SVGs in public/shapes/ (not under src/lib/render/, but
//     noted for clarity) — those intentionally use currentColor for the
//     Satori-honored CSS color cascade on <img> SVG assets.
//
// METHODOLOGY: comment-stripping (line + block); positive-control sanity tests
// pin the methodology so a regression in the stripper itself surfaces immediately.
//
// Total tests: 1 sanity floor + N per-file (where N ≥ 5) + 2 SELF-CTRL = 8+ tests.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

function stripComments(source: string): string {
  return source
    .replace(/\/\/.*$/gm, '') // single-line // comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // /* block */ comments
}

const RENDER_ROOT = resolve(__dirname, '..')
// Files explicitly excluded from the scan (path relative to RENDER_ROOT).
// See file header for justification.
const EXCLUDE_RELATIVE: ReadonlySet<string> = new Set([
  'decorations/registry.ts',
])

function enumerateRenderProductionFiles(): string[] {
  const out: string[] = []
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (
          name === '__tests__' ||
          name === '__snapshots__' ||
          name === '__fixtures__'
        ) {
          continue
        }
        walk(full)
      } else if (
        (name.endsWith('.ts') || name.endsWith('.tsx')) &&
        !name.endsWith('.test.ts') &&
        !name.endsWith('.test.tsx')
      ) {
        out.push(full)
      }
    }
  }
  walk(RENDER_ROOT)
  // Filter out explicitly-excluded files.
  return out.filter((p) => {
    const rel = p.slice(RENDER_ROOT.length + 1)
    return !EXCLUDE_RELATIVE.has(rel)
  })
}

describe('Phase 69 Plan 03 (PARITY-13 / PCL12): currentColor zero-hit gate', () => {
  const files = enumerateRenderProductionFiles()

  it('PCL12 sanity floor: enumeration finds at least 5 production files in src/lib/render/', () => {
    // Floor includes (non-exhaustive): resolve-overlay.ts, render-slide-satori.tsx,
    // decoration-renderer.tsx, hook-fit.ts, render-slide.ts, plus templates/*.ts.
    expect(files.length).toBeGreaterThanOrEqual(5)
  })

  it('PCL12 sanity floor: enumeration excludes decorations/registry.ts (resolver substitution function)', () => {
    const includesRegistry = files.some((p) =>
      p.endsWith(join('decorations', 'registry.ts')),
    )
    expect(includesRegistry).toBe(false)
  })

  files.forEach((file) => {
    const relPath = `src/lib/render/${file.slice(RENDER_ROOT.length + 1)}`
    it(`PCL12: ${relPath} contains zero "currentColor" literals (comment-stripped)`, () => {
      const source = readFileSync(file, 'utf8')
      const stripped = stripComments(source)
      expect(stripped).not.toMatch(/currentColor/)
    })
  })
})

describe('Phase 69 Plan 03 (SELF-CTRL-PCL12): methodology pin', () => {
  it('SELF-CTRL-PCL12-1: stripper REMOVES currentColor inside line and block comments', () => {
    const lineCommented = 'const x = 1; // currentColor in a comment\n'
    const blockCommented = 'const y = 2; /* currentColor in a block */'
    expect(stripComments(lineCommented)).not.toMatch(/currentColor/)
    expect(stripComments(blockCommented)).not.toMatch(/currentColor/)
  })

  it('SELF-CTRL-PCL12-2: stripper PRESERVES currentColor in production code (a real leak would fail the gate)', () => {
    // If this assertion fails, the stripper is over-stripping (false negative)
    // and would silently miss a real currentColor leak. The gate would be
    // useless. Mirror v2.9 Plan 65-03 PRA self-control pattern.
    const productionLeak = 'const fill = "currentColor";'
    expect(stripComments(productionLeak)).toMatch(/currentColor/)
  })

  it('SELF-CTRL-PCL12-3: resolve-overlay.ts (known-clean per Plan 69-01 audit) passes the gate', () => {
    // resolve-overlay.ts uses currentColor only in a /* JSDoc block */ comment.
    // Any future change that breaks the stripper would fail this test before
    // the per-file PCL12 tests above flag a different file.
    const source = readFileSync(join(RENDER_ROOT, 'resolve-overlay.ts'), 'utf8')
    const stripped = stripComments(source)
    expect(stripped).not.toMatch(/currentColor/)
  })
})
