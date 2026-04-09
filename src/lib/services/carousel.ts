import type { SupabaseClient } from '@supabase/supabase-js'

// Carousel generation service -- implementation will be extracted from
// src/app/(dashboard)/project/[id]/actions.ts in Phase 25 when the
// POST /api/v1/carousel endpoint is built.
export async function generateCarousel(
  _supabase: SupabaseClient,
  _userId: string,
  _input: { topic: string; templateId: string; slideCount?: number; imageSource?: 'stock' | 'ai' }
): Promise<{ projectId: string; slideCount: number }> {
  throw new Error('Not implemented -- will be extracted from server action in Phase 25')
}
