// Phase 77 Plan 03 (EDITOR-02): tests for FromReferencesBadge.
// Pure presentation chip, conditional on hasStyleSpec, LEGAL-03 framing.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { FromReferencesBadge } from '../from-references-badge'

// LEGAL-03 forbidden tokens — every Phase 77 component output is grep'd for
// these. Zero matches required (case-insensitive on lowercased rendered HTML).
const LEGAL_03_FORBIDDEN = [
  'exactly like',
  'exactly the same',
  'copied from',
  'cloned from',
  'clone of',
  'duplicate of',
  'copy of',
] as const

describe('FromReferencesBadge (EDITOR-02)', () => {
  it('Test 1: renders visible "Inspired by references" text when hasStyleSpec=true', () => {
    render(<FromReferencesBadge hasStyleSpec={true} />)
    expect(screen.getByText(/inspired by references/i)).toBeInTheDocument()
  })

  it('Test 2: renders nothing (returns null) when hasStyleSpec=false', () => {
    const { container } = render(<FromReferencesBadge hasStyleSpec={false} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('from-references-badge')).not.toBeInTheDocument()
  })

  it('Test 3: badge has data-testid="from-references-badge" for downstream tests', () => {
    render(<FromReferencesBadge hasStyleSpec={true} />)
    expect(screen.getByTestId('from-references-badge')).toBeInTheDocument()
  })

  it('Test 4: badge has accessible aria-label', () => {
    render(<FromReferencesBadge hasStyleSpec={true} />)
    const el = screen.getByTestId('from-references-badge')
    // either the visible text serves as the label, or aria-label is set
    const label = el.getAttribute('aria-label') ?? el.textContent ?? ''
    expect(label.toLowerCase()).toMatch(/inspired by reference/)
  })

  it('Test 5: rendered HTML contains ZERO LEGAL-03 forbidden tokens', () => {
    const { container } = render(<FromReferencesBadge hasStyleSpec={true} />)
    const html = container.innerHTML.toLowerCase()
    for (const token of LEGAL_03_FORBIDDEN) {
      expect(html, `forbidden token found: "${token}"`).not.toContain(token)
    }
  })

  it('Test 6: source imports zero data-fetching modules (pure presentation)', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../from-references-badge.tsx'),
      'utf8',
    )
    // No Supabase / no router / no hooks — pure stateless presentation
    expect(src).not.toMatch(/from\s+['"]@supabase/)
    expect(src).not.toMatch(/from\s+['"]@\/lib\/supabase/)
    expect(src).not.toMatch(/from\s+['"]next\/navigation['"]/)
    expect(src).not.toMatch(/useRouter\b/)
    expect(src).not.toMatch(/useState\b/)
    expect(src).not.toMatch(/useEffect\b/)
    expect(src).not.toMatch(/from\s+['"]swr['"]/)
  })
})
