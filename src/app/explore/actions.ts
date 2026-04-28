'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function forkCarousel(
  publishedId: string,
): Promise<{ success: true; projectId: string } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Sign in to remix this carousel' }
  }

  const { data, error } = await supabase.rpc('fork_published_carousel', {
    p_published_id: publishedId,
  })
  if (error) {
    return { success: false, error: error.message }
  }
  const projectId = data as string
  revalidatePath('/dashboard')
  return { success: true, projectId }
}

export async function forkAndRedirect(publishedId: string): Promise<void> {
  const result = await forkCarousel(publishedId)
  if (result.success) {
    redirect(`/project/${result.projectId}`)
  } else {
    redirect(`/explore?error=${encodeURIComponent(result.error)}`)
  }
}

export async function trackView(publishedId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('carousel_events').insert({
    published_carousel_id: publishedId,
    event_type: 'view',
  })
}

export async function toggleBookmark(
  publishedId: string,
): Promise<{ success: true; bookmarked: boolean } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Sign in to bookmark' }
  }

  const { data: existing } = await supabase
    .from('bookmarks')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('published_carousel_id', publishedId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('published_carousel_id', publishedId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/explore')
    revalidatePath('/bookmarks')
    return { success: true, bookmarked: false }
  } else {
    const { error } = await supabase
      .from('bookmarks')
      .insert({ user_id: user.id, published_carousel_id: publishedId })
    if (error) return { success: false, error: error.message }
    revalidatePath('/explore')
    revalidatePath('/bookmarks')
    return { success: true, bookmarked: true }
  }
}
