'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createProjectService,
  deleteProjectService,
  updateProjectService,
} from '@/lib/services/projects'

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const title = (formData.get('title') as string)?.trim() || 'Untitled Project'
  const description = (formData.get('description') as string)?.trim() || null

  const data = await createProjectService(supabase, user.id, { title, description })

  revalidatePath('/dashboard')

  return data?.id ?? null
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await deleteProjectService(supabase, user.id, projectId)

  revalidatePath('/dashboard')
}

export async function updateProject(
  projectId: string,
  data: { title?: string; description?: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await updateProjectService(supabase, user.id, projectId, data)

  revalidatePath('/dashboard')
}
