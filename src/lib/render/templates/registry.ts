// Phase 83 (TSTORE-02): hybrid sync+async template registry.
//
// The 13 CODE templates stay synchronous in `templates[]` (./index.ts) — this
// module is purely additive and does NOT modify index.ts. It adds a DB-aware
// resolution layer that merges the code templates with DB rows from the
// public.templates table, behind a short (~60s) in-memory TTL cache so a
// newly-inserted DB row appears in the picker within the window with no code
// deploy and no server restart.
//
// Rules (from 83-CONTEXT.md "Registry Merge Architecture"):
//   - Collision: a CODE template always wins over a DB row with the same id.
//   - Picker ordering: DB templates appear FIRST, then the code picker list.
//   - The module NEVER throws — a DB read failure degrades gracefully to
//     code-templates-only behavior.

import { createClient } from '@/lib/supabase/server'
import { templates, pickerTemplates, TEMPLATE_IDS, type SlideTemplate } from './index'
import { dbRowToSlideTemplate, type DbTemplateRow } from './db-template-row'

// A fetcher returns the raw DB template rows. The default hits Supabase; tests
// inject a fixture fetcher via __setDbTemplateFetcher (no live DB).
export type DbTemplateFetcher = () => Promise<DbTemplateRow[]>

/**
 * Default fetcher — reads public.templates via the anon/publishable client,
 * newest-first. Respects the public SELECT RLS policy. NEVER throws: any error
 * degrades to an empty list so the registry falls back to code-templates-only.
 */
async function defaultDbTemplateFetcher(): Promise<DbTemplateRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return []
    return (data as DbTemplateRow[] | null) ?? []
  } catch {
    return []
  }
}

// ── Test seam ────────────────────────────────────────────────────────────────
// activeFetcher is swappable so the merge is hermetically unit-testable.
let activeFetcher: DbTemplateFetcher = defaultDbTemplateFetcher

/** TEST-ONLY: inject a fixture DB-template fetcher (no live DB connection). */
export function __setDbTemplateFetcher(fetcher: DbTemplateFetcher): void {
  activeFetcher = fetcher
}

/** TEST-ONLY: restore the default fetcher AND clear the TTL cache. */
export function __resetDbTemplateRegistry(): void {
  activeFetcher = defaultDbTemplateFetcher
  cache = null
}

// ── Short-TTL in-memory cache over DB rows ──────────────────────────────────
const DB_TEMPLATE_TTL_MS = 60_000 // ~60s — a new row appears within this window.
let cache: { rows: DbTemplateRow[]; fetchedAt: number } | null = null

/**
 * Return DB template rows, served from the ~60s TTL cache when warm. On a cache
 * miss the active fetcher runs; on fetcher failure the last cached rows are
 * returned if present, else an empty list. Never throws.
 */
async function getDbRows(): Promise<DbTemplateRow[]> {
  if (cache && Date.now() - cache.fetchedAt < DB_TEMPLATE_TTL_MS) {
    return cache.rows
  }
  try {
    const rows = await activeFetcher()
    cache = { rows, fetchedAt: Date.now() }
    return rows
  } catch {
    return cache?.rows ?? []
  }
}

// Set of code-template ids — used for the code-wins collision rule.
const CODE_TEMPLATE_ID_SET: ReadonlySet<string> = new Set(TEMPLATE_IDS)

/**
 * Resolve a template id to a SlideTemplate, merging code templates and DB rows.
 *
 * - A CODE template with the id always wins (collision rule).
 * - Else a DB row with the id is mapped via dbRowToSlideTemplate.
 * - Else falls back to templates[0] (mirrors the sync getTemplate contract so
 *   callers never receive undefined).
 *
 * Never throws.
 */
export async function resolveTemplate(id: string): Promise<SlideTemplate> {
  const codeTemplate = templates.find((t) => t.id === id)
  if (codeTemplate) return codeTemplate

  const rows = await getDbRows()
  const row = rows.find((r) => r.id === id)
  if (row) return dbRowToSlideTemplate(row)

  return templates[0]
}

/**
 * The merged picker list: DB templates FIRST (newest curated content surfaced),
 * then the code picker templates. A DB row whose id collides with a code
 * template id is dropped (code wins — no duplicate). Never throws.
 */
export async function getPickerTemplates(): Promise<SlideTemplate[]> {
  const rows = await getDbRows()
  const dbTemplates = rows
    .filter((r) => !CODE_TEMPLATE_ID_SET.has(r.id))
    .map(dbRowToSlideTemplate)
  return [...dbTemplates, ...pickerTemplates]
}

/**
 * Async DB-aware companion to the static TEMPLATE_IDS allowlist. True if the id
 * is a code-template id OR a DB row id. TEMPLATE_IDS itself stays code-only as
 * the synchronous static validation allowlist. Never throws.
 */
export async function isKnownTemplateId(id: string): Promise<boolean> {
  if (CODE_TEMPLATE_ID_SET.has(id)) return true
  const rows = await getDbRows()
  return rows.some((r) => r.id === id)
}
