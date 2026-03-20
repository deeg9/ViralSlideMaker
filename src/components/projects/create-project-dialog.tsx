'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { createProject } from '@/app/(dashboard)/dashboard/actions'

interface CreateProjectDialogProps {
  asPlaceholderCard?: boolean
}

export function CreateProjectDialog({ asPlaceholderCard }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    const projectId = await createProject(formData)
    setOpen(false)
    formRef.current?.reset()
    if (projectId) {
      router.push(`/project/${projectId}`)
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
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
                className="bg-[#3d0000] text-white px-6 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform"
              >
                Create Project
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
