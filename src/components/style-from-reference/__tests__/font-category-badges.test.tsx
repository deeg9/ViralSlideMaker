// Phase 76 Plan 02 (PREVIEW-03):
// FontCategoryBadges display component tests.
//
// 4 tests pin the rendering for each combination of hook+body category presence
// + a graceful-degradation case + a11y semantics.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FontCategoryBadges } from '../font-category-badges'

describe('Phase 76 Plan 02: FontCategoryBadges (PREVIEW-03)', () => {
  it('Test 1: with hook + body categories set, renders both prefixed badges title-cased', () => {
    render(<FontCategoryBadges hookCategory="display" bodyCategory="sans-serif" />)
    const hook = screen.getByTestId('font-badge-hook')
    const body = screen.getByTestId('font-badge-body')
    expect(hook.textContent).toMatch(/Hook:\s*Display/i)
    expect(body.textContent).toMatch(/Body:\s*Sans[-\s]?Serif/i)
  })

  it('Test 2: with only hook set (body undefined), renders only the hook badge', () => {
    const { container } = render(<FontCategoryBadges hookCategory="serif" bodyCategory={undefined} />)
    expect(screen.getByTestId('font-badge-hook')).toBeTruthy()
    expect(container.querySelector('[data-testid="font-badge-body"]')).toBeNull()
  })

  it('Test 3: with neither set, renders an inline "Typography: not detected" muted line', () => {
    render(<FontCategoryBadges hookCategory={undefined} bodyCategory={undefined} />)
    const fallback = screen.getByTestId('font-badge-empty')
    expect(fallback).toBeTruthy()
    expect(fallback.textContent).toMatch(/typography:\s*not detected/i)
  })

  it('Test 4: badges live inside a <ul role="list"> with an aria-label naming the section for screen readers', () => {
    render(<FontCategoryBadges hookCategory="handwriting" bodyCategory="sans-serif" />)
    const list = screen.getByTestId('font-badges-list')
    expect(list).toBeTruthy()
    expect(list.tagName.toLowerCase()).toBe('ul')
    expect(list.getAttribute('aria-label') ?? '').toMatch(/typography/i)
    // List items are present, one per badge
    const items = list.querySelectorAll('li')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })
})
