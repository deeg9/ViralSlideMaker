'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  publishProjectToExplore,
  unpublishCarousel,
} from '@/app/(dashboard)/project/[id]/publish-actions'

const TAG_REGEX = /^[a-z0-9][a-z0-9_-]*[a-z0-9]?$/
const BANNED_TAG_PATTERNS = [/n[i1]gg/i, /f[a4]g/i, /tr[a4]nn/i, /cunt/i, /retard/i]

function normalizeTagsInput(raw: string): { ok: true; tags: string[] } | { ok: false; error: string } {
  const tokens = raw
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
    .filter(Boolean)
  const tags: string[] = []
  for (const t of tokens) {
    if (t.length > 24 || !TAG_REGEX.test(t)) continue
    if (BANNED_TAG_PATTERNS.some((re) => re.test(t))) {
      return { ok: false, error: `Tag "${t}" is not allowed` }
    }
    if (!tags.includes(t)) tags.push(t)
    if (tags.length >= 5) break
  }
  return { ok: true, tags }
}

export type SaveVisibilityResult =
  | { success: true; visibility: 'public' | 'private'; slug?: string }
  | { success: false; error: string }

export async function saveVisibility(
  projectId: string,
  formData: FormData,
): Promise<SaveVisibilityResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const title = ((formData.get('title') as string) ?? '').trim()
  const visibility = formData.get('visibility') === 'public' ? 'public' : 'private'
  const tagsRaw = ((formData.get('tags') as string) ?? '').trim()

  if (!title) return { success: false, error: 'Title is required' }
  if (title.length > 120) return { success: false, error: 'Title must be 120 characters or fewer' }

  const tagsResult = normalizeTagsInput(tagsRaw)
  if (!tagsResult.ok) return { success: false, error: tagsResult.error }
  const tags = tagsResult.tags

  // Validate ownership
  const { data: projectRow } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!projectRow) return { success: false, error: 'Project not found' }

  // Sync projects.title
  const { error: projUpdateErr } = await supabase
    .from('projects')
    .update({ title })
    .eq('id', projectId)
    .eq('user_id', user.id)
  if (projUpdateErr) return { success: false, error: projUpdateErr.message }

  // Find current visible published row for this project, if any
  const { data: publishedRow } = await supabase
    .from('published_carousels')
    .select('id, slug')
    .eq('source_project_id', projectId)
    .eq('owner_id', user.id)
    .is('unpublished_at', null)
    .maybeSingle()

  if (visibility === 'public' && !publishedRow) {
    // private → public: delegate to existing publish flow (renders hero PNG)
    const fd = new FormData()
    fd.set('title', title)
    fd.set('description', '')
    fd.set('tags', tags.join(','))
    const result = await publishProjectToExplore(projectId, fd)
    if (!result.success) return { success: false, error: result.error }
    revalidatePath('/dashboard')
    return { success: true, visibility: 'public', slug: result.slug }
  }

  if (visibility === 'public' && publishedRow) {
    // public → public + edits: UPDATE existing row's title + tags
    const { error: updateErr } = await supabase
      .from('published_carousels')
      .update({ title, tags })
      .eq('id', publishedRow.id)
      .eq('owner_id', user.id)
    if (updateErr) return { success: false, error: updateErr.message }
    revalidatePath('/dashboard')
    revalidatePath('/explore')
    revalidatePath(`/explore/${publishedRow.slug}`)
    return { success: true, visibility: 'public', slug: publishedRow.slug }
  }

  if (visibility === 'private' && publishedRow) {
    // public → private: unpublish
    const result = await unpublishCarousel(publishedRow.id)
    if (!result.success) return { success: false, error: result.error }
    revalidatePath('/dashboard')
    return { success: true, visibility: 'private' }
  }

  // private → private: title already synced above
  revalidatePath('/dashboard')
  return { success: true, visibility: 'private' }
}
