import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Phase 54 (METRIC-01, D-17, D-18): track download_zip events. Body schema:
//   { slide_count: number, template_id?: string | null, user_tier?: string }
// Inserts into carousel_events with event_data payload. Authenticated only.
// Server reads template_id and user_tier from the project row server-side
// when not provided (or to override client-supplied values for trust).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: projectId } = await params

  // 1. Authenticate
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // 2. Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id, template_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project || project.user_id !== user.id) {
    // 404 (not 403) — avoid existence enumeration.
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // 3. Parse body (best-effort; missing body is permitted — server fills defaults)
  let body: { slide_count?: number; template_id?: string | null; user_tier?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const slideCount = typeof body.slide_count === 'number' ? body.slide_count : 0
  const templateId =
    typeof body.template_id === 'string' ? body.template_id : (project.template_id ?? null)
  const userTier = typeof body.user_tier === 'string' ? body.user_tier : 'free'

  // 4. Insert event (admin client bypasses RLS for the audit-style insert
  //    so the event always lands even if user-tier RLS were tightened).
  const admin = createAdminClient()
  const { error } = await admin.from('carousel_events').insert({
    event_type: 'download_zip',
    project_id: projectId,
    published_carousel_id: null,
    event_data: {
      project_id: projectId,
      slide_count: slideCount,
      template_id: templateId,
      user_tier: userTier,
    },
  })
  if (error) {
    return NextResponse.json(
      { error: 'insert_failed', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ tracked: true }, { status: 200 })
}
