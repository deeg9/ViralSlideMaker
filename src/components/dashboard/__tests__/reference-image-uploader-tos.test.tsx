// Phase 79 Plan 02 Task 2 (LEGAL-01):
// Contract tests for the ToS clickwrap gate wired into <ReferenceImageUploader>.
//
// Two layers of defense:
//   - CLIENT: when the parent says the user has not accepted the current ToS
//     (`tosAlreadyAccepted={false}`), the FIRST upload click MUST open the
//     clickwrap modal and BLOCK the upload until the user clicks Accept (which
//     fires the injected `acceptTosAction` and flips client state).
//   - SERVER: the existing /api/style-references/upload-url route gains an
//     audit-log check; when no row matches the current ToS version it returns
//     `{ error: { code: 'TOS_REQUIRED' }, status: 403 }`. This is verified in
//     a sibling route test (route-tos.test.ts) — the present file pins the
//     CLIENT-side gate and the prop API.
//
// What this pins:
//   T1: tosAlreadyAccepted=true (default) → drop-file flows directly to
//       upload, modal is NEVER mounted (preserves existing C3-style happy
//       path for the 10 baseline tests)
//   T2: tosAlreadyAccepted=false → drop-file does NOT call fetch and DOES
//       mount the clickwrap modal
//   T3: clicking Accept inside the modal calls acceptTosAction, then the
//       PENDING upload proceeds (fetch is invoked exactly twice — mint URL
//       + storage PUT)
//   T4: clicking Cancel in the modal aborts the upload (fetch never called),
//       but leaves the uploader in a state where the user can retry later
//   T5: after a successful Accept, subsequent uploads in the SAME session
//       skip the modal (acceptance is sticky for the lifetime of the
//       component instance)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReferenceImageUploader } from '../reference-image-uploader'

// ---- Polyfills mirroring the existing reference-image-uploader test ----
let createObjectURLCalls = 0

beforeEach(() => {
  createObjectURLCalls = 0
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/style-references/upload-url')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              uploadUrl: 'https://supabase.example/upload/signed/abc',
              token: 'tok',
              method: 'PUT',
              headers: { 'Content-Type': 'image/png' },
              path: 'user_123/uuid-pic.png',
            },
          }),
        }
      }
      // Storage PUT
      return { ok: true, json: async () => ({}) }
    }),
  )
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn().mockImplementation(() => {
      createObjectURLCalls++
      return `blob:fake-${createObjectURLCalls}`
    }),
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

describe('Phase 79 Plan 02 Task 2: ReferenceImageUploader × ToS clickwrap (LEGAL-01)', () => {
  it('Test T1: tosAlreadyAccepted=true (default) → drop-file uploads directly, no modal', async () => {
    const onUploadComplete = vi.fn()
    render(<ReferenceImageUploader onUploadComplete={onUploadComplete} />)

    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('pic.png', 'image/png', 1000)] },
    })

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalled())
    // No modal in the document
    expect(document.querySelector('[data-testid="tos-clickwrap-modal"]')).toBeNull()
    // 2 fetches as before (mint + PUT)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('Test T2: tosAlreadyAccepted=false → drop-file opens modal and BLOCKS the upload', async () => {
    const acceptTosAction = vi.fn().mockResolvedValue({ ok: true })
    render(
      <ReferenceImageUploader
        tosAlreadyAccepted={false}
        acceptTosAction={acceptTosAction}
      />,
    )

    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('pic.png', 'image/png', 1000)] },
    })

    await waitFor(() =>
      expect(screen.getByTestId('tos-clickwrap-modal')).toBeTruthy(),
    )
    // Upload is BLOCKED — no signed-URL mint, no storage PUT
    expect(fetch).not.toHaveBeenCalled()
    // The injected accept action is NOT called yet (user hasn't clicked Accept)
    expect(acceptTosAction).not.toHaveBeenCalled()
  })

  it('Test T3: clicking Accept then resumes the pending upload (fetch fires twice)', async () => {
    const acceptTosAction = vi.fn().mockResolvedValue({ ok: true })
    const onUploadComplete = vi.fn()
    render(
      <ReferenceImageUploader
        tosAlreadyAccepted={false}
        acceptTosAction={acceptTosAction}
        onUploadComplete={onUploadComplete}
      />,
    )

    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('pic.png', 'image/png', 1000)] },
    })

    // Wait for modal to mount
    await waitFor(() =>
      expect(screen.getByTestId('tos-clickwrap-modal')).toBeTruthy(),
    )

    // Tick checkbox + click Accept
    fireEvent.click(screen.getByTestId('tos-clickwrap-checkbox'))
    fireEvent.click(screen.getByTestId('tos-clickwrap-accept'))

    await waitFor(() => expect(acceptTosAction).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onUploadComplete).toHaveBeenCalled())
    // Upload pipeline ran: mint + PUT
    expect(fetch).toHaveBeenCalledTimes(2)
    // Modal closed after acceptance
    await waitFor(() =>
      expect(document.querySelector('[data-testid="tos-clickwrap-modal"]')).toBeNull(),
    )
  })

  it('Test T4: clicking Cancel in the modal aborts the upload (no fetch, no callback)', async () => {
    const acceptTosAction = vi.fn().mockResolvedValue({ ok: true })
    const onUploadComplete = vi.fn()
    render(
      <ReferenceImageUploader
        tosAlreadyAccepted={false}
        acceptTosAction={acceptTosAction}
        onUploadComplete={onUploadComplete}
      />,
    )

    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('pic.png', 'image/png', 1000)] },
    })

    await waitFor(() =>
      expect(screen.getByTestId('tos-clickwrap-modal')).toBeTruthy(),
    )
    fireEvent.click(screen.getByTestId('tos-clickwrap-cancel'))

    // Modal closed without invoking the action or starting the upload
    await waitFor(() =>
      expect(document.querySelector('[data-testid="tos-clickwrap-modal"]')).toBeNull(),
    )
    expect(acceptTosAction).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(onUploadComplete).not.toHaveBeenCalled()
  })

  it('Test T5: after Accept, second upload in the same session skips the modal', async () => {
    const acceptTosAction = vi.fn().mockResolvedValue({ ok: true })
    const onUploadComplete = vi.fn()
    render(
      <ReferenceImageUploader
        tosAlreadyAccepted={false}
        acceptTosAction={acceptTosAction}
        onUploadComplete={onUploadComplete}
      />,
    )

    // First drop → modal opens → accept
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('first.png', 'image/png', 1000)] },
    })
    await waitFor(() =>
      expect(screen.getByTestId('tos-clickwrap-modal')).toBeTruthy(),
    )
    fireEvent.click(screen.getByTestId('tos-clickwrap-checkbox'))
    fireEvent.click(screen.getByTestId('tos-clickwrap-accept'))
    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1))

    // Second drop → modal does NOT open; upload proceeds directly
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('second.png', 'image/png', 1000)] },
    })
    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(2))
    expect(acceptTosAction).toHaveBeenCalledTimes(1) // still only one acceptance
    // Modal is NOT mounted
    expect(document.querySelector('[data-testid="tos-clickwrap-modal"]')).toBeNull()
  })
})
