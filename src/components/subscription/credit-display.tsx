import { getCreditBalance } from '@/lib/credits/check-credits'
import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/ui/icon'

export async function CreditDisplay() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const balance = await getCreditBalance(user.id)

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <Icon name="bolt" size="sm" className="text-[#7d6161]" />
      <span className="text-[11px] font-medium text-[#7d6161]">{balance} credits</span>
    </div>
  )
}
