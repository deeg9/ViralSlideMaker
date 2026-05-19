// Phase 86 (ADMIN-01): the (admin) route-group layout — the admin-auth wrapper
// for every page in the group. Gated by the SHARED `requireAdmin` helper; the
// gate is mirrored on the save endpoint (/api/admin/templates). A non-admin or
// unauthenticated visitor is bounced server-side BEFORE any admin UI renders —
// not merely a hidden link.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)

  if (!admin) {
    // Non-admin / unauthenticated → server-side redirect. No styled
    // "access denied" screen — the admin surface simply does not exist.
    redirect('/dashboard')
  }

  // Internal admin tooling — a centered lightweight container, NOT the full
  // DashboardShell product nav (per 86-UI-SPEC layout contract).
  return (
    <div className="min-h-screen bg-[#fff8f7]">
      <div className="mx-auto max-w-2xl px-6 py-12">{children}</div>
    </div>
  )
}
