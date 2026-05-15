import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { CreditDisplay } from '@/components/subscription/credit-display'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'
import { InteractiveOnboardingChecklist } from '@/components/onboarding/interactive-onboarding-checklist'
import { markOnboardingComplete } from '@/lib/onboarding/actions'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Phase 81: extended select pulls onboarding_completed_at in the SAME
  // round-trip so /dashboard never adds a second profiles query.
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.username) {
    redirect('/onboarding/username')
  }

  const userName =
    (profile?.display_name as string | null) ||
    (user.user_metadata?.first_name as string) ||
    user.email?.split('@')[0] ||
    'User'

  // Phase 81 (R2): the welcome modal auto-fires iff this user has not yet
  // completed or skipped the tour. The OnboardingProvider survives client-
  // side navigation between dashboard children (D-02) so the persistent
  // checklist + coachmark stay mounted across route changes.
  const needsOnboarding =
    (profile as { onboarding_completed_at?: string | null } | null)
      ?.onboarding_completed_at == null

  return (
    <OnboardingProvider
      needsOnboarding={needsOnboarding}
      onComplete={markOnboardingComplete}
    >
      <DashboardShell
        userName={userName}
        creditDisplay={
          <Suspense fallback={<span className="text-xs text-[#7d6161]">...</span>}>
            <CreditDisplay />
          </Suspense>
        }
      >
        {children}
        <InteractiveOnboardingChecklist />
      </DashboardShell>
    </OnboardingProvider>
  )
}
