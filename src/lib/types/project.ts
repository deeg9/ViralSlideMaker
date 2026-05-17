import type { Slide, GenerationStatus } from './slide'
import type { StyleSpec } from './style-spec'
import type { ReferenceAssetRow } from './projects-storage-constants'

export interface Project {
  id: string
  user_id: string
  title: string
  description: string | null
  slide_data: Slide[]
  template_id?: string
  /** Phase 82 (R1): content category that drove generation (e.g. 'news',
      'facts'). Nullable — legacy pre-Phase-82 rows have no category;
      generation code treats an absent category as the default ('news'). */
  category?: string
  topic?: string
  generation_status?: GenerationStatus
  created_at: string
  updated_at: string
  // Phase 77 EDITOR-02 + EDITOR-03: optional + nullable additive fields.
  // Mirror the projects.style_spec + projects.reference_assets JSONB
  // columns added by Phase 74-02 migration. Legacy projects (every
  // pre-v2.13 project) read these as null — components null-check before
  // rendering provenance UI. TPLREND-05-style additive discipline:
  // adding optional fields cannot break existing consumers.
  style_spec?: StyleSpec | null
  reference_assets?: ReferenceAssetRow[] | null
}
