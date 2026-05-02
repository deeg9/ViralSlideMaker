import { createClient, type PhotosWithTotalResults, type Photo } from 'pexels'
import {
  pexelsQueryWithGuardrails,
  filterPexelsResultsByAlt,
} from '@/lib/ai/slop-guardrails'

const pexelsClient = createClient(process.env.PEXELS_API_KEY!)

interface SearchOptions {
  orientation?: 'landscape' | 'portrait' | 'square'
  per_page?: number
  page?: number
}

export async function searchPhotos(
  query: string,
  options: SearchOptions = {}
): Promise<Photo[]> {
  const { orientation = 'portrait', per_page = 1, page = 1 } = options

  // Phase 54 (SLOP-02, D-09/D-11): append positive editorial-style terms.
  const guardedQuery = pexelsQueryWithGuardrails(query)

  const result = await pexelsClient.photos.search({
    query: guardedQuery,
    orientation,
    per_page,
    page,
  })

  // Type guard: search returns PhotosWithTotalResults or ErrorResponse
  if ('photos' in result) {
    // Phase 54 (SLOP-02, D-11): drop alt-text-matched negatives. Falls back
    // to unfiltered results if filtering would empty the set — never blocks
    // generation on aggressive filtering.
    return filterPexelsResultsByAlt((result as PhotosWithTotalResults).photos)
  }

  return []
}
