import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_CREDITS } from './types'
import type { SubscriptionTier } from './types'

export async function ensureSubscription(userId: string): Promise<SubscriptionTier> {
  const admin = createAdminClient()

  // Check if subscription exists
  const { data: existing } = await admin
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .single()

  if (existing) {
    return existing.tier as SubscriptionTier
  }

  // Create free subscription
  await admin
    .from('subscriptions')
    .insert({ user_id: userId, tier: 'free', status: 'active' })

  // Grant initial monthly credits
  await admin
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type: 'subscription_grant',
      amount: TIER_CREDITS.free,
      description: 'Monthly credit grant (Free tier)',
    })

  return 'free'
}
