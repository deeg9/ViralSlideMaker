'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { deleteProject } from '@/app/(dashboard)/dashboard/actions'
import type { Project } from '@/lib/types/project'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()

  function handleCardClick() {
    router.push(`/project/${project.id}`)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return
    await deleteProject(project.id)
  }

  return (
    <Card
      className="cursor-pointer hover:ring-foreground/20 transition-shadow"
      onClick={handleCardClick}
    >
      <CardHeader>
        <CardTitle className="truncate font-bold text-base">
          {project.title}
        </CardTitle>
        <CardDescription>
          {project.description ?? 'No description'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Updated {relativeTime(project.updated_at)}
        </p>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          aria-label={`Delete ${project.title}`}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
