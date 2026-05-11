// Phase 76 Plan 03 (PREVIEW-12):
// SafetyBlockRecovery — full-panel replacement when extract returns
// safety_blocked. Surfaces the Phase 75 recovery_suggestion verbatim
// PLUS three actionable affordances: "Try a different image" CTA
// (dispatches UPLOAD_RESET), "Describe in text" alternative (disabled
// stub for v2.13 — Phase 77 enables), and a guidance bullet list.
//
// LEGAL-03 forward-compat per-file grep is in Test 6.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { SafetyBlockRecovery } from '../safety-block-recovery'

describe('Phase 76 Plan 03: SafetyBlockRecovery (PREVIEW-12)', () => {
  it('Test 1: renders the recovery panel surface', () => {
    render(<SafetyBlockRecovery recoverySuggestion={undefined} dispatch={vi.fn()} />)
    expect(screen.getByTestId('safety-block-recovery')).toBeTruthy()
  })

  it('Test 2: displays recovery_suggestion text from Phase 75 verbatim', () => {
    render(
      <SafetyBlockRecovery
        recoverySuggestion="Try cropping high-skin areas"
        dispatch={vi.fn()}
      />,
    )
    const node = screen.getByTestId('recovery-suggestion-text')
    expect(node.textContent).toContain('Try cropping high-skin areas')
  })

  it('Test 3a: "Try a different image" CTA dispatches UPLOAD_RESET with empty references', () => {
    const dispatch = vi.fn()
    render(<SafetyBlockRecovery recoverySuggestion={undefined} dispatch={dispatch} />)
    fireEvent.click(screen.getByTestId('try-different-image-cta'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPLOAD_RESET', references: [] })
  })

  it('Test 3b: "Describe in text" alternative is disabled with tooltip', () => {
    render(<SafetyBlockRecovery recoverySuggestion={undefined} dispatch={vi.fn()} />)
    const btn = screen.getByTestId('describe-in-text-cta') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    // Tooltip element exists; copy mentions deferred / coming
    const tooltipId = btn.getAttribute('aria-describedby')
    expect(tooltipId).toBeTruthy()
    const tooltip = document.getElementById(tooltipId!)
    expect(tooltip).toBeTruthy()
    expect(tooltip!.textContent?.toLowerCase()).toMatch(/coming|next update|soon|defer/)
  })

  it('Test 3c: renders general guidance bullets per PREVIEW-12 spec', () => {
    const { container } = render(
      <SafetyBlockRecovery
        recoverySuggestion="Try cropping high-skin areas"
        dispatch={vi.fn()}
      />,
    )
    const items = container.querySelectorAll('ul li')
    expect(items.length).toBeGreaterThanOrEqual(3)
    const allText = Array.from(items).map((li) => li.textContent ?? '').join(' ').toLowerCase()
    expect(allText).toMatch(/cropping|skin/)
    expect(allText).toMatch(/different/)
    expect(allText).toMatch(/describe/)
  })

  it('Test 4: clicking "Try a different image" clears state via UPLOAD_RESET (sticky strip empties + retries reset)', () => {
    // Contract: UPLOAD_RESET with empty references is the action that the
    // reducer translates to "fresh upload set" (which resets retriesRemaining
    // to 2 per Plan 76-01 reducer). This component's responsibility is to
    // dispatch the right action — verified by Test 3a — Test 4 doubles down
    // by asserting the action shape is exactly the reducer's RESET-to-2
    // shape (action.references is an array, length 0).
    const dispatch = vi.fn()
    render(<SafetyBlockRecovery recoverySuggestion="x" dispatch={dispatch} />)
    fireEvent.click(screen.getByTestId('try-different-image-cta'))
    const action = dispatch.mock.calls[0][0]
    expect(action.type).toBe('UPLOAD_RESET')
    expect(Array.isArray(action.references)).toBe(true)
    expect(action.references).toHaveLength(0)
  })

  it('Test 5: panel has region role + aria-label so screen readers announce surface change', () => {
    render(<SafetyBlockRecovery recoverySuggestion={undefined} dispatch={vi.fn()} />)
    const panel = screen.getByTestId('safety-block-recovery')
    expect(panel.getAttribute('role')).toBe('region')
    expect(panel.getAttribute('aria-label')).toBeTruthy()
  })

  it('Test 6: LEGAL-03 forward-compat — zero forbidden tokens in safety-block-recovery.tsx', () => {
    const filePath = path.resolve(__dirname, '../safety-block-recovery.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in safety-block-recovery.tsx`).toBe(0)
    }
  })
})
