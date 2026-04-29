// Phase 47 (TPLAI-01 + TPLAI-02): pure-logic validation surface for the
// post-Gemini, pre-Zod-parse pipeline. All helpers are pure functions over the
// parsed Gemini JSON shape — no Gemini calls, no I/O, no side effects beyond
// returning a result object (validateAndRepair mutates segment fields in place
// for the documentary opt-out; this is intentional and the caller owns the
// data lifecycle).
//
// Plan 47-03 wraps validateAndRepair with retry-once-against-Gemini logic.
//
// Implements rules from 47-CONTEXT.md Areas 1 (length caps + orphans),
// 2 (typo gate), and 3 (documentary highlight strip).

import { KNOWN_TYPOS } from './typos'

// Locked set per Phase 46 + 47-CONTEXT.md Area 1. Inlined to avoid a circular
// dep on src/lib/render/templates/index.ts (which imports the validator at
// module load — keep this file dependency-light).
const PREMIUM_TEMPLATE_IDS: ReadonlySet<string> = new Set([
  'magazine-bold',
  'tr3nding-news',
  'documentary',
])

const HOOK_CAP = 12
const BODY_CAP = 35
const ORPHAN_JACCARD_THRESHOLD = 0.80

// Per CONTEXT.md Area 1: split on whitespace, filter empties.
// Hyphenated words count as one (split(/\s+/) does not split on '-').
// "$50M" counts as one (no special handling — same reason).
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function isPremiumTemplate(templateId?: string): boolean {
  return templateId !== undefined && PREMIUM_TEMPLATE_IDS.has(templateId)
}

export interface OverflowFinding {
  slideIndex: number
  field: 'hook_text' | 'body_text'
  count: number
  cap: number
}

// Premium-tier scope only (D-01) — legacy templates always return [].
export function detectOverflows(
  slides: ReadonlyArray<{ hook_text: string; body_text: string }>,
  templateId?: string,
): OverflowFinding[] {
  if (!isPremiumTemplate(templateId)) return []
  const findings: OverflowFinding[] = []
  slides.forEach((slide, slideIndex) => {
    const hookCount = wordCount(slide.hook_text)
    if (hookCount > HOOK_CAP) {
      findings.push({ slideIndex, field: 'hook_text', count: hookCount, cap: HOOK_CAP })
    }
    const bodyCount = wordCount(slide.body_text)
    if (bodyCount > BODY_CAP) {
      findings.push({ slideIndex, field: 'body_text', count: bodyCount, cap: BODY_CAP })
    }
  })
  return findings
}

export interface OrphanFinding {
  slideIndex: number
}

// Jaccard overlap between hook and body word sets (case-insensitive, simple
// whitespace split). |A ∩ B| / |A ∪ B| >= 0.80 → orphan. Also flags exact
// equality (same string content) as an orphan even if it would not reach the
// threshold (defensive — a literal duplicate is always an orphan).
export function detectOrphans(
  slides: ReadonlyArray<{ hook_text: string; body_text: string }>,
): OrphanFinding[] {
  const findings: OrphanFinding[] = []
  slides.forEach((slide, slideIndex) => {
    if (slide.hook_text === slide.body_text && slide.hook_text.length > 0) {
      findings.push({ slideIndex })
      return
    }
    const hookSet = new Set(
      slide.hook_text
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    )
    const bodySet = new Set(
      slide.body_text
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    )
    if (hookSet.size === 0 || bodySet.size === 0) return
    let intersection = 0
    hookSet.forEach((w) => {
      if (bodySet.has(w)) intersection += 1
    })
    const union = hookSet.size + bodySet.size - intersection
    const jaccard = intersection / union
    if (jaccard >= ORPHAN_JACCARD_THRESHOLD) {
      findings.push({ slideIndex })
    }
  })
  return findings
}

export interface TypoFinding {
  slideIndex: number
  field: 'hook_text' | 'body_text' | 'hook_segment' | 'body_segment'
  typo: string
}

