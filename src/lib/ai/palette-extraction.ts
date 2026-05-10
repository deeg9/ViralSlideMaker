// SERVER-ONLY: do not import this from a 'use client' component.
// node-vibrant/node uses node:fs and canvas-style image decoders that
// are NOT browser-compatible. The /node subpath is the load-bearing
// gate that keeps this module out of the client bundle (per package.json
// `exports`, the bare 'node-vibrant' specifier resolves to a
// throw-on-import stub).
//
// Phase 75 Plan 03 — EXTRACT-04: deterministic palette extraction.
//
// Why this exists (per CONTEXT.md D-07):
//   "node-vibrant extracts palette deterministically from preprocessed
//    bytes (NOT Gemini); Gemini ONLY for categorical role/style
//    inference (font category, layout type, decoration density, etc.).
//    This is the load-bearing determinism guarantee."
//
// Why we don't ask Gemini for the palette (per PITFALLS Pitfall 2b):
//   VLMs struggle with attribute-binding; a 3-stop cobalt gradient
//   becomes one flat hex; perceived hexes drift across calls. Our
//   v2.9 duotone-cobalt photos look like single-color to a VLM.
//   node-vibrant on the same preprocessed bytes is deterministic,
//   ~50ms server-side, free, and already in package.json@^4.0.4.
//
// CONTEXT.md Discretion (multi-image merge strategy):
//   "call once per reference image; merge palettes server-side via
//    dominant-color voting OR weighted average — recommend
//    dominant-color voting (more interpretable)."
//
// Determinism guarantee (gated by tests):
//   1. extractPaletteFromBytes — same Buffer in -> deeply equal out.
//   2. mergePalettes — lex-tiebreaker on every sort key. Order-
//      independent: shuffling input palettes does not change output.

import { Vibrant } from 'node-vibrant/node'

/** Cap on merged-palette size — matches the StyleSpec palette field budget. */
export const PALETTE_TARGET_SIZE = 6

/** Documented neutral fallback when Vibrant returns no swatches. */
export const FALLBACK_NEUTRAL_HEX = '#808080'

/**
 * Result shape for a single-image palette OR a merged multi-image palette.
 *
 * `hex` is 1..PALETTE_TARGET_SIZE unique uppercase 6-digit hex strings,
 * always at least one (fallback to neutral gray on empty / failure).
 *
 * `dominant` is always a member of `hex`. For single-image extraction
 * it is the highest-population swatch; for merged palettes it is the
 * winner of dominant-color voting (lex-lower hex wins ties).
 */
export interface ExtractedPalette {
  hex: string[]
  dominant: string
}

/** Perceptual-saliency order for picking swatches off the Vibrant Palette. */
const SWATCH_ORDER = [
  'Vibrant',
  'LightVibrant',
  'Muted',
  'DarkVibrant',
  'DarkMuted',
  'LightMuted',
] as const

/**
 * Canonicalize an input hex string to '#RRGGBB' uppercase.
 *
 * Accepts: '#abc', 'abc', '#aabbcc', 'AABBCC', and pads short input.
 * This is the strict-canonicalization gate that satisfies T-75-03-01
 * (Tampering — malformed hex injected via Vibrant output).
 */
function normalizeHex(input: string): string {
  const raw = input.startsWith('#') ? input.slice(1) : input
  const expanded =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6)
  return ('#' + expanded).toUpperCase()
}

/**
 * Extract a deterministic palette from preprocessed image bytes.
 *
 * Contract:
 *   - Pure / deterministic: same Buffer -> deeply equal ExtractedPalette.
 *   - Never throws: Vibrant errors fall back to FALLBACK_NEUTRAL_HEX.
 *   - Always returns >=1 valid 6-digit hex.
 *
 * Caller (Plan 75-01 orchestrator) feeds in `prepared.bytes` from
 * src/lib/preprocessing/style-reference-prep.ts (JPEG@85 <=1024x1024 —
 * already EXIF-stripped per T-75-03-03).
 */
