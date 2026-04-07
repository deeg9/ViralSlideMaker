// Stub: Will be implemented in Plan 02
// Extracted carousel generation service (cookie-free)
import { SupabaseClient } from '@supabase/supabase-js'

export interface CarouselServiceParams {
  topic: string
  slideCount?: number
  [key: string]: unknown
}

export interface CarouselResult {
  success: boolean
  slideCount?: number
  projectId?: string
  error?: string
  upgradeEligible?: boolean
}

export async function generateCarouselService(
  userId: string,
  params: CarouselServiceParams,
  options?: { adminClient?: SupabaseClient }
): Promise<CarouselResult> {
  throw new Error('Not implemented -- Plan 02 will implement this')
}
