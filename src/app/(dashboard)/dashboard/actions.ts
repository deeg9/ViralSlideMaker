'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createProject(formData: FormData) {
  const supabase = await createClient()

  const title = (formData.get('title') as string)?.trim() || 'Untitled Project'
  const description = (formData.get('description') as string)?.trim() || null

  const { data } = await supabase
    .from('projects')
    .insert({ title, description, slide_data: [] })
    .select('id')
    .single()

  revalidatePath('/dashboard')

  return data?.id ?? null
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()

  await supabase.from('projects').delete().eq('id', projectId)

  revalidatePath('/dashboard')
}

export async function updateProject(
  projectId: string,
  data: { title?: string; description?: string }
) {
  const supabase = await createClient()

  await supabase.from('projects').update(data).eq('id', projectId)

  revalidatePath('/dashboard')
}
