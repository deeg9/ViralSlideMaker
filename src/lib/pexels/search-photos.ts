import { createClient, type PhotosWithTotalResults, type Photo } from 'pexels'

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

  const result = await pexelsClient.photos.search({
    query,
    orientation,
    per_page,
    page,
  })

  // Type guard: search returns PhotosWithTotalResults or ErrorResponse
  if ('photos' in result) {
    return (result as PhotosWithTotalResults).photos
  }

  return []
}
