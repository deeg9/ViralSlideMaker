/**
 * SHAPES-05 (Phase 70 Plan 01 Task 2): scripts/build-shapes.ts contract tests.
 *
 * Replaces the Phase 69 skeleton with a full corpus generator. This test:
 *   1. invokes the script via execSync (true integration; matches `npm run shapes`)
 *   2. asserts the script exits 0
 *   3. lints every emitted SVG (viewBox, currentColor, no <filter>/<style>/<script>/on*=)
 *   4. asserts manifest.json shape covers filled+outline for SVG shapes + css-div for rect/circle/ellipse
 *   5. asserts the Phase 69-02 filled SVGs are byte-identical pre/post run (defensive)
 *   6. asserts the script is idempotent (re-running yields the same files)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const SHAPES_DIR = 'public/shapes'
const SCRIPT = 'scripts/build-shapes.ts'

const FILLED_BASELINES = [
  'triangle.svg',
  'polygon-5.svg',
  'polygon-6.svg',
  'polygon-8.svg',
  'star-5.svg',
  'star-6.svg',
  'arrow.svg',
  'line.svg',
] as const

const OUTLINED_FILES = [
  'triangle-outline.svg',
  'polygon-5-outline.svg',
  'polygon-6-outline.svg',
  'polygon-8-outline.svg',
  'star-5-outline.svg',
  'star-6-outline.svg',
  'arrow-outline.svg',
  'line-outline.svg',
] as const

function sha(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function readSvg(name: string): string {
  return readFileSync(join(SHAPES_DIR, name), 'utf-8')
}

function readSvgBytes(name: string): Buffer {
  return readFileSync(join(SHAPES_DIR, name))
}

describe('SHAPES-05 build-shapes.ts full corpus generator', () => {
  // Capture filled SVG hashes BEFORE running so we can assert byte-identity afterwards.
  const filledHashesBefore = new Map<string, string>()

  beforeAll(() => {
    for (const name of FILLED_BASELINES) {
      if (existsSync(join(SHAPES_DIR, name))) {
        filledHashesBefore.set(name, sha(readSvgBytes(name)))
      }
    }
    // Run the script — if this throws, the rest of the suite fails fast.
    execSync(`npx tsx ${SCRIPT}`, { stdio: 'pipe' })
  })

  it('Test 1: script exits 0 (beforeAll completed without throwing)', () => {
    // beforeAll throws on non-zero exit; reaching this assertion means clean run.
    expect(true).toBe(true)
  })

  it('Test 2: every outlined variant is emitted to public/shapes/', () => {
    for (const name of OUTLINED_FILES) {
      expect(existsSync(join(SHAPES_DIR, name)), `missing ${name}`).toBe(true)
    }
  })

  it('Test 3: every emitted SVG has viewBox="0 0 100 100"', () => {
    const all = [...FILLED_BASELINES, ...OUTLINED_FILES]
    for (const name of all) {
      const svg = readSvg(name)
      expect(svg, `${name} missing viewBox`).toMatch(/viewBox=["']0 0 100 100["']/)
    }
  })

  it('Test 4: every emitted SVG declares xmlns="http://www.w3.org/2000/svg"', () => {
    const all = [...FILLED_BASELINES, ...OUTLINED_FILES]
    for (const name of all) {
      const svg = readSvg(name)
      expect(svg, `${name} missing xmlns`).toMatch(/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/)
    }
  })

  it('Test 5: every emitted SVG references currentColor (fill or stroke)', () => {
    const all = [...FILLED_BASELINES, ...OUTLINED_FILES]
    for (const name of all) {
      const svg = readSvg(name)
      expect(svg, `${name} missing currentColor`).toMatch(/currentColor/)
    }
  })

  it('Test 6: lint pass — NO <filter>, <style>, <script>, or on*= handler', () => {
    const all = [...FILLED_BASELINES, ...OUTLINED_FILES]
    const forbidden = [
      { pattern: /<filter[\s>]/, label: '<filter>' },
      { pattern: /<style[\s>]/, label: '<style>' },
      { pattern: /<script[\s>]/, label: '<script>' },
      // `on` followed by an alpha sequence and `=` — defensive against onmouseover= etc.
      { pattern: /\son[a-zA-Z]+=/, label: 'on*= handler' },
    ]
    for (const name of all) {
      const svg = readSvg(name)
      for (const { pattern, label } of forbidden) {
        expect(pattern.test(svg), `${name} contains forbidden ${label}`).toBe(false)
      }
    }
  })

  it('Test 7: outlined variants use fill="none" stroke="currentColor"', () => {
    // Line is intrinsically stroke-only; its outline variant inherits the stroke property
    // from the base <line> element, so we just check stroke="currentColor" is present.
    for (const name of OUTLINED_FILES) {
      const svg = readSvg(name)
      expect(svg, `${name} missing stroke="currentColor"`).toMatch(/stroke=["']currentColor["']/)
      if (name !== 'line-outline.svg') {
        // Closed shapes must NOT have a fill (fill="none")
        expect(svg, `${name} should be unfilled outline`).toMatch(/fill=["']none["']/)
      }
    }
  })

  it('Test 8: manifest.json exists and conforms to schema', () => {
    const manifestPath = join(SHAPES_DIR, 'manifest.json')
    expect(existsSync(manifestPath)).toBe(true)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(manifest).toHaveProperty('version')
    expect(manifest.version).toBe(1)
    expect(Array.isArray(manifest.shapes)).toBe(true)
  })

  it('Test 9: manifest contains filled + outline entries for every SVG-rendered shape', () => {
    const manifest = JSON.parse(readFileSync(join(SHAPES_DIR, 'manifest.json'), 'utf-8'))
    const shapes = manifest.shapes as Array<{
      kind: string
      variant: string
      points?: number
      path?: string
      renderer?: string
    }>

    // CSS-div shapes — filled-only entries
    for (const kind of ['rect', 'circle', 'ellipse']) {
      const entry = shapes.find((s) => s.kind === kind)
      expect(entry, `manifest missing ${kind}`).toBeDefined()
      expect(entry?.renderer).toBe('css-div')
    }

    // SVG-rendered: triangle, arrow, line — filled + outline
    for (const kind of ['triangle', 'arrow', 'line']) {
      const filled = shapes.find((s) => s.kind === kind && s.variant === 'filled')
      const outline = shapes.find((s) => s.kind === kind && s.variant === 'outline')
      expect(filled, `manifest missing filled ${kind}`).toBeDefined()
      expect(outline, `manifest missing outline ${kind}`).toBeDefined()
      expect(filled?.path).toMatch(new RegExp(`/shapes/${kind}\\.svg$`))
      expect(outline?.path).toMatch(new RegExp(`/shapes/${kind}-outline\\.svg$`))
    }

    // Polygon: 5/6/8 vertex counts × {filled, outline}
    for (const points of [5, 6, 8]) {
      const filled = shapes.find(
        (s) => s.kind === 'polygon' && s.variant === 'filled' && s.points === points,
      )
      const outline = shapes.find(
        (s) => s.kind === 'polygon' && s.variant === 'outline' && s.points === points,
      )
      expect(filled, `manifest missing filled polygon-${points}`).toBeDefined()
      expect(outline, `manifest missing outline polygon-${points}`).toBeDefined()
    }

    // Star: 5/6 point counts × {filled, outline}
    for (const points of [5, 6]) {
      const filled = shapes.find(
        (s) => s.kind === 'star' && s.variant === 'filled' && s.points === points,
      )
      const outline = shapes.find(
        (s) => s.kind === 'star' && s.variant === 'outline' && s.points === points,
      )
      expect(filled, `manifest missing filled star-${points}`).toBeDefined()
      expect(outline, `manifest missing outline star-${points}`).toBeDefined()
    }
  })

  it('Test 10: Phase 69-02 filled SVGs are byte-identical post-run', () => {
    // The build-shapes script MUST NOT regenerate filled SVGs that already exist on
    // disk — those are pinned by Phase 69-02 fingerprint snapshots.
    for (const name of FILLED_BASELINES) {
      const before = filledHashesBefore.get(name)
      if (!before) continue
      const after = sha(readSvgBytes(name))
      expect(after, `${name} was regenerated (byte-mismatch with pre-run state)`).toBe(before)
    }
  })

  it('Test 11: re-running the script is idempotent (no diff on second run)', () => {
    const hashesBefore = new Map<string, string>()
    for (const name of [...FILLED_BASELINES, ...OUTLINED_FILES]) {
      hashesBefore.set(name, sha(readSvgBytes(name)))
    }
    const manifestBefore = sha(readSvgBytes('manifest.json'))

    execSync(`npx tsx ${SCRIPT}`, { stdio: 'pipe' })

    for (const [name, before] of hashesBefore) {
      const after = sha(readSvgBytes(name))
      expect(after, `${name} differed on second run`).toBe(before)
    }
    expect(sha(readSvgBytes('manifest.json'))).toBe(manifestBefore)
  })

  it('Test 12: line-outline.svg is structurally consistent (line is stroke-only)', () => {
    // For the line shape the "outline" variant is a synonym of the filled variant —
    // this is intentional for manifest symmetry (Plan 70-04 SHAPES-08 stroke-style enum
    // selects between filled/outlined assets at render time; line treats both as
    // identical because <line> has no fill).
    const outline = readSvg('line-outline.svg')
    expect(outline).toMatch(/<line\b/)
    expect(outline).toMatch(/stroke=["']currentColor["']/)
  })
})
