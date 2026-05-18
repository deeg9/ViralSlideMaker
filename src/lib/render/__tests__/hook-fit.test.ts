import { describe, it, expect } from 'vitest'
import {
  getHookFontSize,
  hasHookFit,
  HOOK_FIT_TEMPLATE_IDS,
  clampManualHookSize,
  fitHeadlineToBox,
  captionCardBox,
  CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT,
  HEADLINE_FIT_CEILING,
  HEADLINE_FIT_FLOOR,
} from '../hook-fit'
import { templates } from '../templates'
import { resolveCaptionBar } from '../resolve-overlay'
import { magazineBold } from '../templates/magazine-bold'

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
    // 260503: long-hook step tightened to 0.45 / 0.38 — at the previous 0.52
    // (57px) the 27-char segment "IS OUTSOURCING THINKING TO" still rendered
    // wider than the 842px container in Satori, overflowing the cover-layout
    // hook zone and crashing into the body.
    expect(getHookFontSize('news-drop', 'SHORT', 110)).toBe(110) // 5 chars → 1.0
    expect(getHookFontSize('news-drop', 'A'.repeat(14), 110)).toBe(110) // 14 chars → 1.0
    expect(getHookFontSize('news-drop', 'A'.repeat(15), 110)).toBe(88) // 15 chars → 0.80
    expect(getHookFontSize('news-drop', 'A'.repeat(22), 110)).toBe(88) // 22 chars → 0.80
    expect(getHookFontSize('news-drop', 'A'.repeat(23), 110)).toBe(72) // 23 chars → 0.65
    expect(getHookFontSize('news-drop', 'A'.repeat(32), 110)).toBe(72) // 32 chars → 0.65
    expect(getHookFontSize('news-drop', 'A'.repeat(33), 110)).toBe(50) // 33 chars → 0.45
    expect(getHookFontSize('news-drop', 'A'.repeat(48), 110)).toBe(50) // 48 chars → 0.45
    expect(getHookFontSize('news-drop', 'A'.repeat(80), 110)).toBe(42) // 49+ chars → 0.38
    // Real samples from the regression bug report
    expect(getHookFontSize('news-cyan', 'AMAZON FACES PRICE-FIXING ALLEGATIONS', 110)).toBe(50) // 37 chars → 0.45
    expect(getHookFontSize('news-cyan', 'VIRALITY WAS HER ONLY HOPE', 110)).toBe(72) // 26 chars → 0.65
    expect(getHookFontSize('news-cyan', 'THIS IS A HUGE PROBLEM', 110)).toBe(88) // 22 chars → 0.80
    // Regression lock for the original failing case ("YOUR BRAIN IS
    // OUTSOURCING THINKING TO AI" — 41 chars). Must drop below the previous
    // 57px so the long inner segment fits the 842px container in Satori.
    expect(getHookFontSize('news-cyan', 'YOUR BRAIN IS OUTSOURCING THINKING TO AI', 110)).toBe(50)
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

  // quick-260510-export-overlap regression: a too-big manual hook_font_size on
  // a news layout must be clamped so hook + body don't overlap in export.
  // Real reported bug: news-cyan cover, hook "YOUR BRAIN IS OUTSOURCING
  // THINKING TO AI" (40 chars), manual hook_font_size: 114 → wraps to 5 lines
  // and collides with body at bodyY=83%. autoFit returns 50.
  //
  // Phase 82 Gap A: the cap is now body-aware (5th arg `hasBody`). It only
  // fires for slides that carry body text, and the multiplier was raised
  // 1.6× → 2.6×. The clamp cases below pass `hasBody = true`.
  describe('clampManualHookSize (hasBody = true — overlap-protected)', () => {
    it('passes through manual size unchanged for templates without hook-fit', () => {
      expect(clampManualHookSize(120, 'highlight-bar', 'anything', 88, true)).toBe(120)
      expect(clampManualHookSize(200, 'y2k-pop', 'anything', 96, true)).toBe(200)
    })

    it('clamps oversized manual size on news templates with long hook', () => {
      // news-cyan, 40-char hook → autoFit step 0.45 → 50px. Cap = round(2.6 × 50) = 130.
      expect(
        clampManualHookSize(300, 'news-cyan', 'YOUR BRAIN IS OUTSOURCING THINKING TO AI', 110, true),
      ).toBe(130)
      // news-drop, same pattern.
      expect(clampManualHookSize(300, 'news-drop', 'A'.repeat(40), 110, true)).toBe(130)
    })

    it('leaves manual size unchanged when below the clamp', () => {
      // news-cyan, 40 chars: cap = 130. Manual 64 < 130 → passthrough.
      expect(
        clampManualHookSize(64, 'news-cyan', 'YOUR BRAIN IS OUTSOURCING THINKING TO AI', 110, true),
      ).toBe(64)
    })

    it('scales with autoFit per template (short hooks get higher cap)', () => {
      // news-drop, 14-char hook → autoFit 110px. Cap = round(2.6 × 110) = 286.
      // Manual 350 > 286 → clamped to 286.
      expect(clampManualHookSize(350, 'news-drop', 'A'.repeat(14), 110, true)).toBe(286)
      // Manual 150 < 286 → passthrough.
      expect(clampManualHookSize(150, 'news-drop', 'A'.repeat(14), 110, true)).toBe(150)
    })
  })

  // Phase 82 Gap A — headline-only news slides (no body box) must NOT be
  // capped: the overlap rationale that motivated the cap does not apply when
  // there is no body zone. clampManualHookSize returns the manual size verbatim
  // when hasBody === false, so a user entering 190 vs 290 in the editor gets
  // genuinely distinct rendered sizes and the headline can dominate the slide.
  describe('clampManualHookSize — Phase 82 Gap A (hasBody = false)', () => {
    it('does NOT cap a headline-only news slide — large size honored verbatim', () => {
      // news-cyan, registered hook-fit template. hasBody=false → no clamp.
      expect(
        clampManualHookSize(290, 'news-cyan', 'MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS', 110, false),
      ).toBe(290)
      // 190 and 290 must render distinctly — the Gap A defect was both
      // collapsing to the same 1.6× value.
      expect(
        clampManualHookSize(190, 'news-cyan', 'MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS', 110, false),
      ).toBe(190)
    })

    it('still clamps the SAME slide when hasBody = true', () => {
      // Same template + hook, hasBody=true → cap = round(2.6 × autoFit) applies.
      const capped = clampManualHookSize(
        290, 'news-cyan', 'MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS', 110, true,
      )
      expect(capped).toBeLessThan(290)
    })

    it('passes through unregistered templates regardless of hasBody', () => {
      // hasHookFit() false → manualSize unchanged whether hasBody true or false.
      expect(clampManualHookSize(300, 'y2k-pop', 'anything', 96, false)).toBe(300)
      expect(clampManualHookSize(300, 'y2k-pop', 'anything', 96, true)).toBe(300)
    })
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

// =====================================================================
// Phase 82 Gap D — fitHeadlineToBox + captionCardBox auto-fit.
// =====================================================================
describe('fitHeadlineToBox + captionCardBox — Phase 82 Gap D', () => {
  // The default news hook box from promote-news-headline.ts.
  const NEWS_BOX = { widthPx: 842, heightPx: 620 }
  // Conservative char advance — must match CONDENSED_CHAR_ADVANCE in hook-fit.ts.
  const CHAR_ADVANCE = 0.5

  it('returns an integer within [FLOOR, CEILING] for any headline', () => {
    for (const hook of ['BREAKING', 'MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS', '']) {
      const size = fitHeadlineToBox(hook, NEWS_BOX)
      expect(Number.isInteger(size)).toBe(true)
      expect(size).toBeGreaterThanOrEqual(HEADLINE_FIT_FLOOR)
      expect(size).toBeLessThanOrEqual(HEADLINE_FIT_CEILING)
    }
  })

  it('a short headline fits at a large near-ceiling size', () => {
    expect(fitHeadlineToBox('BREAKING', NEWS_BOX)).toBeGreaterThanOrEqual(200)
  })

  it('a long headline gets a smaller size that does NOT overflow the box width', () => {
    const longHook = 'MAJOR TECH COMPANY ANNOUNCES 19,000 LAYOFFS'
    const size = fitHeadlineToBox(longHook, NEWS_BOX)
    expect(size).toBeLessThan(fitHeadlineToBox('BREAKING', NEWS_BOX))
    expect(size).toBeLessThanOrEqual(HEADLINE_FIT_CEILING)
    // Gap-D regression: the longest word at the fitted size must not exceed
    // the box width — no word would ever need a mid-word break.
    const longestWordLen = longHook
      .trim()
      .split(/\s+/)
      .reduce((m, w) => Math.max(m, w.length), 0)
    expect(longestWordLen * size * CHAR_ADVANCE).toBeLessThanOrEqual(NEWS_BOX.widthPx)
  })

  it('is monotonic — a longer headline never returns a larger size', () => {
    const a = fitHeadlineToBox('AI', NEWS_BOX)
    const b = fitHeadlineToBox('AI SHIFT HITS HARD', NEWS_BOX)
    const c = fitHeadlineToBox('AI SHIFT HITS HARD ACROSS THE ENTIRE TECH SECTOR NATIONWIDE', NEWS_BOX)
    expect(b).toBeLessThanOrEqual(a)
    expect(c).toBeLessThanOrEqual(b)
  })

  it('captionCardBox derives widthPx from the card width but heightPx from the FIXED reference height', () => {
    // quick-260518-ch8: captionCardBox's heightPx is NO LONGER coupled to the
    // user-controlled caption_bar_height_pct — it uses a fixed 38% reference so
    // the Height slider cannot resize the headline. Only the width is coupled.
    const resolved = resolveCaptionBar(
      {
        caption_bar_enabled: true,
        caption_bar_width: 90,
        caption_bar_height_pct: 30,
      },
      magazineBold,
    )
    const box = captionCardBox(resolved)
    // widthPx: 90% of 1080 minus 2*80 inset — still coupled to caption_bar_width.
    expect(box.widthPx).toBeCloseTo(0.9 * 1080 - 160, 0)
    // heightPx: derived from the FIXED 38% reference (NOT the 30% override).
    expect(box.heightPx).toBeCloseTo((CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT / 100) * 1920 - 160, 0)
    expect(box.widthPx).toBeGreaterThanOrEqual(1)
    expect(box.heightPx).toBeGreaterThanOrEqual(1)
  })

  it('captionCardBox heightPx is INVARIANT to caption_bar_height_pct', () => {
    // The Height slider must not change the fit box's heightPx — every height
    // from the 10% floor to the 90% ceiling yields the same heightPx.
    const heights = [10, 30, 38, 60, 90].map((heightPct) => {
      const resolved = resolveCaptionBar(
        { caption_bar_enabled: true, caption_bar_width: 90, caption_bar_height_pct: heightPct },
        magazineBold,
      )
      return captionCardBox(resolved).heightPx
    })
    for (const h of heights) {
      expect(h).toBe(heights[0])
    }
  })

  it('a narrower caption card fits a headline smaller than the default news box (WIDTH coupling kept)', () => {
    // Phase 82 width/overflow safety — a narrow card must still shrink the
    // headline so it never overflows the card horizontally / breaks mid-word.
    const resolved = resolveCaptionBar(
      {
        caption_bar_enabled: true,
        caption_bar_width: 50,
      },
      magazineBold,
    )
    const hook = 'MAJOR TECH COMPANY ANNOUNCES 19,000 LAYOFFS'
    const fitToCard = fitHeadlineToBox(hook, captionCardBox(resolved))
    const fitToNewsBox = fitHeadlineToBox(hook, NEWS_BOX)
    expect(fitToCard).toBeLessThan(fitToNewsBox)
  })
})
