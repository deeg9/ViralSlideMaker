import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SubscriptionTier, CreditStatus } from './types'

export { isValidTier } from './types'
export type { SubscriptionTier, CreditStatus } from './types'

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.tier as SubscriptionTier) ?? 'free'
}

export async function getCreditBalance(userId: string, adminClient?: SupabaseClient): Promise<number> {
  const supabase = adminClient ?? await createClient()
  const { data } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  return data ?? 0
}

export async function deductCredit(
  userId: string,
  type: string,
  description?: string,
  referenceId?: string,
  amount: number = 1,
  adminClient?: SupabaseClient,
): Promise<boolean> {
  if (amount <= 0) return true // Free actions (text regen, stock image regen)
  const supabase = adminClient ?? await createClient()
  const { data } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description ?? null,
    p_reference_id: referenceId ?? null,
  })
  return data === true
}

export async function checkProjectLimit(userId: string, tier: SubscriptionTier): Promise<boolean> {
  if (tier !== 'free') return true
  const supabase = await createClient()
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return (count ?? 0) < 10
}

export async function checkCredits(): Promise<CreditStatus> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { allowed: false, tier: 'free', balance: 0 }
  }
  const tier = await getUserTier(user.id)
  const balance = await getCreditBalance(user.id)
  return {
    allowed: balance > 0,
    tier,
    balance,
  }
}
