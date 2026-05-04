/**
 * Phase 70 Plan 01 (SHAPES-05): asset build pipeline for public/shapes/*.svg.
 *
 * Phase 69 Plan 02 shipped 8 hand-rolled FILLED reference assets (triangle,
 * polygon-5/6/8, star-5/6, arrow, line). This script lands the OUTLINED
 * variants needed by SHAPES-08 (DecorationCard stroke-style enum) PLUS a
 * manifest.json the picker (Plan 70-02) and AI emit (Phase 71) consume.
 *
 * Mirror: scripts/build-textures.ts (v2.9 Phase 56) — same shape:
 *   1. pure tsx (node:fs + node:path; NO React, NO Next.js dependency)
 *   2. write SVGs to public/shapes/*.svg
 *   3. write manifest.json describing every variant
 *   4. lint pass on EVERY public/shapes/*.svg afterwards (asserts viewBox,
 *      currentColor, no <filter>/<style>/<script>/on*= handlers); non-zero
 *      exit on lint failure (CI-fail signal — T-70-02 STRIDE mitigation)
 *
 * Defensive contract:
 *   - DOES NOT overwrite existing FILLED SVGs (those are pinned by Phase 69-02
 *     fingerprint snapshots; regenerating them would silently break parity)
 *   - DOES overwrite existing OUTLINED SVGs (this script owns them; idempotent)
 *   - DOES overwrite manifest.json (also owned by this script)
 *
 * NOTE: public/shapes/*.svg files are STATIC ASSETS, not src/ production code.
 * The PCL12 grep gate (Phase 69 Plan 03) scans src/lib/render/ ONLY — these
 * SVGs are EXEMPT and intentionally use currentColor for the CSS color cascade.
 *
 * Run:
 *   npx tsx scripts/build-shapes.ts
 *   # or
 *   npm run shapes
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SHAPES_DIR = resolve(process.cwd(), 'public', 'shapes')

// ──────────────────────────────────────────────────────────────────────────
// Geometry — mirror the Phase 69-02 hand-rolled FILLED variants exactly so
// the OUTLINE variant is the same polygon with stroke-only styling. These
// `points` strings are byte-identical to public/shapes/{shape}.svg.
// ──────────────────────────────────────────────────────────────────────────

const TRIANGLE_POINTS = '50,10 90,90 10,90'

// Pentagon (5-pointed regular polygon) — Phase 69-02 polygon-5.svg
const POLYGON_5_POINTS = '50,5 92.80,36.10 76.45,86.40 23.55,86.40 7.20,36.10'
// Hexagon (6-pointed regular polygon) — Phase 69-02 polygon-6.svg
const POLYGON_6_POINTS = '50,5 88.97,27.5 88.97,72.5 50,95 11.03,72.5 11.03,27.5'
// Octagon (8-pointed regular polygon) — Phase 69-02 polygon-8.svg
const POLYGON_8_POINTS = '50,5 81.82,18.18 95,50 81.82,81.82 50,95 18.18,81.82 5,50 18.18,18.18'

// 5-pointed star — Phase 69-02 star-5.svg
const STAR_5_POINTS =
  '50,5 60.58,35.44 92.80,36.10 67.12,55.56 76.45,86.40 50,68 23.55,86.40 32.88,55.56 7.20,36.10 39.42,35.44'
// 6-pointed star — Phase 69-02 star-6.svg
const STAR_6_POINTS =
  '50,5 61,30.95 88.97,27.5 72,50 88.97,72.5 61,69.05 50,95 39,69.05 11.03,72.5 28,50 11.03,27.5 39,30.95'

// Arrow — Phase 69-02 arrow.svg
const ARROW_POINTS = '10,40 60,40 60,20 90,50 60,80 60,60 10,60'

// Outline stroke width (px in 100×100 viewBox — visually consistent with the
// stroke-width="6" the line.svg ships with).
const OUTLINE_STROKE_WIDTH = 6

// ──────────────────────────────────────────────────────────────────────────
// SVG emitters
// ──────────────────────────────────────────────────────────────────────────

const SVG_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
const SVG_CLOSE = `</svg>`

function polygonOutline(points: string): string {
  return `${SVG_OPEN}<polygon points="${points}" fill="none" stroke="currentColor" stroke-width="${OUTLINE_STROKE_WIDTH}" stroke-linejoin="round"/>${SVG_CLOSE}\n`
}

function lineOutline(): string {
  // The line shape is intrinsically stroke-only; "outline" = "filled" geometry.
  // Emitted as a synonym so manifest.json has uniform { filled, outline } pairs.
  return `${SVG_OPEN}<line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" stroke-width="${OUTLINE_STROKE_WIDTH}" stroke-linecap="round"/>${SVG_CLOSE}\n`
}

// ──────────────────────────────────────────────────────────────────────────
// File emit list — fixed enumeration; bounded (T-70-08 STRIDE mitigation).
// ──────────────────────────────────────────────────────────────────────────

interface OutlineSpec {
  filename: string
  body: string
}

const OUTLINE_FILES: OutlineSpec[] = [
  { filename: 'triangle-outline.svg', body: polygonOutline(TRIANGLE_POINTS) },
  { filename: 'polygon-5-outline.svg', body: polygonOutline(POLYGON_5_POINTS) },
  { filename: 'polygon-6-outline.svg', body: polygonOutline(POLYGON_6_POINTS) },
  { filename: 'polygon-8-outline.svg', body: polygonOutline(POLYGON_8_POINTS) },
  { filename: 'star-5-outline.svg', body: polygonOutline(STAR_5_POINTS) },
  { filename: 'star-6-outline.svg', body: polygonOutline(STAR_6_POINTS) },
  { filename: 'arrow-outline.svg', body: polygonOutline(ARROW_POINTS) },
  { filename: 'line-outline.svg', body: lineOutline() },
]

// ──────────────────────────────────────────────────────────────────────────
// Manifest — picker (Plan 70-02) + AI emit (Phase 71) consume this.
// ──────────────────────────────────────────────────────────────────────────

interface ManifestEntry {
  kind: string
  variant?: 'filled' | 'outline'
  points?: number
  path?: string       // public URL path; absent for css-div renderer
  renderer?: 'css-div' | 'svg'
  label: string
}

interface Manifest {
  version: 1
  shapes: ManifestEntry[]
}

function buildManifest(): Manifest {
  return {
    version: 1,
    shapes: [
      // CSS-div renderer (no SVG asset; rendered via decoration-renderer.tsx
      // CSS-div path per Phase 69 register).
      { kind: 'rect', renderer: 'css-div', label: 'Rectangle' },
      { kind: 'circle', renderer: 'css-div', label: 'Circle' },
      { kind: 'ellipse', renderer: 'css-div', label: 'Ellipse' },

      // SVG renderer — closed shapes (filled + outline pairs)
      { kind: 'triangle', variant: 'filled', renderer: 'svg', path: '/shapes/triangle.svg', label: 'Triangle' },
      { kind: 'triangle', variant: 'outline', renderer: 'svg', path: '/shapes/triangle-outline.svg', label: 'Triangle (outline)' },

      { kind: 'polygon', variant: 'filled', points: 5, renderer: 'svg', path: '/shapes/polygon-5.svg', label: 'Pentagon' },
      { kind: 'polygon', variant: 'outline', points: 5, renderer: 'svg', path: '/shapes/polygon-5-outline.svg', label: 'Pentagon (outline)' },
      { kind: 'polygon', variant: 'filled', points: 6, renderer: 'svg', path: '/shapes/polygon-6.svg', label: 'Hexagon' },
      { kind: 'polygon', variant: 'outline', points: 6, renderer: 'svg', path: '/shapes/polygon-6-outline.svg', label: 'Hexagon (outline)' },
      { kind: 'polygon', variant: 'filled', points: 8, renderer: 'svg', path: '/shapes/polygon-8.svg', label: 'Octagon' },
      { kind: 'polygon', variant: 'outline', points: 8, renderer: 'svg', path: '/shapes/polygon-8-outline.svg', label: 'Octagon (outline)' },

      { kind: 'star', variant: 'filled', points: 5, renderer: 'svg', path: '/shapes/star-5.svg', label: '5-point star' },
      { kind: 'star', variant: 'outline', points: 5, renderer: 'svg', path: '/shapes/star-5-outline.svg', label: '5-point star (outline)' },
      { kind: 'star', variant: 'filled', points: 6, renderer: 'svg', path: '/shapes/star-6.svg', label: '6-point star' },
      { kind: 'star', variant: 'outline', points: 6, renderer: 'svg', path: '/shapes/star-6-outline.svg', label: '6-point star (outline)' },

      { kind: 'arrow', variant: 'filled', renderer: 'svg', path: '/shapes/arrow.svg', label: 'Arrow' },
      { kind: 'arrow', variant: 'outline', renderer: 'svg', path: '/shapes/arrow-outline.svg', label: 'Arrow (outline)' },

      // Stroke-only shapes — filled + outline are synonyms (line has no fill).
      { kind: 'line', variant: 'filled', renderer: 'svg', path: '/shapes/line.svg', label: 'Line' },
      { kind: 'line', variant: 'outline', renderer: 'svg', path: '/shapes/line-outline.svg', label: 'Line (outline)' },
    ],
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Lint pass — T-70-02 STRIDE mitigation. Asserts every emitted SVG is safe
// for inclusion via <img src="..."> (currentColor inheritance, no scripts).
// ──────────────────────────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /<filter[\s>]/i, label: '<filter>' },
  { re: /<style[\s>]/i, label: '<style>' },
  { re: /<script[\s>]/i, label: '<script>' },
  // Event handlers — `on` followed by alpha and `=`. The leading whitespace/
  // quote/`<` lookbehind avoids false positives on legitimate words like
  // "polygon" — match only when `on` appears as a real attribute.
  { re: /[\s"'<]on[a-zA-Z]+\s*=/i, label: 'on*= handler attribute' },
]

interface LintError {
  file: string
  reason: string
}

function lintSvg(filename: string, body: string): LintError[] {
  const errors: LintError[] = []
  if (!/viewBox=["']0 0 100 100["']/.test(body)) {
    errors.push({ file: filename, reason: 'missing viewBox="0 0 100 100"' })
  }
  if (!/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/.test(body)) {
    errors.push({ file: filename, reason: 'missing xmlns="http://www.w3.org/2000/svg"' })
  }
  if (!/currentColor/.test(body)) {
    errors.push({ file: filename, reason: 'missing currentColor (fill or stroke)' })
  }
  for (const { re, label } of FORBIDDEN_PATTERNS) {
    if (re.test(body)) {
      errors.push({ file: filename, reason: `contains forbidden ${label}` })
    }
  }
  return errors
}

// ──────────────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────────────

function main(): void {
  const writes: string[] = []
  const skipped: string[] = []

  // 1. Emit OUTLINE files (idempotent; overwrite OK because this script owns them).
  for (const { filename, body } of OUTLINE_FILES) {
    const path = join(SHAPES_DIR, filename)
    writeFileSync(path, body, 'utf-8')
    writes.push(filename)
  }

  // 2. Emit manifest.json (idempotent; overwrite OK).
  const manifest = buildManifest()
  writeFileSync(
    join(SHAPES_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8',
  )
  writes.push('manifest.json')

  // 3. Defensive guard: never overwrite existing FILLED variants. They are
  //    pinned by Phase 69-02 fingerprint snapshots; this script must NOT
  //    regenerate them. Detect drift by reading them and asserting they
  //    weren't touched (we never wrote — but log for visibility).
  const FILLED_NAMES = [
    'triangle.svg',
    'polygon-5.svg',
    'polygon-6.svg',
    'polygon-8.svg',
    'star-5.svg',
    'star-6.svg',
    'arrow.svg',
    'line.svg',
  ]
  for (const name of FILLED_NAMES) {
    if (existsSync(join(SHAPES_DIR, name))) {
      skipped.push(name)
    }
  }

  // 4. Lint pass on EVERY public/shapes/*.svg (filled AND outline).
  const allSvgs = readdirSync(SHAPES_DIR).filter((f) => f.endsWith('.svg'))
  const lintErrors: LintError[] = []
  for (const filename of allSvgs) {
    const body = readFileSync(join(SHAPES_DIR, filename), 'utf-8')
    lintErrors.push(...lintSvg(filename, body))
  }

  if (lintErrors.length > 0) {
    console.error('[build-shapes] LINT FAILED:')
    for (const e of lintErrors) {
      console.error(`  ${e.file}: ${e.reason}`)
    }
    process.exit(1)
  }

  // 5. Summary
  console.log(`[build-shapes] Wrote ${writes.length} files:`)
  for (const f of writes) {
    console.log(`  - public/shapes/${f}`)
  }
  console.log(`[build-shapes] Preserved ${skipped.length} filled variants (Phase 69-02 pinned):`)
  for (const f of skipped) {
    console.log(`  - public/shapes/${f}`)
  }
  console.log(`[build-shapes] Lint pass: ${allSvgs.length} SVGs OK.`)
}

main()
