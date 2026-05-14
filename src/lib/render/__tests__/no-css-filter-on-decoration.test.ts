// Phase 69 Plan 03 (PARITY-14 / PCL13): CSS filter / backdrop-filter /
// mix-blend-mode zero-hit gate on the decoration render path.
//
// Drop-shadow effects on decorations MUST use CSS box-shadow on the wrapping
// <div>, never SVG <filter> or CSS filter:/backdrop-filter:/mix-blend-mode:
// — vercel/satori#573 (CSS filter), #393 (drop-shadow filter), and the
// broader #41 family silently drop these properties, causing TPLREND-05
// divergence (React preview shows the effect; Satori PNG strips it).
//
// SCOPE: explicit file list — the 4 files that own the decoration render path.
// Phase 55/58's no-css-filter.test.ts already covers resolve-overlay.ts + 4
// templates; this gate extends the invariant to the new Phase 69 surfaces.
//
// METHODOLOGY: comment-stripping (line + block); positive-control sanity tests
// pin the methodology so a regression in the stripper itself surfaces immediately.
//
// Total: 4 files × 5 substring patterns + 2 existence sanity = 22 negative
// assertions + 3 SELF-CTRL = 25 tests.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function stripComments(source: string): string {
  return source
    .replace(/\/\/.*$/gm, '') // single-line // comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // /* block */ comments
}

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')

const DECORATION_RENDER_PATH_FILES = [
  'src/lib/render/decoration-renderer.tsx',
  'src/lib/render/decorations/registry.ts',
  'src/lib/render/render-slide-satori.tsx',
  'src/components/slides/slide-preview.tsx',
] as const

// quick-260514-decoration-controls-polish: decoration-renderer.tsx is the
// ONE file in the scanned set that may emit `filter: drop-shadow(...)` —
// narrowly, only for icon decorations rendered with target==='browser', so
// the editor preview gets a glyph-shaped shadow while Satori export stays
// on box-shadow. All other `filter:` values (blur, brightness, contrast,
// invert, sepia, hue-rotate, saturate, grayscale, opacity, etc.) remain
// banned in EVERY scanned file including this one — the assertion below
// allow-lists ONLY the drop-shadow form.
const DROP_SHADOW_ALLOWED_FILES: ReadonlySet<string> = new Set([
  'src/lib/render/decoration-renderer.tsx',
])

describe('Phase 69 Plan 03 (PARITY-14 / PCL13): CSS filter zero-hit gate on decoration render path', () => {
  DECORATION_RENDER_PATH_FILES.forEach((relPath) => {
    const fullPath = resolve(REPO_ROOT, relPath)
    const dropShadowAllowed = DROP_SHADOW_ALLOWED_FILES.has(relPath)

    describe(relPath, () => {
      it('exists', () => {
        expect(existsSync(fullPath)).toBe(true)
      })

      // Read once per file (vitest re-runs the describe body across each
      // test so we read inside it() to avoid stale closures on watch mode).
      it('no "filter:" CSS property usage (comment-stripped, excluding "backdrop-filter:")', () => {
        const stripped = stripComments(readFileSync(fullPath, 'utf8'))
        // Negative-lookbehind for `backdrop-` so "backdrop-filter:" is checked separately.
        const matches = stripped.match(/(?<!backdrop-)filter\s*:\s*[^;,}\n]*/g) ?? []
        for (const match of matches) {
          if (dropShadowAllowed) {
            // Allow-list: filter: drop-shadow(...) is the ONLY permitted form.
            expect(match).toMatch(/filter\s*:\s*[`'"]?\s*drop-shadow\(/)
          } else {
            // Strict zero-hit for all other files in the scanned set.
            expect(stripped).not.toMatch(/(?<!backdrop-)filter\s*:/)
          }
        }
      })

      it('no "backdrop-filter:" CSS property usage (comment-stripped)', () => {
        const stripped = stripComments(readFileSync(fullPath, 'utf8'))
        expect(stripped).not.toMatch(/backdrop-filter\s*:/)
      })

      it('no "mix-blend-mode:" CSS property usage (comment-stripped)', () => {
        const stripped = stripComments(readFileSync(fullPath, 'utf8'))
        expect(stripped).not.toMatch(/mix-blend-mode\s*:/)
      })

      it('no JS-style camelCase backdropFilter / mixBlendMode in style objects', () => {
        const stripped = stripComments(readFileSync(fullPath, 'utf8'))
        expect(stripped).not.toMatch(/\bbackdropFilter\s*:/)
        expect(stripped).not.toMatch(/\bmixBlendMode\s*:/)
      })

      it('no bare "filter:" identifier in TS object/style position (camelCase + property syntax)', () => {
        // Catches: `filter:` in style objects (which would mean `style.filter = ...`)
        // The negative-lookbehind keeps us from double-counting the kebab-case
        // backdrop-filter handled above. The boundary `\b` excludes attr names
        // like "data-filter" (even though those are not CSS-filter risks).
        const stripped = stripComments(readFileSync(fullPath, 'utf8'))
        const matches = stripped.match(/(?<![\w-])filter\s*:\s*[^;,}\n]*/g) ?? []
        for (const match of matches) {
          if (dropShadowAllowed) {
            // Allow-list mirrors the kebab-case test above — only drop-shadow.
            expect(match).toMatch(/filter\s*:\s*[`'"]?\s*drop-shadow\(/)
          } else {
            expect(stripped).not.toMatch(/(?<![\w-])filter\s*:/)
          }
        }
      })
    })
  })
})

describe('Phase 69 Plan 03 (SELF-CTRL-PCL13): methodology pin', () => {
  it('SELF-CTRL-PCL13-1: stripper REMOVES filter: inside line and block comments', () => {
    const lineCommented = 'const x = 1; // filter: blur(4px) — banned\n'
    const blockCommented = 'const y = 2; /* filter: drop-shadow(...) — banned */'
    expect(stripComments(lineCommented)).not.toMatch(/(?<![\w-])filter\s*:/)
    expect(stripComments(blockCommented)).not.toMatch(/(?<![\w-])filter\s*:/)
  })

  it('SELF-CTRL-PCL13-2: stripper PRESERVES filter: in production code (a real leak would fail the gate)', () => {
    // If this assertion fails, the stripper is over-stripping (false negative)
    // and would silently miss a real filter: leak. Mirror v2.9 Plan 65-03 PRA
    // self-control pattern.
    const productionLeak = 'const style = { filter: "blur(4px)" }'
    expect(stripComments(productionLeak)).toMatch(/(?<![\w-])filter\s*:/)
  })

  it('SELF-CTRL-PCL13-3: existing PCL gate file (no-css-filter.test.ts) still in suite (prevents accidental deletion)', () => {
    const olderGate = resolve(__dirname, 'no-css-filter.test.ts')
    expect(existsSync(olderGate)).toBe(true)
  })
})
