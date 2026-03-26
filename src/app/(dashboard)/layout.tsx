import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { CreditDisplay } from '@/components/subscription/credit-display'

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

  const userName = (user.user_metadata?.first_name as string) || user.email?.split('@')[0] || 'User'

  return (
    <DashboardShell
      userName={userName}
      creditDisplay={
        <Suspense fallback={<span className="text-xs text-[#7d6161]">...</span>}>
          <CreditDisplay />
        </Suspense>
      }
    >
      {children}
    </DashboardShell>
  )
}
