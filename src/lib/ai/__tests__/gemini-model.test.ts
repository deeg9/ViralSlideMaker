// quick-260515-io9: tests for the centralized Gemini TEXT-model constant.
//
// Two contracts:
//   1. GEMINI_TEXT_MODEL resolves to 'gemini-3.1-flash-lite' when no
//      GEMINI_TEXT_MODEL env override is present (default-fallback).
//   2. Grep-gate: no production .ts file under src/ contains a hardcoded
//      `gemini-2.5-flash'` TEXT-model literal. Allowlist:
//        - gemini-model.ts        — the constant module (its JSDoc mentions
//          the old + image model IDs as documentation; the trailing-quote
//          pattern is not present, but it is allowlisted for safety).
//        - imagen/stylize-image.ts — uses the SEPARATE image-generation
//          model 'gemini-2.5-flash-image-preview' (own deprecation track).
//      The image model literal has NO quote immediately after `flash`
//      (`gemini-2.5-flash-image-preview'`), so the `gemini-2.5-flash'`
//      pattern with a trailing quote distinguishes the text model and does
//      NOT trip on the image model. This gate fails the build if any future
//      code reintroduces a hardcoded 2.5-Flash text literal.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { GEMINI_TEXT_MODEL } from '@/lib/ai/gemini-model'

describe('quick-260515-io9: GEMINI_TEXT_MODEL constant', () => {
  it('resolves to gemini-3.1-flash-lite by default (no env override)', () => {
    // The vitest env does not set GEMINI_TEXT_MODEL, so the fallback applies.
    expect(GEMINI_TEXT_MODEL).toBe('gemini-3.1-flash-lite')
  })
})

// --------------------------------------------------------------------- //
// Grep-gate: zero stray `gemini-2.5-flash'` text-model literals in src/   //
// --------------------------------------------------------------------- //

const SRC_ROOT = resolve(__dirname, '..', '..', '..')

// Files allowed to contain the substring (path relative to SRC_ROOT).
const GREP_GATE_ALLOWLIST: ReadonlySet<string> = new Set([
  join('lib', 'ai', 'gemini-model.ts'),
  join('lib', 'imagen', 'stylize-image.ts'),
])

function enumerateProductionTsFiles(): string[] {
  const out: string[] = []
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (
          name === '__tests__' ||
          name === '__snapshots__' ||
          name === '__fixtures__'
        ) {
          continue
        }
        walk(full)
      } else if (
        (name.endsWith('.ts') || name.endsWith('.tsx')) &&
        !name.endsWith('.test.ts') &&
        !name.endsWith('.test.tsx')
      ) {
        out.push(full)
      }
    }
  }
  walk(SRC_ROOT)
  return out
}

describe('quick-260515-io9: gemini-2.5-flash text-literal grep-gate', () => {
  const files = enumerateProductionTsFiles()

  it('sanity floor: enumeration finds at least 50 production files in src/', () => {
    expect(files.length).toBeGreaterThanOrEqual(50)
  })

  it('finds zero hardcoded gemini-2.5-flash text-model literals outside the allowlist', () => {
    const offenders: string[] = []
    for (const file of files) {
      const rel = file.slice(SRC_ROOT.length + 1)
      if (GREP_GATE_ALLOWLIST.has(rel)) continue
      const source = readFileSync(file, 'utf8')
      // Trailing quote distinguishes the TEXT model from the image model
      // `gemini-2.5-flash-image-preview` (no quote right after `flash`).
      if (source.includes("gemini-2.5-flash'")) {
        offenders.push(rel)
      }
    }
    expect(offenders).toEqual([])
  })

  it('does NOT trip on the gemini-2.5-flash-image-preview image model', () => {
    // The image-model literal must not match the text-model pattern.
    const imageLiteral = "model: 'gemini-2.5-flash-image-preview'"
    expect(imageLiteral.includes("gemini-2.5-flash'")).toBe(false)
  })

  it('DOES trip on a real text-model literal (pattern self-control)', () => {
    // If this fails, the pattern is broken and the gate would miss leaks.
    const textLiteral = "model: 'gemini-2.5-flash'"
    expect(textLiteral.includes("gemini-2.5-flash'")).toBe(true)
  })
})
