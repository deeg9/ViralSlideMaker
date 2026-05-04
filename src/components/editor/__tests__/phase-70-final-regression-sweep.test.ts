/**
 * Phase 70 Plan 05: final phase-70 regression sweep.
 *
 * End-of-phase contract pin: a single CI-blocking test that asserts the
 * Phase 70 invariants — tsc baseline preserved, bundle-delta doc lives,
 * all 5 plan SUMMARY files exist, every Phase 70 requirement is referenced
 * in at least one SUMMARY, and the PCL11/PCL12/PCL13 audit files exist.
 *
 * This sweep is a regression NET — it does not re-execute every test
 * (the regular vitest run does that). It pins the cross-cutting invariants
 * that are easy to silently break (a SUMMARY rename, a new requirement
 * not back-filled into a SUMMARY, the bundle-delta doc deleted, an audit
 * file renamed) and surfaces a single clear "Phase 70 contract broken"
 * signal.
 *
 * Mirror reference: v2.11 Phase 66 close-out sweep pattern.
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')
const TSC_BASELINE = 17
const PHASE_DIR = '.planning/phases/70-editor-ui-picker-card-layers-shapes'
const BUNDLE_DELTA_DOC = `${PHASE_DIR}/70-01-DEPS-05-BUNDLE-DELTA.md`

const PLAN_NUMBERS = ['70-01', '70-02', '70-03', '70-04', '70-05'] as const

// 31 Phase 70 requirements per the milestone scope (DEPS-02..05, PICKER-01..08,
// SHAPES-01..09, KBD-10..12, CARD-01..05, PARITY-12, PARITY-18).
const REQUIRED_REQS = [
  'DEPS-02',
  'DEPS-03',
  'DEPS-04',
  'DEPS-05',
  'PICKER-01',
  'PICKER-02',
  'PICKER-03',
  'PICKER-04',
  'PICKER-05',
  'PICKER-06',
  'PICKER-07',
  'PICKER-08',
  'SHAPES-01',
  'SHAPES-02',
  'SHAPES-03',
  'SHAPES-04',
  'SHAPES-05',
  'SHAPES-06',
  'SHAPES-07',
  'SHAPES-08',
  'SHAPES-09',
  'KBD-10',
  'KBD-11',
  'KBD-12',
  'CARD-01',
  'CARD-02',
  'CARD-03',
  'CARD-04',
  'CARD-05',
  'PARITY-12',
  'PARITY-18',
] as const

describe('Phase 70 final regression sweep', () => {
  it('tsc baseline preserved (≤ 17 errors)', () => {
    let errCount = 0
    try {
      execSync('npx tsc --noEmit', {
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: REPO_ROOT,
      })
      // No throw → 0 errors.
      errCount = 0
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string }
      const out = (err.stdout ?? '') + (err.stderr ?? '')
      errCount = (out.match(/error TS/g) ?? []).length
    }
    expect(errCount).toBeLessThanOrEqual(TSC_BASELINE)
  })

  it('70-01-DEPS-05-BUNDLE-DELTA.md exists and references the v2.11 baseline + 200 KB ceiling', () => {
    const path = resolve(REPO_ROOT, BUNDLE_DELTA_DOC)
    expect(existsSync(path), `${BUNDLE_DELTA_DOC} should exist`).toBe(true)
    const content = readFileSync(path, 'utf8')
    expect(content).toMatch(/baseline/i)
    expect(content).toMatch(/200\s*KB/i)
  })

  it('all 5 Phase 70 plan SUMMARY files exist', () => {
    for (const plan of PLAN_NUMBERS) {
      const path = resolve(REPO_ROOT, `${PHASE_DIR}/${plan}-SUMMARY.md`)
      expect(existsSync(path), `${plan}-SUMMARY.md should exist`).toBe(true)
    }
  })

  it('every Phase 70 requirement appears in at least one SUMMARY', () => {
    const summaries = PLAN_NUMBERS.map((p) =>
      readFileSync(resolve(REPO_ROOT, `${PHASE_DIR}/${p}-SUMMARY.md`), 'utf8'),
    ).join('\n')
    const missing = REQUIRED_REQS.filter((req) => !summaries.includes(req))
    expect(
      missing,
      `Missing reqs in SUMMARYs: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('PCL11 + PCL12 + PCL13 audit files all present in the test corpus', () => {
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          'src/lib/render/__tests__/parity.pcl11-decoration-chrome-leak.test.tsx',
        ),
      ),
      'PCL11 audit file should exist',
    ).toBe(true)
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          'src/lib/render/__tests__/no-current-color-in-render.test.ts',
        ),
      ),
      'PCL12 audit file should exist',
    ).toBe(true)
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          'src/lib/render/__tests__/no-css-filter-on-decoration.test.ts',
        ),
      ),
      'PCL13 audit file should exist',
    ).toBe(true)
  })

  it('DEPS-05 bundle-gate test file exists (CI bundle ceiling enforcement)', () => {
    expect(
      existsSync(
        resolve(REPO_ROOT, 'src/components/editor/__tests__/bundle-gate.test.ts'),
      ),
      'bundle-gate.test.ts should exist',
    ).toBe(true)
    // bundle-gate-baseline.ts holds the BASELINE_V211_BYTES + CEILING constants.
    expect(
      existsSync(
        resolve(REPO_ROOT, 'src/components/editor/__tests__/bundle-gate-baseline.ts'),
      ),
    ).toBe(true)
  })

  it('SWEEP-PICK-1..6 picker-firewall grep gate file exists (Plan 70-03)', () => {
    expect(
      existsSync(
        resolve(REPO_ROOT, 'src/components/editor/__tests__/picker-firewall-grep.test.ts'),
      ),
    ).toBe(true)
  })

  it('decoration renderer single-source-of-truth file exists (Phase 69 / TPLREND-05)', () => {
    expect(
      existsSync(resolve(REPO_ROOT, 'src/lib/render/decoration-renderer.tsx')),
    ).toBe(true)
  })

  it('Layers panel decoration glyph + LP-NEW1..3 test files exist (Plan 70-05)', () => {
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          'src/components/editor/layers-panel/__tests__/layer-chip-decoration.test.tsx',
        ),
      ),
    ).toBe(true)
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          'src/components/editor/layers-panel/__tests__/layers-panel-lp-new.test.tsx',
        ),
      ),
    ).toBe(true)
  })

  it('REQUIREMENTS.md mentions every Phase 70 requirement (traceability)', () => {
    const reqs = readFileSync(
      resolve(REPO_ROOT, '.planning/REQUIREMENTS.md'),
      'utf8',
    )
    const missing = REQUIRED_REQS.filter((req) => !reqs.includes(req))
    expect(
      missing,
      `Phase 70 reqs missing from REQUIREMENTS.md: ${missing.join(', ')}`,
    ).toEqual([])
  })
}, 60_000) // describe-level timeout — `npx tsc --noEmit` can take 30+ seconds
