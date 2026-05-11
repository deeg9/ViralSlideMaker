'use client'

// Phase 79 Plan 02 Task 1 (LEGAL-01):
// ToS clickwrap modal — gates the FIRST style-from-reference upload per
// user. Renders only when `open` is true; the parent (Plan 79-02 Task 2,
// <ReferenceImageUploader>) computes `open` from a server-checked
// "has the current user accepted the current ToS version?" lookup.
//
// Anatomy mirrors src/components/projects/edit-visibility-modal.tsx — a
// fixed-positioned overlay with a centered card. The codebase ships no
// shadcn `<Dialog>` primitive; the native pattern is the established one.
//
// LEGAL-03 framing discipline: copy uses "Inspired by" language only.
// Phase 79 Plan 02 Task 4 ships a repo-wide grep gate that fails CI on
// `exactly like / clone / copy this / duplicate the / stolen from /
// ripped from` tokens in this file (and every v2.13 UI surface file).
// Test 7 in __tests__/tos-clickwrap-modal.test.tsx asserts the rendered
// DOM stays clean as a forward defense.

import { useState } from 'react'

export interface TosAcceptResult {
  ok: boolean
  error?: unknown
}

export interface TosClickwrapModalProps {
  /** Parent computes from `hasUserAcceptedCurrentTos`; modal renders nothing
   *  when false (fast path for repeat uploaders). */
  open: boolean
  /** Called after the server action returns `{ ok: true }` — parent should
   *  flip its local "accepted" state and proceed with the upload. */
  onAccepted: () => void
  /** Called when the user clicks Cancel — parent should abort the upload
   *  attempt that opened the modal. */
  onCancel: () => void
  /** Server action that records acceptance. Plan 79-02 Task 1 wires this to
   *  `acceptStyleFromReferenceTosAction` (defined in
   *  src/app/(dashboard)/style-from-reference/actions.ts). Inversion-of-
   *  control here keeps the component pure: the test injects a vi.fn() and
   *  asserts dispatch shape without spinning up the server-action runtime. */
  acceptAction: (version: string) => Promise<TosAcceptResult>
}

import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'

export function TosClickwrapModal({
  open,
  onAccepted,
  onCancel,
  acceptAction,
}: TosClickwrapModalProps) {
  const [checked, setChecked] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleAccept() {
    if (!checked || pending) return
    setError(null)
    setPending(true)
    const result = await acceptAction(STYLE_FROM_REFERENCE_TOS_VERSION)
    setPending(false)
    if (result.ok) {
      onAccepted()
    } else {
      setError('We could not record your acceptance. Please try again.')
    }
  }

  return (
    <div
      data-testid="tos-clickwrap-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tos-clickwrap-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 border border-[#dbc1bc]/40 shadow-xl">
        <h2
          id="tos-clickwrap-title"
          className="text-xl font-bold text-[#3d0000]"
        >
          Reference image terms
        </h2>
        <p className="mt-2 text-sm text-[#55423f]">
          You can upload reference images to generate carousels{' '}
          <strong>inspired by</strong> their visual style. The output reflects
          aesthetic patterns (palette, typography, layout) — it is not a
          reproduction of the source images, brands, or any individuals
          depicted.
        </p>
        <p className="mt-3 text-sm text-[#55423f]">
          Before your first upload, please confirm that you have the rights
          needed to share these images with us, and that they do not infringe
          another party&rsquo;s intellectual property, publicity, or privacy
          rights. If we receive a takedown request that matches your upload,
          we may remove the underlying audit record per our DMCA process.
        </p>

        <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
          <input
            data-testid="tos-clickwrap-checkbox"
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#dbc1bc] text-[#3d0000] focus:ring-[#3d0000]/30"
          />
          <span className="text-sm text-[#3d0000]">
            I have the rights to upload these reference images and I understand
            generated carousels will be inspired by — not copies of — their
            visual style.
          </span>
        </label>

        {error && (
          <div
            data-testid="tos-clickwrap-error"
            role="alert"
            className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <p className="mt-4 text-[11px] text-[#7d6161]">
          Terms version: {STYLE_FROM_REFERENCE_TOS_VERSION}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-testid="tos-clickwrap-cancel"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#7d6161] hover:bg-[#fadbdb] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="tos-clickwrap-accept"
            onClick={handleAccept}
            disabled={!checked || pending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#3d0000] text-white hover:bg-[#5a0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Recording…' : 'Accept and continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
