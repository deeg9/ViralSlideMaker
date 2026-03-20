import { createClient } from '@/lib/supabase/server'

export type SubscriptionTier = 'free' | 'plus' | 'pro'

const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 5,
  plus: 12,
  pro: 30,
}

export function getCreditLimit(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier]
}

export function isValidTier(tier: string): tier is SubscriptionTier {
  return tier === 'free' || tier === 'plus' || tier === 'pro'
}

export async function getUserTier(): Promise<SubscriptionTier> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tier = user?.user_metadata?.subscription_tier
  return isValidTier(tier) ? tier : 'free'
}

export async function getUsedCredits(): Promise<number> {
  const supabase = await createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .neq('generation_status', 'draft')
    .gte('created_at', monthStart)

  return count ?? 0
}

export async function checkCredits(): Promise<{
  allowed: boolean
  tier: SubscriptionTier
  used: number
  limit: number
  remaining: number
}> {
  const tier = await getUserTier()
  const used = await getUsedCredits()
  const limit = getCreditLimit(tier)
  const remaining = Math.max(0, limit - used)

  return {
    allowed: remaining > 0,
    tier,
    used,
    limit,
    remaining,
  }
}
