// Phase 76 Plan 03 → quick-260514-g7y final relocation:
//
// The "From references" CTA traveled across two refactors:
//   1. Phase 76 Plan 03 placed it as a dashboard promo card.
//   2. quick-260514-back-button moved it to a "References" pill on the
//      prompt form (generation-form.tsx) routing to a standalone
//      /style-from-reference/new page.
//   3. quick-260514-g7y INLINED the entire style-from-reference flow as
//      a collapsible section inside the prompt form and DELETED the
//      standalone page. The "References" pill is gone; the collapsible
//      is the only entry point.
//
// This test is now a regression guard: assert the obsolete entry points
// stay gone so a future PR re-adding the standalone page route or the
// dashboard CTA goes red and forces explicit intent. The new inline
// collapsible's contract is covered by the spec-preview-panel +
// state-machine tests (which are co-located in this directory and stay
// green through the inlining).

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const generationFormPath = resolve(
  __dirname,
  '../../../components/slides/generation-form.tsx',
)
const dashboardPath = resolve(
  __dirname,
  '../../../app/(dashboard)/dashboard/page.tsx',
)
const standalonePagePath = resolve(
  __dirname,
  '../../../app/(dashboard)/style-from-reference/new/page.tsx',
)

describe('quick-260514-g7y: style-from-reference entry-point relocation guard', () => {
  it('Test 1: standalone /style-from-reference/new route file does NOT exist', () => {
    // The standalone page was deleted when the flow was inlined. If a
    // future PR re-adds the file, this test goes red so we revisit intent.
    expect(existsSync(standalonePagePath)).toBe(false)
  })

  it('Test 2: generation form no longer carries the "References" pill', () => {
    const formSrc = readFileSync(generationFormPath, 'utf8')
    // The old pill linked to /style-from-reference/new with a stable
    // testid. Both have been removed.
    expect(formSrc).not.toContain('data-testid="from-references-cta"')
    expect(formSrc).not.toMatch(/href=[`"]?\/style-from-reference\/new/)
  })

  it('Test 3: generation form no longer carries the "Copy style" collapsible', () => {
    const formSrc = readFileSync(generationFormPath, 'utf8')
    // The Copy Style collapsible (the inlined style-from-reference flow) was
    // removed from the prompt form. Assert it stays gone so a future PR
    // re-adding it goes red and forces explicit intent.
    expect(formSrc).not.toMatch(/Copy style/)
    expect(formSrc).not.toContain('StyleFromReferenceShell')
  })

  it('Test 4: dashboard page no longer carries the old CTA either', () => {
    const dashSrc = readFileSync(dashboardPath, 'utf8')
    expect(dashSrc).not.toContain('from-references-cta')
    expect(dashSrc).not.toContain('href="/style-from-reference/new"')
  })

  it('Test 5: LEGAL-03 forward-compat — generation form uses safe framing', () => {
    const formSrc = readFileSync(generationFormPath, 'utf8')
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (formSrc.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in generation-form.tsx`).toBe(0)
    }
  })
})
