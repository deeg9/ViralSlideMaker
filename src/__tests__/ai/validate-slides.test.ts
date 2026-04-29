import { describe, it, expect } from 'vitest'
import {
  wordCount,
  isPremiumTemplate,
  detectOverflows,
  detectOrphans,
  detectTypos,
  validateAndRepair,
} from '@/lib/ai/validate-slides'

describe('wordCount', () => {
  it("returns 4 for 'FOLK SINGER FIGHTS BACK'", () => {
    expect(wordCount('FOLK SINGER FIGHTS BACK')).toBe(4)
  })

  it('collapses multiple/leading/trailing whitespace', () => {
    expect(wordCount('  multiple   spaces  here ')).toBe(3)
  })

  it('returns 0 for the empty string', () => {
    expect(wordCount('')).toBe(0)
  })

  it("counts '$50M' as one word ('STARTUP RAISES $50M IN 12 MINUTES' === 6)", () => {
    expect(wordCount('STARTUP RAISES $50M IN 12 MINUTES')).toBe(6)
  })

  it("counts hyphenated words as one ('state-of-the-art breakthrough' === 2)", () => {
    expect(wordCount('state-of-the-art breakthrough')).toBe(2)
  })
})

describe('isPremiumTemplate', () => {
  it("returns true for 'magazine-bold'", () => {
    expect(isPremiumTemplate('magazine-bold')).toBe(true)
  })

  it("returns true for 'tr3nding-news'", () => {
    expect(isPremiumTemplate('tr3nding-news')).toBe(true)
  })

  it("returns true for 'documentary'", () => {
    expect(isPremiumTemplate('documentary')).toBe(true)
  })

  it("returns false for legacy template id 'highlight-bar'", () => {
    expect(isPremiumTemplate('highlight-bar')).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isPremiumTemplate(undefined)).toBe(false)
  })
})

describe('detectOverflows', () => {
  it('returns [] when all slides are under cap on a premium template', () => {
    const slides = [
      { hook_text: 'FOLK SINGER FIGHTS BACK', body_text: 'Murphy Campbell sues OpenAI for copyright theft.' },
    ]
    expect(detectOverflows(slides, 'magazine-bold')).toEqual([])
  })

  it('flags a 13-word hook on magazine-bold (count 13, field hook_text, slideIndex 0)', () => {
    const hook13 = 'one two three four five six seven eight nine ten eleven twelve thirteen'
    const slides = [{ hook_text: hook13, body_text: 'short body.' }]
    const findings = detectOverflows(slides, 'magazine-bold')
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      slideIndex: 0,
      field: 'hook_text',
      count: 13,
    })
  })

  it('flags a 36-word body on magazine-bold', () => {
    const body36 = Array.from({ length: 36 }, (_, i) => `w${i}`).join(' ')
    const slides = [{ hook_text: 'short hook', body_text: body36 }]
    const findings = detectOverflows(slides, 'magazine-bold')
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      slideIndex: 0,
      field: 'body_text',
      count: 36,
    })
  })

  it("returns [] for legacy template ('news-drop') even when hook is 20 words (premium-tier scope only per D-01)", () => {
    const hook20 = Array.from({ length: 20 }, (_, i) => `w${i}`).join(' ')
    const slides = [{ hook_text: hook20, body_text: 'short body.' }]
    expect(detectOverflows(slides, 'news-drop')).toEqual([])
  })
})

describe('detectOrphans', () => {
  it('flags a slide where hook_text === body_text exactly', () => {
    const slides = [
      { hook_text: 'AI startups raise huge sums', body_text: 'AI startups raise huge sums' },
    ]
    const findings = detectOrphans(slides)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ slideIndex: 0 })
  })

  it('flags a slide where hook+body share >=80% Jaccard word overlap', () => {
    // hook 5 words, body adds 1 word. intersection 5, union 6 → 5/6 ≈ 0.833
    const slides = [
      { hook_text: 'AI startups raise huge sums', body_text: 'AI startups raise huge sums fast' },
    ]
    const findings = detectOrphans(slides)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ slideIndex: 0 })
  })

  it('returns [] when hook and body are distinct (low overlap)', () => {
    const slides = [
      {
        hook_text: 'FOLK SINGER FIGHTS BACK',
        body_text: 'Murphy Campbell sues OpenAI for copyright theft over voice clone.',
      },
    ]
    expect(detectOrphans(slides)).toEqual([])
  })
})

