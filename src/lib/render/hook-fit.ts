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
  'news-drop': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 32, scale: 0.65 },
      { maxChars: 48, scale: 0.52 },
      { maxChars: Infinity, scale: 0.42 },
    ],
  },
  'news-cyan': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 32, scale: 0.65 },
      { maxChars: 48, scale: 0.52 },
      { maxChars: Infinity, scale: 0.42 },
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
  'documentary': {
    baseSize: 110,
    steps: [
      { maxChars: 20, scale: 1 },
      { maxChars: 38, scale: 0.8 },
      { maxChars: 60, scale: 0.64 },
      { maxChars: Infinity, scale: 0.52 },
    ],
  },
  // Phase 56 templates.
  'editorial-serif': {
    baseSize: 130,
    steps: [
      { maxChars: 16, scale: 1 },
      { maxChars: 30, scale: 0.78 },
      { maxChars: 48, scale: 0.62 },
      { maxChars: Infinity, scale: 0.5 },
    ],
  },
  'notes-app-chic': {
    baseSize: 110,
    steps: [
      { maxChars: 20, scale: 1 },
      { maxChars: 38, scale: 0.8 },
      { maxChars: 60, scale: 0.64 },
      { maxChars: Infinity, scale: 0.52 },
    ],
  },
  // Brutalist hits 180/220px — even short headlines need aggressive scaling.
  'brutalist-grid': {
    baseSize: 180,
    steps: [
      { maxChars: 10, scale: 1 },
      { maxChars: 20, scale: 0.75 },
      { maxChars: 32, scale: 0.55 },
      { maxChars: Infinity, scale: 0.42 },
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
