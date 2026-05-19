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
 * Phase 86: the `preview` column IS carried onto `SlideTemplate.preview`.
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
    // Phase 86 (ADMIN-02): carry the row's preview column onto
    // SlideTemplate.preview so a DB template's saved cover-snapshot URL
    // reaches the picker. `null` → `undefined` to match the optional field.
    preview: row.preview ?? undefined,
  } as SlideTemplate
}

// SlideTemplate keys that identify the template or are picker assets — NOT
// flat style. They are owned by the DB template's own row columns (id, name,
// preview) or are source-specific assets, so they are stripped from a saved
// flat_style blob.
const NON_FLAT_STYLE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'thumbnail',
  'sample',
  'preview',
])

/**
 * Project a resolved SlideTemplate down to a `flat_style` blob — the
 * write-side inverse of `dbRowToSlideTemplate`.
 *
 * The admin Save-as-Template flow uses this so a DB template carries the
 * source carousel's RESOLVED-TEMPLATE flat style (fonts, colors, accent,
 * treatments). The blob must be SlideTemplate-shaped (camelCase) — exactly
 * what `dbRowToSlideTemplate` reads back — and a resolved SlideTemplate
 * already is that shape; this only strips the identity + picker-asset keys
 * and omits `undefined`-valued fields (skip-emit) so the stored blob is
 * minimal.
 *
 * Note: this deliberately does NOT use `extractLayoutRecipe`'s `flatStyle`
 * output — that is `SlideStyleOverrides`-shaped (snake_case), keys
 * `dbRowToSlideTemplate` never reads, and is empty whenever a carousel's look
 * lives in its code template rather than in per-slide overrides. The resolved
 * template is the faithful flat-style base.
 *
 * Pure — no I/O, no mutation of the input.
 */
export function templateFlatStyle(template: SlideTemplate): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(template)) {
    if (NON_FLAT_STYLE_KEYS.has(key)) continue
    if (value === undefined) continue
    out[key] = value
  }
  return out
}
