import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/ui/icon'

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  website_url: string | null
  social_links: Record<string, string> | null
  created_at: string
}

interface CarouselRow {
  id: string
  slug: string
  title: string
  hero_image_url: string | null
  tags: string[]
  bookmark_count: number
  remix_count: number
  published_at: string
}

const SOCIAL_PLATFORMS: ReadonlyArray<{
  key: 'tiktok' | 'instagram' | 'x' | 'youtube'
  label: string
  href: (handle: string) => string
}> = [
  { key: 'tiktok', label: 'TikTok', href: (h) => `https://tiktok.com/@${h}` },
  { key: 'instagram', label: 'Instagram', href: (h) => `https://instagram.com/${h}` },
  { key: 'x', label: 'X', href: (h) => `https://x.com/${h}` },
  { key: 'youtube', label: 'YouTube', href: (h) => `https://youtube.com/@${h}` },
]

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const supabase = await createClient()

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, website_url, social_links, created_at')
    .eq('username', username)
    .maybeSingle()

  if (!profileRow) notFound()
  const profile = profileRow as ProfileRow

  const { data: { user } } = await supabase.auth.getUser()
  const isOwnProfile = !!user && user.id === profile.id

  const { data: carouselRows } = await supabase
    .from('published_carousels')
    .select('id, slug, title, hero_image_url, tags, bookmark_count, remix_count, published_at')
    .eq('owner_id', profile.id)
    .is('unpublished_at', null)
    .eq('is_hidden', false)
    .order('published_at', { ascending: false })
    .limit(48)
  const carousels = (carouselRows as CarouselRow[] | null) ?? []

  const displayName = profile.display_name || (profile.username ? `@${profile.username}` : 'Unknown')
  const joinedLabel = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const websiteUrl = profile.website_url?.trim() || null
  const websiteLabel = websiteUrl ? websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : null
  type SocialChip = (typeof SOCIAL_PLATFORMS)[number] & { handle: string }
  const socials: SocialChip[] = SOCIAL_PLATFORMS.flatMap((p) => {
    const handle = (profile.social_links?.[p.key] ?? '').trim().replace(/^@+/, '')
    return handle ? [{ ...p, handle }] : []
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-[#dbc1bc]/30 p-6 mb-8">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-[#fadbdb] flex items-center justify-center overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName}
                width={80}
                height={80}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <Icon name="person" size="xl" className="text-[#3d0000]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-[#3d0000] truncate">{displayName}</h1>
                {profile.username && (
                  <p className="text-sm text-[#7d6161] mt-0.5">@{profile.username}</p>
                )}
              </div>
              {isOwnProfile && (
                <Link
                  href="/settings/profile"
                  className="flex-shrink-0 bg-[#3d0000] text-white px-4 py-2 rounded-xl font-medium text-sm transition-transform active:scale-95 hover:bg-[#3d0000]/90"
                >
                  Edit profile
                </Link>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm text-[#55423f] mt-3 leading-relaxed whitespace-pre-line">
                {profile.bio}
              </p>
            )}

            <p className="text-xs text-[#7d6161] mt-3">
              {carousels.length} template{carousels.length === 1 ? '' : 's'} · joined {joinedLabel}
            </p>

            {(websiteUrl || socials.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fff0f0] text-xs text-[#3d0000] hover:bg-[#fadbdb] transition-colors"
                  >
                    <Icon name="link" size="sm" />
                    {websiteLabel}
                  </a>
                )}
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href(s.handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#fff0f0] text-xs text-[#3d0000] hover:bg-[#fadbdb] transition-colors"
                  >
                    {s.label} · @{s.handle}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Carousels */}
      {carousels.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#dbc1bc]/30">
          <Icon name="image" size="lg" className="text-[#7d6161] mx-auto" />
          <p className="text-lg text-[#3d0000] font-semibold mt-4">
            {isOwnProfile
              ? "You haven't published anything yet."
              : `@${profile.username ?? 'this user'} hasn't published anything yet.`}
          </p>
          {isOwnProfile && (
            <>
              <p className="text-sm text-[#7d6161] mt-1">
                Publish a carousel from your dashboard to share it here.
              </p>
              <Link
                href="/dashboard?new=1"
                className="inline-flex items-center gap-2 mt-4 bg-[#3d0000] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#3d0000]/90"
              >
                Create a carousel
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {carousels.map((c) => (
            <Link
              key={c.id}
              href={`/explore/${c.slug}`}
              className="block bg-white rounded-2xl border border-[#dbc1bc]/30 overflow-hidden hover:shadow-lg hover:border-[#3d0000]/30 transition-all"
            >
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
          ))}
        </div>
      )}
    </div>
  )
}
