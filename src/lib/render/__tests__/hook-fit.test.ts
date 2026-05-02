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

  it('news templates fit single-line into 78%-canvas hook container', () => {
    // baseSize 110 — re-tightened 2026-05-02 to enforce single-line fit so
    // AI-generated segment hooks don't bleed past the canvas.
    expect(getHookFontSize('news-drop', 'SHORT', 110)).toBe(110) // 5 chars → 1.0
    expect(getHookFontSize('news-drop', 'A'.repeat(14), 110)).toBe(110) // 14 chars → 1.0
    expect(getHookFontSize('news-drop', 'A'.repeat(15), 110)).toBe(88) // 15 chars → 0.80
    expect(getHookFontSize('news-drop', 'A'.repeat(22), 110)).toBe(88) // 22 chars → 0.80
    expect(getHookFontSize('news-drop', 'A'.repeat(23), 110)).toBe(72) // 23 chars → 0.65
    expect(getHookFontSize('news-drop', 'A'.repeat(32), 110)).toBe(72) // 32 chars → 0.65
    expect(getHookFontSize('news-drop', 'A'.repeat(33), 110)).toBe(57) // 33 chars → 0.52
    expect(getHookFontSize('news-drop', 'A'.repeat(48), 110)).toBe(57) // 48 chars → 0.52
    expect(getHookFontSize('news-drop', 'A'.repeat(80), 110)).toBe(46) // 49+ chars → 0.42
    // Real samples from the regression bug report
    expect(getHookFontSize('news-cyan', 'AMAZON FACES PRICE-FIXING ALLEGATIONS', 110)).toBe(57) // 37 chars → 0.52
    expect(getHookFontSize('news-cyan', 'VIRALITY WAS HER ONLY HOPE', 110)).toBe(72) // 26 chars → 0.65
    expect(getHookFontSize('news-cyan', 'THIS IS A HUGE PROBLEM', 110)).toBe(88) // 22 chars → 0.80
  })

  it('scales premium template hooks (Plus Jakarta Sans, tighter curve for bottom-card layouts)', () => {
    // magazine-bold + tr3nding-news baseSize 120
    expect(getHookFontSize('magazine-bold', 'A'.repeat(15), 120)).toBe(120) // 1.0
    expect(getHookFontSize('magazine-bold', 'A'.repeat(28), 120)).toBe(84) // 0.70
    expect(getHookFontSize('magazine-bold', 'A'.repeat(42), 120)).toBe(66) // 0.55
    expect(getHookFontSize('magazine-bold', 'A'.repeat(60), 120)).toBe(54) // 0.45
    expect(getHookFontSize('magazine-bold', 'A'.repeat(80), 120)).toBe(46) // 0.38

    // documentary baseSize 110 — re-tightened 2026-05-02 to match
    // news-template calibration (842px container, 269px hook zone).
    expect(getHookFontSize('documentary', 'A'.repeat(14), 110)).toBe(110) // 1.0
    expect(getHookFontSize('documentary', 'A'.repeat(22), 110)).toBe(88) // 0.80
    expect(getHookFontSize('documentary', 'A'.repeat(32), 110)).toBe(72) // 0.65
    expect(getHookFontSize('documentary', 'A'.repeat(48), 110)).toBe(57) // 0.52
    expect(getHookFontSize('documentary', 'A'.repeat(80), 110)).toBe(46) // 0.42
  })

  it('scales Phase 56 templates with their own curves', () => {
    // editorial-serif baseSize 130 — re-tightened 2026-05-02 (Lora bold serif,
    // 269px inner hook zone forces stricter curve)
    expect(getHookFontSize('editorial-serif', 'A'.repeat(13), 130)).toBe(130) // 1.0
    expect(getHookFontSize('editorial-serif', 'A'.repeat(22), 130)).toBe(101) // 0.78
    expect(getHookFontSize('editorial-serif', 'A'.repeat(34), 130)).toBe(81) // 0.62
    expect(getHookFontSize('editorial-serif', 'A'.repeat(50), 130)).toBe(65) // 0.50
    expect(getHookFontSize('editorial-serif', 'A'.repeat(80), 130)).toBe(52) // 0.40

    // notes-app-chic baseSize 110 — re-tightened 2026-05-02 (ransom-note
    // multi-fonts widen lines, so curve mirrors documentary)
    expect(getHookFontSize('notes-app-chic', 'A'.repeat(14), 110)).toBe(110)
    expect(getHookFontSize('notes-app-chic', 'A'.repeat(22), 110)).toBe(88)
    expect(getHookFontSize('notes-app-chic', 'A'.repeat(34), 110)).toBe(72)
    expect(getHookFontSize('notes-app-chic', 'A'.repeat(50), 110)).toBe(57)

    // brutalist-grid baseSize 180 — re-tightened 2026-05-02 (most exposed
    // template; even 8 chars at full size already overflows 842px)
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(8), 180)).toBe(180) // 1.0
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(14), 180)).toBe(135) // 0.75
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(22), 180)).toBe(99) // 0.55
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(32), 180)).toBe(76) // 0.42
    expect(getHookFontSize('brutalist-grid', 'A'.repeat(50), 180)).toBe(58) // 0.32
  })

  // Real-sample regression locks — these are each template's actual
  // sample.hook_text (the text the picker thumbnail renders). Locking
  // their resolved font sizes catches the next time someone changes a
  // sample without re-checking the curve.
  it('locks resolved font size for each template sample', () => {
    expect(getHookFontSize('documentary', 'The Last Glassblower of Murano', 110)).toBe(72) // 30 chars
    expect(
      getHookFontSize('editorial-serif', 'The quietest revolutions begin in living rooms', 130),
    ).toBe(65) // 46 chars
    expect(getHookFontSize('notes-app-chic', 'I quit my job to sell paintings', 110)).toBe(72) // 31 chars
    expect(getHookFontSize('brutalist-grid', 'NO HEADLINES. JUST TYPE.', 180)).toBe(76) // 24 chars
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
