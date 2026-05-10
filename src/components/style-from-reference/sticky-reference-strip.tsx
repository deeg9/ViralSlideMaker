'use client'

// Phase 76 Plan 01 (PREVIEW-09):
// Sticky reference thumbnail strip. Rendered OUTSIDE the conditional
// spec-preview block in the shell so the user always sees what they
// uploaded across every status transition (extracting / preview /
// generating / done / error). Defends the "I forgot what I uploaded"
// UX trap (CONTEXT.md specifics).
//
// Plan 76-03 will pass `slotPerReference` to inject inline refusal-warning
// chips beside flagged thumbnails — the prop exists today so 76-03 does
// not need to fork this component.
//
// Copy posture: this file ships zero user-facing copy beyond image alt
// text (which uses the original filename). No forbidden mimicry-framing
// tokens — Phase 79 will land the project-wide grep gate.

import type { ReactNode } from 'react'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

export interface StickyReferenceStripProps {
  references: ReferenceAssetRow[]
  /** Optional slot Plan 76-03 uses to render inline refusal-warning chips
   *  alongside the matching thumbnail. */
  slotPerReference?: (row: ReferenceAssetRow, idx: number) => ReactNode
}

export function StickyReferenceStrip(props: StickyReferenceStripProps) {
  if (props.references.length === 0) {
    // Render the sticky container (so its DOM presence is stable for tests +
    // layout) but show no thumbnails. The container ALWAYS renders so the
    // shell can place it outside conditional blocks per PREVIEW-09.
    return (
      <div
        data-testid="sticky-reference-strip"
        className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#e2cfcf] py-2 px-3 min-h-[48px] flex items-center"
      >
        <p className="text-[11px] text-[#7d6161]">No references uploaded yet.</p>
      </div>
    )
  }

  return (
    <ul
      data-testid="sticky-reference-strip"
      className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#e2cfcf] py-2 px-3 flex gap-2 overflow-x-auto"
    >
      {props.references.map((row, idx) => (
        <li
          key={`${row.url}-${idx}`}
          className="relative flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-[#f5f5f5] border border-[#e2cfcf]"
          data-testid="sticky-reference-thumb"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.url}
            alt={row.original_filename}
            className="w-full h-full object-cover"
          />
          {props.slotPerReference?.(row, idx)}
        </li>
      ))}
    </ul>
  )
}
