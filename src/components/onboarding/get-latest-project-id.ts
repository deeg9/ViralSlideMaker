'use server'

// quick-260520-gr3: server action used by the onboarding checklist's
// "Take me there" fallback for the publish-toggle step. The visibility
// dropdown only renders inside the project editor (/project/[id]) — so
// when the user is on /dashboard and clicks the step, we need to resolve
// a real project URL. If the user has no projects yet, we return null
// and the checklist gracefully completes the step rather than dead-end
// routing to a /project/null page.

import { createClient } from '@/lib/supabase/server'

export async function getLatestProjectId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Mirrors the dashboard's project loader (ordered by updated_at desc).
  // RLS scopes the result to the current user.
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return (data?.id as string | undefined) ?? null
}
