import { getCreditBalance } from '@/lib/credits/check-credits'
import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/ui/icon'

export async function CreditDisplay() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const balance = await getCreditBalance(user.id)

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fadbdb]">
      <Icon name="bolt" size="sm" className="text-[#3d0000]" />
      <span className="text-xs font-bold text-[#3d0000]">{balance}</span>
      <span className="text-xs text-[#7d6161]">credits</span>
    </div>
  )
}
