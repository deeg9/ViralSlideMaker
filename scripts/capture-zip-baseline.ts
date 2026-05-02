/**
 * Phase 54 (D-20, METRIC-03): one-shot baseline-capture script.
 *
 * Reads carousel_events for the 30 days preceding the script run,
 * computes downloads/projects-created ratio via the
 * v_zip_download_rate view, and writes the result to
 * .planning/milestones/v2.9-METRIC-BASELINE.md.
 *
 * Run once at the end of Phase 54. Result file is committed to repo
 * as the immutable v2.9 baseline.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/capture-zip-baseline.ts
 */

import { createClient } from '@supabase/supabase-js'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(url, key)
  const { data, error } = await admin.from('v_zip_download_rate').select('*').single()
  if (error || !data) {
    console.error('Query failed:', error?.message ?? 'no rows')
    process.exit(1)
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const downloads = Number(data.downloads ?? 0)
  const projects = Number(data.projects_created ?? 0)
  const rate = Number(data.rate ?? 0)
  const ratePct = (rate * 100).toFixed(2)

  const md = `# v2.9 Metric Baseline — ZIP Download Rate

**Captured:** ${today}
**Window:** 30 days preceding script run (\`window_start: ${data.window_start}, window_end: ${data.window_end}\`)
**Source:** \`public.v_zip_download_rate\` view (Phase 54, D-19)

## Baseline

- Downloads (event_type='download_zip'): **${downloads}**
- Projects created in window: **${projects}**
- Rate (downloads / projects_created): **${ratePct}%** (raw: ${rate})

## Phase 58 Ship Gate

v2.9 success criterion: post-launch \`zip_download_rate\` MUST be greater than or equal to this baseline.

If \`projects_created = 0\` (cold-start), the gate evaluates against absolute downloads instead.

This file is committed to the repo as the immutable v2.9 baseline reference.

## Caveat — pre-tracking baseline

The \`download_zip\` event tracking only landed in this phase (Plan 54-02 Task 3).
The 30-day pre-Phase-54 window therefore shows ZERO downloads tracked — events
could not have been logged before the migration. \`projects_created\` is correct
(historical row). The baseline captures \`downloads = 0\` as the floor; any
post-launch download count will automatically be greater than or equal to that floor,
making the Phase 58 ship gate trivially passable on absolute terms.

The substantive comparison (rate movement) becomes meaningful once 14+ days of
post-launch tracking accumulate. Re-run this script at the end of Phase 58 to
capture the post-launch comparison snapshot.
`

  const outPath = '.planning/milestones/v2.9-METRIC-BASELINE.md'
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, md, 'utf8')
  console.log(`Wrote baseline: ${outPath}`)
  console.log(`  downloads=${downloads}, projects=${projects}, rate=${ratePct}%`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
