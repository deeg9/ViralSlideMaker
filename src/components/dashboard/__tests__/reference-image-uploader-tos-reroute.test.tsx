// Quick task 260510 (tos-page-wire-fix): regression test for the
// "Failed to mint upload URL" symptom when the server-side LEGAL-01 ToS gate
// rejects with 403 TOS_REQUIRED. The uploader must reopen the clickwrap modal
// rather than showing the cryptic generic error.
//
// Catches a regression where:
//   - Page forgets to pass `tosAlreadyAccepted={false}` (so client thinks ToS
//     is accepted and skips the modal client-side)
//   - Server-side gate rejects with 403 TOS_REQUIRED
//   - Old behavior: generic "Failed to mint upload URL" — cryptic
//   - New behavior: modal reopens so the user can accept and retry

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReferenceImageUploader } from '../reference-image-uploader'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/style-references/upload-url')) {
        // Simulate the server-side ToS gate rejection
        return {
          ok: false,
          status: 403,
          json: async () => ({
            error: {
              code: 'TOS_REQUIRED',
              message:
                'You must accept the style-from-reference Terms of Service before uploading.',
            },
          }),
        }
      }
      return { ok: true, json: async () => ({}) }
    }),
  )
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn().mockReturnValue('blob:fake'),
    revokeObjectURL: vi.fn(),
  } as unknown as typeof URL)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeFile(name: string, type: string, sizeBytes: number): File {
  const f = new File([new Uint8Array(0)], name, { type })
  Object.defineProperty(f, 'size', { value: sizeBytes, configurable: true })
  return f
}

describe('Quick 260510: TOS_REQUIRED reroute', () => {
  it('reopens the clickwrap modal when the mint route returns 403 TOS_REQUIRED (instead of showing the generic "Failed to mint upload URL" error)', async () => {
    const acceptTosAction = vi.fn().mockResolvedValue({ ok: true })

    // Simulate the page passing tosAlreadyAccepted=true (the bug scenario:
    // server-side audit row was missing or stale, so the gate rejects even
    // though the client thinks ToS is accepted).
    render(
      <ReferenceImageUploader
        tosAlreadyAccepted={true}
        acceptTosAction={acceptTosAction}
      />,
    )

    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('pic.png', 'image/png', 1000)] },
    })

    // Modal SHOULD reopen because the server returned TOS_REQUIRED
    await waitFor(() =>
      expect(screen.getByTestId('tos-clickwrap-modal')).toBeTruthy(),
    )

    // The cryptic generic error MUST NOT be visible — the modal supersedes it
    expect(screen.queryByText(/Failed to mint upload URL/i)).toBeNull()
  })

  it('shows the generic error for non-403 mint failures (network 500, etc.)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/style-references/upload-url')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({
              error: { code: 'INTERNAL_ERROR', message: 'something exploded' },
            }),
          }
        }
        return { ok: true, json: async () => ({}) }
      }),
    )

    render(<ReferenceImageUploader />)

    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('pic.png', 'image/png', 1000)] },
    })

    // The server's message is surfaced (better than the generic fallback)
    await waitFor(() =>
      expect(screen.getByText(/something exploded/i)).toBeTruthy(),
    )
    // Modal does NOT open for non-TOS failures
    expect(screen.queryByTestId('tos-clickwrap-modal')).toBeNull()
  })
})
