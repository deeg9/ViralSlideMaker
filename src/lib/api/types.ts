import type { SubscriptionTier } from '@/lib/credits/types'

export interface ApiKeyAuth {
  userId: string
  keyId: string
  tier: SubscriptionTier
}

export interface ApiKeyRecord {
  id: string
  user_id: string
  prefix: string
  label: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}
