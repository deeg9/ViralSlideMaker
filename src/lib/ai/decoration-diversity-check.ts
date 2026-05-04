// Phase 71 (AI-05): advisory monoculture gate for AI-emitted decorations.
//
// Mirrors v2.9 hookOpeningTrigram diversity advisory pattern (D-14):
// metric runs and emits console.warn on threshold trip; CI is NEVER failed
// in v2.12. v3.0+ may promote to retry-on-detection or fail-CI by importing
// DEFAULT_MONOCULTURE_THRESHOLD and asserting against it.
//
// Per-discriminator frequency: icons and shapes are independent populations
// (a 4/4 icon dominance does NOT compare against shape population, and vice
// versa). The function is pure and deterministic except for the side-effect
// console.warn — suitable for both ingest-time advisory call (Plan 71-01
// generate-slides.ts) and ad-hoc auditing.
//
// Cross-refs:
// - Plan 71-01: resolved decorations[] feed into this check post-ingest
// - v2.9 D-14: src/lib/ai/__tests__/diversity.test.ts (advisory pattern)
// - v3.0+ promote-to-fail anchor: import DEFAULT_MONOCULTURE_THRESHOLD

/**
 * Default ≥60% dominance threshold for advisory monoculture warning.
 * Exported so v3.0+ promotion to retry-on-detection or fail-CI can import
 * and assert against this constant rather than redefining the value.
 */
export const DEFAULT_MONOCULTURE_THRESHOLD = 0.6

export interface DiversityCheckResult {
  /** True iff a single name/kind exceeded the threshold and warn was logged. */
  warned: boolean
  /** Which discriminator dominated when warned === true. */
  dominantKind?: 'icon' | 'shape'
  /** lucideName when dominantKind === 'icon'. */
  dominantName?: string
  /** shapeKind when dominantKind === 'shape'. */
  dominantShapeKind?: string
  /** Number of decorations matching the dominant name/kind. */
  dominantCount?: number
  /** Total decorations in the dominant population (icons OR shapes). */
  total?: number
  /** Share = dominantCount / total, in [0..1]. */
  share?: number
}

export interface DiversityCheckOpts {
  /** Override the default 0.60 threshold. Useful for tests + v3.0+ tuning. */
  threshold?: number
  /** Optional carousel id — appears in the warn message for log triage. */
  carouselId?: string
}

interface IconDecorationLike {
  kind: 'icon'
  lucideName: string
}

interface ShapeDecorationLike {
  kind: 'shape'
  shapeKind: string
}

function isIconDecoration(d: unknown): d is IconDecorationLike {
  return (
    typeof d === 'object' &&
    d !== null &&
    (d as { kind?: unknown }).kind === 'icon' &&
    typeof (d as { lucideName?: unknown }).lucideName === 'string' &&
    (d as { lucideName: string }).lucideName.length > 0
  )
}

function isShapeDecoration(d: unknown): d is ShapeDecorationLike {
  return (
    typeof d === 'object' &&
    d !== null &&
    (d as { kind?: unknown }).kind === 'shape' &&
    typeof (d as { shapeKind?: unknown }).shapeKind === 'string' &&
    (d as { shapeKind: string }).shapeKind.length > 0
  )
}

// Use a broad shape so callers can pass any slide-like object whose
// `decorations` field (when present) is an array. We never require the field
// to exist — slides without decorations contribute 0 to the populations.
type SlideLike = {
  readonly decorations?: unknown
} & Record<string, unknown>

interface Dominance {
  name: string
  count: number
  total: number
  share: number
}

function dominance(freq: Map<string, number>): Dominance | null {
  let total = 0
  let topName = ''
  let topCount = 0
  for (const [name, count] of freq) {
    total += count
    if (count > topCount) {
      topCount = count
      topName = name
    }
  }
  if (total === 0) return null
  return { name: topName, count: topCount, total, share: topCount / total }
}

/**
 * Walk all slides; build per-discriminator (icon-lucideName + shape-shapeKind)
 * frequency maps; if any single name/kind ≥ threshold (default 60%), log a
 * console.warn and return a populated DiversityCheckResult. Otherwise return
 * { warned: false }.
 *
 * ADVISORY ONLY in v2.12 — never throws, never fails CI. Promote in v3.0+
 * by asserting against DEFAULT_MONOCULTURE_THRESHOLD.
 */
export function decorationDiversityCheck(
  slides: ReadonlyArray<SlideLike>,
  opts: DiversityCheckOpts = {},
): DiversityCheckResult {
  const threshold = opts.threshold ?? DEFAULT_MONOCULTURE_THRESHOLD

  const iconFreq = new Map<string, number>()
  const shapeFreq = new Map<string, number>()

  for (const slide of slides) {
    const decorations = slide?.decorations
    if (!Array.isArray(decorations)) continue
    for (const d of decorations) {
      if (isIconDecoration(d)) {
        iconFreq.set(d.lucideName, (iconFreq.get(d.lucideName) ?? 0) + 1)
      } else if (isShapeDecoration(d)) {
        shapeFreq.set(d.shapeKind, (shapeFreq.get(d.shapeKind) ?? 0) + 1)
      }
      // else: graceful skip — never throws on malformed entries
    }
  }

  const iconDom = dominance(iconFreq)
  const shapeDom = dominance(shapeFreq)

  type Candidate = Dominance & { kind: 'icon' | 'shape' }
  const candidates: Candidate[] = []
  if (iconDom) candidates.push({ kind: 'icon', ...iconDom })
  if (shapeDom) candidates.push({ kind: 'shape', ...shapeDom })

  const triggered = candidates.find((c) => c.share >= threshold)
  if (!triggered) return { warned: false }

  const carouselTag = opts.carouselId ? ` carousel=${opts.carouselId}` : ''
  const labelKey = triggered.kind === 'icon' ? 'lucideName' : 'shapeKind'
  console.warn(
    `[decoration-diversity]${carouselTag} ${labelKey}='${triggered.name}' dominance ${(
      triggered.share * 100
    ).toFixed(1)}% (${triggered.count}/${triggered.total}) >= threshold ${(threshold * 100).toFixed(0)}% — ADVISORY (does not fail CI in v2.12)`,
  )

  if (triggered.kind === 'icon') {
    return {
      warned: true,
      dominantKind: 'icon',
      dominantName: triggered.name,
      dominantCount: triggered.count,
      total: triggered.total,
      share: triggered.share,
    }
  }
  return {
    warned: true,
    dominantKind: 'shape',
    dominantShapeKind: triggered.name,
    dominantCount: triggered.count,
    total: triggered.total,
    share: triggered.share,
  }
}
