'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import {
  unpublishCarousel,
  deletePublishedCarousel,
} from '@/app/(dashboard)/project/[id]/publish-actions'

export interface PublishedCarouselRow {
  id: string
  slug: string
  title: string
  hero_image_url: string | null
  bookmark_count: number
  remix_count: number
  unpublished_at: string | null
}

export function PublishedList({ rows }: { rows: PublishedCarouselRow[] }) {
  if (rows.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Icon name="public" className="text-[#3d0000]" />
        <h2 className="text-xl font-semibold text-[#3d0000]">Published to Explore</h2>
        <span className="text-sm text-[#7d6161]">{rows.length} total</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {rows.map((row) => (
          <PublishedCard key={row.id} row={row} />
        ))}
      </div>
    </section>
  )
}

function PublishedCard({ row }: { row: PublishedCarouselRow }) {
  const router = useRouter()
  const [unpublishPending, startUnpublish] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const isHidden = !!row.unpublished_at
  const busy = unpublishPending || deletePending

  function handleUnpublish() {
    startUnpublish(async () => {
      const result = await unpublishCarousel(row.id)
      if (result.success) {
        router.refresh()
      } else {
        alert(result.error)
      }
    })
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${row.title}" permanently? Anyone who already forked it keeps their copy.`)) {
      return
    }
    startDelete(async () => {
      const result = await deletePublishedCarousel(row.id)
      if (result.success) {
        router.refresh()
      } else {
        alert(result.error)
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-[#dbc1bc]/30 overflow-hidden">
      <div className="relative aspect-[9/16] bg-[#fadbdb]">
        {row.hero_image_url ? (
          <Image
            src={row.hero_image_url}
            alt={row.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover ${isHidden ? 'opacity-50' : ''}`}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#7d6161]">
            <Icon name="image" size="lg" />
          </div>
        )}
        {isHidden && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-[#fadbdb] text-[#3d0000] text-[10px] font-bold uppercase tracking-wider">
            Hidden
          </div>
        )}
      </div>
      <div className="p-3 space-y-3">
        <div>
          <h3 className="font-semibold text-sm text-[#3d0000] line-clamp-2">{row.title}</h3>
          <div className="flex items-center gap-3 text-xs text-[#7d6161] mt-2">
            <span className="flex items-center gap-1">
              <Icon name="bookmark" size="sm" />
              {row.bookmark_count}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="content_copy" size="sm" />
              {row.remix_count}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/explore/${row.slug}`}
            className="flex-1 inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-[#3d0000] bg-[#fff0f0] hover:bg-[#fadbdb] transition-colors"
          >
            View
          </Link>
          {!isHidden && (
            <button
              onClick={handleUnpublish}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-[#3d0000] border border-[#dbc1bc]/40 hover:bg-[#fff0f0] disabled:opacity-50"
            >
              {unpublishPending ? '…' : 'Unpublish'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            {deletePending ? '…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
