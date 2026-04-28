// Shared char-count-based scaler for the news templates' giant hook headlines.
//
// News Drop / News Cyan use textPosition: 'bottom' + cover layout (body at y=80%),
// leaving ~20% of canvas height for the hook before it overlaps the body line.
// At the default 110px Anton, anything past ~2 lines pushes into the body zone.
// This scaler shrinks the hook size as the hook text gets longer so multi-line
// headlines stay inside the hook zone.

const NEWS_TEMPLATE_IDS = new Set(['news-drop', 'news-cyan'])

export function isNewsTemplate(templateId: string): boolean {
  return NEWS_TEMPLATE_IDS.has(templateId)
}

// baseSize is the template's default hookFontSize in px (typically 110).
export function getNewsHookFontSize(hookText: string, baseSize: number): number {
  const len = (hookText ?? '').trim().length
  if (len <= 22) return baseSize
  if (len <= 44) return Math.round(baseSize * 0.80)
  if (len <= 66) return Math.round(baseSize * 0.64)
  return Math.round(baseSize * 0.52)
}
