// SERVER-ONLY: do not import from client components.
// Phase 57 (PALETTE-01, PALETTE-04): named-role palette extraction
// for palette-dominant templates (editorial-serif, notes-app-chic).
//
// Contract:
//   extractPalette(treatedUrl) -> NamedPalette { Vibrant, DarkVibrant,
//     LightVibrant, Muted, DarkMuted, LightMuted } — all hex strings,
//     never null (cascade fallback per D-06).
//   - Resizes input to ≤256×256 via sharp BEFORE passing to Vibrant
//     (PALETTE-04: keeps Vercel function memory under budget).
//   - Pure: deterministic given the same input URL bytes.

import { Vibrant } from 'node-vibrant/node'
import { sharp } from './sharp-config'

export type NamedPalette = {
  Vibrant: string
  DarkVibrant: string
  LightVibrant: string
  Muted: string
  DarkMuted: string
  LightMuted: string
}

const FALLBACK_HEX = '#7d6161' // brand muted (final cascade fallback)

const ROLE_CASCADE: Array<keyof NamedPalette> = [
  'Vibrant',
  'DarkVibrant',
  'Muted',
  'DarkMuted',
  'LightVibrant',
  'LightMuted',
]

/**
 * Extract a named-role palette from a treated photo URL.
 *
 * Resizes to ≤256×256 via sharp, then runs node-vibrant. Any role that
 * Vibrant returns null for is filled by cascading through the other
 * roles (Vibrant → DarkVibrant → Muted → DarkMuted → LightVibrant →
 * LightMuted → brand fallback).
 */
export async function extractPalette(treatedUrl: string): Promise<NamedPalette> {
  // 1. Fetch the treated URL as a buffer
  const response = await fetch(treatedUrl)
  if (!response.ok) {
    throw new Error(
      `extractPalette: fetch failed ${response.status} for ${treatedUrl}`,
    )
  }
  const arrayBuffer = await response.arrayBuffer()
  const sourceBuffer = Buffer.from(arrayBuffer)

  // 2. Resize via sharp to ≤256×256 (PALETTE-04 budget)
  const thumbBuffer = await sharp(sourceBuffer)
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  // 3. Pass to Vibrant
  const palette = await Vibrant.from(thumbBuffer).getPalette()

  // 4. Map roles with cascade fallback (D-06)
  const raw: Partial<NamedPalette> = {
    Vibrant: palette.Vibrant?.hex,
    DarkVibrant: palette.DarkVibrant?.hex,
    LightVibrant: palette.LightVibrant?.hex,
    Muted: palette.Muted?.hex,
    DarkMuted: palette.DarkMuted?.hex,
    LightMuted: palette.LightMuted?.hex,
  }

  function resolveRole(key: keyof NamedPalette): string {
    if (raw[key]) return raw[key]!
    for (const fallback of ROLE_CASCADE) {
      if (raw[fallback]) return raw[fallback]!
    }
    return FALLBACK_HEX
  }

  return {
    Vibrant: resolveRole('Vibrant'),
    DarkVibrant: resolveRole('DarkVibrant'),
    LightVibrant: resolveRole('LightVibrant'),
    Muted: resolveRole('Muted'),
    DarkMuted: resolveRole('DarkMuted'),
    LightMuted: resolveRole('LightMuted'),
  }
}
