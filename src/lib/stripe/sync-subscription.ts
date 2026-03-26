import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripeServer } from './client'
import { tierFromPriceId, CREDIT_PACK_AMOUNTS } from './config'
import { TIER_CREDITS } from '@/lib/credits/types'

export async function handleStripeEvent(
  event: Stripe.Event,
  admin: SupabaseClient
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        admin
      )
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(
        event.data.object as Stripe.Subscription,
        admin
      )
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription,
        admin
      )
      break
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice, admin)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice, admin)
      break
  }
}

/** Extract subscription ID from an Invoice (Stripe v20+ uses parent.subscription_details) */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  if (
    invoice.parent?.type === 'subscription_details' &&
    invoice.parent.subscription_details?.subscription
  ) {
    const sub = invoice.parent.subscription_details.subscription
    return typeof sub === 'string' ? sub : sub.id
  }
  return null
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  admin: SupabaseClient
): Promise<void> {
  const userId = session.metadata?.supabase_user_id
  if (!userId) return

  if (session.mode === 'subscription') {
    const stripe = getStripeServer()
    const sub = await stripe.subscriptions.retrieve(
      session.subscription as string
    )
    const tier = tierFromPriceId(sub.items.data[0].price.id)
    if (!tier) return

    // Use start_date and billing cycle for period tracking
    const periodStart = new Date(sub.start_date * 1000).toISOString()
    const periodEnd = sub.cancel_at
      ? new Date(sub.cancel_at * 1000).toISOString()
      : null

    await admin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        tier,
        status: 'active',
        current_period_start: periodStart,
        current_period_end: periodEnd,
      }, { onConflict: 'user_id' })

    // Grant initial credits for new subscription (invoice.paid may race with this)
    const creditAmount = TIER_CREDITS[tier]
    if (creditAmount) {
      await admin.from('credit_transactions').insert({
        user_id: userId,
        type: 'subscription_grant',
        amount: creditAmount,
        description: `Welcome credits (${tier.charAt(0).toUpperCase() + tier.slice(1)} tier)`,
        reference_id: session.id,
      })
    }
  } else if (session.mode === 'payment') {
    const stripe = getStripeServer()
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
    const priceId = lineItems.data[0]?.price?.id
    if (!priceId) return

    const creditAmount = CREDIT_PACK_AMOUNTS[priceId]
    if (!creditAmount) return

    await admin.from('credit_transactions').insert({
      user_id: userId,
      type: 'credit_pack_purchase',
      amount: creditAmount,
      description: 'Credit pack purchase',
      reference_id: session.id,
    })
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  admin: SupabaseClient
): Promise<void> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!sub) return

  const tier = tierFromPriceId(subscription.items.data[0].price.id)
  if (!tier) return

  const periodStart = new Date(subscription.start_date * 1000).toISOString()
  const periodEnd = subscription.cancel_at
    ? new Date(subscription.cancel_at * 1000).toISOString()
    : null

  await admin
    .from('subscriptions')
    .update({
      tier,
      status: subscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('user_id', sub.user_id)
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  admin: SupabaseClient
): Promise<void> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!sub) return

  await admin
    .from('subscriptions')
    .update({
      tier: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
    })
    .eq('user_id', sub.user_id)
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  admin: SupabaseClient
): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice)
  if (!subscriptionId) return

  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id, tier')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (!sub) return

  const tierKey = sub.tier as keyof typeof TIER_CREDITS
  const creditAmount = TIER_CREDITS[tierKey]
  if (!creditAmount) return

  // Skip if credits were already granted for this billing cycle (e.g. by checkout handler)
  const { count } = await admin
    .from('credit_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', sub.user_id)
    .eq('type', 'subscription_grant')
    .eq('reference_id', invoice.id)

  if (count && count > 0) return

  await admin.from('credit_transactions').insert({
    user_id: sub.user_id,
    type: 'subscription_grant',
    amount: creditAmount,
    description: `Monthly credit grant (${sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1)} tier)`,
    reference_id: invoice.id,
  })
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  admin: SupabaseClient
): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice)
  if (!subscriptionId) return

  await admin
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId)
}
