import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/ui/icon'
import { ExploreSearchBox } from './search-box'

type Tab = 'trending' | 'new' | 'featured'

interface PublishedRow {
  id: string
  slug: string
  title: string
  hero_image_url: string | null
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
      'id, slug, title, hero_image_url, tags, bookmark_count, remix_count, view_count, published_at, owner_id',
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
    <div className="min-h-screen bg-[#fff8f7]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#3d0000]">Explore</h1>
            <p className="text-sm text-[#7d6161] mt-1">Discover and remix carousels from the community</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-[#3d0000] hover:underline"
          >
            Back to dashboard →
          </Link>
        </div>

        <ExploreSearchBox initialQuery={searchQuery ?? ''} />

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-[#dbc1bc]/30">
          <TabLink current={tab} tab="trending" label="Trending" tag={tagFilter} />
          <TabLink current={tab} tab="new" label="New" tag={tagFilter} />
          <TabLink current={tab} tab="featured" label="Featured" tag={tagFilter} />
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link
            href={`/explore?tab=${tab}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              !tagFilter ? 'bg-[#3d0000] text-white' : 'bg-white text-[#7d6161] border border-[#dbc1bc]/40 hover:bg-[#fadbdb]'
            }`}
          >
            All
          </Link>
          {PILL_TAGS.map((t) => (
            <Link
              key={t}
              href={`/explore?tab=${tab}&tag=${t}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                tagFilter === t
                  ? 'bg-[#3d0000] text-white'
                  : 'bg-white text-[#7d6161] border border-[#dbc1bc]/40 hover:bg-[#fadbdb]'
              }`}
            >
              #{t}
            </Link>
          ))}
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
                <Link
                  key={c.id}
                  href={`/explore/${c.slug}`}
                  className="block bg-white rounded-2xl border border-[#dbc1bc]/30 overflow-hidden hover:shadow-lg hover:border-[#3d0000]/30 transition-all"
                >
                  {/* Hero */}
                  <div className="relative aspect-[9/16] bg-[#fadbdb]">
                    {c.hero_image_url ? (
                      <Image
                        src={c.hero_image_url}
                        alt={c.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[#7d6161]">
                        <Icon name="image" size="lg" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm text-[#3d0000] line-clamp-2">{c.title}</h3>
                    {creator?.username && (
                      <p className="text-xs text-[#7d6161] mt-1">
                        @{creator.username}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-[#7d6161] mt-2">
                      <span className="flex items-center gap-1">
                        <Icon name="bookmark" size="sm" />
                        {c.bookmark_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="content_copy" size="sm" />
                        {c.remix_count}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TabLink({
  current,
  tab,
  label,
  tag,
}: {
  current: Tab
  tab: Tab
  label: string
  tag: string | null
}) {
  const active = current === tab
  const href = `/explore?tab=${tab}${tag ? `&tag=${tag}` : ''}`
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-semibold ${
        active
          ? 'text-[#3d0000] border-b-2 border-[#3d0000] -mb-px'
          : 'text-[#7d6161] hover:text-[#3d0000]'
      }`}
    >
      {label}
    </Link>
  )
}
