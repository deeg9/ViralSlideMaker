'use client'

import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { createProject } from '@/app/(dashboard)/dashboard/actions'

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    await createProject(formData)
    setOpen(false)
    formRef.current?.reset()
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={
        <Button>
          <Plus className="size-4" />
          New Project
        </Button>
      } />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-bold">
            New Project
          </Dialog.Title>
          <Dialog.Description className="mb-4 text-sm text-muted-foreground">
            Give your slideshow project a name to get started.
          </Dialog.Description>
          <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                placeholder="My Slideshow"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="What is this slideshow about?"
                rows={3}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Dialog.Close render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              } />
              <Button type="submit">Create Project</Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
