import type { SupabaseClient } from '@supabase/supabase-js'

export async function listProjects(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, topic, description, template_id, slide_data, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getProject(supabase: SupabaseClient, userId: string, projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function createProjectService(
  supabase: SupabaseClient,
  userId: string,
  input: { title: string; description?: string | null; topic?: string | null; template_id?: string | null; slide_data?: unknown[] }
) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, ...input, slide_data: input.slide_data ?? [] })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function deleteProjectService(supabase: SupabaseClient, userId: string, projectId: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function updateProjectService(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  data: Record<string, unknown>
) {
  const { error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', projectId)
    .eq('user_id', userId)
  if (error) throw error
}