// Tokenize on non-letter boundaries (uppercase A-Z) to avoid false positives
// where a typo is a substring of a longer legitimate word. Compare uppercased
// tokens directly to KNOWN_TYPOS entries. Skip tokens under 3 chars per
// CONTEXT.md Area 2 (avoids flagging single/double-letter accents).
function scanFieldForTypos(text: string): string[] {
  const hits: string[] = []
  const tokens = text.toUpperCase().split(/[^A-Z]+/).filter(Boolean)
  tokens.forEach((tok) => {
    if (tok.length < 3) return
    if (KNOWN_TYPOS.has(tok)) hits.push(tok)
  })
  return hits
}

// Scope: ALL templates (the gate is cheap and benefits everyone — D-02).
export function detectTypos(
  slides: ReadonlyArray<{
    hook_text: string
    body_text: string
    hook_segments?: Array<{ text: string }>
    body_segments?: Array<{ text: string }>
  }>,
): TypoFinding[] {
  const findings: TypoFinding[] = []
  slides.forEach((slide, slideIndex) => {
    scanFieldForTypos(slide.hook_text).forEach((typo) =>
      findings.push({ slideIndex, field: 'hook_text', typo }),
    )
    scanFieldForTypos(slide.body_text).forEach((typo) =>
      findings.push({ slideIndex, field: 'body_text', typo }),
    )
    slide.hook_segments?.forEach((seg) => {
      scanFieldForTypos(seg.text).forEach((typo) =>
        findings.push({ slideIndex, field: 'hook_segment', typo }),
      )
    })
    slide.body_segments?.forEach((seg) => {
      scanFieldForTypos(seg.text).forEach((typo) =>
        findings.push({ slideIndex, field: 'body_segment', typo }),
      )
    })
  })
  return findings
}

export interface ValidateAndRepairOptions {
  templateId?: string
}

export interface ValidateAndRepairResult<T> {
  data: T
  retried: boolean
  warnings: string[]
}

// Pure transform — never throws, never calls Gemini. Returns the (possibly
// mutated) data plus a warning list the caller decides what to do with.
// Plan 47-03 wraps this with retry-once-against-Gemini logic.
//
// Documentary opt-out: per CONTEXT.md Area 3, documentary slides MUST NOT
// carry highlightColor/highlightStyle. Strip silently before return — the
// strip emits NO warning because the field is intentional AI output that
// the validator silently corrects to match template semantics.
export function validateAndRepair<
  T extends {
    slides: Array<{
      hook_text: string
      body_text: string
      hook_segments?: Array<{
        text: string
        accent: boolean
        highlightColor?: string
        highlightStyle?: 'pill'
      }>
      body_segments?: Array<{
        text: string
        accent: boolean
        highlightColor?: string
        highlightStyle?: 'pill'
      }>
    }>
  },
>(data: T, options: ValidateAndRepairOptions = {}): ValidateAndRepairResult<T> {
  const warnings: string[] = []
  const { templateId } = options

  // Documentary strip — silent (no warning per D-03).
  if (templateId === 'documentary') {
    data.slides.forEach((slide) => {
      slide.hook_segments?.forEach((seg) => {
        delete seg.highlightColor
        delete seg.highlightStyle
      })
      slide.body_segments?.forEach((seg) => {
        delete seg.highlightColor
        delete seg.highlightStyle
      })
    })
  }

  const overflows = detectOverflows(data.slides, templateId)
  overflows.forEach((o) => {
    warnings.push(
      `slide ${o.slideIndex} ${o.field} has ${o.count} words (cap ${o.cap})`,
    )
  })

  // Orphan detection is premium-tier only per CONTEXT.md D-01 (mirrors
  // detectOverflows gating above).
  const orphans = isPremiumTemplate(templateId) ? detectOrphans(data.slides) : []
  orphans.forEach((o) => {
    warnings.push(`slide ${o.slideIndex} hook/body are orphans (>=80% overlap)`)
  })

  const typos = detectTypos(data.slides)
  typos.forEach((t) => {
    warnings.push(`slide ${t.slideIndex} ${t.field} contains typo '${t.typo}'`)
  })

  return { data, retried: false, warnings }
}
