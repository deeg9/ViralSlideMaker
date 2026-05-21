/**
 * One-off script: render a real photo-backed cover-preview PNG for every of
 * the 16 code templates and wire the resulting public URL onto each template
 * source file. Idempotent — re-running on an unchanged set is a no-op.
 *
 * The pipeline, per template:
 *   1. find an exemplar carousel on buyer@example.com's account
 *      (a generation_status='complete' project using that template_id);
 *   2. for templates with NO exemplar, generate a fresh 3-slide carousel on
 *      that account (real Gemini Flash text spend — 1 call per gap template);
 *   3. snapshot the cover slide via renderCoverPreviewPng;
 *   4. upload the PNG to the public `template-previews` bucket at the
 *      deterministic path `code-templates/{slug}.png` (upsert: true);
 *   5. rewrite `src/lib/render/templates/{slug}.ts`, wiring the public URL
 *      onto the template's `preview` field (insert-or-replace, idempotent).
 *
 * Plan 90-01 ships this script with a working `--dry-run` mode only — NO live
 * writes, NO Gemini spend, NO Storage objects. The live, money-spending run is
 * Plan 90-02, which simply invokes the non-dry-run path built here.
 *
 * Run (preferred — loads .env.local for you):
 *   npm run previews -- [--user-id=<uuid>] [--dry-run]
 * Or directly (standalone tsx does NOT auto-load .env.local — pass --env-file):
 *   npx tsx --env-file=.env.local scripts/render-template-previews.ts [--user-id=<uuid>] [--dry-run]
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *               GEMINI_API_KEY, PEXELS_API_KEY, NEXT_PUBLIC_APP_URL.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { templates, type SlideTemplate } from '../src/lib/render/templates/index'
import { resolveTemplate } from '../src/lib/render/templates/registry'
import { renderCoverPreviewPng } from '../src/lib/render/preview-render'
import type { Slide } from '../src/lib/types/slide'

// NOTE: `generateCarousel` is imported LAZILY inside the live gap-fill path
// (step 9a) — never at module load. Its transitive import chain reaches
// `src/lib/pexels/search-photos.ts`, which constructs the Pexels client at
// module-load time (`createClient(process.env.PEXELS_API_KEY!)`) and THROWS if
// the key is absent. A static top-level import would therefore crash `--dry-run`
// (and the helper unit tests) before `requireEnv` can emit its clean message.
// The dynamic import keeps the dry-run path and the pure-helper tests hermetic.

const LOG = '[render-previews]'
const PREVIEW_BUCKET = 'template-previews'
const PREVIEW_ACCOUNT_EMAIL = 'buyer@example.com'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A `projects` row, narrowed to the columns the gap-map + snapshot need. The
 * caller pre-filters the query to `generation_status = 'complete'`.
 */
export interface ProjectRow {
  id: string
  title: string | null
  topic: string | null
  template_id: string | null
  slide_data: Slide[]
  generation_status: string | null
  updated_at: string | null
}

/**
 * Per-template gap-map entry. `exemplar` carries the freshest completed project
 * for that template id; `gap` means the account has no carousel for it yet.
 */
export type GapEntry =
  | { kind: 'exemplar'; project: ProjectRow }
  | { kind: 'gap' }

// ─── Curated topics for gap-fill generation ─────────────────────────────────
// One evergreen, visually-strong topic per template id (RESEARCH.md Open
// Question 2). Topics are picked to suit each template's vibe — news-* take a
// current-events headline shape, soft-sage / paper-essay take a calm wellness
// angle, y2k-pop / sunset-tabloid take a punchy pop-culture angle. Used ONLY on
// the non-dry-run gap path; every one of the 16 ids has an entry.
const TOPIC_MAP: Record<string, string> = {
  'bold-yellow': '5 money habits that quietly build wealth',
  'brutalist-grid': 'The productivity systems that actually scale',
  'chrome-pulse': 'AI tools reshaping creative work in 2026',
  documentary: 'How one small town reinvented its future',
  'editorial-serif': 'The lost art of deep, focused reading',
  'highlight-bar': 'How I gained 50K followers in 90 days',
  'magazine-bold': 'The street-style trends defining this season',
  'news-cyan': 'Breaking: the tech shift everyone is watching',
  'news-drop': 'The headline story shaping this week',
  'news-oracle': 'What this market move means for you',
  'notes-app-chic': 'My honest morning routine, unfiltered',
  'paper-essay': 'A quiet case for doing less, better',
  'soft-sage': 'Simple mindfulness rituals for a calmer day',
  'sunset-tabloid': 'The pop-culture moment everyone is talking about',
  'tr3nding-news': 'The story going viral right now',
  'y2k-pop': 'Why Y2K nostalgia is having a huge moment',
}