describe('detectTypos', () => {
  it("finds 'MUSICAN' in hook_text 'THE FOLK MUSICAN STRIKES BACK'", () => {
    const slides = [
      { hook_text: 'THE FOLK MUSICAN STRIKES BACK', body_text: 'clean body.' },
    ]
    const findings = detectTypos(slides)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      slideIndex: 0,
      field: 'hook_text',
      typo: 'MUSICAN',
    })
  })

  it('flags typo case-insensitively (input mUsIcAn → still flagged)', () => {
    const slides = [
      { hook_text: 'The folk mUsIcAn strikes back', body_text: 'clean body.' },
    ]
    const findings = detectTypos(slides)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      slideIndex: 0,
      field: 'hook_text',
      typo: 'MUSICAN',
    })
  })

  it('scans hook_segments[].text and body_segments[].text in addition to hook_text/body_text', () => {
    const slides = [
      {
        hook_text: 'clean hook',
        body_text: 'clean body',
        hook_segments: [
          { text: 'recieve' },
          { text: 'fine' },
        ],
        body_segments: [
          { text: 'wierd' },
        ],
      },
    ]
    const findings = detectTypos(slides)
    const fields = findings.map((f) => f.field).sort()
    const typos = findings.map((f) => f.typo).sort()
    expect(fields).toContain('hook_segment')
    expect(fields).toContain('body_segment')
    expect(typos).toContain('RECIEVE')
    expect(typos).toContain('WIERD')
  })

  it('returns [] for clean slides', () => {
    const slides = [
      { hook_text: 'FOLK SINGER FIGHTS BACK', body_text: 'A clean body with no spelling mistakes.' },
    ]
    expect(detectTypos(slides)).toEqual([])
  })
})

describe('validateAndRepair', () => {
  it('returns { data, retried: false, warnings: [] } on clean premium-template input', () => {
    const data = {
      slides: [
        {
          hook_text: 'FOLK SINGER FIGHTS BACK',
          body_text: 'Murphy Campbell sues OpenAI for copyright theft.',
        },
      ],
    }
    const result = validateAndRepair(data, { templateId: 'magazine-bold' })
    expect(result.retried).toBe(false)
    expect(result.warnings).toEqual([])
    expect(result.data).toBe(data)
  })

  it('returns retried:false but warnings.length > 0 on overflow input (does NOT call Gemini — caller handles retry)', () => {
    const hook13 = 'one two three four five six seven eight nine ten eleven twelve thirteen'
    const data = {
      slides: [{ hook_text: hook13, body_text: 'short body.' }],
    }
    const result = validateAndRepair(data, { templateId: 'magazine-bold' })
    expect(result.retried).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('strips highlightColor + highlightStyle silently from documentary slides (no warning per D-03)', () => {
    const data = {
      slides: [
        {
          hook_text: 'FOLK SINGER FIGHTS BACK',
          body_text: 'Murphy Campbell sues OpenAI for copyright theft.',
          hook_segments: [
            { text: 'X', accent: false, highlightColor: '#A8E0B0', highlightStyle: 'pill' as const },
          ],
        },
      ],
    }
    const result = validateAndRepair(data, { templateId: 'documentary' })
    const seg = result.data.slides[0].hook_segments![0]
    expect(seg.highlightColor).toBeUndefined()
    expect(seg.highlightStyle).toBeUndefined()
    // Silent strip — no warning enumerating the strip
    const stripWarnings = result.warnings.filter((w) =>
      w.toLowerCase().includes('highlight'),
    )
    expect(stripWarnings).toEqual([])
  })

  it('leaves highlightColor + highlightStyle UNTOUCHED on magazine-bold slides', () => {
    const data = {
      slides: [
        {
          hook_text: 'FOLK SINGER FIGHTS BACK',
          body_text: 'Murphy Campbell sues OpenAI for copyright theft.',
          hook_segments: [
            { text: 'X', accent: false, highlightColor: '#A8E0B0', highlightStyle: 'pill' as const },
          ],
        },
      ],
    }
    const result = validateAndRepair(data, { templateId: 'magazine-bold' })
    const seg = result.data.slides[0].hook_segments![0]
    expect(seg.highlightColor).toBe('#A8E0B0')
    expect(seg.highlightStyle).toBe('pill')
  })
})
