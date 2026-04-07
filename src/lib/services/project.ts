import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ApiError } from '@/lib/api/errors'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ProjectListItem {
  id: string
  title: string
  topic: string | null
  template_id: string | null
  generation_status: string | null
  created_at: string
  updated_at: string
}

interface ProjectDetail {
  id: string
  title: string
  topic: string | null
  template_id: string | null
  generation_status: string | null
  slide_data: unknown
  created_at: string
  updated_at: string
}

interface ServiceOptions {
  adminClient?: SupabaseClient
}

async function getClient(options?: ServiceOptions): Promise<SupabaseClient> {
  return options?.adminClient ?? (await createClient())
}

export async function listProjects(
  userId: string,
  options?: ServiceOptions
): Promise<ProjectListItem[]> {
  const supabase = await getClient(options)

  const { data, error } = await supabase
    .from('projects')
    .select('id, title, topic, template_id, generation_status, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to list projects')
  }

  return data ?? []
}

export async function getProject(
  userId: string,
  projectId: string,
  options?: ServiceOptions
): Promise<ProjectDetail | null> {
  const supabase = await getClient(options)

  const { data, error } = await supabase
    .from('projects')
    .select('id, title, topic, template_id, generation_status, slide_data, created_at, updated_at')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to get project')
  }

  return data
}

export async function createProjectService(
  userId: string,
  params: { title: string; topic?: string; templateId?: string },
  options?: ServiceOptions
): Promise<{ id: string }> {
  const supabase = await getClient(options)

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      title: params.title,
      topic: params.topic ?? null,
      template_id: params.templateId ?? null,
      slide_data: [],
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to create project')
  }

  return { id: data.id }
}

export async function deleteProjectService(
  userId: string,
  projectId: string,
  options?: ServiceOptions
): Promise<void> {
  const supabase = await getClient(options)

  const { data, error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to delete project')
  }

  if (!data || data.length === 0) {
    throw new ApiError('NOT_FOUND', 'Project not found')
  }
}
