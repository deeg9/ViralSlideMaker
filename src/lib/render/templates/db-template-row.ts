// Phase 83 (TSTORE-02): DB template row shape + mapper to SlideTemplate.
// flat_style is a jsonb blob mirroring the SlideTemplate flat-style fields
// (~30 mostly-optional). This module is pure — no Supabase import, no I/O —
// so it is trivially unit-testable.

import type { SlideTemplate } from './index'

// Row shape of the public.templates table created by the Phase 83 migration
// (20260518_phase83_templates_table.sql). The project's Supabase client is
// untyped, so this interface is the hand-maintained contract for a DB row.
export interface DbTemplateRow {
  id: string
  name: string
  category: string | null
  flat_style: Record<string, unknown>
  // NULLABLE jsonb reserved for the Phase 84 LayoutRecipe model. Phase 83
  // never reads it — it is part of the row shape but the mapper ignores it.
  layout_recipe: Record<string, unknown> | null
  preview: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// SlideTemplate fields that are REQUIRED (non-optional) on the interface.
// A sparse flat_style blob might omit some of them, so the mapper backfills
// these defaults — but ONLY when the key is absent (nullish), never
// overwriting a value the blob actually supplies.
const REQUIRED_FIELD_DEFAULTS = {
  thumbnail: '',
  fontFamily: 'Inter',
  hookFontSize: '48px',
  bodyFontSize: '28px',
  textColor: '#000000',
  backgroundColor: '#ffffff',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'left' as const,
  textPosition: 'center' as const,
  hookStyle: 'normal' as const,
}

/**
 * Convert a public.templates DB row to a SlideTemplate.
 *
 * The flat_style jsonb blob holds the SlideTemplate flat-style fields; the
 * canonical `id` / `name` columns win over anything inside the blob. Required
 * SlideTemplate fields absent from a sparse blob are backfilled with safe
 * defaults so the mapper never returns a structurally-invalid template.
 *
 * `layout_recipe` is deliberately NOT read — it is reserved for Phase 84.
 */
export function dbRowToSlideTemplate(row: DbTemplateRow): SlideTemplate {
  const blob = row.flat_style ?? {}

  // Backfill only the required fields that the blob omits (nullish coalescing
  // per field — a value the blob supplies is always preserved).
  const backfilled: Record<string, unknown> = {}
  for (const [key, fallback] of Object.entries(REQUIRED_FIELD_DEFAULTS)) {
    backfilled[key] = (blob as Record<string, unknown>)[key] ?? fallback
  }

  return {
    // Spread the blob first (carries all optional flat-style fields)...
    ...blob,
    // ...then the backfilled required fields (only fill what the blob omits)...
    ...backfilled,
    // ...then the canonical columns win over anything in the blob.
    id: row.id,
    name: row.name,
  } as SlideTemplate
}
