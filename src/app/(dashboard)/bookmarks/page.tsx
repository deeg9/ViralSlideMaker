import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/ui/icon'

interface BookmarkRow {
  created_at: string
  carousel: {
    id: string
    slug: string
    title: string
    hero_image_url: string | null
    bookmark_count: number
    remix_count: number
    owner_id: string
    unpublished_at: string | null
    is_hidden: boolean
  }
}

interface CreatorRow {
  id: string
  username: string | null
  display_name: string | null
}

export default async function BookmarksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/bookmarks')

  const { data: rows } = await supabase
    .from('bookmarks')
    .select(
      'created_at, carousel:published_carousel_id (id, slug, title, hero_image_url, bookmark_count, remix_count, owner_id, unpublished_at, is_hidden)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const bookmarks = ((rows as unknown) as BookmarkRow[] | null ?? []).filter(
    (b) => b.carousel && b.carousel.unpublished_at === null && !b.carousel.is_hidden,
  )

  const ownerIds = Array.from(new Set(bookmarks.map((b) => b.carousel.owner_id)))
  const { data: creatorsRows } = ownerIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', ownerIds)
    : { data: [] as CreatorRow[] }
  const creators = new Map((creatorsRows as CreatorRow[]).map((c) => [c.id, c]))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Icon name="bookmark" size="lg" className="text-[#3d0000]" />
        <div>
          <h1 className="text-2xl font-bold text-[#3d0000]">Bookmarks</h1>
          <p className="text-sm text-[#7d6161]">Carousels you saved for later</p>
        </div>
      </div>

      {bookmarks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#dbc1bc]/30">
          <Icon name="bookmark_border" size="lg" className="text-[#7d6161] mx-auto" />
          <p className="text-lg text-[#3d0000] font-semibold mt-4">No bookmarks yet</p>
          <p className="text-sm text-[#7d6161] mt-1">Save carousels from Explore to fork them later.</p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 mt-4 bg-[#3d0000] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#3d0000]/90"
          >
            Browse Explore
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {bookmarks.map((b) => {
            const creator = creators.get(b.carousel.owner_id)
            return (
              <Link
                key={b.carousel.id}
                href={`/explore/${b.carousel.slug}`}
                className="block bg-white rounded-2xl border border-[#dbc1bc]/30 overflow-hidden hover:shadow-lg hover:border-[#3d0000]/30 transition-all"
              >
                <div className="relative aspect-[9/16] bg-[#fadbdb]">
                  {b.carousel.hero_image_url ? (
                    <Image
                      src={b.carousel.hero_image_url}
                      alt={b.carousel.title}
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
                  <h3 className="font-semibold text-sm text-[#3d0000] line-clamp-2">
                    {b.carousel.title}
                  </h3>
                  {creator?.username && (
                    <p className="text-xs text-[#7d6161] mt-1">@{creator.username}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-[#7d6161] mt-2">
                    <span className="flex items-center gap-1">
                      <Icon name="bookmark" size="sm" />
                      {b.carousel.bookmark_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="content_copy" size="sm" />
                      {b.carousel.remix_count}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
