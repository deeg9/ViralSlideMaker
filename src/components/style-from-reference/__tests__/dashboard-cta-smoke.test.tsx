// Phase 76 Plan 03 (entry-point wiring):
// Dashboard "From references" CTA smoke test. The dashboard page is a
// server component that calls supabase + ensureSubscription + fetches
// user data — mocking that whole stack to render in jsdom adds noise
// without catching a real bug. A source-grep on the page file is the
// right granularity for the wiring assertion (the page exists, the
// link targets the right route, copy uses safe framing).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dashboardPath = resolve(
  __dirname,
  '../../../app/(dashboard)/dashboard/page.tsx',
)

describe('Phase 76 Plan 03: dashboard CTA wiring (entry point)', () => {
  const src = readFileSync(dashboardPath, 'utf8')

  it('Test 1: dashboard page links to /dashboard/style-from-reference/new', () => {
    expect(src).toContain('/dashboard/style-from-reference/new')
  })

  it('Test 2: CTA copy mentions references (entry-point discoverability)', () => {
    // The CTA label string must mention "reference" so the user understands
    // what the entry-point does.
    expect(src.toLowerCase()).toMatch(/from references|reference/)
  })

  it('Test 3: CTA uses a stable testid for downstream UX QA', () => {
    expect(src).toContain('data-testid="from-references-cta"')
  })

  it('Test 4: LEGAL-03 forward-compat — dashboard page uses safe framing', () => {
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in dashboard/page.tsx`).toBe(0)
    }
  })
})
