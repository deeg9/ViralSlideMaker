'use server'

// Phase 81 server actions for the first-run tour.
//
// Both actions read the authed user and update profiles.onboarding_completed_at
// for that user's own row. Per CONTEXT D-14 the existing profile-self-update
// RLS policy covers this — no policy work required.
//
// Neither action calls redirect(). The caller (settings page button, provider's
// onComplete prop) handles navigation. revalidatePath flips the cached server
// fetch in (dashboard)/layout.tsx so a subsequent dashboard navigation sees
// the updated needsOnboarding boolean.

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

type ActionResult = { success: true } | { success: false; error: string }

export async function markOnboardingComplete(): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    // WR-02: surface a generic message to the client; log the underlying
    // Supabase / PostgREST error server-side so we keep diagnostics without
    // leaking constraint names, column hints, or RLS policy names across
    // the trust boundary.
    console.error('[onboarding/markOnboardingComplete] supabase update failed:', error)
    return { success: false, error: 'Failed to update onboarding state' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function restartOnboarding(): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: null })
    .eq('id', user.id)

  if (error) {
    // WR-02: see markOnboardingComplete — generic message out, full error
    // logged server-side.
    console.error('[onboarding/restartOnboarding] supabase update failed:', error)
    return { success: false, error: 'Failed to restart onboarding tour' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/settings/profile')
  return { success: true }
}