// ─── Pure helpers (exported — unit-tested without a live DB) ─────────────────

/**
 * Build the deterministic Storage path for a template's preview PNG.
 * Guards the id against `/^[a-z0-9-]+$/` BEFORE composing the path so a crafted
 * template id can never inject into the bucket (threat T-90-01; mirrors the
 * guard in generate-template-thumbnails.ts).
 */
export function previewStoragePath(templateId: string): string {
  if (!/^[a-z0-9-]+$/.test(templateId)) {
    throw new Error(
      `${LOG} Unsafe template id '${templateId}' — must match [a-z0-9-]+`,
    )
  }
  return `code-templates/${templateId}.png`
}

/**
 * Build the per-template gap-map. Pure: takes the already-filtered
 * (`generation_status = 'complete'`) projects as an argument and never queries.
 * For each of the supplied templates, returns the freshest matching project as
 * an `exemplar`, or `gap` when the account has no carousel for that id. All
 * supplied template ids appear as keys.
 */
export function buildGapMap(
  templateList: SlideTemplate[],
  projects: ProjectRow[],
): Map<string, GapEntry> {
  const map = new Map<string, GapEntry>()
  for (const template of templateList) {
    const matches = projects.filter((p) => p.template_id === template.id)
    if (matches.length === 0) {
      map.set(template.id, { kind: 'gap' })
      continue
    }
    // Freshest by updated_at (descending). A missing updated_at sorts last.
    const freshest = matches.reduce((best, current) => {
      const bestAt = best.updated_at ?? ''
      const currentAt = current.updated_at ?? ''
      return currentAt > bestAt ? current : best
    })
    map.set(template.id, { kind: 'exemplar', project: freshest })
  }
  return map
}

// Matches the `preview:` field line inside a flat object literal, capturing the
// indentation so a replacement preserves the file's existing formatting.
const PREVIEW_LINE_RE = /^([ \t]*)preview:\s*'[^']*',?[ \t]*$/m

/**
 * Insert-or-replace the `preview:` field on a single template `.ts` file's text.
 *
 * - If a `preview:` line already exists, REPLACE its string value with
 *   `previewUrl` (preserving the line's indentation).
 * - Else INSERT `  preview: '<previewUrl>',` immediately before the final `}`
 *   that closes the `export const ...: SlideTemplate = { ... }` literal.
 *
 * Idempotent: `rewriteTemplateSource(rewriteTemplateSource(SRC, u), u)` equals
 * `rewriteTemplateSource(SRC, u)`. Every template file is a flat literal ending
 * in `\n}\n` (verified against highlight-bar.ts / news-oracle.ts).
 */
export function rewriteTemplateSource(src: string, previewUrl: string): string {
  const existing = PREVIEW_LINE_RE.exec(src)
  if (existing) {
    const indent = existing[1]
    return src.replace(PREVIEW_LINE_RE, `${indent}preview: '${previewUrl}',`)
  }

  // No preview line — insert before the closing `}` of the export literal.
  // The closing brace is the last top-level `}` followed by an optional
  // trailing newline at end-of-file.
  const closeIdx = src.lastIndexOf('\n}')
  if (closeIdx < 0) {
    throw new Error(
      `${LOG} could not locate the closing '}' of the template literal`,
    )
  }
  const before = src.slice(0, closeIdx)
  const after = src.slice(closeIdx) // begins with '\n}'
  return `${before}\n  preview: '${previewUrl}',${after}`
}

// ─── Script-only helpers (not exported — touch env / argv / DB) ──────────────

