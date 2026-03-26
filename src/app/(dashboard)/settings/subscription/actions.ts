'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeServer } from '@/lib/stripe/client'
import { STRIPE_PRICES } from '@/lib/stripe/config'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user
}

async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const admin = createAdminClient()
  const stripe = getStripeServer()

  await ensureSubscription(userId)

  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (sub?.stripe_customer_id) {
    return sub.stripe_customer_id
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  })

  // Upsert subscriptions row with new customer ID (belt-and-suspenders with ensureSubscription)
  await admin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: customer.id,
      tier: 'free',
      status: 'active',
    }, { onConflict: 'user_id' })

  return customer.id
}

export async function createCheckoutSession(priceId: string) {
  const user = await getAuthenticatedUser()
  const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? '')
  const stripe = getStripeServer()
  const admin = createAdminClient()

  // Check for existing active subscription — upgrade instead of creating a second one
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (sub?.stripe_subscription_id) {
    // Retrieve existing subscription and swap the price (prorated)
    const existing = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    const itemId = existing.items.data[0]?.id
    if (itemId) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'create_prorations',
        metadata: { supabase_user_id: user.id },
      })
      redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?success=true`)
    }
  }

  // No existing subscription — create new checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?canceled=true`,
    metadata: { supabase_user_id: user.id },
  })

  redirect(session.url!)
}

export async function createPortalSession() {
  const user = await getAuthenticatedUser()
  const admin = createAdminClient()
  const stripe = getStripeServer()

  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sub?.stripe_customer_id) {
    throw new Error('No active subscription found')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
  })

  redirect(session.url)
}

export async function createCreditPackCheckout() {
  const user = await getAuthenticatedUser()
  const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? '')
  const stripe = getStripeServer()

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{ price: STRIPE_PRICES.credit_pack_10, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?credits=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
    metadata: { supabase_user_id: user.id },
  })

  redirect(session.url!)
}
