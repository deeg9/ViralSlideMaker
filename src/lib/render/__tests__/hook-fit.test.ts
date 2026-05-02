import { describe, it, expect } from 'vitest'
import { getHookFontSize, hasHookFit, HOOK_FIT_TEMPLATE_IDS } from '../hook-fit'
import { templates } from '../templates'

describe('hook-fit registry', () => {
  it('returns base size unchanged for unregistered templates', () => {
    expect(getHookFontSize('highlight-bar', 'A long enough hook to scale', 88)).toBe(88)
    expect(getHookFontSize('y2k-pop', '', 96)).toBe(96)
    expect(getHookFontSize('not-a-template', 'anything', 64)).toBe(64)
  })

  it('hasHookFit gates auto-fit per template', () => {
    expect(hasHookFit('news-drop')).toBe(true)
    expect(hasHookFit('magazine-bold')).toBe(true)
    expect(hasHookFit('editorial-serif')).toBe(true)
    expect(hasHookFit('brutalist-grid')).toBe(true)
    expect(hasHookFit('highlight-bar')).toBe(false)
    expect(hasHookFit('y2k-pop')).toBe(false)
    expect(hasHookFit('bold-yellow')).toBe(false)
  })

  it('preserves news template thresholds (v2.7 quick-task calibration)', () => {
    // baseSize 110 — original Anton calibration unchanged.
    expect(getHookFontSize('news-drop', 'SHORT', 110)).toBe(110) // 5 chars → 1.0
    expect(getHookFontSize('news-drop', 'A'.repeat(22), 110)).toBe(110) // 22 chars → 1.0
    expect(getHookFontSize('news-drop', 'A'.repeat(23), 110)).toBe(88) // 23 chars → 0.80
    expect(getHookFontSize('news-drop', 'A'.repeat(44), 110)).toBe(88) // 44 chars → 0.80
    expect(getHookFontSize('news-drop', 'A'.repeat(45), 110)).toBe(70) // 45 chars → 0.64
    expect(getHookFontSize('news-drop', 'A'.repeat(67), 110)).toBe(57) // 67+ chars → 0.52
    expect(getHookFontSize('news-cyan', 'AMAZON FACES PRICE-FIXING ALLEGATIONS', 110)).toBe(88)
  })

  it('scales premium template hooks (Plus Jakarta Sans, tighter curve for bottom-card layouts)', () => {
    // magazine-bold + tr3nding-news baseSize 120
    expect(getHookFontSize('magazine-bold', 'A'.repeat(15), 120)).toBe(120) // 1.0
    expect(getHookFontSize('magazine-bold', 'A'.repeat(28), 120)).toBe(84) // 0.70
    expect(getHookFontSize('magazine-bold', 'A'.repeat(42), 120)).toBe(66) // 0.55
    expect(getHookFontSize('magazine-bold', 'A'.repeat(60), 120)).toBe(54) // 0.45
    expect(getHookFontSize('magazine-bold', 'A'.repeat(80), 120)).toBe(46) // 0.38

    // documentary baseSize 110
    expect(getHookFontSize('documentary', 'A'.repeat(20), 110)).toBe(110) // 1.0
    expect(getHookFontSize('documentary', 'A'.repeat(38), 110)).toBe(88) // 0.80
  })

  it('scales Phase 56 templates with their own curves', () => {
    // editorial-serif baseSize 130
    expect(getHookFontSize('editorial-serif', 'A'.repeat(16), 130)).toBe(130) // 1.0
    expect(getHookFontSize('editorial-serif', 'A'.repeat(30), 130)).toBe(101) // 0.78
    expect(getHookFontSize('editorial-serif', 'A'.repeat(48), 130)).toBe(81) // 0.62
    expect(getHookFontSize('editorial-serif', 'A'.repeat(80), 130)).toBe(65) // 0.50

    // notes-app-chic baseSize 110
    expect(getHookFontSize('notes-app-chic', 'A'.repeat(20), 110)).toBe(110)
    expect(getHookFontSize('notes-app-chic', 'A'.repeat(38), 110)).toBe(88)

    // brutalist-grid baseSize 180 — tightest curve due to 180px+ sizes
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(10), 180)).toBe(180) // 1.0
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(20), 180)).toBe(135) // 0.75
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(32), 180)).toBe(99) // 0.55
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(50), 180)).toBe(76) // 0.42
  })

  it('handles null/undefined/empty hook text safely', () => {
    expect(getHookFontSize('news-drop', null, 110)).toBe(110)
    expect(getHookFontSize('news-drop', undefined, 110)).toBe(110)
    expect(getHookFontSize('news-drop', '', 110)).toBe(110)
    expect(getHookFontSize('news-drop', '   ', 110)).toBe(110) // trim + len 0
  })

  // Regression guard — every template's actual sample.hook_text must resolve
  // to a font size that is no larger than the template's declared
  // hookFontSize. Catches future sample-text changes that would re-introduce
  // the v2.9 overflow bug in picker thumbnails.
  it('every registered template sample fits within its base size', () => {
    for (const tplId of HOOK_FIT_TEMPLATE_IDS) {
      const tpl = templates.find((t) => t.id === tplId)
      expect(tpl, `template ${tplId} must exist in registry`).toBeDefined()
      if (!tpl) continue
      const sampleHook = tpl.sample?.hook_text ?? ''
      const baseSize = parseInt(tpl.hookFontSize, 10)
      const fittedSize = getHookFontSize(tplId, sampleHook, baseSize)
      expect(fittedSize).toBeLessThanOrEqual(baseSize)
      expect(fittedSize).toBeGreaterThan(0)
    }
  })
})
