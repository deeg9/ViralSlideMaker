/**
 * Carousel output formats — the SINGLE source of truth for slide canvas
 * dimensions across every render path (Satori PNG export, HTML export, React
 * preview) and every endpoint.
 *
 * A carousel renders at one of three formats:
 *   - tiktok    1080×1920 (9:16) — TikTok full-screen vertical (the legacy size)
 *   - instagram 1080×1350 (4:5)  — Instagram feed carousel (the 2026 standard)
 *   - square    1080×1080 (1:1)  — universal, crops on no platform
 *
 * WIDTH IS ALWAYS 1080 — only the canvas HEIGHT varies. Every renderer derives
 * its width from REF_WIDTH=1080 and its height from the active format.
 *
 * BACK-COMPAT CONTRACT: `tiktok` equals the old hardcoded 1080×1920 constants
 * and `heightScale(tiktok) === 1` exactly, so every render function that
 * defaults its `format` param to `CAROUSEL_FORMATS.tiktok` stays byte-identical
 * to its pre-change behavior. A NULL/absent `projects.output_format` column
 * resolves to `tiktok` via `resolveFormat`, so every carousel created before
 * this feature is visually unchanged.
 *
 * Pure module — no React/DOM/Node deps. Safe to import on server and client.
 */

export type CarouselFormatId = 'tiktok' | 'instagram' | 'square'

export interface CarouselFormat {
  id: CarouselFormatId
  /** Canvas width in px. Always 1080 — kept on the object for call-site clarity. */
  w: number
  /** Canvas height in px. */
  h: number
  /** Human label for the picker UI. */
  label: string
  /** Aspect-ratio label for the picker UI (e.g. '9:16'). */
  ratioLabel: string
}

export const CAROUSEL_FORMATS: Record<CarouselFormatId, CarouselFormat> = {
  tiktok: { id: 'tiktok', w: 1080, h: 1920, label: 'TikTok', ratioLabel: '9:16' },
  instagram: { id: 'instagram', w: 1080, h: 1350, label: 'Instagram', ratioLabel: '4:5' },
  square: { id: 'square', w: 1080, h: 1080, label: 'Square', ratioLabel: '1:1' },
}

/** All valid format ids — used for server-side validation of stored values. */
export const CAROUSEL_FORMAT_IDS = Object.keys(CAROUSEL_FORMATS) as CarouselFormatId[]

/** Default for a brand-new carousel — Instagram-compatible out of the box. */
export const DEFAULT_FORMAT_NEW: CarouselFormatId = 'instagram'

/** Default for a legacy carousel (NULL `output_format`) — the historical size. */
export const DEFAULT_FORMAT_LEGACY: CarouselFormatId = 'tiktok'

/** Reference canvas height that absolute-pixel font sizes are calibrated to. */
export const REFERENCE_HEIGHT = 1920

/**
 * Resolve a raw stored value (the `projects.output_format` column) to a
 * CarouselFormat. NULL / undefined / unknown all resolve to `tiktok` — the
 * legacy contract — so a pre-feature row or a hand-edited value never crashes
 * a render.
 */
export function resolveFormat(raw: string | null | undefined): CarouselFormat {
  // `CAROUSEL_FORMAT_IDS.includes` — NOT the `in` operator — so a hand-edited
  // value like '__proto__' (which `in` finds on the prototype chain) falls
  // through to the legacy default instead of resolving to a junk object.
  if (raw && (CAROUSEL_FORMAT_IDS as string[]).includes(raw)) {
    return CAROUSEL_FORMATS[raw as CarouselFormatId]
  }
  return CAROUSEL_FORMATS[DEFAULT_FORMAT_LEGACY]
}

/**
 * Resolve a download-time format, honoring an explicit `?format=` override.
 *
 * A valid override id (from the Export dialog's `?format=` query param) wins;
 * anything else — null, undefined, a junk string — falls back to the project's
 * own stored format via `resolveFormat`. This lets one carousel be exported at
 * any aspect ratio (TikTok / Instagram / Square) without mutating the
 * project's `output_format`. When no override is passed the result is
 * byte-identical to `resolveFormat(stored)`, so existing callers are unaffected.
 */
export function resolveFormatWithOverride(
  override: string | null | undefined,
  stored: string | null | undefined,
): CarouselFormat {
  if (override && (CAROUSEL_FORMAT_IDS as string[]).includes(override)) {
    return CAROUSEL_FORMATS[override as CarouselFormatId]
  }
  return resolveFormat(stored)
}

/**
 * Height scale factor relative to the 1920 reference: 1 for tiktok, 0.703 for
 * instagram, 0.5625 for square. Applied to absolute-pixel font sizes and
 * pixel overlay offsets so a shorter canvas stays proportional and
 * collision-free. `heightScale(tiktok) === 1` exactly — a no-op for legacy.
 */
export function heightScale(fmt: CarouselFormat): number {
  return fmt.h / REFERENCE_HEIGHT
}

/**
 * Scale an absolute-pixel value (a font size, a pixel overlay offset) by the
 * format's height ratio. For `tiktok` the scale is exactly 1 — the input is
 * returned UNCHANGED with no rounding, so byte-identity holds even for a
 * non-integer stored size. For shorter canvases the result is rounded.
 */
export function scaleFontPx(px: number, fmt: CarouselFormat): number {
  const scale = heightScale(fmt)
  if (scale === 1) return px
  return Math.round(px * scale)
}
