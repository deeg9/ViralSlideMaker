'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { useNavigationLoader } from '@/components/layout/navigation-loader'
import { createProject } from '@/app/(dashboard)/dashboard/actions'

interface CreateProjectDialogProps {
  asPlaceholderCard?: boolean
}

export function CreateProjectDialog({ asPlaceholderCard }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  // quick-260510-card-loading: tracks just the in-flight server action so we
  // can disable the submit button + show "Creating…". The full-screen overlay
  // itself is rendered by NavigationLoaderProvider — same morphing square
  // used by every other navigation in the shell.
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const wantsNew = searchParams.get('new') === '1'
  const { startNavigation, stopNavigation } = useNavigationLoader()

  useEffect(() => {
    if (wantsNew && !asPlaceholderCard) setOpen(true)
  }, [wantsNew, asPlaceholderCard])

  // quick-260510: must use onSubmit + preventDefault rather than React 19's
  // form `action` prop. When a function is passed to `action={...}`, React
  // wraps the call in startTransition — which DEFERS the setSubmitting(true)
  // state update until the awaited server action resolves. That means the
  // overlay never paints during the in-flight window: by the time React
  // commits the state, the action is already done and we're closing the
  // modal + navigating. Plain onSubmit keeps state updates outside the
  // transition so the overlay paints on the very next frame.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const formData = new FormData(e.currentTarget)
    setSubmitting(true)
    startNavigation('Creating project…')
    try {
      const projectId = await createProject(formData)
      setOpen(false)
      formRef.current?.reset()
      if (wantsNew) router.replace('/dashboard')
      if (projectId) {
        router.push(`/project/${projectId}`)
      } else {
        // No projectId → server action rejected (e.g. free-tier limit). Clear
        // the overlay + button so the user can correct and retry. The path
        // didn't change, so the loader's pathname-based auto-clear won't fire
        // — call stopNavigation explicitly.
        setSubmitting(false)
        stopNavigation()
      }
    } catch (err) {
      setSubmitting(false)
      stopNavigation()
      throw err
    }
  }

  const trigger = asPlaceholderCard ? (
    <div className="aspect-[9/16] bg-[#fff0f0] border-2 border-dashed border-[#dbc1bc]/30 rounded-xl flex flex-col items-center justify-center gap-4 hover:bg-[#ffe1e1] transition-colors cursor-pointer">
      <div className="w-12 h-12 rounded-full bg-[#fadbdb] flex items-center justify-center">
        <Icon name="add" className="text-[#3d0000]" />
      </div>
      <span className="text-[0.75rem] font-bold uppercase tracking-widest text-[#7d6161]">Start Fresh</span>
    </div>
  ) : (
    <button className="bg-[#3d0000] text-white px-8 py-4 rounded-xl font-bold tracking-tight shadow-lg shadow-[#3d0000]/10 hover:translate-y-[-2px] transition-all flex items-center gap-2">
      <Icon name="add" size="sm" />
      Create New Slide
    </button>
  )

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && wantsNew) router.replace('/dashboard')
      }}
    >
      <Dialog.Trigger render={trigger} />
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
                className="rounded-xl border border-[#dbc1bc]/30 bg-[#fff0f0] px-4 py-3 text-sm text-[#3d0000] outline-none focus:border-[#3d0000] focus:ring-1 focus:ring-[#3d0000] resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <Dialog.Close render={
                <Button type="button" variant="outline" className="rounded-xl border-[#dbc1bc] text-[#7d6161]">
                  Cancel
                </Button>
              } />
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#3d0000] text-white px-6 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {submitting ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
      {submitting && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Creating project"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#fff5f5]/80 backdrop-blur-sm"
        >
          <MorphingSquare
            className="bg-[#3d0000]"
            message="Creating project…"
          />
        </div>
      )}
    </Dialog.Root>
  )
}
