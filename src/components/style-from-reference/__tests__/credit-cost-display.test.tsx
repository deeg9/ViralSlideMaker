// Phase 76 Plan 02 (PREVIEW-11):
// CreditCostDisplay tests.
//
// 5 tests: default cost=1 wording, plural cost=N wording, tooltip
// (button + describedby + tooltip text), data-testid for layout assertion,
// LEGAL-03 forward-compat grep.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { CreditCostDisplay } from '../credit-cost-display'

describe('Phase 76 Plan 02: CreditCostDisplay (PREVIEW-11)', () => {
  it('Test 1: renders "Generating will use 1 credit" by default', () => {
    render(<CreditCostDisplay />)
    expect(screen.getByText(/generating will use 1 credit\b/i)).toBeTruthy()
  })

  it('Test 2: cost=2 renders plural "2 credits"', () => {
    render(<CreditCostDisplay cost={2} />)
    expect(screen.getByText(/generating will use 2 credits/i)).toBeTruthy()
  })

  it('Test 3: tooltip — has a button with aria-describedby pointing to a tooltip element', () => {
    render(<CreditCostDisplay />)
    const button = screen.getByRole('button', { name: /credit cost details/i })
    expect(button).toBeTruthy()
    const describedById = button.getAttribute('aria-describedby')
    expect(describedById).toBeTruthy()
    const tooltip = document.getElementById(describedById!)
    expect(tooltip).toBeTruthy()
    expect((tooltip!.textContent ?? '').toLowerCase()).toMatch(/credit/)
  })

  it('Test 4: has data-testid="credit-cost-display" for layout assertions', () => {
    render(<CreditCostDisplay />)
    expect(screen.getByTestId('credit-cost-display')).toBeTruthy()
  })

  it('Test 5: LEGAL-03 forward-compat — zero forbidden tokens in the component file', () => {
    const filePath = path.resolve(__dirname, '../credit-cost-display.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in credit-cost-display.tsx`).toBe(0)
    }
  })
})