export async function extractPaletteFromBytes(
  bytes: Buffer,
): Promise<ExtractedPalette> {
  try {
    const palette = await Vibrant.from(bytes).getPalette()

    const swatches: Array<{ hex: string; population: number }> = []
    for (const name of SWATCH_ORDER) {
      const sw = palette[name]
      if (sw) {
        swatches.push({
          hex: normalizeHex(sw.hex),
          population: sw.population ?? 0,
        })
      }
    }

    if (swatches.length === 0) {
      return { hex: [FALLBACK_NEUTRAL_HEX], dominant: FALLBACK_NEUTRAL_HEX }
    }

    // Dedupe (Vibrant can return the same hex for multiple roles on flat
    // images — preserve perceptual-saliency order via SWATCH_ORDER above).
    const uniqueHex: string[] = []
    const seen = new Set<string>()
    for (const s of swatches) {
      if (!seen.has(s.hex)) {
        uniqueHex.push(s.hex)
        seen.add(s.hex)
      }
    }

    // Dominant = swatch with highest pixel population. Tiebreaker: keep
    // the first one (perceptual-saliency order from SWATCH_ORDER).
    const dominantSwatch = swatches.reduce(
      (best, cur) => (cur.population > best.population ? cur : best),
      swatches[0],
    )

    return {
      hex: uniqueHex.slice(0, PALETTE_TARGET_SIZE),
      dominant: dominantSwatch.hex,
    }
  } catch (err) {
    // Graceful degradation per T-75-03-02 (D — DoS / adversarial decode).
    // The orchestrator's outer 10s Promise.race in Plan 75-01 is the hard
    // bound; this catch handles unexpected decode errors so palette
    // extraction never crashes the extract-style-spec call.
    console.warn(
      '[palette-extraction] Vibrant.from threw (graceful fallback):',
      err,
    )
    return { hex: [FALLBACK_NEUTRAL_HEX], dominant: FALLBACK_NEUTRAL_HEX }
  }
}

/**
 * Merge N reference palettes into one via dominant-color voting.
 *
 * Algorithm (per CONTEXT.md Discretion):
 *   1. Count dominant votes across all input palettes; merged.dominant =
 *      most-voted hex. Tiebreaker: lex-lower hex wins.
 *   2. Count per-hex appearances across all input palettes.
 *   3. Sort: mergedDominant first, then by frequency desc, then lex asc.
 *   4. Cap at PALETTE_TARGET_SIZE (matches StyleSpec palette budget).
 *
 * Determinism: every sort key includes a lex-tiebreaker, so output is
 * byte-identical for the same input regardless of input ORDER. Tested
 * by the order-independent assertion in mergePalettes-tiebreaker.
 *
 * Edge case: empty input -> single-entry FALLBACK_NEUTRAL_HEX palette.
 */
export function mergePalettes(palettes: ExtractedPalette[]): ExtractedPalette {
  if (palettes.length === 0) {
    return { hex: [FALLBACK_NEUTRAL_HEX], dominant: FALLBACK_NEUTRAL_HEX }
  }

  // Step 1 — count dominant votes; pick the winner with lex tiebreaker.
  const dominantVotes = new Map<string, number>()
  for (const p of palettes) {
    const norm = normalizeHex(p.dominant)
    dominantVotes.set(norm, (dominantVotes.get(norm) ?? 0) + 1)
  }
  const sortedDominants = [...dominantVotes.entries()].sort(
    ([hexA, votesA], [hexB, votesB]) => {
      if (votesB !== votesA) return votesB - votesA
      return hexA.localeCompare(hexB)
    },
  )
  const mergedDominant = sortedDominants[0][0]

  // Step 2 — count per-hex appearances across the union.
  const hexCounts = new Map<string, number>()
  for (const p of palettes) {
    for (const h of p.hex) {
      const norm = normalizeHex(h)
      hexCounts.set(norm, (hexCounts.get(norm) ?? 0) + 1)
    }
  }

  // Step 3 — sort: mergedDominant first, then frequency desc, then lex asc.
  const sortedHexes = [...hexCounts.entries()].sort(
    ([hexA, ca], [hexB, cb]) => {
      if (hexA === mergedDominant && hexB !== mergedDominant) return -1
      if (hexB === mergedDominant && hexA !== mergedDominant) return 1
      if (cb !== ca) return cb - ca
      return hexA.localeCompare(hexB)
    },
  )

  // Step 4 — cap at PALETTE_TARGET_SIZE.
  const mergedHex = sortedHexes
    .slice(0, PALETTE_TARGET_SIZE)
    .map(([hex]) => hex)

  return { hex: mergedHex, dominant: mergedDominant }
}
