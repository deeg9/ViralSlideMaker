export type SubscriptionTier = 'free' | 'plus' | 'pro'

export type CreditTransactionType =
  | 'subscription_grant'
  | 'carousel_generation'
  | 'imagen_generation'
  | 'gemini_vision_match' // Phase 58 (MATCH-05, D-10): premium photo↔slide matching
  | 'gemini_vision_extract_style' // Phase 73 (COST-06): style-from-reference vision extraction
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
  free: 3,
  plus: 25,
  pro: 55,
}

export const CREDIT_COSTS = {
  carousel_generation: 1,   // Generate a carousel with stock images + text
  imagen_generation: 1,     // AI-generate a single image (Imagen)
  gemini_vision_match: 1,   // Phase 58 (MATCH-05, D-10): premium photo↔slide matching
  gemini_vision_extract_style: 1, // Phase 73 (COST-06): style-from-reference vision extraction (1 credit per call, NOT per image)
  text_regeneration: 0,     // Rewrite text with AI — free
  image_regeneration: 0,    // New stock photo — free
} as const

export const FREE_PROJECT_LIMIT = 10

export function isValidTier(tier: string): tier is SubscriptionTier {
  return tier === 'free' || tier === 'plus' || tier === 'pro'
}

// User-facing display name for each tier. The internal enum values stay
// 'plus' / 'pro' for DB / Stripe compatibility; only the rendered label
// changes. Use this everywhere the tier is shown to a user.
export const TIER_DISPLAY_NAME: Record<SubscriptionTier, string> = {
  free: 'Free',
  plus: 'Hobbyist',
  pro: 'Creator',
}

export function tierDisplayName(tier: SubscriptionTier): string {
  return TIER_DISPLAY_NAME[tier]
}
