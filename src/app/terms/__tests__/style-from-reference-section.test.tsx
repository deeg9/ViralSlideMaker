// Phase 79 Plan 02 Task 3 (LEGAL-05):
// Verifies the new "Style-from-Reference Generation" section landed on the
// /terms page and renders the standard rights/responsibilities clause.
//
// This is a thin assertion (one render + a handful of text + heading
// checks) — the page is a simple server component with no interactivity, so
// the right granularity is a render-and-check rather than a full snapshot.
//
// What this pins:
//   T1: Page renders an H2 with the new section title
//   T2: Section body warrants the user has rights to uploaded references
//   T3: Section body references the DMCA doc / takedown contact
//   T4: Section body uses "Inspired by" framing — zero forbidden tokens
//   T5: Section body imports + displays the current ToS version literal
//       (so the rendered clause is sortable against audit rows)

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import TermsOfServicePage from '../page'
import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'

describe('Phase 79 Plan 02 Task 3: /terms — Style-from-Reference section (LEGAL-05)', () => {
  it('Test T1: renders an H2 titled "Style-from-Reference Generation"', () => {
    const { container } = render(<TermsOfServicePage />)
    const h2s = Array.from(container.querySelectorAll('h2')).map(
      (h) => h.textContent ?? '',
    )
    const found = h2s.find((t) => /style[\s-]from[\s-]reference/i.test(t))
    expect(found, `expected an H2 mentioning "Style-from-Reference"; got: ${h2s.join(' | ')}`).toBeTruthy()
  })

  it('Test T2: section body warrants user-rights to uploaded references', () => {
    const { container } = render(<TermsOfServicePage />)
    const text = container.textContent ?? ''
    // Standard rights/responsibilities clause: user warrants they have the
    // rights needed to upload these references.
    expect(text).toMatch(/(rights to|own[a-z]*\s+rights|rights needed)/i)
    expect(text.toLowerCase()).toMatch(/reference/)
  })

  it('Test T3: section body references the DMCA process / takedown channel', () => {
    const { container } = render(<TermsOfServicePage />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/dmca|takedown/i)
  })

  it('Test T4: section body uses "Inspired by" framing — zero forbidden tokens', () => {
    const { container } = render(<TermsOfServicePage />)
    const text = container.textContent ?? ''
    const forbidden = [
      /exactly\s+like/i,
      /\bclone\b/i,
      /copy\s+this/i,
      /duplicate\s+the/i,
      /stolen\s+from/i,
      /ripped\s+from/i,
    ]
    for (const re of forbidden) {
      expect(text, `forbidden token ${re} in /terms page`).not.toMatch(re)
    }
    expect(text.toLowerCase()).toMatch(/inspired by/)
  })

  it('Test T5: section displays the current ToS version literal', () => {
    const { container } = render(<TermsOfServicePage />)
    const text = container.textContent ?? ''
    expect(text).toContain(STYLE_FROM_REFERENCE_TOS_VERSION)
  })
})
