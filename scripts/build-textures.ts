/**
 * Phase 56-01 (TPL-05): Deterministic grain PNG + halftone PNG generator.
 *
 * Outputs (idempotent — overwrites on every run):
 *   public/textures/grain-subtle.png   1080×1920 Gaussian noise σ=0.04
 *   public/textures/grain-medium.png   1080×1920 Gaussian noise σ=0.08
 *   public/textures/grain-heavy.png    1080×1920 Gaussian noise σ=0.14 + contrast +20%
 *   public/textures/paper-texture.png  1080×1920 paper-cream #F4EFE3 + low-freq noise + fiber streaks
 *   public/textures/xerox-grain.png    1080×1920 high-contrast B&W photocopier feel
 *
 *   public/overlays/halftone-dots-light.png  1080×1920 sparse Bayer halftone (#1A1A1A on transparent)
 *   public/overlays/halftone-dots-dense.png  1080×1920 dense Bayer halftone (#1A1A1A on transparent)
 *
 * Determinism contract (D-17, D-18): same input → byte-identical PNGs across runs.
 *   - All randomness derived from `crypto.createHash('sha256')` seeded with literal strings
 *   - NO `Math.random()`, NO `Date.now()`, NO env-derived values
 *   - Bumping the `-vN` suffix on a seed string is the deliberate way to regenerate
 *   - Validated by `scripts/build-textures.test.ts` (asserts SHA-256 byte-identical across 2 invocations)
 *
 * Run: `npm run textures`
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { createHash } from 'crypto'

// Pitfall #5 mitigation (Phase 54 carry-forward): force serial sharp execution.
sharp.cache(false)
sharp.concurrency(1)

const CANVAS = { W: 1080, H: 1920 } as const
const OUT_DIR = path.join(process.cwd(), 'public', 'textures')
const OVERLAYS_DIR = path.join(process.cwd(), 'public', 'overlays')

/**
 * Produce a width*height byte buffer of seeded Gaussian-distributed values
 * centered at 128 with the given stdDev (in 0..255 units).
 *
 * Deterministic: same `seedString` → same buffer bytes across any platform.
 *
 * Strategy:
 *   1. Seed the SHA-256 hash chain with the literal string.
 *   2. Each 32-byte digest yields 32 raw bytes; chain by re-hashing the prior digest
 *      until we have width*height bytes.
 *   3. Map each raw byte (uniform 0..255) to a Gaussian-shaped value via a
 *      cheap centered-shift formula:
 *
 *         output = clamp((rawByte - 128) / 255 * 256 * stdDev + 128, 0, 255)
 *
 *      This yields a distribution centered at 128 with controllable spread.
 *      Not a true Gaussian — but visually indistinguishable for grain texture
 *      and fully deterministic.
 */
function noiseBuffer(seedString: string, width: number, height: number, stdDev: number): Buffer {
  const total = width * height
  const out = Buffer.alloc(total)
  let digest = createHash('sha256').update(seedString).digest()
  let cursor = 0
  while (cursor < total) {
    const slice = digest
    for (let i = 0; i < slice.length && cursor < total; i++) {
      const raw = slice[i]
      const shaped = ((raw - 128) / 255) * 256 * (stdDev / 255) * 255 + 128
      const clamped = Math.max(0, Math.min(255, Math.round(shaped)))
      out[cursor++] = clamped
    }
    // Re-hash digest to extend the byte stream deterministically.
    digest = createHash('sha256').update(digest).digest()
  }
  return out
}

/**
 * Generate seeded fiber-streak SVG for paper-texture.
 * Returns a Buffer containing the SVG markup that sharp can composite.
 */
