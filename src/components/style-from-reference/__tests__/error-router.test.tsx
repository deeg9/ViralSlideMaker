// Phase 76 Plan 03 (PREVIEW-10/12 + recovery routing):
// ErrorRouter — switches by state.error.kind to render the right
// recovery surface. Specific surface per error kind (no generic
// "Something went wrong" — Pitfall 6/7 explicitly call out generic
// errors as a churn event).
//
// LEGAL-03 forward-compat per-file grep is in Test 8.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ErrorRouter } from '../error-router'
import { initialSpecPreviewState, type SpecPreviewState } from '../state-machine'

function stateWithError(
  kind: SpecPreviewState['error'] extends { kind: infer K } | null ? K : never,
  extras: Partial<NonNullable<SpecPreviewState['error']>> = {},
): SpecPreviewState {
  return {
    ...initialSpecPreviewState,
    status: 'error',
    error: { kind, ...extras },
  }
}

describe('Phase 76 Plan 03: ErrorRouter (recovery routing)', () => {
  it('Test 1: state.error = null → renders null', () => {
    const { container } = render(
      <ErrorRouter state={initialSpecPreviewState} dispatch={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('Test 2: kind=safety_blocked → renders SafetyBlockRecovery with recoverySuggestion', () => {
    render(
      <ErrorRouter
        state={stateWithError('safety_blocked', {
          recovery_suggestion: 'Try cropping high-skin areas',
        })}
        dispatch={vi.fn()}
      />,
    )
    expect(screen.getByTestId('safety-block-recovery')).toBeTruthy()
    expect(screen.getByTestId('recovery-suggestion-text').textContent).toContain(
      'Try cropping high-skin areas',
    )
    // SafetyBlockRecovery's CTAs ride along
    expect(screen.getByTestId('try-different-image-cta')).toBeTruthy()
  })

  it('Test 3: kind=cap_reached → renders daily-cap panel with Upgrade link to /pricing', () => {
    render(
      <ErrorRouter state={stateWithError('cap_reached')} dispatch={vi.fn()} />,
    )
    const panel = screen.getByTestId('error-cap-reached')
    expect(panel.textContent?.toLowerCase()).toMatch(/limit|cap|today/)
    const link = screen.getByTestId('upgrade-link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/pricing')
  })

  it('Test 4: kind=insufficient_credits → renders Out-of-credits panel with /pricing link', () => {
    render(
      <ErrorRouter
        state={stateWithError('insufficient_credits')}
        dispatch={vi.fn()}
      />,
    )
    const panel = screen.getByTestId('error-insufficient-credits')
    expect(panel.textContent?.toLowerCase()).toMatch(/credit/)
    const link = screen.getByTestId('get-credits-link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/pricing')
  })

  it('Test 5: kind=extraction_failed → renders generic-extract-failed panel + Try again CLEAR_ERROR', () => {
    const dispatch = vi.fn()
    render(
      <ErrorRouter state={stateWithError('extraction_failed')} dispatch={dispatch} />,
    )
    expect(screen.getByTestId('error-extraction-failed')).toBeTruthy()
    fireEvent.click(screen.getByTestId('try-again-cta'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'CLEAR_ERROR' })
  })

  it('Test 6: kind=no-retries-left → renders fresh-upload panel + Start over UPLOAD_RESET', () => {
    const dispatch = vi.fn()
    render(
      <ErrorRouter state={stateWithError('no-retries-left')} dispatch={dispatch} />,
    )
    expect(screen.getByTestId('error-no-retries')).toBeTruthy()
    fireEvent.click(screen.getByTestId('reset-uploads-cta'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPLOAD_RESET', references: [] })
  })

  it('Test 7: kind in {no-references, preview-required} → inline hint; no-aspects-selected → null', () => {
    const a = render(
      <ErrorRouter state={stateWithError('no-references')} dispatch={vi.fn()} />,
    )
    expect(a.getByTestId('error-inline-hint')).toBeTruthy()
    a.unmount()

    const b = render(
      <ErrorRouter state={stateWithError('preview-required')} dispatch={vi.fn()} />,
    )
    expect(b.getByTestId('error-inline-hint')).toBeTruthy()
    b.unmount()

    const c = render(
      <ErrorRouter state={stateWithError('no-aspects-selected')} dispatch={vi.fn()} />,
    )
    // PerAspectToggles owns the no-aspects-selected hint (Plan 76-02);
    // ErrorRouter renders nothing here to avoid duplicate hints.
    expect(c.container.firstChild).toBeNull()
  })

  it('Test 8: LEGAL-03 forward-compat — zero forbidden tokens in error-router.tsx', () => {
    const filePath = path.resolve(__dirname, '../error-router.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in error-router.tsx`).toBe(0)
    }
  })
})
