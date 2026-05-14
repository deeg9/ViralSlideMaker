// Phase 76 Plan 03 (entry-point wiring) — UPDATED quick-260514:
// The "From references" CTA was moved off the dashboard and into the
// in-flow prompt form (src/components/slides/generation-form.tsx) so the
// affordance sits next to the visual-style picker rather than as a
// dashboard-level promo card. Both surfaces (the old CTA, the new pill)
// route to /style-from-reference/new — only the host file changes.
// A source-grep on the generation-form file is the right granularity:
// the form is a client component but rendering it in jsdom needs
// useTransition + supabase shims, and the grep catches the wiring
// regression class (broken href, missing testid, mimicry-framing copy)
// without that mock weight.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const generationFormPath = resolve(
  __dirname,
  '../../../components/slides/generation-form.tsx',
)
const dashboardPath = resolve(
  __dirname,
  '../../../app/(dashboard)/dashboard/page.tsx',
)

describe('Phase 76 Plan 03 (quick-260514-relocated): References CTA wiring', () => {
  const formSrc = readFileSync(generationFormPath, 'utf8')

  it('Test 1: generation form links to /style-from-reference/new (Next.js (dashboard) route group is stripped from URL)', () => {
    // Accept either a plain href="…" or a template-literal href={`…?from=…`}
    // since quick-260514-back-button passes a ?from= query param to give the
    // back-button a same-origin return path. We anchor on the URL itself
    // (followed by `?` query string, closing quote, or closing backtick)
    // rather than the href= prefix so both JSX shapes pass.
    expect(formSrc).toMatch(/\/style-from-reference\/new(\?|"|`)/)
    // Defensive: assert we did NOT regress to the broken /dashboard/-prefixed URL
    expect(formSrc).not.toContain('/dashboard/style-from-reference/new')
  })

  it('Test 2: CTA copy mentions references (entry-point discoverability)', () => {
    expect(formSrc.toLowerCase()).toMatch(/references/)
  })

  it('Test 3: CTA uses a stable testid for downstream UX QA', () => {
    expect(formSrc).toContain('data-testid="from-references-cta"')
  })

  it('Test 4: LEGAL-03 forward-compat — generation form uses safe framing', () => {
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (formSrc.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in generation-form.tsx`).toBe(0)
    }
  })

  it('Test 5 (quick-260514 relocation guard): dashboard page no longer carries the CTA', () => {
    // The old CTA was removed from the dashboard. If a future PR re-adds a
    // duplicate dashboard-level CTA, this test goes red so we re-confirm
    // intent before re-introducing the dashboard-level promo card.
    const dashSrc = readFileSync(dashboardPath, 'utf8')
    expect(dashSrc).not.toContain('from-references-cta')
    expect(dashSrc).not.toContain('href="/style-from-reference/new"')
  })
})
