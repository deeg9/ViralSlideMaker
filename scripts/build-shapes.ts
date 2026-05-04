/**
 * Phase 70 (SHAPES-05): asset build pipeline for public/shapes/*.svg.
 *
 * Phase 69 ships 8 HAND-ROLLED reference assets (triangle, polygon-5/6/8,
 * star-5/6, arrow, line). This script's full corpus generation lands in
 * Phase 70 — including filled/outlined variants per shapeKind, parameterized
 * polygon vertex counts, and a lint pass that asserts every emitted SVG:
 *   - uses fill="currentColor" / stroke="currentColor"
 *   - has NO <filter> / <style> blocks
 *   - viewBox="0 0 100 100"
 *
 * Mirror: scripts/build-textures.ts (v2.9 Phase 56).
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

// import { writeFileSync } from 'node:fs'
// import { resolve } from 'node:path'

function main(): void {
  console.log('[build-shapes] Phase 69 ships hand-rolled assets only.')
  console.log('[build-shapes] Phase 70 will populate the full filled/outlined corpus.')
  // TODO Phase 70: emit filled + outlined variants for each shapeKind
  //   - triangle, polygon-{3..12}, star-{4..8}, arrow, arrow-up/down/left, line
  //   - both fill="currentColor" and stroke="currentColor" variants
  // TODO Phase 70: lint pass — assert every emitted file:
  //   - viewBox="0 0 100 100"
  //   - contains "currentColor" (fill OR stroke)
  //   - does NOT contain "<filter" or "<style" or "<script"
  //   - does NOT contain on*= event handlers
  // TODO Phase 70: emit a manifest JSON listing every available shape key
  //   so the picker UI can enumerate shapes without filesystem scans.
}

main()
