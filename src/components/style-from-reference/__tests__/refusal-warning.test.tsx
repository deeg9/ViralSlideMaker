// Phase 76 Plan 03 (PREVIEW-10):
// RefusalWarning — inline chip rendered next to a flagged reference
// thumbnail in the sticky strip. Renders only when at least one of
// flags.contains_{logo,face,watermark} is true. Uses the verbatim
// CONTEXT.md "Inspired by"-framing copy ("inspired by the style, not
// the brand identity"). Confirm dispatches CONFIRM_REFUSAL_WARNING.
//
// LEGAL-03 forward-compat per-file grep guards against future drift in
// this surface — the file may NEVER contain "exactly like / clone /
// copy this style / duplicate" tokens (Phase 79 project-wide gate
// hardens this later).

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { RefusalWarning } from '../refusal-warning'
import type { RefusalFlags } from '@/lib/ai/refusal-pre-pass'

function flags(overrides: Partial<RefusalFlags> = {}): RefusalFlags {
  return {
    contains_logo: false,
    contains_face: false,
    contains_watermark: false,
    ...overrides,
  }
}

describe('Phase 76 Plan 03: RefusalWarning (PREVIEW-10)', () => {
  it('Test 1: renders null when no flags are positive', () => {
    const { container } = render(
      <RefusalWarning flags={flags()} acknowledged={false} dispatch={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="refusal-warning"]')).toBeNull()
  })

  it('Test 2: renders chip with logo + verbatim "Inspired by" framing copy', () => {
    render(
      <RefusalWarning
        flags={flags({ contains_logo: true })}
        acknowledged={false}
        dispatch={vi.fn()}
      />,
    )
    const chip = screen.getByTestId('refusal-warning')
    expect(chip).toBeTruthy()
    // Categories named in the chip
    expect(chip.textContent?.toLowerCase()).toContain('logo')
    // Verbatim "Inspired by" framing per CONTEXT.md PREVIEW-10
    expect(chip.textContent).toMatch(/inspired by the style, not the brand identity/i)
  })

  it('Test 3: multiple flags renders ONE chip listing both categories', () => {
    render(
      <RefusalWarning
        flags={flags({ contains_logo: true, contains_face: true })}
        acknowledged={false}
        dispatch={vi.fn()}
      />,
    )
    const chips = screen.queryAllByTestId('refusal-warning')
    expect(chips).toHaveLength(1)
    const text = chips[0].textContent ?? ''
    expect(text.toLowerCase()).toContain('logo')
    expect(text.toLowerCase()).toContain('face')
    // Preamble appears exactly once (no duplication)
    const matches = text.match(/inspired by the style, not the brand identity/gi) ?? []
    expect(matches).toHaveLength(1)
  })

  it('Test 4: clicking Continue dispatches CONFIRM_REFUSAL_WARNING exactly once', () => {
    const dispatch = vi.fn()
    render(
      <RefusalWarning
        flags={flags({ contains_logo: true })}
        acknowledged={false}
        dispatch={dispatch}
      />,
    )
    fireEvent.click(screen.getByTestId('refusal-continue-cta'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'CONFIRM_REFUSAL_WARNING' })
  })

  it('Test 5: when acknowledged=true, renders Acknowledged badge instead of Continue', () => {
    render(
      <RefusalWarning
        flags={flags({ contains_logo: true })}
        acknowledged={true}
        dispatch={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('refusal-continue-cta')).toBeNull()
    const chip = screen.getByTestId('refusal-warning')
    expect(chip.textContent?.toLowerCase()).toMatch(/acknowledged/)
  })

  it('Test 6: chip has role=alert and aria-live=polite', () => {
    render(
      <RefusalWarning
        flags={flags({ contains_face: true })}
        acknowledged={false}
        dispatch={vi.fn()}
      />,
    )
    const chip = screen.getByTestId('refusal-warning')
    expect(chip.getAttribute('role')).toBe('alert')
    expect(chip.getAttribute('aria-live')).toBe('polite')
  })

  it('Test 7: LEGAL-03 forward-compat — file contains "inspired by" and zero forbidden tokens', () => {
    const filePath = path.resolve(__dirname, '../refusal-warning.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')
    expect(src.toLowerCase()).toContain('inspired by')
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in refusal-warning.tsx`).toBe(0)
    }
  })
})
