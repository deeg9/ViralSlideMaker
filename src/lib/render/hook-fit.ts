// Per-template hook auto-fit. Shrinks the hook fontSize as the headline gets
// longer so multi-line hooks stay inside each template's reserved hook zone.
//
// Calibrated per template-font: condensed display fonts (Anton) fit more chars
// per line than proportional sans (Plus Jakarta Sans) at the same px size, so
// each template declares its own thresholds. Templates not in the registry
// keep their declared `hookFontSize` unchanged (auto-opt-out).

type HookFitStep = { maxChars: number; scale: number }
type HookFitSpec = { baseSize: number; steps: HookFitStep[] }

// Curves below assume baseSize equal to the template's declared hookFontSize.
// `steps` are evaluated in order; first step where `len <= maxChars` wins.
// If none match, the last step's scale applies.
const HOOK_FIT_REGISTRY: Record<string, HookFitSpec> = {
  // News templates — Anton (condensed) at 110px on a hookWidth ≈ 78% canvas
  // (842px). Original calibration assumed 2-line wraps were OK; in practice
  // AI-generated segment-rendered hooks don't always wrap inside spans, so
  // single-line widths must fit the container. Tightened thresholds enforce
  // single-line fit at each scale step (rough char-width math: Anton at S px
  // averages ~0.45*S per char; container fits ~842/0.45*S chars = 1871/S).
  // 260503: long-hook step tightened from 0.52 → 0.45 and Infinity from 0.42 →
  // 0.38. At 0.52 (57px) the segment "IS OUTSOURCING THINKING TO" rendered as a
  // single oversized flex item that exceeded the 842px hook container in Satori
  // — Satori does not honor overflow-wrap inside flex items, so the hook content
  // visually overflowed its 60→80% cover zone and crashed into the body text.
  'news-drop': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 32, scale: 0.65 },
      { maxChars: 48, scale: 0.45 },
      { maxChars: Infinity, scale: 0.38 },
    ],
  },
  'news-cyan': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 32, scale: 0.65 },
      { maxChars: 48, scale: 0.45 },
      { maxChars: Infinity, scale: 0.38 },
    ],
  },
  // Premium magazine — Plus Jakarta Sans (proportional, wider) on a tight
  // image-with-bottom-card layout where hook + body share ~40% of canvas
  // height. Tighter curve so 4+-line wraps don't bleed into the body zone.
  'magazine-bold': {
    baseSize: 120,
    steps: [
      { maxChars: 15, scale: 1 },
      { maxChars: 28, scale: 0.7 },
      { maxChars: 42, scale: 0.55 },
      { maxChars: 60, scale: 0.45 },
      { maxChars: Infinity, scale: 0.38 },
    ],
  },
  'tr3nding-news': {
    baseSize: 120,
    steps: [
      { maxChars: 15, scale: 1 },
      { maxChars: 28, scale: 0.7 },
      { maxChars: 42, scale: 0.55 },
      { maxChars: 60, scale: 0.45 },
      { maxChars: Infinity, scale: 0.38 },
    ],
  },
  // documentary — Plus Jakarta Sans, 110px base, hookY 48% / bodyY 62% =
  // tight 269px hook zone. Tightened 2026-05-02 to match news-template
  // calibration so multi-line wraps don't bleed into body.
  'documentary': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 32, scale: 0.65 },
      { maxChars: 48, scale: 0.52 },
      { maxChars: Infinity, scale: 0.42 },
    ],
  },
  // Phase 56 templates.
  // editorial-serif — Lora bold serif, 130px base, inner hookY 48 → bodyY 62
  // (269px). Cover layout is generous (346px) but inner is tightest
  // constraint. Tightened 2026-05-02.
  'editorial-serif': {
    baseSize: 130,
    steps: [
      { maxChars: 13, scale: 1 },
      { maxChars: 22, scale: 0.78 },
      { maxChars: 34, scale: 0.62 },
      { maxChars: 50, scale: 0.5 },
      { maxChars: Infinity, scale: 0.4 },
    ],
  },
  // notes-app-chic — Plus Jakarta Sans + ransom-note multi-fonts. 346px
  // hook zone is generous, but ransom-note widens lines so add safety buffer.
  'notes-app-chic': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 34, scale: 0.65 },
      { maxChars: 50, scale: 0.52 },
      { maxChars: Infinity, scale: 0.42 },
    ],
  },
  // brutalist-grid — Space Grotesk bold, 180px base. Even 10 chars at full
  // size overflows 842px container. Aggressive curve. (Cover layout uses
  // 220px hookFontSize but registry sees template.hookFontSize=180; cover-
  // aware baseSize is a future enhancement.)
  'brutalist-grid': {
    baseSize: 180,
    steps: [
      { maxChars: 8, scale: 1 },
      { maxChars: 14, scale: 0.75 },
      { maxChars: 22, scale: 0.55 },
      { maxChars: 32, scale: 0.42 },
      { maxChars: Infinity, scale: 0.32 },
    ],
  },
}

