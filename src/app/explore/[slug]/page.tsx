import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/ui/icon'
import { ForkButton } from './fork-button'
import { BookmarkButton } from './bookmark-button'
import { ViewTracker } from './view-tracker'
import type { Slide } from '@/lib/types/slide'

export default async function ExploreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ published?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const justPublished = sp.published === '1'

  const supabase = await createClient()

  const { data: row } = await supabase
    .from('published_carousels')
    .select(
      'id, slug, title, description, hero_image_url, slide_data, tags, owner_id, bookmark_count, remix_count, view_count, published_at',
    )
    .eq('slug', slug)
    .is('unpublished_at', null)
    .eq('is_hidden', false)
    .maybeSingle()

  if (!row) notFound()
  const c = row as {
    id: string
    slug: string
    title: string
    description: string | null
    hero_image_url: string | null
    slide_data: Slide[]
    tags: string[]
    owner_id: string
    bookmark_count: number
    remix_count: number
    view_count: number
    published_at: string
  }

  const { data: creatorRow } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, bio')
    .eq('id', c.owner_id)
    .maybeSingle()
  const creator = creatorRow as {
    username: string | null
    display_name: string | null
    avatar_url: string | null
    bio: string | null
  } | null

  const { data: { user } } = await supabase.auth.getUser()
  let isBookmarked = false
  if (user) {
    const { data: bm } = await supabase
      .from('bookmarks')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('published_carousel_id', c.id)
      .maybeSingle()
    isBookmarked = !!bm
  }

  return (
    <>
      <ViewTracker publishedId={c.id} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        {justPublished && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Published! Share this link: <span className="font-mono text-xs">/explore/{c.slug}</span>
          </div>
        )}

        <Link href="/explore" className="text-sm text-[#7d6161] hover:text-[#3d0000]">
          ← Back to Explore
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 mt-4">
          {/* Slides preview */}
          <div>
            <div className="bg-white rounded-2xl border border-[#dbc1bc]/30 overflow-hidden">
              {c.hero_image_url && (
                <div className="relative aspect-[9/16] bg-[#fadbdb] max-w-md mx-auto">
                  <Image
                    src={c.hero_image_url}
                    alt={c.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 600px"
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
              )}
            </div>
            <p className="text-sm text-[#7d6161] mt-3">
              {c.slide_data.length} slide{c.slide_data.length === 1 ? '' : 's'} · published{' '}
              {new Date(c.published_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-[#3d0000]">{c.title}</h1>
              {c.description && (
                <p className="text-sm text-[#55423f] mt-2 leading-relaxed">{c.description}</p>
              )}
            </div>

            {creator && (
              <Link
                href={creator.username ? `/${creator.username}` : '#'}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#dbc1bc]/30 hover:bg-[#fff0f0] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#fadbdb] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {creator.avatar_url ? (
                    <Image
                      src={creator.avatar_url}
                      alt={creator.display_name ?? creator.username ?? ''}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <Icon name="person" size="sm" className="text-[#3d0000]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#3d0000] truncate">
                    {creator.display_name ?? creator.username ?? 'Unknown'}
                  </p>
                  {creator.username && (
                    <p className="text-xs text-[#7d6161] truncate">@{creator.username}</p>
                  )}
                </div>
              </Link>
            )}

            <div className="flex items-center gap-3 text-sm text-[#7d6161]">
              <span className="flex items-center gap-1.5">
                <Icon name="bookmark" size="sm" />
                {c.bookmark_count} saved
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="content_copy" size="sm" />
                {c.remix_count} remixed
              </span>
            </div>

            <div className="space-y-2">
              <ForkButton publishedId={c.id} signedIn={!!user} />
              <BookmarkButton publishedId={c.id} initialBookmarked={isBookmarked} signedIn={!!user} />
            </div>

            {c.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {c.tags.map((t) => (
                  <Link
                    key={t}
                    href={`/explore?tag=${t}`}
                    className="px-2.5 py-1 rounded-full bg-white border border-[#dbc1bc]/40 text-xs text-[#7d6161] hover:bg-[#fadbdb]"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
