// Phase 76 Plan 01 (PREVIEW-01, PREVIEW-09):
// Server-component shell for /style-from-reference/new.
// (File lives under (dashboard) route group — parens strip from URL.)
//
// Composition:
//   - server-side: auth gate (redirect to /login if no user) + brandKit fetch
//   - client island: <StyleFromReferenceShell> owns the state machine,
//     uploader, sticky strip, and spec-preview panel
//
// projectId: Phase 76 uses a per-render UUID placeholder. Phase 77 will wire
// the actual project creation path; the projectId only needs to be stable for
// the duration of one extract -> generate session (the rate-cap key is
// per-user, not per-project).

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BackButton } from './back-button'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBrandKit } from '@/app/(dashboard)/settings/brand-kit/actions'
import { StyleFromReferenceShell } from '@/components/style-from-reference/style-from-reference-shell'
import { acceptStyleFromReferenceTosCurrentVersionAction } from '@/app/(dashboard)/style-from-reference/actions'
import { hasUserAcceptedCurrentTos } from '@/lib/legal/audit-log'
import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Best-effort extraction of a project UUID from the `from` searchParam (set
// by the References pill on the prompt page as
// `?from=/project/<projectId>`). Returns null when the param is missing,
// malformed, or doesn't point at a /project/<uuid> path — the shell then
// falls back to the rate-cap-only random projectId and reports an error
// to the user if they try to generate without a target project row.
function parseTargetProjectIdFromQuery(from: string | undefined): string | null {
  if (!from) return null
  // Same `safeInAppPath` shape as back-button.tsx: reject protocol-relative,
  // protocol-bearing, or anything that isn't a single-leading-`/` in-app path.
  if (!from.startsWith('/') || from.startsWith('//') || from.includes(':')) {
    return null
  }
  const match = from.match(/^\/project\/([^/?#]+)/)
  if (!match) return null
  const candidate = match[1]
  return UUID_RE.test(candidate) ? candidate : null
}

export default async function StyleFromReferenceNewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const brandKit = await getBrandKit()
  const params = (await searchParams) ?? {}
  const fromParam = typeof params.from === 'string' ? params.from : undefined
  const targetProjectId = parseTargetProjectIdFromQuery(fromParam)

  // When the user came from /project/<id> via the References pill, fetch the
  // existing project's topic so the generation step has something meaningful
  // to write a carousel about. RLS gates the read by user_id, so a tampered
  // `?from=` pointing at someone else's project simply returns no row and
  // generation falls back to the placeholder topic.
  let currentTopic: string | null = null
  if (targetProjectId) {
    const { data: projectRow } = await supabase
      .from('projects')
      .select('topic')
      .eq('id', targetProjectId)
      .maybeSingle()
    if (projectRow && typeof (projectRow as { topic?: string }).topic === 'string') {
      currentTopic = (projectRow as { topic: string }).topic
    }
  }

  // The shell's `projectId` is the rate-cap key for extraction; when the user
  // arrived from /project/<id> we reuse that UUID so generation writes to the
  // same row. When they hit /style-from-reference/new directly, we mint a
  // fresh UUID — extraction works, but generation needs a real project row,
  // so the shell surfaces a clearer error.
  const projectId = targetProjectId ?? crypto.randomUUID()

  // Phase 79 LEGAL-01: read ToS acceptance status server-side so the client
  // shell can render the clickwrap modal on first upload (vs hitting the
  // server-side gate and showing the cryptic "Failed to mint upload URL").
  // Service-role admin client because the audit-log helper requires it.
  const admin = createAdminClient()
  const tosAlreadyAccepted = await hasUserAcceptedCurrentTos(
    admin,
    user.id,
    STYLE_FROM_REFERENCE_TOS_VERSION,
  )

  return (
    <div className="mx-auto max-w-4xl py-8">
      {/* Suspense boundary required by Next.js when a client component
          inside this server-rendered page reads useSearchParams. */}
      <Suspense fallback={<div className="mb-4 h-5" aria-hidden />}>
        <BackButton />
      </Suspense>
      <h1 className="text-2xl font-bold text-[#3d0000] mb-2">
        Generate from a reference
      </h1>
      <p className="text-sm text-[#7d6161] mb-6">
        Upload up to 8 images. We&apos;ll extract a style template inspired by
        them — you&apos;ll review it before we generate.
      </p>
      <StyleFromReferenceShell
        projectId={projectId}
        targetProjectId={targetProjectId}
        currentTopic={currentTopic}
        brandKit={brandKit}
        brandKitAvailable={brandKit !== null}
        tosAlreadyAccepted={tosAlreadyAccepted}
        acceptTosAction={acceptStyleFromReferenceTosCurrentVersionAction}
      />
    </div>
  )
}
