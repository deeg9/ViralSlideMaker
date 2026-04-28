import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { suggestFromEmail } from '@/lib/profile/username-suggestions'
import { ClaimUsernameForm } from './claim-username-form'

export default async function OnboardingUsernamePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.username) {
    redirect(params.next ?? '/dashboard')
  }

  const suggestion = user.email ? suggestFromEmail(user.email) : ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fff8f7] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 border border-[#dbc1bc]/40">
        <h1 className="text-2xl font-bold text-[#3d0000]">Pick your username</h1>
        <p className="text-sm text-[#7d6161] mt-1">
          This is how others will find your profile and templates on the Explore page.
        </p>
        <ClaimUsernameForm
          initialSuggestion={suggestion}
          next={params.next ?? '/dashboard'}
        />
      </div>
    </div>
  )
}
