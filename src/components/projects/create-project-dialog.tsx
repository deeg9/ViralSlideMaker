'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { MorphingSquare } from '@/components/ui/morphing-square'
import { createProject } from '@/app/(dashboard)/dashboard/actions'

interface CreateProjectDialogProps {
  asPlaceholderCard?: boolean
}

export function CreateProjectDialog({ asPlaceholderCard }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  // quick-260510-card-loading: covers the full createProject() server action
  // PLUS the subsequent router.push to /project/{id}. The createProject server
  // action does a Supabase insert; the project page is server-rendered with
  // additional fetches and then mounts the heavy editor canvas — together
  // routinely 1-3 seconds. Without an indicator the modal just freezes after
  // submit. Cleared on error or when this component unmounts post-navigation.
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const wantsNew = searchParams.get('new') === '1'

  useEffect(() => {
    if (wantsNew && !asPlaceholderCard) setOpen(true)
  }, [wantsNew, asPlaceholderCard])

  async function handleSubmit(formData: FormData) {
    setSubmitting(true)
    try {
      const projectId = await createProject(formData)
      setOpen(false)
      formRef.current?.reset()
      if (wantsNew) router.replace('/dashboard')
      if (projectId) {
        router.push(`/project/${projectId}`)
      } else {
        // No projectId → server action rejected (e.g. free-tier limit). Clear
        // the overlay so the user can correct and retry.
        setSubmitting(false)
      }
    } catch (err) {
      setSubmitting(false)
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
          <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
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
