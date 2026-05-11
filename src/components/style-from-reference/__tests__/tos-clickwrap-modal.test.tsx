// Phase 79 Plan 02 Task 1 (LEGAL-01):
// Contract tests for the ToS clickwrap modal that gates first
// style-from-reference upload.
//
// What this pins:
//   T1: Renders a dialog containing the version literal + a checkbox + an
//       Accept CTA + a Cancel CTA
//   T2: Accept button is DISABLED until the checkbox is checked
//   T3: Clicking Accept dispatches the injected acceptStyleFromReferenceTosAction
//       with the current ToS version literal exactly once
//   T4: On a successful action result the modal calls onAccepted() (parent
//       closes it) and does NOT call onCancel()
//   T5: On a failed action result the modal stays mounted, surfaces an
//       error message, and does NOT call onAccepted()
//   T6: Clicking Cancel calls onCancel() without invoking the action
//   T7: Modal copy uses ONLY "Inspired by" framing — explicit per-file grep
//       on the rendered text (no "exactly like" / "clone" / "copy this" /
//       "duplicate the" / "stolen from" / "ripped from" tokens)
//
// LEGAL-03 forward-compat: this file participates in the Phase 79 final
// grep gate (`scripts/grep-gates/inspired-by-framing.sh`); the source MUST
// NOT contain forbidden tokens outside comment lines, and the test below
// asserts that the RENDERED DOM also stays clean.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TosClickwrapModal } from '../tos-clickwrap-modal'
import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'

function setup(overrides: Partial<React.ComponentProps<typeof TosClickwrapModal>> = {}) {
  const onAccepted = vi.fn()
  const onCancel = vi.fn()
  const acceptAction = vi.fn().mockResolvedValue({ ok: true })
  const utils = render(
    <TosClickwrapModal
      open={true}
      onAccepted={onAccepted}
      onCancel={onCancel}
      acceptAction={acceptAction}
      {...overrides}
    />,
  )
  return { ...utils, onAccepted, onCancel, acceptAction }
}

describe('Phase 79 Plan 02 Task 1: TosClickwrapModal (LEGAL-01)', () => {
  it('Test 1: renders dialog with version literal, checkbox, Accept CTA, Cancel CTA', () => {
    setup()
    // Dialog root with stable testid for downstream UX QA
    const dialog = screen.getByTestId('tos-clickwrap-modal')
    expect(dialog).toBeTruthy()
    // Version literal surfaces in the dialog body so the user sees what they
    // are agreeing to (and so audit forensics match the rendered string).
    expect(dialog.textContent ?? '').toContain(STYLE_FROM_REFERENCE_TOS_VERSION)
    // Required interactive primitives
    expect(screen.getByTestId('tos-clickwrap-checkbox')).toBeTruthy()
    expect(screen.getByTestId('tos-clickwrap-accept')).toBeTruthy()
    expect(screen.getByTestId('tos-clickwrap-cancel')).toBeTruthy()
  })

  it('Test 2: Accept button is disabled until the checkbox is checked', () => {
    setup()
    const accept = screen.getByTestId('tos-clickwrap-accept') as HTMLButtonElement
    expect(accept.disabled).toBe(true)

    // Tick the checkbox; Accept becomes enabled
    const checkbox = screen.getByTestId('tos-clickwrap-checkbox') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
    expect(accept.disabled).toBe(false)

    // Untick → Accept disabled again (no submit-after-uncheck loophole)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
    expect(accept.disabled).toBe(true)
  })

  it('Test 3: clicking Accept invokes acceptAction with the current ToS version exactly once', async () => {
    const { acceptAction } = setup()
    fireEvent.click(screen.getByTestId('tos-clickwrap-checkbox'))
    fireEvent.click(screen.getByTestId('tos-clickwrap-accept'))
    await waitFor(() => {
      expect(acceptAction).toHaveBeenCalledTimes(1)
    })
    expect(acceptAction).toHaveBeenCalledWith(STYLE_FROM_REFERENCE_TOS_VERSION)
  })

  it('Test 4: on { ok: true } result, calls onAccepted() and not onCancel()', async () => {
    const { onAccepted, onCancel } = setup()
    fireEvent.click(screen.getByTestId('tos-clickwrap-checkbox'))
    fireEvent.click(screen.getByTestId('tos-clickwrap-accept'))
    await waitFor(() => {
      expect(onAccepted).toHaveBeenCalledTimes(1)
    })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Test 5: on { ok: false } result, surfaces an error and does NOT call onAccepted()', async () => {
    const acceptAction = vi.fn().mockResolvedValue({ ok: false, error: 'db down' })
    const { onAccepted } = setup({ acceptAction })
    fireEvent.click(screen.getByTestId('tos-clickwrap-checkbox'))
    fireEvent.click(screen.getByTestId('tos-clickwrap-accept'))

    await waitFor(() => {
      expect(screen.getByTestId('tos-clickwrap-error')).toBeTruthy()
    })
    expect(onAccepted).not.toHaveBeenCalled()
    // Modal stays mounted (the dialog root is still in the document)
    expect(screen.getByTestId('tos-clickwrap-modal')).toBeTruthy()
  })

  it('Test 6: clicking Cancel calls onCancel() without invoking the action', () => {
    const { acceptAction, onCancel, onAccepted } = setup()
    fireEvent.click(screen.getByTestId('tos-clickwrap-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(acceptAction).not.toHaveBeenCalled()
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it('Test 7: rendered DOM uses only "Inspired by" framing — zero forbidden tokens', () => {
    setup()
    const dialog = screen.getByTestId('tos-clickwrap-modal')
    const text = dialog.textContent ?? ''
    const forbidden = [
      /exactly\s+like/i,
      /\bclone\b/i,
      /copy\s+this/i,
      /duplicate\s+the/i,
      /stolen\s+from/i,
      /ripped\s+from/i,
    ]
    for (const re of forbidden) {
      expect(text, `forbidden token ${re} in modal copy`).not.toMatch(re)
    }
    // Positive assertion: the dialog explicitly invokes "Inspired by" framing
    expect(text.toLowerCase()).toMatch(/inspired by/)
  })

  it('Test 8: when open=false, renders nothing', () => {
    const { container } = render(
      <TosClickwrapModal
        open={false}
        onAccepted={vi.fn()}
        onCancel={vi.fn()}
        acceptAction={vi.fn().mockResolvedValue({ ok: true })}
      />,
    )
    expect(container.querySelector('[data-testid="tos-clickwrap-modal"]')).toBeNull()
  })
})
