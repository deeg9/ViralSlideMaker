/**
 * Phase 73 (COST-05): daily Vercel cron — sums today's NET extraction cost
 * (charges - refunds) and emits a structured `console.warn('[bill-alarm]', ...)`
 * if today's cost exceeds STYLE_EXTRACTION_DAILY_COST_CEILING_USD (default $5).
 *
 * Vercel cron contract:
 *   - GET /api/cron/style-extraction-bill-alarm with `Authorization: Bearer <CRON_SECRET>`
 *   - 09:00 UTC daily per vercel.json (post-midnight in all major timezones)
 *
 * Counting policy: this cron sums NET cost (charges - refunds), since refunded
 * calls did not actually cost the wire. The rate-cap helper takes the OPPOSITE
 * stance (counts charges only) — these are intentionally different.
 *
 * Pre-PMF: structured warn is sufficient (Vercel monitoring captures it).
 * Future: add Slack/email delivery here — interface stays the same. Per CONTEXT.md
 * deferred decision, that's a one-line change at the warn site.
 *
 * Phase 75 telemetry feeds this cron — Phase 75 only needs to ensure its charge
 * rows are typed 'gemini_vision_extract_style' (the ledger helper guarantees that).
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DAILY_COST_CEILING_USD = parseFloat(
  process.env.STYLE_EXTRACTION_DAILY_COST_CEILING_USD ?? '5',
)
// Worst-case from STACK.md per-extraction estimate (3 reference images
// at 1024×1024 + ~600-token JSON output on gemini-3.1-flash-lite). Tune as
// launch telemetry refines real-world averages.
const PER_CALL_COST_USD = parseFloat(
  process.env.STYLE_EXTRACTION_PER_CALL_COST_USD ?? '0.003',
)

function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  // Fail-closed if env var is unset/empty — never accept a request when
  // there is no secret to verify against.
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

interface BillAlarmPayload {
  ok: true
  date: string
  netCalls: number
  chargesToday: number
  refundsToday: number
  todayCostUsd: number
  ceilingUsd: number
  breach: boolean
}

interface BillAlarmError {
  ok: false
  error: string
}

async function runBillAlarm(): Promise<BillAlarmPayload | BillAlarmError> {
  const admin = createAdminClient()
  const startOfDayUtc = new Date()
  startOfDayUtc.setUTCHours(0, 0, 0, 0)
  const since = startOfDayUtc.toISOString()

  const { count: chargesToday, error: chargeErr } = await admin
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'gemini_vision_extract_style')
    .gte('created_at', since)

  const { count: refundsToday, error: refundErr } = await admin
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'refund')
    .like('description', 'Refund: extract-style%')
    .gte('created_at', since)

  if (chargeErr || refundErr) {
    console.error('[bill-alarm] DB error; cannot compute today cost:', {
      chargeErr,
      refundErr,
    })
    return { ok: false, error: 'db_error' }
  }

  const netCalls = Math.max(0, (chargesToday ?? 0) - (refundsToday ?? 0))
  const todayCostUsd = netCalls * PER_CALL_COST_USD
  const breach = todayCostUsd > DAILY_COST_CEILING_USD

  const payload: BillAlarmPayload = {
    ok: true,
    date: since.slice(0, 10),
    netCalls,
    chargesToday: chargesToday ?? 0,
    refundsToday: refundsToday ?? 0,
    todayCostUsd: Number(todayCostUsd.toFixed(4)),
    ceilingUsd: DAILY_COST_CEILING_USD,
    breach,
  }

  if (breach) {
    console.warn('[bill-alarm] CEILING BREACHED', JSON.stringify(payload))
  } else {
    console.log('[bill-alarm] within ceiling', JSON.stringify(payload))
  }
  return payload
}

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await runBillAlarm()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function POST(req: Request) {
  // Manual invocation in dev; same auth gate.
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await runBillAlarm()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
