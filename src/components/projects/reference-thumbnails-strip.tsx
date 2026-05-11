// Phase 77 Plan 03 (EDITOR-03): persistent reference thumbnail strip on the
// project detail page. Pure presentation. Reads from projects.reference_assets
// JSONB (added by Phase 74-02 migration). Empty / null / undefined input
// renders null — legacy projects (every pre-v2.13 project) and non-style-from-
// reference projects render byte-identical to pre-Phase-77 layout.
//
// LEGAL-03 framing discipline: caption + alt text use "Inspired by" language —
// NEVER "copied from", "cloned from", "exactly like", "duplicate of". Tested
// at the component level by an HTML grep (Test 8).
//
// Note: uses raw <img> rather than next/image because reference URLs can be
// Supabase Storage signed URLs whose host needs explicit next.config domain
// allowlisting. v1 ships <img>; next/image migration is a follow-up if perf
// telemetry warrants it (the strip is small + above the fold + lazy-loaded
// already).

import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

interface ReferenceThumbnailsStripProps {
  references: ReferenceAssetRow[] | null | undefined
}

export function ReferenceThumbnailsStrip({
  references,
}: ReferenceThumbnailsStripProps) {
  if (!references || references.length === 0) return null
  return (
    <div
      data-testid="reference-thumbnails-strip"
      className="flex items-center gap-3 px-4 py-3 border-b border-[#dbc1bc]/30 bg-[#fff5f5]"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#3d0000]/70">
        Inspired by
      </span>
      <div className="flex items-center gap-2">
        {references.map((row, idx) => (
          <img
            key={`${row.sha256}-${idx}`}
            src={row.url}
            alt={`Inspired by reference ${idx + 1}`}
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="h-12 w-12 rounded-md object-cover border border-[#dbc1bc]/40"
          />
        ))}
      </div>
    </div>
  )
}
