import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { TIER_CREDITS, type SubscriptionTier } from '@/lib/credits/types'

export const GET = withApiAuth(async (_req, ctx) => {
  const { data: sub } = await ctx.supabase
    .from('subscriptions')
    .select('tier, status, current_period_end, cancel_at_period_end')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  const tier = ((sub?.tier as SubscriptionTier) ?? 'free') as SubscriptionTier
  const period_end = (sub?.current_period_end as string | null) ?? null
  const status = (sub?.status as string | null) ?? null
  const cancel_at_period_end = (sub?.cancel_at_period_end as boolean | null) ?? null

  return apiSuccess({
    data: {
      tier,
      balance: ctx.creditBalance,
      monthly_grant: TIER_CREDITS[tier],
      period_end,
      status,
      cancel_at_period_end,
    },
  })
})
