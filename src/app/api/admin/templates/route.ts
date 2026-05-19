// Phase 86 (ADMIN-01, ADMIN-02): the Save-as-Template save endpoint.
//
// Admin-gated (ADMIN-01) via the SHARED `requireAdmin` session-cookie check —
// the same gate as the `(admin)` route-group layout, mirrored here so a
// non-admin cannot reach the endpoint even with a hand-crafted request. No
// bearer token.
//
// The endpoint writes the FULL templates row in ONE service-role insert: a
// collision-safe slug id (never shadowing a code template — code wins per
// Phase 83), the Phase 84 extracted layout_recipe + flat_style, the form
// category, created_by = the admin id, and preview = a rendered cover-snapshot
// PNG uploaded to the template-previews bucket. Render parity (TPLREND-05) is
// preserved via the shared `renderCoverPreviewPng` helper.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { getProject } from '@/lib/services/projects'
import { extractLayoutRecipe } from '@/lib/ai/layout-recipe-extract'
import { renderCoverPreviewPng } from '@/lib/render/preview-render'
import { resolveTemplate } from '@/lib/render/templates/registry'
import { templateFlatStyle } from '@/lib/render/templates/db-template-row'
import { TEMPLATE_IDS } from '@/lib/render/templates/index'
import { CONTENT_CATEGORIES } from '@/lib/ai/categories'
import { templateSlug, withSuffix } from '@/lib/templates/slug'
import type { Slide } from '@/lib/types/slide'

// The synchronous Satori cover render needs headroom — mirror /api/render.
export const maxDuration = 60

export async function POST(request: Request) {
  // 1. Admin gate (ADMIN-01) — session-cookie check, mirrors the (admin) layout.
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Parse + validate the body.
  let body: { projectId?: unknown; name?: unknown; category?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const category = typeof body.category === 'string' ? body.category : ''

  if (!projectId) {
    return NextResponse.json({ error: 'Pick a source carousel first.' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'Give the template a name.' }, { status: 400 })
  }
  // Closed-enum invariant — category must be a CONTENT_CATEGORIES value.
  if (!(CONTENT_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: 'Choose a category.' }, { status: 400 })
  }

  // 3. Load the source carousel — the admin's OWN project only. getProject
  //    filters .eq('user_id', userId), so another user's id resolves to error.
  let project: { slide_data?: Slide[]; template_id?: string | null; topic?: string | null }
  try {
    project = (await getProject(supabase, admin.id, projectId)) as typeof project
  } catch {
    return NextResponse.json({ error: 'Carousel not found' }, { status: 404 })
  }
  if (!project) {
    return NextResponse.json({ error: 'Carousel not found' }, { status: 404 })
  }

  const slides = (project.slide_data ?? []) as Slide[]
  if (slides.length === 0 || !slides[0]) {
    return NextResponse.json({ error: 'Carousel has no slides' }, { status: 400 })
  }

  // 4. Resolve the source template (used for the cover render).
  const sourceTemplate = await resolveTemplate(project.template_id ?? 'highlight-bar')

  // 5. Extract the layout recipe (Phase 84). extractLayoutRecipe never throws.
  const { recipe } = extractLayoutRecipe(slides)

  // 5b. flat_style — the resolved source template's flat-style fields, in
  //     SlideTemplate shape (camelCase) so dbRowToSlideTemplate reads it back
  //     faithfully. extractLayoutRecipe's own `flatStyle` is intentionally NOT
  //     used here: it is SlideStyleOverrides-shaped (snake_case) — keys
  //     dbRowToSlideTemplate never reads — and comes back empty whenever a
  //     carousel's look lives in its code template rather than in per-slide
  //     overrides. The resolved template is the faithful flat-style base.
  const flatStyle = templateFlatStyle(sourceTemplate)

  // 6. Render the cover preview PNG (ADMIN-02).
  let previewBuffer: Buffer
  try {
    const origin = new URL(request.url).origin
    previewBuffer = await renderCoverPreviewPng(
      slides[0],
      sourceTemplate,
      { slideIndex: 0, totalSlides: slides.length, topic: project.topic ?? undefined },
      origin,
    )
  } catch {
    return NextResponse.json({ error: 'Preview render failed' }, { status: 500 })
  }

  // 7. Derive a collision-safe template id. A code-template id ALWAYS forces a
  //    suffix — never shadow a code template (code wins per Phase 83).
  const adminClient = createAdminClient()
  const baseSlug = templateSlug(name)
  const codeIds = new Set<string>(TEMPLATE_IDS)
  let id = baseSlug
  for (let attempt = 0; attempt < 6; attempt++) {
    const collidesCode = codeIds.has(id)
    let collidesDb = false
    if (!collidesCode) {
      const { data: existing } = await adminClient
        .from('templates')
        .select('id')
        .eq('id', id)
        .maybeSingle()
      collidesDb = existing != null
    }
    if (!collidesCode && !collidesDb) break
    id = withSuffix(baseSlug)
  }

  // 8. Upload the preview PNG to the template-previews bucket.
  const previewPath = `${admin.id}/${id}.png`
  const { error: uploadErr } = await adminClient.storage
    .from('template-previews')
    .upload(previewPath, previewBuffer, { contentType: 'image/png', upsert: false })
  if (uploadErr) {
    return NextResponse.json({ error: 'Preview upload failed' }, { status: 500 })
  }
  const { data: pub } = adminClient.storage.from('template-previews').getPublicUrl(previewPath)
  const previewUrl = pub.publicUrl

  // 9. ONE service-role insert of the full row.
  const { error: insertErr } = await adminClient
    .from('templates')
    .insert({
      id,
      name,
      category,
      flat_style: flatStyle,
      layout_recipe: recipe,
      created_by: admin.id,
      preview: previewUrl,
    })
    .select('id')
    .single()
  if (insertErr) {
    // Best-effort cleanup of the orphan preview.
    await adminClient.storage.from('template-previews').remove([previewPath])
    return NextResponse.json({ error: 'Template insert failed' }, { status: 500 })
  }

  // 10. Success. The picker reflects the new template within the Phase 83
  //     registry TTL window (<=60s) — accepted; no explicit cache bust.
  return NextResponse.json({ id, name, previewUrl }, { status: 201 })
}
