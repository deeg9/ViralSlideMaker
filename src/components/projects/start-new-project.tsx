'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/app/(dashboard)/dashboard/actions'
import { useNavigationLoader } from '@/components/layout/navigation-loader'

interface RenderProps {
  start: () => void
  pending: boolean
}

interface StartNewProjectProps {
  children: (props: RenderProps) => React.ReactNode
}

/**
 * quick-260510-modal-on-prompt-page: shared trigger for the "new project" UX.
 * Click → call `createProject` with the placeholder title "Untitled Project",
 * then navigate to /project/{id}?naming=1 so the empty-state prompt page
 * pops the naming dialog on top of the real generation form.
 *
 * One place owns the flow so every trigger surface (top navbar +, bottom
 * navbar Create, header "Create New Slide" button, Start Fresh placeholder
 * card, legacy /dashboard?new=1 URL) gets the same loader handling, error
 * recovery, and post-create destination.
 */
export function StartNewProject({ children }: StartNewProjectProps) {
  const router = useRouter()
  const { startNavigation, stopNavigation } = useNavigationLoader()
  const [pending, setPending] = useState(false)

  const start = useCallback(async () => {
    if (pending) return
    setPending(true)
    startNavigation('Creating project…')
    try {
      const formData = new FormData()
      formData.set('title', 'Untitled Project')
      const projectId = await createProject(formData)
      if (!projectId) {
        // Service returned null without throwing — treat as a soft failure.
        stopNavigation()
        setPending(false)
        return
      }
      router.push(`/project/${projectId}?naming=1`)
      // Don't clear pending here — the route change unmounts this component.
    } catch (err) {
      // createProject throws on free-tier limit, unauthenticated, etc.
      // Surface as a window-level alert; richer toast UI can replace this.
      stopNavigation()
      setPending(false)
      const message = err instanceof Error ? err.message : 'Could not create project.'
      if (typeof window !== 'undefined') {
        window.alert(message)
      }
    }
  }, [pending, router, startNavigation, stopNavigation])

  return <>{children({ start, pending })}</>
}
