// Phase 76 Plan 01 (PREVIEW-01, PREVIEW-09):
// Server-component shell for /dashboard/style-from-reference/new.
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

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBrandKit } from '@/app/(dashboard)/settings/brand-kit/actions'
import { StyleFromReferenceShell } from '@/components/style-from-reference/style-from-reference-shell'

export default async function StyleFromReferenceNewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const brandKit = await getBrandKit()
  const projectId = crypto.randomUUID()

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold text-[#3d0000] mb-2">
        Generate from a reference
      </h1>
      <p className="text-sm text-[#7d6161] mb-6">
        Upload up to 8 images. We&apos;ll extract a style template inspired by
        them — you&apos;ll review it before we generate.
      </p>
      <StyleFromReferenceShell
        projectId={projectId}
        brandKit={brandKit}
        brandKitAvailable={brandKit !== null}
      />
    </div>
  )
}
