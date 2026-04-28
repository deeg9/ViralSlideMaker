import { createClient } from '@/lib/supabase/server'
import { TopNavbar } from '@/components/layout/top-navbar'

export default async function UsernameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userName: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
    userName =
      (profile?.display_name as string | null) ||
      (user.user_metadata?.first_name as string) ||
      user.email?.split('@')[0] ||
      'User'
  }

  return (
    <div className="min-h-screen bg-[#fff8f7]">
      <TopNavbar variant="app" signedIn={!!user} userName={userName} />
      <main>{children}</main>
    </div>
  )
}
