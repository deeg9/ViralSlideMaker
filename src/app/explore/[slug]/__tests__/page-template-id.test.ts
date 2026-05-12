// quick-260511-uk1: explore detail page reads the snapshotted template_id
// from published_carousels and resolves the template via
// `getTemplate(c.template_id ?? 'highlight-bar')` — replacing the
// pre-uk1 hardcoded `getTemplate('highlight-bar')` at page.tsx:77.
//
// STATIC SOURCE-LEVEL TEST. The page is a Next.js server component with
// deep next/cookies + RSC dependencies; mounting it under JSDOM with the
// supabase client mocked is painful and brittle compared to the contract
// these tests actually pin (a small set of source-string invariants on
// page.tsx).
//
// All assertions are run against a comment-filtered copy of the page
// source. Filter strips:
//   - any line whose first non-whitespace character is `//`
//   - any line containing the literal token `260511-uk1`
//
// The second filter is the defense against the "self-invalidating grep
// gate" anti-pattern: this header (and the comments inside page.tsx
// inserted by Task 3) contain the literal string `getTemplate('highlight-bar')`
// in narrative text. Filtering both `//` lines AND `260511-uk1`-bearing
// lines guarantees those tokens never satisfy the negative-grep below.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PAGE_PATH = resolve(__dirname, '..', 'page.tsx')
const RAW_SRC = readFileSync(PAGE_PATH, 'utf8')

// Strip line comments (full-line `//…`) AND any line that names this
// quick task by id. The second filter defends against the
// self-invalidating grep gate: comments added by Task 3 reference the
// literal token `getTemplate('highlight-bar')` and would otherwise
// match the "no hardcoded fallback" negative grep below.
const SRC = RAW_SRC.split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .filter((line) => !line.includes('260511-uk1'))
  .join('\n')

describe('quick-260511-uk1: explore detail page snapshot template_id', () => {
  it('SELECT projection passed to published_carousels includes template_id', () => {
    // Find the .select(' ... ') string passed to
    //   .from('published_carousels').select( ... )
    const selectMatch = SRC.match(
      /from\(\s*['"]published_carousels['"]\s*\)\s*\.select\(\s*['"]([^'"]+)['"]\s*\)/,
    )
    expect(selectMatch).not.toBeNull()
    expect(selectMatch![1]).toContain('template_id')
  })

  it('template resolution uses snapshotted template_id with highlight-bar fallback', () => {
    // Accept either `c.template_id` (current local-var name on the page)
    // or `row.template_id` (in case a future rename happens) — either is
    // fine as long as the fallback expression is preserved.
    const pattern =
      /getTemplate\(\s*(?:c|row)\.template_id\s*\?\?\s*['"]highlight-bar['"]\s*\)/
    expect(SRC).toMatch(pattern)
  })

  it('does NOT hardcode getTemplate(\'highlight-bar\') with no fallback expression', () => {
    // The literal `getTemplate('highlight-bar')` as a SOLE-argument call
    // MUST be gone. The ?? fallback above does pass the literal
    // 'highlight-bar' as an argument expression, but as part of a `??`
    // — not as the only token between the parens. A strict regex on
    // `( SPACES ['"]highlight-bar['"] SPACES )` catches the hardcoded
    // form without matching the fallback form.
    const hardcoded = /getTemplate\(\s*['"]highlight-bar['"]\s*\)/
    expect(SRC).not.toMatch(hardcoded)
  })

  it('row type annotation widens to include template_id: string | null', () => {
    // The page narrows the supabase result to an inline `{ ... }` type.
    // Adding `template_id: string | null` to that type is what makes
    // `c.template_id ?? 'highlight-bar'` type-check cleanly (the ?? then
    // collapses `string | null` to `string`).
    expect(SRC).toMatch(/template_id\s*:\s*string\s*\|\s*null/)
  })
})
