// Phase 54 (TREAT-01..TREAT-06): server-side photo-treatment foundation.
// All sharp operations route through ./sharp-config to ensure cache(false)
// + concurrency(1) are set BEFORE any sharp() pipeline runs (D-04, Pitfall #5).
//
// Contract:
//   treatPhoto(sourceUrl, spec, userId) -> { url, palette }
//   - Idempotent per (sourceUrl, spec): SHA-256 cache key over
//     `${sourceUrl}|${JSON.stringify(spec)}` (D-03).
//   - Storage: slide-backgrounds-treated/{userId}/treated/{sha}.png (D-06).
//   - Cache hit: skips sharp pipeline, derives palette from existing buffer.
//
// SECURITY (T-54-01-01): sourceUrl is server-trusted in this phase
// (callers pass Pexels/Imagen URLs only). Phase 57 editor URL input MUST
// validate sourceUrl against an allowlist of trusted hosts before calling
// treatPhoto. Do NOT accept raw client URLs here without that gate.

import { sharp } from './sharp-config'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const TREATED_BUCKET = 'slide-backgrounds-treated'

export type TreatmentPreset =
  | { kind: 'bw'; contrast?: number }
  | { kind: 'duotone-cream'; intensity?: number }
  | { kind: 'duotone-cobalt'; intensity?: number }
  | { kind: 'contrast-bump'; gamma?: number; linear?: [number, number] }

export type PaletteColor = { r: number; g: number; b: number; hex: string }

export type Palette = {
  dominant: PaletteColor
  cluster1: PaletteColor
  cluster2: PaletteColor
  cluster3: PaletteColor
}

export type TreatmentResult = { url: string; palette: Palette }

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  const hex = (n: number) => clamp(n).toString(16).padStart(2, '0')
  return '#' + hex(rgb.r) + hex(rgb.g) + hex(rgb.b)
}

/**
 * Build the SHA-256 cache key per D-03. Exported for unit testing.
 */
export function buildCacheKey(sourceUrl: string, spec: TreatmentPreset): string {
  return createHash('sha256')
    .update(`${sourceUrl}|${JSON.stringify(spec)}`)
    .digest('hex')
}

/**
 * Apply the preset's sharp pipeline to a source buffer and return the
 * treated PNG buffer. Pure function (no I/O) — used directly by tests
 * to assert byte-identical output across repeated invocations.
 */
export async function applyPreset(
  buf: Buffer,
  spec: TreatmentPreset,
): Promise<Buffer> {
  switch (spec.kind) {
    case 'bw':
      return sharp(buf)
        .grayscale()
        .linear(spec.contrast ?? 1.05, -8)
        .png()
        .toBuffer()
    case 'duotone-cream':
      return sharp(buf)
        .grayscale()
        .tint({ r: 248, g: 232, b: 200 })
        .modulate({ brightness: spec.intensity ?? 1.0 })
        .png()
        .toBuffer()
    case 'duotone-cobalt':
      return sharp(buf)
        .grayscale()
        .tint({ r: 30, g: 70, b: 140 })
        .modulate({ brightness: spec.intensity ?? 1.0 })
        .png()
        .toBuffer()
    case 'contrast-bump':
      return sharp(buf)
        .gamma(spec.gamma ?? 1.1)
        .linear(spec.linear?.[0] ?? 1.08, spec.linear?.[1] ?? -6)
        .png()
        .toBuffer()
    default: {
      // Exhaustive switch — should never happen at runtime.
      const _exhaustive: never = spec
      throw new Error(`Unknown preset kind: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/**
 * Extract a Palette from a treated buffer using sharp.stats() (D-02).
 * Phase 54: cluster1..3 derived from sharp.stats().channels (R/G/B
 * per-channel means). @vibrant/node named-role k-means deferred to
 * Phase 57 per D-02 — palette shape exists; cluster source can be
 * swapped without breaking callers.
 */
async function extractPalette(treatedBuf: Buffer): Promise<Palette> {
  const stats = await sharp(treatedBuf).stats()
  const dominant: PaletteColor = {
    r: stats.dominant.r,
    g: stats.dominant.g,
    b: stats.dominant.b,
    hex: rgbToHex(stats.dominant),
  }
  const channelToColor = (mean: number): PaletteColor => {
    const v = Math.round(mean)
    return {
      r: v,
      g: v,
      b: v,
      hex: rgbToHex({ r: v, g: v, b: v }),
    }
  }
  const ch = stats.channels
  const cluster1 = channelToColor(ch[0]?.mean ?? 0)
  const cluster2 = channelToColor(ch[1]?.mean ?? 0)
  const cluster3 = channelToColor(ch[2]?.mean ?? 0)
  return { dominant, cluster1, cluster2, cluster3 }
}

/**
 * Server-side photo treatment with SHA-256 idempotent cache (D-03).
 * Returns the public URL of the treated asset and a derived palette.
 */
export async function treatPhoto(
  sourceUrl: string,
  spec: TreatmentPreset,
  userId: string,
): Promise<TreatmentResult> {
  const cacheKey = buildCacheKey(sourceUrl, spec)
  const objectPath = `${userId}/treated/${cacheKey}.png`
  const supabase = createAdminClient()

  // Cache-hit short circuit: list the user's treated folder for this exact
  // sha. If found, fetch the existing public URL and re-extract palette.
  const list = await supabase.storage
    .from(TREATED_BUCKET)
    .list(`${userId}/treated`, { search: `${cacheKey}.png` })

  const existing = list.data?.find((entry) => entry.name === `${cacheKey}.png`)
  if (existing) {
    const { data: publicData } = supabase.storage
      .from(TREATED_BUCKET)
      .getPublicUrl(objectPath)
    const cachedRes = await fetch(publicData.publicUrl)
    const cachedBuf = Buffer.from(await cachedRes.arrayBuffer())
    const palette = await extractPalette(cachedBuf)
    return { url: publicData.publicUrl, palette }
  }

  // Cache miss: download source, run sharp pipeline, upload, return.
  const sourceRes = await fetch(sourceUrl)
  if (!sourceRes.ok) {
    throw new Error(
      `treatPhoto: failed to fetch sourceUrl (${sourceRes.status} ${sourceRes.statusText})`,
    )
  }
  const sourceBuf = Buffer.from(await sourceRes.arrayBuffer())
  const treatedBuf = await applyPreset(sourceBuf, spec)
  const palette = await extractPalette(treatedBuf)

  // upsert: false — concurrent calls with the same key fail-soft (we treat
  // a duplicate-key error as a cache hit and just return the public URL).
  const { error: uploadErr } = await supabase.storage
    .from(TREATED_BUCKET)
    .upload(objectPath, treatedBuf, {
      contentType: 'image/png',
      upsert: false,
    })
  if (uploadErr && !/duplicate|already exists/i.test(uploadErr.message)) {
    throw new Error(`treatPhoto: storage upload failed — ${uploadErr.message}`)
  }
  const { data: publicData } = supabase.storage
    .from(TREATED_BUCKET)
    .getPublicUrl(objectPath)
  return { url: publicData.publicUrl, palette }
}
