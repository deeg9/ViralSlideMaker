import { NextResponse } from 'next/server'
import { getStripeServer } from '@/lib/stripe/client'
import { handleStripeEvent } from '@/lib/stripe/sync-subscription'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const stripe = getStripeServer()
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotency: check if event already processed
  const { data: existing } = await admin
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .single()

  if (existing) {
    return NextResponse.json({ received: true })
  }

  // Record event before processing
  await admin.from('stripe_events').insert({
    event_id: event.id,
    event_type: event.type,
  })

  try {
    await handleStripeEvent(event, admin)
  } catch (error) {
    console.error('Stripe webhook handler error:', error)
    // Return 200 to prevent Stripe retries on app bugs
  }

  return NextResponse.json({ received: true })
}