function buildFiberStreaks(seed: string, width: number, height: number): Buffer {
  // Use a small noise buffer to derive 8 deterministic ellipse positions.
  const positionBytes = noiseBuffer(seed + '-streaks', 64, 1, 255)
  const ellipses: string[] = []
  for (let i = 0; i < 8; i++) {
    const cx = Math.round((positionBytes[i * 4] / 255) * width)
    const cy = Math.round((positionBytes[i * 4 + 1] / 255) * height)
    const rx = 60 + Math.round((positionBytes[i * 4 + 2] / 255) * 120)
    const ry = 2 + Math.round((positionBytes[i * 4 + 3] / 255) * 4)
    const rot = Math.round((positionBytes[i * 4] / 255) * 180)
    ellipses.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(50,40,30,0.10)" transform="rotate(${rot} ${cx} ${cy})"/>`,
    )
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${ellipses.join('')}</svg>`
  return Buffer.from(svg)
}

// ──────────────────────────────────────────────────────────────────────────
// Grain PNG builders (5)
// ──────────────────────────────────────────────────────────────────────────

export async function buildGrainSubtle(): Promise<Buffer> {
  const seed = 'gsd-grain-subtle-v1'
  const noise = noiseBuffer(seed, CANVAS.W, CANVAS.H, 0.04 * 255)
  return await sharp(noise, {
    raw: { width: CANVAS.W, height: CANVAS.H, channels: 1 },
  })
    .blur(1)
    .toColorspace('srgb')
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()
}

export async function buildGrainMedium(): Promise<Buffer> {
  const seed = 'gsd-grain-medium-v1'
  const noise = noiseBuffer(seed, CANVAS.W, CANVAS.H, 0.08 * 255)
  return await sharp(noise, {
    raw: { width: CANVAS.W, height: CANVAS.H, channels: 1 },
  })
    .blur(1)
    .toColorspace('srgb')
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()
}

export async function buildGrainHeavy(): Promise<Buffer> {
  const seed = 'gsd-grain-heavy-v1'
  const noise = noiseBuffer(seed, CANVAS.W, CANVAS.H, 0.14 * 255)
  return await sharp(noise, {
    raw: { width: CANVAS.W, height: CANVAS.H, channels: 1 },
  })
    // Contrast +20%: linear(multiplier, offset) where offset shifts black point.
    .linear(1.2, -25.5)
    .toColorspace('srgb')
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()
}

export async function buildPaperTexture(): Promise<Buffer> {
  const seed = 'gsd-paper-texture-v1'
  const noise = noiseBuffer(seed, CANVAS.W, CANVAS.H, 0.06 * 255)

  // Solid #F4EFE3 base canvas
  const base = await sharp({
    create: {
      width: CANVAS.W,
      height: CANVAS.H,
      channels: 4,
      background: { r: 244, g: 239, b: 227, alpha: 1 },
    },
  })
    .png()
    .toBuffer()

  // Low-frequency noise as multiply overlay
  const noiseOverlay = await sharp(noise, {
    raw: { width: CANVAS.W, height: CANVAS.H, channels: 1 },
  })
    .blur(12)
    .toColorspace('srgb')
    .ensureAlpha(0.30)
    .png()
    .toBuffer()

  const streaks = buildFiberStreaks(seed, CANVAS.W, CANVAS.H)

  return await sharp(base)
    .composite([
      { input: noiseOverlay, blend: 'multiply' },
      { input: streaks, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

export async function buildXeroxGrain(): Promise<Buffer> {
  const seed = 'gsd-xerox-grain-v1'
  const noise = noiseBuffer(seed, CANVAS.W, CANVAS.H, 0.50 * 255)
  return await sharp(noise, {
    raw: { width: CANVAS.W, height: CANVAS.H, channels: 1 },
  })
    .median(3)
    .threshold(127)
    .toColorspace('srgb')
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()
}

// ──────────────────────────────────────────────────────────────────────────
// Halftone PNG builders (2) — for public/overlays/
// ──────────────────────────────────────────────────────────────────────────

interface BayerOpts {
  seed: string
  spacing: number
  matrixSize: 4 | 8
}

// Standard 4×4 Bayer matrix (values 0..15) / 16
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

// Standard 8×8 Bayer matrix (values 0..63) / 64
const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

async function buildBayerHalftone(opts: BayerOpts): Promise<Buffer> {
  const { spacing, matrixSize } = opts
  const matrix = matrixSize === 4 ? BAYER_4 : BAYER_8
  const matrixMax = matrixSize * matrixSize
  // RGBA buffer — start fully transparent
  const rawBuf = Buffer.alloc(CANVAS.W * CANVAS.H * 4, 0)

  // Iterate over a grid of dot centers; for each dot, draw a filled circle
  // whose alpha is modulated by the Bayer matrix indexed by (col % size, row % size).
  const radius = Math.max(1, Math.round(spacing * 0.4))
  const radiusSq = radius * radius

  for (let cy = spacing / 2; cy < CANVAS.H; cy += spacing) {
    for (let cx = spacing / 2; cx < CANVAS.W; cx += spacing) {
      const col = Math.floor(cx / spacing) % matrixSize
      const row = Math.floor(cy / spacing) % matrixSize
      const matrixVal = matrix[row][col] // 0..(matrixMax-1)
      // Map matrix value to alpha 60..255 range so even "dim" cells are visible.
      const alpha = Math.round(60 + (matrixVal / (matrixMax - 1)) * 195)

      // Stamp a filled circle at (cx, cy) with the computed alpha.
      const cxR = Math.round(cx)
      const cyR = Math.round(cy)
      const yMin = Math.max(0, cyR - radius)
      const yMax = Math.min(CANVAS.H - 1, cyR + radius)
      const xMin = Math.max(0, cxR - radius)
      const xMax = Math.min(CANVAS.W - 1, cxR + radius)
      for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
          const dy = y - cyR
          const dx = x - cxR
          if (dx * dx + dy * dy <= radiusSq) {
            const idx = (y * CANVAS.W + x) * 4
            // foreground #1A1A1A
            rawBuf[idx + 0] = 26
            rawBuf[idx + 1] = 26
            rawBuf[idx + 2] = 26
            // Take max alpha if overlapping circles touch
            if (alpha > rawBuf[idx + 3]) rawBuf[idx + 3] = alpha
          }
        }
      }
    }
  }

  return await sharp(rawBuf, {
    raw: { width: CANVAS.W, height: CANVAS.H, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

export async function buildHalftoneDotsLight(): Promise<Buffer> {
  return buildBayerHalftone({ seed: 'gsd-halftone-light-v1', spacing: 24, matrixSize: 8 })
}

export async function buildHalftoneDotsDense(): Promise<Buffer> {
  return buildBayerHalftone({ seed: 'gsd-halftone-dense-v1', spacing: 12, matrixSize: 4 })
}

// ──────────────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(OVERLAYS_DIR, { recursive: true })

  const grainTasks: Array<[string, () => Promise<Buffer>]> = [
    ['grain-subtle.png', buildGrainSubtle],
    ['grain-medium.png', buildGrainMedium],
    ['grain-heavy.png', buildGrainHeavy],
    ['paper-texture.png', buildPaperTexture],
    ['xerox-grain.png', buildXeroxGrain],
  ]
  for (const [filename, builder] of grainTasks) {
    const buf = await builder()
    writeFileSync(path.join(OUT_DIR, filename), buf)
    console.log(`[textures] Wrote public/textures/${filename}`)
  }

  const halftoneTasks: Array<[string, () => Promise<Buffer>]> = [
    ['halftone-dots-light.png', buildHalftoneDotsLight],
    ['halftone-dots-dense.png', buildHalftoneDotsDense],
  ]
  for (const [filename, builder] of halftoneTasks) {
    const buf = await builder()
    writeFileSync(path.join(OVERLAYS_DIR, filename), buf)
    console.log(`[textures] Wrote public/overlays/${filename}`)
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
