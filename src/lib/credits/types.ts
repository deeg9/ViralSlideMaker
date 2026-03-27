export type SubscriptionTier = 'free' | 'plus' | 'pro'

export type CreditTransactionType =
  | 'subscription_grant'
  | 'carousel_generation'
  | 'imagen_generation'
  | 'credit_pack_purchase'
  | 'refund'
  | 'admin_adjustment'

export interface CreditStatus {
  allowed: boolean
  tier: SubscriptionTier
  balance: number
}

export interface CreditTransaction {
  id: string
  user_id: string
  type: CreditTransactionType
  amount: number
  description: string | null
  reference_id: string | null
  created_at: string
}

export const TIER_CREDITS: Record<SubscriptionTier, number> = {
  free: 10,
  plus: 50,
  pro: 200,
}

export const CREDIT_COSTS = {
  carousel_generation: 1,   // Generate a carousel with stock images + text
  imagen_generation: 3,     // AI-generate a single image (Imagen)
  text_regeneration: 0,     // Rewrite text with AI — free
  image_regeneration: 0,    // New stock photo — free
} as const

export const FREE_PROJECT_LIMIT = 10

export function isValidTier(tier: string): tier is SubscriptionTier {
  return tier === 'free' || tier === 'plus' || tier === 'pro'
}
