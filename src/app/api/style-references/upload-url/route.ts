// Phase 74 Plan 03 (REF-02): signed-URL upload route for the slide-references
// bucket. In-app cookie-session auth (NOT Bearer/API-key) — this route is
// called from the dashboard browser, where the user has a Supabase session
// cookie. Mirrors src/app/api/render/route.ts auth pattern (NOT the public
// REST API /v1/* routes which use withApiAuth).
//
// Three deliberate divergences from the original brand-kit logo-upload-url
// mirror used during planning:
//
//   1. Bucket: SLIDE_REFERENCES_BUCKET (PRIVATE — no publicUrl in response;
//      Phase 75 mints signed READ URLs at extraction time via createSignedUrl).
//   2. Allowed MIME: ALLOWED_REFERENCE_MIME — png/jpeg/webp/heic only (NO
//      svg+xml; vision LLM doesn't need vector reference art for v2.13).
//   3. Server-side size validation (REF-05, ≤ 20 MB pre-preprocessing) — accept
//      `size_bytes` in request body and reject if > MAX_REFERENCE_SIZE_BYTES.
//
// Validation logic lives in @/lib/storage/upload-reference-validation so the
// React component can run the SAME checks fail-fast before round-tripping the
// network. Defense-in-depth: client validates for UX, server re-validates for
// trust.
//
// Phase 79 Plan 02 Task 2 (LEGAL-01): server-side ToS enforcement. Runs the
// `hasUserAcceptedCurrentTos` audit-log check BEFORE minting a signed URL —
// no row matching the current ToS version => 403 TOS_REQUIRED. Defense in
// depth alongside the client clickwrap modal.
//
// Quick 260510-tos-page-wire follow-up: switched from withApiAuth (Bearer
// token) to cookie-session auth (createClient from @/lib/supabase/server).
// The original planner mirror was the public REST API route which uses API
// keys; this route is in-app browser-only, so cookies are the right surface.

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { SLIDE_REFERENCES_BUCKET } from '@/lib/types/projects-storage-constants'
import { validateReferenceUpload } from '@/lib/storage/upload-reference-validation'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasUserAcceptedCurrentTos } from '@/lib/legal/audit-log'
import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'

export async function POST(req: NextRequest) {
  // 1. Auth gate — cookie session
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return apiError('UNAUTHORIZED', 'Sign in to upload reference images.', 401)
  }

  // 2. Body parse + validation
  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text.length > 0) body = JSON.parse(text)
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateReferenceUpload({
    filename: body.filename,
    contentType: body.contentType,
    size_bytes: body.size_bytes,
  })
  if (!validation.ok) {
    return apiError('VALIDATION_ERROR', validation.message, 400)
  }

  // 3. Phase 79 LEGAL-01 ToS gate. Service-role admin client because RLS
  // routes audit-table reads through service_role (the helper signature
  // requires it). Helper NEVER throws — fail-secures to false on any DB
  // error, which forces a 403 here.
  const admin = createAdminClient()
  const accepted = await hasUserAcceptedCurrentTos(
    admin,
    user.id,
    STYLE_FROM_REFERENCE_TOS_VERSION,
  )
  if (!accepted) {
    return apiError(
      'TOS_REQUIRED',
      'You must accept the style-from-reference Terms of Service before uploading.',
      403,
    )
  }

  // 4. Mint signed upload URL via cookie-session client (RLS allows the
  // user to write to their own slide-references/{user_id}/* path).
  const path = `${user.id}/${crypto.randomUUID()}-${validation.safeFilename}`
  const { data, error } = await supabase.storage
    .from(SLIDE_REFERENCES_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) {
    return apiError(
      'INTERNAL_ERROR',
      error?.message ?? 'Failed to create signed upload URL',
      500,
    )
  }

  // No publicUrl in the response — bucket is private. Phase 75 mints a
  // short-lived signed READ URL at extraction time.
  return apiSuccess({
    data: {
      uploadUrl: data.signedUrl,
      token: data.token,
      method: 'PUT' as const,
      headers: { 'Content-Type': String(body.contentType) },
      path,
    },
  })
}
