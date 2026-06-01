import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_FORMAT_NEW } from '@/lib/render/carousel-formats'

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
  input: { title: string; description?: string | null; topic?: string | null; template_id?: string | null; slide_data?: unknown[]; output_format?: string | null }
) {
  const { data, error } = await supabase
    .from('projects')
    // Phase 90: new carousels default to Instagram 4:5 (output_format is
    // listed BEFORE ...input so an explicit input.output_format still wins —
    // e.g. a future "remix preserves format" path).
    .insert({ user_id: userId, output_format: DEFAULT_FORMAT_NEW, ...input, slide_data: input.slide_data ?? [] })
    .select('id')
    .single()
  if (error) throw error
  return data
}

// Phase 58 (PARITY-06, D-17): extract storage path from a public Supabase
// URL. Returns null if URL is not a Supabase storage URL for the given
// bucket. Pure function — easily unit-testable.
export function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.substring(idx + marker.length)
}

interface SlideForCleanup {
  background_url?: string | null
  original_source_url?: string | null
}

export async function deleteProjectService(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  admin?: SupabaseClient,
) {
  // Phase 58 (PARITY-06, D-17): cascade-delete cleanup. Best-effort —
  // never blocks the row delete on storage cleanup failure.
  if (admin) {
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('slide_data')
        .eq('id', projectId)
        .eq('user_id', userId)
        .maybeSingle()

      if (project?.slide_data) {
        const slides = (project.slide_data ?? []) as SlideForCleanup[]
        const treatedPaths: string[] = []
        const originalPaths: string[] = []
        for (const slide of slides) {
          if (slide.background_url) {
            const p = extractStoragePath(
              slide.background_url,
              'slide-backgrounds-treated',
            )
            if (p) treatedPaths.push(p)
          }
          if (slide.original_source_url) {
            const p = extractStoragePath(
              slide.original_source_url,
              'slide-backgrounds',
            )
            if (p) originalPaths.push(p)
          }
        }

        if (treatedPaths.length > 0) {
          await admin.storage
            .from('slide-backgrounds-treated')
            .remove(treatedPaths)
            .catch((err) =>
              console.warn('[delete-project] treated cleanup failed:', err),
            )
        }
        if (originalPaths.length > 0) {
          await admin.storage
            .from('slide-backgrounds')
            .remove(originalPaths)
            .catch((err) =>
              console.warn('[delete-project] original cleanup failed:', err),
            )
        }
      }
    } catch (err) {
      console.warn('[delete-project] cascade-delete pre-fetch failed:', err)
    }
  }

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
