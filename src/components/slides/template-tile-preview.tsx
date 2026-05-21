'use client'

// Phase 90 (PREVIEW-04): every code AND DB template now carries a `preview`
// URL (a rendered cover-snapshot PNG). The picker tile is a single <img>.
// The old live-render fallback branch (and its sample-slide import) are gone
// — a new code template cannot ship without first rendering its preview.

import type { SlideTemplate } from '@/lib/render/templates/index'

export function TemplateTilePreview({ template }: { template: SlideTemplate }) {
  return (
    <img
      src={template.preview}
      alt={`Preview of ${template.name}`}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
}