export function getHookFontSize(
  templateId: string,
  hookText: string | null | undefined,
  baseSize: number,
): number {
  const spec = HOOK_FIT_REGISTRY[templateId]
  if (!spec) return baseSize
  const len = (hookText ?? '').trim().length
  for (const step of spec.steps) {
    if (len <= step.maxChars) return Math.round(baseSize * step.scale)
  }
  return Math.round(baseSize * spec.steps[spec.steps.length - 1].scale)
}

export function hasHookFit(templateId: string): boolean {
  return templateId in HOOK_FIT_REGISTRY
}

// Test-only export so the unit suite can iterate the registry.
export const HOOK_FIT_TEMPLATE_IDS = Object.keys(HOOK_FIT_REGISTRY)

/**
 * quick-260510-export-overlap: cap manual `hook_font_size` overrides in
 * layouts where bodyY is fixed by a preset (NEWS_LAYOUT cover/body).
 *
 * Without this cap, a user-set hook size that exceeds what auto-fit produces
 * causes the hook to wrap into more lines than the (bodyY - hookY) zone can
 * hold, and the export renders hook + body overlapping. (Reproduced on
 * news-cyan cover layout with hook_font_size: 114 — wraps to 5 lines and
 * collides with body at bodyY=84%.)
 *
 * Phase 82 Gap A: the cap is now BODY-AWARE. The overlap rationale above only
 * applies when the slide actually HAS a body — a headline crashing into the
 * body zone. Phase 82 News slides are headline-only (R4 — body_text optional,
 * headline-only is the default), so there is no body zone for the headline to
 * collide with: on those slides the manual size is honored verbatim and the
 * headline can own the whole canvas (the reference news look). The cap only
 * fires for slides that carry body text, and was raised 1.6× → 2.6× so a
 * legitimately large user pick survives instead of being flattened.
 *
 * Both renderers (render-slide-satori.tsx + slide-preview.tsx) call this
 * helper at the same point in the resolution pipeline and MUST pass the same
 * `hasBody` value (TPLREND-05 parity contract — both must produce identical
 * clamped fontSize).
 *
 * Behavior:
 *   - When `hookFit` is unknown for the template, returns `manualSize`
 *     unchanged (templates outside the registry have no calibrated cap).
 *   - When `hasBody` is false (headline-only slide), returns `manualSize`
 *     unchanged — no body zone to collide with.
 *   - When `hookFit` is registered AND `hasBody` is true, allows the manual
 *     override to grow up to MANUAL_GROWTH_MAX × the auto-fit value. Past
 *     that, the hook would wrap into the body zone.
 */
const MANUAL_GROWTH_MAX = 2.6

export function clampManualHookSize(
  manualSize: number,
  templateId: string,
  hookText: string | null | undefined,
  baseSize: number,
  hasBody: boolean,
): number {
  if (!hasHookFit(templateId)) return manualSize
  // Phase 82 Gap A: headline-only slides (no body box) have no body zone for
  // the hook to wrap into — the overlap rationale that motivated the cap does
  // not apply, so the manual size is honored verbatim. The headline can own
  // the whole canvas (the reference news look).
  if (!hasBody) return manualSize
  const autoFit = getHookFontSize(templateId, hookText, baseSize)
  const cap = Math.round(autoFit * MANUAL_GROWTH_MAX)
  return Math.min(manualSize, cap)
}
