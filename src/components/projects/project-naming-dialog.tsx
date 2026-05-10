'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { useNavigationLoader } from '@/components/layout/navigation-loader'
import { deleteProject, updateProject } from '@/app/(dashboard)/dashboard/actions'

interface ProjectNamingDialogProps {
  projectId: string
  initialTitle?: string
  initialDescription?: string
}

/**
 * quick-260510-modal-on-prompt-page: naming dialog rendered on top of the
 * project empty-state page. Auto-opens when `?naming=1` is in the URL —
 * StartNewProject lands the user here right after createProject.
 *
 * Submit  → updateProject(title, description) → drops ?naming=1.
 * Cancel  → deleteProject (this is a brand-new row with no slides, so the
 *          cascade is just one delete) → router.push('/dashboard').
 *
 * Uses onSubmit + e.preventDefault rather than the React 19 form `action`
 * prop. action={fn} runs the handler inside startTransition which DEFERS
 * state updates until the awaited server action resolves — that means the
 * loading overlay would never paint. Plain onSubmit keeps state updates
 * outside the transition (see commit b71b2be).
 */
export function ProjectNamingDialog({
  projectId,
  initialTitle,
  initialDescription,
}: ProjectNamingDialogProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const naming = searchParams.get('naming') === '1'
  const [open, setOpen] = useState(naming)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const { startNavigation, stopNavigation } = useNavigationLoader()

  // Track the URL flag — useful for back/forward nav that toggles ?naming.
  useEffect(() => {
    setOpen(naming)
  }, [naming])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const formData = new FormData(e.currentTarget)
    const title = ((formData.get('title') as string) ?? '').trim() || 'Untitled Project'
    const description = ((formData.get('description') as string) ?? '').trim() || undefined

    setSubmitting(true)
    try {
      await updateProject(projectId, { title, description })
      router.replace(`/project/${projectId}`)
      router.refresh()
      // Component stays mounted; close the dialog so the user can see the form.
      setOpen(false)
      setSubmitting(false)
    } catch (err) {
      setSubmitting(false)
      const message = err instanceof Error ? err.message : 'Could not save project name.'
      if (typeof window !== 'undefined') window.alert(message)
    }
  }

  async function handleCancel() {
    if (cancelling || submitting) return
    setCancelling(true)
    startNavigation('Returning to dashboard…')
    try {
      await deleteProject(projectId)
      router.push('/dashboard')
      // pending stays true — route change unmounts the component.
    } catch (err) {
      stopNavigation()
      setCancelling(false)
      const message = err instanceof Error ? err.message : 'Could not cancel project.'
      if (typeof window !== 'undefined') window.alert(message)
    }
  }

  // Block dismissal via outside-click or Esc — both should route through
  // Cancel so we delete the placeholder row instead of stranding it. The
  // controlled `open` state ignores requests to close that don't come from
  // our explicit handlers.
  return (
    <Dialog.Root open={open} onOpenChange={() => undefined}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8 shadow-[0px_40px_80px_rgba(61,0,0,0.15)]">
          <Dialog.Title className="mb-1 text-lg font-bold text-[#3d0000]">
            New Project
          </Dialog.Title>
          <Dialog.Description className="mb-6 text-sm text-[#7d6161]">
            Give your slideshow project a name to get started.
          </Dialog.Description>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                placeholder="My Slideshow"
                defaultValue={initialTitle && initialTitle !== 'Untitled Project' ? initialTitle : ''}
                autoFocus
                className="h-12 rounded-xl border border-[#dbc1bc]/30 bg-[#fff0f0] px-4 text-sm text-[#3d0000] outline-none focus:border-[#3d0000] focus:ring-1 focus:ring-[#3d0000]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
                Description <span className="font-normal text-[#dbc1bc]">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="What is this slideshow about?"
                rows={3}
                defaultValue={initialDescription ?? ''}
                className="rounded-xl border border-[#dbc1bc]/30 bg-[#fff0f0] px-4 py-3 text-sm text-[#3d0000] outline-none focus:border-[#3d0000] focus:ring-1 focus:ring-[#3d0000] resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={submitting || cancelling}
                className="rounded-xl border-[#dbc1bc] text-[#7d6161]"
              >
                Cancel
              </Button>
              <button
                type="submit"
                disabled={submitting || cancelling}
                className="bg-[#3d0000] text-white px-6 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {submitting ? 'Saving…' : 'Create Project'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
