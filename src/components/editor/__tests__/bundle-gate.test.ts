/**
 * DEPS-05 (Phase 70 Plan 01): CI bundle-size gate.
 *
 * Asserts the editor route page chunk size stays within
 * `BASELINE_V211_BYTES_{RAW,GZ} + 200 KB` after every commit through end-of-
 * phase. Mirror of the v2.6 triple-layer build-gate pattern:
 *   layer 1: static import test  — Tasks 1+ verify the new deps resolve
 *   layer 2: this vitest gate    — verifies built chunk size ≤ ceiling
 *   layer 3: `npm run build`     — must produce a chunk under the ceiling
 *
 * The gate is BLOCKING in CI (where `next build` always runs before vitest).
 * `it.skipIf` is a graceful local-dev fallback for `npm run test` invocations
 * that haven't built `.next/` yet — never an opt-out.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  BASELINE_V211_BYTES_RAW,
  BASELINE_V211_BYTES_GZ,
  CEILING_BYTES_RAW,
  CEILING_BYTES_GZ,
} from './bundle-gate-baseline'

// Editor route lives at /project/[id]; Next.js emits the page chunk under the
// `(dashboard)` route group: `.next/static/chunks/app/(dashboard)/project/[id]/page-*.js`.
const EDITOR_CHUNK_DIR = '.next/static/chunks/app/(dashboard)/project/[id]'

function findEditorChunks(): string[] {
  if (!existsSync(EDITOR_CHUNK_DIR)) return []
  return readdirSync(EDITOR_CHUNK_DIR)
    .filter((name) => name.startsWith('page-') && name.endsWith('.js'))
    .map((name) => join(EDITOR_CHUNK_DIR, name))
}

const editorChunks = findEditorChunks()
const skipReason =
  editorChunks.length === 0
    ? '.next/ build artifacts missing — run `next build` before vitest in CI; skipping locally'
    : null

if (skipReason) {
  // eslint-disable-next-line no-console
  console.warn(`[bundle-gate] ${skipReason}`)
}

describe('DEPS-05 bundle-size gate (Phase 70 Plan 01)', () => {
  it('exports baseline constants documented in 70-01-DEPS-05-BUNDLE-DELTA.md', () => {
    expect(BASELINE_V211_BYTES_RAW).toBeGreaterThan(0)
    expect(BASELINE_V211_BYTES_GZ).toBeGreaterThan(0)
    expect(CEILING_BYTES_RAW).toBe(BASELINE_V211_BYTES_RAW + 200 * 1024)
    expect(CEILING_BYTES_GZ).toBe(BASELINE_V211_BYTES_GZ + 200 * 1024)
  })

  it.skipIf(editorChunks.length === 0)(
    'editor route page chunk is within v2.11 baseline + 200KB (raw bytes)',
    () => {
      const totalRaw = editorChunks.reduce((sum, p) => sum + statSync(p).size, 0)
      const diff = totalRaw - BASELINE_V211_BYTES_RAW
      expect(
        totalRaw,
        `actual: ${totalRaw}, ceiling: ${CEILING_BYTES_RAW}, baseline: ${BASELINE_V211_BYTES_RAW}, diff: ${diff > 0 ? '+' : ''}${diff}`,
      ).toBeLessThanOrEqual(CEILING_BYTES_RAW)
    },
  )

  it.skipIf(editorChunks.length === 0)(
    'editor route page chunk is within v2.11 baseline + 200KB (gzipped bytes)',
    () => {
      const totalGz = editorChunks.reduce(
        (sum, p) => sum + gzipSync(readFileSync(p)).byteLength,
        0,
      )
      const diff = totalGz - BASELINE_V211_BYTES_GZ
      expect(
        totalGz,
        `actual: ${totalGz}, ceiling: ${CEILING_BYTES_GZ}, baseline: ${BASELINE_V211_BYTES_GZ}, diff: ${diff > 0 ? '+' : ''}${diff}`,
      ).toBeLessThanOrEqual(CEILING_BYTES_GZ)
    },
  )

  it.skipIf(editorChunks.length === 0)(
    'discovers exactly one editor route page chunk',
    () => {
      // Guards against accidental chunk-splitting that would force the gate to
      // read multiple files and silently inflate the comparison; if Next.js
      // ever emits >1 chunk for /project/[id] we want a deliberate review.
      expect(editorChunks.length).toBe(1)
    },
  )
})
