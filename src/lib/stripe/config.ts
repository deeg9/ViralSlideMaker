import type { SubscriptionTier } from '@/lib/credits/types'

export const STRIPE_PRICES = {
  plus_monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY ?? '',
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
  credit_pack_10: process.env.STRIPE_PRICE_CREDIT_PACK_10 ?? '',
} as const

export function tierFromPriceId(priceId: string): SubscriptionTier | null {
  if (priceId === STRIPE_PRICES.plus_monthly) return 'plus'
  if (priceId === STRIPE_PRICES.pro_monthly) return 'pro'
  return null
}

// Credits granted per credit-pack purchase. The Stripe price object itself is
// still $4.99; we just changed how many credits a pack grants. Key name kept
// as `credit_pack_10` to avoid churning the env var + tests + actions.ts —
// it's an internal identifier, not the user-facing credit count.
export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  [STRIPE_PRICES.credit_pack_10]: 5,
}
