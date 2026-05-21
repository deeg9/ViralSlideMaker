/**
 * One-shot script: re-render the hero PNG for a single published_carousels
 * row by slug. Closes the visible-drift symptom left behind after
 * quick-260511-uk1 fixed the Explore detail page consumer: the index card
 * still shows the publish-time hero snapshot, which can be visibly stale
 * if the source project's template_id changed after publish.
 *
 * Reuses the production render path (renderHeroBuffer from publish.ts) so
 * the regenerated PNG is byte-identical to what a fresh publish would
 * produce today. No new render logic.
 *
 * Run:
 *   npx tsx scripts/rerender-hero-by-slug.ts --slug=<published-slug>
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import { renderHeroBuffer, appOrigin } from '../src/lib/services/publish'
import type { Project } from '../src/lib/types/project'

const DEFAULT_SLUG = 'cognitive-agency-surrender-ai-s-impact-on-your-brain-7ebfc1'

function parseSlug(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith('--slug='))
  if (flag) return flag.slice('--slug='.length)
  return DEFAULT_SLUG
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`[rerender-hero] missing env: ${name}`)
    process.exit(1)
  }
  return v
}

/**
 * Best-effort: given the public hero URL, derive the bucket-relative path
 * (`<userId>/<uuid>.png`) so we can delete the stale object. The public URL
 * shape is `<supabase>/storage/v1/object/public/hero-thumbnails/<path>`.
 * Returns null if the URL doesn't match — caller logs a warning and skips.
 */
function pathFromPublicHeroUrl(url: string | null): string | null {
  if (!url) return null
  const marker = '/storage/v1/object/public/hero-thumbnails/'
  const idx = url.indexOf(marker)
  if (idx < 0) return null
  return url.slice(idx + marker.length)
}

async function main(): Promise<void> {
  const slug = parseSlug(process.argv.slice(2))
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`[rerender-hero] slug=${slug}`)

  // 1. Fetch the published row.
  const { data: pubRow, error: pubErr } = await admin
    .from('published_carousels')
    .select('id, slug, owner_id, source_project_id, template_id, hero_image_url, title')
    .eq('slug', slug)
    .maybeSingle()
  if (pubErr) {
    console.error('[rerender-hero] published_carousels fetch failed:', pubErr.message)
    process.exit(1)
  }
  if (!pubRow) {
    console.error(`[rerender-hero] no published_carousels row for slug=${slug}`)
    process.exit(1)
  }
  const pub = pubRow as {
    id: string
    slug: string
    owner_id: string
    source_project_id: string | null
    template_id: string | null
    hero_image_url: string | null
    title: string
  }
  if (!pub.source_project_id) {
    console.error(`[rerender-hero] row ${pub.id} has no source_project_id — cannot re-render from source project. Aborting.`)
    process.exit(1)
  }

  console.log(`[rerender-hero] PUB id=${pub.id} title="${pub.title}"`)
  console.log(`[rerender-hero] OLD hero_image_url: ${pub.hero_image_url ?? '<null>'}`)
  console.log(`[rerender-hero] published template_id: ${pub.template_id ?? '<null — render will fall back to highlight-bar>'}`)

  // 2. Fetch the source project — this is what renderHeroBuffer expects.
  const { data: projectRow, error: projErr } = await admin
    .from('projects')
    .select('*')
    .eq('id', pub.source_project_id)
    .maybeSingle()
  if (projErr) {
    console.error('[rerender-hero] projects fetch failed:', projErr.message)
    process.exit(1)
  }
  if (!projectRow) {
    console.error(`[rerender-hero] source project ${pub.source_project_id} no longer exists.`)
    process.exit(1)
  }
  const project = projectRow as Project
  console.log(`[rerender-hero] source project template_id: ${project.template_id ?? '<null>'}`)

  // 3. Render via the production path — byte-identical to a fresh publish.
  // Phase 89 (BKSHELVE): brand-kit removed; renderHeroBuffer no longer
  // takes a brand-kit argument.
  let buffer: Buffer
  try {
    buffer = await renderHeroBuffer(project, appOrigin())
  } catch (err) {
    console.error('[rerender-hero] renderHeroBuffer failed:', (err as Error).message)
    process.exit(1)
  }
  console.log(`[rerender-hero] rendered hero buffer: ${buffer.length} bytes`)

  // 5. Upload to hero-thumbnails. Same path shape as publish.ts:146.
  const newFilename = `${pub.owner_id}/${crypto.randomUUID()}.png`
  const { error: uploadErr } = await admin.storage
    .from('hero-thumbnails')
    .upload(newFilename, buffer, { contentType: 'image/png', upsert: false })
  if (uploadErr) {
    console.error('[rerender-hero] upload failed:', uploadErr.message)
    process.exit(1)
  }
  const { data: pubUrl } = admin.storage.from('hero-thumbnails').getPublicUrl(newFilename)
  const newHeroUrl = pubUrl.publicUrl
  console.log(`[rerender-hero] NEW hero_image_url: ${newHeroUrl}`)

  // 6. Atomically swap the URL on the published row.
  const { error: updateErr } = await admin
    .from('published_carousels')
    .update({ hero_image_url: newHeroUrl })
    .eq('id', pub.id)
  if (updateErr) {
    console.error('[rerender-hero] update failed:', updateErr.message)
    console.error('[rerender-hero] NEW PNG already uploaded at:', newFilename)
    console.error('[rerender-hero] You may want to delete it manually to avoid orphan storage.')
    process.exit(1)
  }

  // 7. Best-effort cleanup of the old PNG. Failure here does NOT roll back.
  const oldPath = pathFromPublicHeroUrl(pub.hero_image_url)
  if (oldPath) {
    const { error: delErr } = await admin.storage.from('hero-thumbnails').remove([oldPath])
    if (delErr) {
      console.warn(`[rerender-hero] WARN: could not delete old PNG at "${oldPath}":`, delErr.message)
    } else {
      console.log(`[rerender-hero] deleted old PNG: ${oldPath}`)
    }
  } else if (pub.hero_image_url) {
    console.warn(`[rerender-hero] WARN: old hero_image_url did not match expected /hero-thumbnails/ shape — skipping cleanup. URL: ${pub.hero_image_url}`)
  }

  console.log('[rerender-hero] STATUS: ok')
}

main().catch((err) => {
  console.error('[rerender-hero] fatal:', err)
  process.exit(1)
})
