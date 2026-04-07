import { createAdminClient } from '@/lib/supabase/admin'
import { ApiError } from '@/lib/api/errors'
import { searchPhotos } from '@/lib/pexels/search-photos'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

interface ServiceOptions {
  adminClient?: SupabaseClient
}

interface SlideUpdates {
  hook_text?: string
  body_text?: string
  image_query?: string
  background_url?: string
  style_overrides?: Partial<SlideStyleOverrides>
}

async function getClient(options?: ServiceOptions): Promise<SupabaseClient> {
  return options?.adminClient ?? createAdminClient()
}

async function fetchProjectSlides(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<{ slides: Slide[]; raw: Record<string, unknown> }> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, user_id, slide_data')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to fetch project')
  }

  if (!data) {
    throw new ApiError('NOT_FOUND', 'Project not found')
  }

  const slides = (data.slide_data ?? []) as Slide[]
  return { slides, raw: data as Record<string, unknown> }
}

function validateSlideIndex(slides: Slide[], slideIndex: number): void {
  if (slideIndex < 0 || slideIndex >= slides.length) {
    throw new ApiError('NOT_FOUND', `Slide at index ${slideIndex} not found`)
  }
}

export async function updateSlide(
  userId: string,
  projectId: string,
  slideIndex: number,
  updates: SlideUpdates,
  options?: ServiceOptions
): Promise<Slide> {
  const supabase = await getClient(options)
  const { slides } = await fetchProjectSlides(supabase, userId, projectId)
  validateSlideIndex(slides, slideIndex)

  const currentSlide = slides[slideIndex]

  // Handle image_query: trigger Pexels search
  if (updates.image_query !== undefined) {
    const photos = await searchPhotos(updates.image_query)
    if (photos.length > 0) {
      currentSlide.background_url = photos[0].src.large2x
      currentSlide.pexels_photo_id = photos[0].id
    }
    currentSlide.image_query = updates.image_query
  }

  // Handle direct background_url (must be https://)
  if (updates.background_url !== undefined) {
    if (!updates.background_url.startsWith('https://')) {
      throw new ApiError('VALIDATION_ERROR', 'background_url must use https://')
    }
    currentSlide.background_url = updates.background_url
    currentSlide.pexels_photo_id = null
  }

  // Handle text fields
  if (updates.hook_text !== undefined) {
    currentSlide.hook_text = updates.hook_text
  }
  if (updates.body_text !== undefined) {
    currentSlide.body_text = updates.body_text
  }

  // Handle style_overrides (shallow merge)
  if (updates.style_overrides !== undefined) {
    currentSlide.style_overrides = {
      ...currentSlide.style_overrides,
      ...updates.style_overrides,
    }
  }

  // Write updated slide_data back (ownership already verified in fetch above)
  slides[slideIndex] = currentSlide
  await supabase
    .from('projects')
    .update({ slide_data: slides as unknown as Record<string, unknown>[] })
    .eq('id', projectId)

  return currentSlide
}

export async function getSlide(
  userId: string,
  projectId: string,
  slideIndex: number,
  options?: ServiceOptions
): Promise<Slide> {
  const supabase = await getClient(options)
  const { slides } = await fetchProjectSlides(supabase, userId, projectId)
  validateSlideIndex(slides, slideIndex)

  return slides[slideIndex]
}
