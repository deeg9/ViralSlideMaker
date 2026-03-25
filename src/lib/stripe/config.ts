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

export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  [STRIPE_PRICES.credit_pack_10]: 10,
}
