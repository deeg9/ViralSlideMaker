import { createClient } from '@/lib/supabase/server'
import type { SubscriptionTier, CreditStatus } from './types'

export { isValidTier } from './types'
export type { SubscriptionTier, CreditStatus } from './types'

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .single()
  return (data?.tier as SubscriptionTier) ?? 'free'
}

export async function getCreditBalance(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  return data ?? 0
}

export async function deductCredit(
  userId: string,
  type: string,
  description?: string,
  referenceId?: string,
): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: 1,
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
