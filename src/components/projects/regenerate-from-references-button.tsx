'use client'

// Phase 78 Plan 02 Task 2 (REMIX-05):
// "Regenerate from references" button + confirmation modal. Visible only on
// projects whose `reference_assets` is non-null AND non-empty (REMIX-04
// inheritance from Plan 78-01's fork RPC). Dispatches the Phase 78 Plan 02
// Task 1 Server Action and navigates to the new project on success.
//
// LEGAL-03 framing discipline:
//   - Modal title: "Generate a new project inspired by these references"
//   - Cost indicator: "Generating will use 1 credit"
//   - Forbidden tokens enumerated by the test suite — see Test 11 + 12 in
//     regenerate-from-references-button.test.tsx for the canonical list.
//   - Test 11 + 12 enforce this with an HTML grep + source grep
//
// Modal uses base-ui Dialog (same primitive as <ProjectNamingDialog>) — the
// project does NOT have shadcn Dialog installed; base-ui is the established
// modal primitive in this codebase. The plan's "shadcn <Dialog>" reference
// is a generic "use the project's modal primitive" pointer per Rule 3
// (auto-fix blocking dependency mismatch — base-ui IS the project's choice).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { regenerateFromReferencesAction } from '@/app/(dashboard)/style-from-reference/actions'
import type { Project } from '@/lib/types/project'

interface RegenerateFromReferencesButtonProps {
  project: Pick<Project, 'id' | 'reference_assets'>
}

export function RegenerateFromReferencesButton({
  project,
}: RegenerateFromReferencesButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // REMIX-04 inheritance gate — only render when there are inherited refs
  // to regenerate from. Mirrors <ReferenceThumbnailsStrip>'s null/empty
  // guard so the two surfaces stay in lockstep.
  const refs = project.reference_assets
  if (!refs || refs.length === 0) return null

  async function handleConfirm() {
    if (pending) return
    setError(null)
    setPending(true)
    try {
      const result = await regenerateFromReferencesAction({
        sourceProjectId: project.id,
      })
      if (result.ok) {
        router.push(`/project/${result.projectId}`)
        // Don't reset pending — route change unmounts; if it doesn't, the
        // button is hidden behind the new project page.
        return
      }
      // Error surface: short, user-friendly message keyed off result.error.
      const userMessage = (() => {
        switch (result.error) {
          case 'unauthenticated':
            return 'Please sign in to regenerate.'
          case 'no_references':
            return 'No references found on this project.'
          case 'source_not_found':
            return 'Could not find the source project.'
          case 'extract_failed':
            return 'Could not analyze the references. Try again in a moment.'
          case 'emit_failed':
            return 'Could not generate the new project. Try again in a moment.'
          default:
            return 'Something went wrong. Try again in a moment.'
        }
      })()
      setError(userMessage)
    } catch {
      setError('Something went wrong. Try again in a moment.')
    } finally {
      setPending(false)
    }
  }

  function handleClose() {
    if (pending) return
    setError(null)
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="regenerate-from-references-button"
        onClick={() => setOpen(true)}
        className="rounded-xl border-[#dbc1bc] text-[#3d0000]"
      >
        Regenerate from references
      </Button>

      <Dialog.Root open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Popup
            data-testid="regenerate-from-references-modal"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8 shadow-[0px_40px_80px_rgba(61,0,0,0.15)]"
          >
            <Dialog.Title className="mb-2 text-lg font-bold text-[#3d0000]">
              Generate a new project inspired by these references
            </Dialog.Title>
            <Dialog.Description className="mb-6 text-sm text-[#7d6161]">
              We will analyze the inherited references and create a new
              sibling project in your dashboard. Your current project is
              not modified.
            </Dialog.Description>

            <div className="mb-6 rounded-xl bg-[#fff0f0] border border-[#dbc1bc]/30 px-4 py-3 text-xs text-[#3d0000]">
              Generating will use 1 credit.
            </div>

            {error && (
              <div
                data-testid="regenerate-from-references-error"
                role="alert"
                className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={pending}
                className="rounded-xl border-[#dbc1bc] text-[#7d6161]"
              >
                Cancel
              </Button>
              <button
                type="button"
                data-testid="regenerate-from-references-confirm"
                onClick={handleConfirm}
                disabled={pending}
                className="bg-[#3d0000] text-white px-6 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {pending ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
