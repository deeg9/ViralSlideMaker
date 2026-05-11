// Phase 78 Plan 02 Task 3 (REMIX-05):
// Smoke test verifying that the project detail page wires
// <RegenerateFromReferencesButton> in. Uses a SOURCE-GREP shape (mirror of
// the existing actions.ts firewall test pattern) because the page is an
// async React Server Component — full-tree rendering would require mocking
// the Supabase server client + getUserTier + getBrandKit + the editor +
// the published-row lookup, which goes well beyond what this smoke test
// is meant to catch.
//
// What this asserts:
//   1. The page imports RegenerateFromReferencesButton
//   2. The component is referenced in JSX (rendered in the page)
//   3. The component is wired with the project as a prop (so the
//      conditional render gate inside the component fires correctly)
//
// What this intentionally does NOT assert:
//   - The page's full React tree (covered by E2E + the component's own tests)
//   - Conditional rendering logic (the component owns that — see Tests 1-3 in
//     regenerate-from-references-button.test.tsx)

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const PAGE_PATH = path.resolve(__dirname, '../page.tsx')

describe('Phase 78 Plan 02 Task 3: project/[id]/page.tsx wires RegenerateFromReferencesButton', () => {
  it('Test 1: page imports RegenerateFromReferencesButton from @/components/projects', () => {
    const src = readFileSync(PAGE_PATH, 'utf8')
    expect(src).toMatch(
      /import\s*\{[^}]*RegenerateFromReferencesButton[^}]*\}\s*from\s*['"]@\/components\/projects\/regenerate-from-references-button['"]/,
    )
  })

  it('Test 2: page renders <RegenerateFromReferencesButton ... /> in JSX', () => {
    const src = readFileSync(PAGE_PATH, 'utf8')
    expect(src).toMatch(/<RegenerateFromReferencesButton\b/)
  })

  it('Test 3: RegenerateFromReferencesButton is wired with the project as prop', () => {
    const src = readFileSync(PAGE_PATH, 'utf8')
    // Match either `project={p}` or `project={project}` — the component's
    // internal conditional uses project.reference_assets, so any binding
    // that flows the project shape through is acceptable.
    expect(src).toMatch(/<RegenerateFromReferencesButton[^/>]*project=\{[^}]+\}/)
  })
})
