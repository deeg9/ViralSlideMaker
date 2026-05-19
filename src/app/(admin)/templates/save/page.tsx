// Phase 86 (ADMIN-01): the Save-as-Template admin page. The (admin) layout has
// already gated this route — `user` here is a non-null admin. The page loads
// the admin's OWN carousels (listProjects) and hands them to the client form.

import { createClient } from '@/lib/supabase/server'
import { listProjects } from '@/lib/services/projects'
import { SaveTemplateForm } from './save-template-form'

export default async function SaveTemplatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defensive only — the (admin) layout already redirects a non-admin.
  if (!user) {
    return <p className="text-sm text-[#7d6161]">Not authorized.</p>
  }

  const projects = await listProjects(supabase, user.id)
  const trimmed = (projects ?? []).map((p) => ({
    id: p.id as string,
    title: (p.title as string | null) ?? 'Untitled carousel',
    template_id: (p.template_id as string | null) ?? null,
    slide_data: (p.slide_data as unknown[] | null) ?? [],
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#3d0000]">Save as Template</h1>
      <p className="mt-1.5 text-sm text-[#7d6161]">
        Turn one of your carousels into a template everyone can pick.
      </p>
      <div className="mt-8">
        <SaveTemplateForm projects={trimmed} />
      </div>
    </div>
  )
}