function parseFlag(argv: string[], name: string): string | undefined {
  const flag = argv.find((a) => a.startsWith(`--${name}=`))
  return flag ? flag.slice(`--${name}=`.length) : undefined
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${LOG} missing env: ${name}`)
    process.exit(1)
  }
  return v
}

/**
 * Resolve a Supabase user id by email via the service-role `auth.admin` API.
 * `listUsers` is paginated — page through (large perPage) until a match or the
 * final page. Throws a clear error if no auth user matches.
 */
async function resolveUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )
    if (match) return match.id
    if (data.users.length < 1000) break
  }
  throw new Error(`No auth user for ${email}`)
}

// ─── Orchestration ──────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  // 1. Parse flags.
  const dryRun = argv.includes('--dry-run')
  const userIdFlag = parseFlag(argv, 'user-id')

  // 2. Env preflight — all 5 vars required.
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  requireEnv('GEMINI_API_KEY')
  requireEnv('PEXELS_API_KEY')
  const appUrl = requireEnv('NEXT_PUBLIC_APP_URL')

  // 3. Service-role client.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`${LOG} mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

  // 4. Pre-flight bucket check (Pitfall 6 — the migration may not be applied
  //    to the shared remote Supabase project).
  const { data: bucket, error: bucketErr } = await admin.storage.getBucket(
    PREVIEW_BUCKET,
  )
  if (bucketErr || !bucket) {
    console.error(
      `${LOG} bucket "${PREVIEW_BUCKET}" not found — apply supabase/migrations/20260519_phase86_template_previews_bucket.sql to the shared project`,
    )
    process.exit(1)
  }
  console.log(`${LOG} bucket "${PREVIEW_BUCKET}" present`)

  // 5. Resolve the account user id.
  let userId: string
  if (userIdFlag) {
    userId = userIdFlag
    console.log(`${LOG} using --user-id=${userId}`)
  } else {
    try {
      userId = await resolveUserIdByEmail(admin, PREVIEW_ACCOUNT_EMAIL)
    } catch (err) {
      console.error(
        `${LOG} could not resolve ${PREVIEW_ACCOUNT_EMAIL}: ${(err as Error).message}`,
      )
      process.exit(1)
    }
    console.log(`${LOG} resolved ${PREVIEW_ACCOUNT_EMAIL} → ${userId}`)
  }

  // 6. Query the account's completed carousels (newest first).
  const { data: projectRows, error: projectsErr } = await admin
    .from('projects')
    .select(
      'id, title, topic, template_id, slide_data, generation_status, updated_at',
    )
    .eq('user_id', userId)
    .eq('generation_status', 'complete')
    .order('updated_at', { ascending: false })
  if (projectsErr) {
    console.error(`${LOG} projects query failed: ${projectsErr.message}`)
    process.exit(1)
  }
  const projects = (projectRows as ProjectRow[] | null) ?? []
  console.log(`${LOG} found ${projects.length} completed carousels on account`)

  // 7. Build the gap-map and log the per-template plan.
  const gapMap = buildGapMap(templates, projects)
  let gapCount = 0
  console.log(`${LOG} per-template plan:`)
  for (const template of templates) {
    const entry = gapMap.get(template.id)!
    if (entry.kind === 'gap') {
      gapCount++
      console.log(`${LOG}   ${template.id.padEnd(18)} → gap`)
    } else {
      console.log(
        `${LOG}   ${template.id.padEnd(18)} → exemplar (project ${entry.project.id})`,
      )
    }
  }
  console.log(
    `${LOG} ${gapCount} gap(s) — estimated cost: ${gapCount} x 1 Gemini Flash text call`,
  )

  // 8. Dry-run path — log the plan and stop. No generation, snapshot, upload,
  //    or source-file write.
  if (dryRun) {
    console.log(`${LOG} DRY RUN — no live writes`)
    for (const template of templates) {
      const entry = gapMap.get(template.id)!
      const path = previewStoragePath(template.id)
      console.log(
        `${LOG}   plan ${template.id.padEnd(18)} ${entry.kind.padEnd(8)} → ${path}`,
      )
    }
    console.log(`${LOG} STATUS: dry-run ok`)
    return
  }

  // 9. Live path — exercised in Plan 02. For each of the 16 templates:
  //    gap-fill generate (if needed), snapshot the cover, upload, rewrite the
  //    template source file.
  let generated = 0
  let reused = 0
  let uploaded = 0
  let rewritten = 0

  for (const template of templates) {
    const id = template.id
    // Path-injection guard (threat T-90-01) — also re-asserts before any I/O.
    const storagePath = previewStoragePath(id)
    const entry = gapMap.get(id)!

    // 9a. Obtain the source carousel — reuse an exemplar, or generate a gap.
    let project: ProjectRow
    if (entry.kind === 'exemplar') {
      project = entry.project
      reused++
      console.log(`${LOG} ${id}: reusing exemplar project ${project.id}`)
    } else {
      const topic = TOPIC_MAP[id]
      if (!topic) {
        console.error(`${LOG} ${id}: no TOPIC_MAP entry — cannot gap-fill`)
        process.exit(1)
      }
      console.log(`${LOG} ${id}: gap — generating carousel (topic: "${topic}")`)
      // Lazy import — keeps the Pexels-client module-load side effect (and any
      // Gemini-client init) off the dry-run / unit-test path. See the note at
      // the top of this file.
      const { generateCarousel } = await import('../src/lib/services/carousel')
      // imageSource: 'stock' — Pexels, cheap. NEVER 'ai' (Imagen per slide).
      const { projectId } = await generateCarousel(admin, userId, {
        topic,
        templateId: id,
        slideCount: 3,
        imageSource: 'stock',
      })
      // Re-fetch the generated project's slide_data.
      const { data: freshRow, error: freshErr } = await admin
        .from('projects')
        .select(
          'id, title, topic, template_id, slide_data, generation_status, updated_at',
        )
        .eq('id', projectId)
        .single()
      if (freshErr || !freshRow) {
        console.error(
          `${LOG} ${id}: could not re-fetch generated project ${projectId}: ${
            freshErr?.message ?? 'no row'
          }`,
        )
        process.exit(1)
      }
      project = freshRow as ProjectRow
      generated++
    }

    const slides = project.slide_data
    if (!Array.isArray(slides) || slides.length === 0) {
      console.error(`${LOG} ${id}: project ${project.id} has empty slide_data`)
      process.exit(1)
    }

    // 9b. Snapshot the cover. Pitfall 1: render with resolveTemplate(id) — the
    //     INTENDED template — NOT the generated project's template_id, which
    //     generateCarousel may have silently snapped to a category default.
    const resolved = await resolveTemplate(id)
    let buffer: Buffer
    try {
      buffer = await renderCoverPreviewPng(
        slides[0],
        resolved,
        {
          slideIndex: 0,
          totalSlides: slides.length,
          topic: project.topic ?? undefined,
        },
        appUrl, // origin — lets Satori fetch /textures + /overlays (Pitfall 3)
      )
    } catch (err) {
      console.error(
        `${LOG} ${id}: renderCoverPreviewPng failed: ${(err as Error).message}`,
      )
      process.exit(1)
    }
    console.log(`${LOG} ${id}: rendered cover (${buffer.length} bytes)`)

    // 9c. Upload to Storage. Pitfall 2: upsert: true is mandatory — the
    //     deterministic path requires overwrite-in-place for idempotent re-runs.
    const { error: uploadErr } = await admin.storage
      .from(PREVIEW_BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      })
    if (uploadErr) {
      console.error(`${LOG} ${id}: upload failed: ${uploadErr.message}`)
      process.exit(1)
    }
    const { data: pub } = admin.storage
      .from(PREVIEW_BUCKET)
      .getPublicUrl(storagePath)
    const previewUrl = pub.publicUrl
    uploaded++
    console.log(`${LOG} ${id}: uploaded → ${previewUrl}`)

    // 9d. Wire the URL onto the template source file (insert-or-replace).
    //     Write back only when the rewrite actually changes the file.
    const filePath = join(
      process.cwd(),
      'src',
      'lib',
      'render',
      'templates',
      `${id}.ts`,
    )
    const fileText = readFileSync(filePath, 'utf-8')
    const rewritten1 = rewriteTemplateSource(fileText, previewUrl)
    if (rewritten1 !== fileText) {
      writeFileSync(filePath, rewritten1)
      rewritten++
      console.log(`${LOG} ${id}: wired preview URL into ${id}.ts`)
    } else {
      console.log(`${LOG} ${id}: ${id}.ts already up to date`)
    }
  }

  console.log(
    `${LOG} STATUS: ok — ${generated} generated, ${reused} reused, ${uploaded} uploaded, ${rewritten} file(s) rewritten`,
  )
}

// Run `main()` ONLY when this file is executed directly (`npm run previews` /
// `tsx scripts/render-template-previews.ts`). When the Wave-0 unit test imports
// the pure helpers, the module must NOT run the pipeline — otherwise `main()`'s
// `requireEnv` preflight calls `process.exit(1)` inside vitest, which surfaces
// as an unhandled error and can poison the test run.
const isDirectRun =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((err) => {
    console.error(`${LOG} fatal:`, err)
    process.exit(1)
  })
}
