import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ExploreSearchBox } from './search-box'
import { FilterButton } from './filter-button'
import { ExploreCard } from './explore-card'
import type { Slide } from '@/lib/types/slide'

type Tab = 'trending' | 'new' | 'featured'

interface PublishedRow {
  id: string
  slug: string
  title: string
  hero_image_url: string | null
  slide_data: Slide[] | null
  template_id: string | null
  tags: string[]
  bookmark_count: number
  remix_count: number
  view_count: number
  published_at: string
  owner_id: string
}

interface CreatorRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; tag?: string; q?: string }>
}) {
  const params = await searchParams
  const tab: Tab =
    params.tab === 'new' ? 'new' : params.tab === 'featured' ? 'featured' : 'trending'
  const tagFilter = params.tag?.trim().toLowerCase() || null
  const searchQuery = params.q?.trim() || null

  const supabase = await createClient()

  let query = supabase
    .from('published_carousels')
    .select(
      'id, slug, title, hero_image_url, slide_data, template_id, tags, bookmark_count, remix_count, view_count, published_at, owner_id',
    )
    .is('unpublished_at', null)
    .eq('is_hidden', false)
    .limit(48)

  if (searchQuery) {
    query = query.textSearch('search_vector', searchQuery, {
      type: 'websearch',
      config: 'simple',
    })
  }

  if (searchQuery) {
    query = query.order('published_at', { ascending: false })
  } else if (tab === 'trending') {
    query = query.order('popularity_score', { ascending: false }).order('published_at', { ascending: false })
  } else if (tab === 'new') {
    query = query.order('published_at', { ascending: false })
  } else {
    query = query.eq('is_featured', true).order('published_at', { ascending: false })
  }

  if (tagFilter) {
    query = query.contains('tags', [tagFilter])
  }

  const { data: rows } = await query
  const carousels = (rows as PublishedRow[] | null) ?? []

  const ownerIds = Array.from(new Set(carousels.map((c) => c.owner_id)))
  const { data: creatorsRows } = ownerIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', ownerIds)
    : { data: [] as CreatorRow[] }
  const creators = new Map((creatorsRows as CreatorRow[]).map((c) => [c.id, c]))

  const PILL_TAGS = [
    'hooks',
    'storytime',
    'productivity',
    'finance',
    'fitness',
    'mindset',
    'tutorial',
    'humor',
    'design',
    'travel',
    'food',
    'tech',
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#3d0000]">Explore</h1>
          <p className="text-sm text-[#7d6161] mt-1">Discover and remix carousels from the community</p>
        </div>

        <div className="flex items-stretch gap-2 mb-6">
          <div className="flex-1 min-w-0">
            <ExploreSearchBox initialQuery={searchQuery ?? ''} />
          </div>
          <FilterButton current={tab} />
        </div>

        {/* Card grid */}
        {carousels.length === 0 ? (
          <div className="text-center py-16 text-[#7d6161]">
            {searchQuery ? (
              <>
                <p className="text-lg">No matches for &ldquo;{searchQuery}&rdquo;.</p>
                <p className="text-sm mt-2">Try a popular tag:</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-lg mx-auto">
                  {PILL_TAGS.map((t) => (
                    <Link
                      key={t}
                      href={`/explore?tag=${t}`}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-[#7d6161] border border-[#dbc1bc]/40 hover:bg-[#fadbdb]"
                    >
                      #{t}
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-lg">No carousels yet{tagFilter ? ` with #${tagFilter}` : ''}.</p>
                <p className="text-sm mt-2">Be the first to publish.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {carousels.map((c) => {
              const creator = creators.get(c.owner_id)
              return (
                <ExploreCard
                  key={c.id}
                  slug={c.slug}
                  title={c.title}
                  heroImageUrl={c.hero_image_url}
                  slides={c.slide_data ?? []}
                  templateId={c.template_id}
                  creatorUsername={creator?.username ?? null}
                  bookmarkCount={c.bookmark_count}
                  remixCount={c.remix_count}
                />
              )
            })}
          </div>
        )}
    </div>
  )
}

