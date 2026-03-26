import { Icon } from '@/components/ui/icon'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserTier, getCreditBalance } from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { STRIPE_PRICES } from '@/lib/stripe/config'
import { createCheckoutSession, createCreditPackCheckout } from './actions'
import { ManageSubscriptionButton } from './manage-subscription-button'
import { Check, Star } from 'lucide-react'
import type { SubscriptionTier } from '@/lib/credits/types'

const plans = [
  {
    name: 'Free',
    tier: 'free' as SubscriptionTier,
    price: '$0',
    period: '/mo',
    features: [
      '10 credits/month',
      'Basic templates',
      'Stock images',
      'Standard quality exports',
    ],
    description: 'Perfect for trying out ViralSlideMaker.',
    priceId: null as string | null,
    isPopular: false,
  },
  {
    name: 'Plus',
    tier: 'plus' as SubscriptionTier,
    price: '$19.99',
    period: '/mo',
    features: [
      '50 credits/month',
      'All templates',
      'Stock images + AI-generated images',
      'Image exports',
      'Priority generation',
    ],
    description: 'Best for creators who post regularly.',
    priceId: STRIPE_PRICES.plus_monthly,
    isPopular: true,
  },
  {
    name: 'Pro',
    tier: 'pro' as SubscriptionTier,
    price: '$49.99',
    period: '/mo',
    features: [
      '200 credits/month',
      'Everything in Plus',
    ],
    description: 'For power creators and agencies.',
    priceId: STRIPE_PRICES.pro_monthly,
    isPopular: false,
  },
]

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; credits?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  await ensureSubscription(user.id)

  const tier = await getUserTier(user.id)
  const balance = await getCreditBalance(user.id)

  // Look up stripe_customer_id for manage subscription button
  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  const hasStripeCustomer = !!sub?.stripe_customer_id

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Icon name="credit_card" size="lg" className="text-[#3d0000]" />
        <div>
          <h1 className="text-2xl font-bold text-[#3d0000]">Manage Subscription</h1>
          <p className="text-sm text-[#7d6161]">View your plan and manage billing</p>
        </div>
      </div>

      {/* Success/Cancel Banners */}
      {params.success === 'true' && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Subscription activated! Your credits will appear shortly.
        </div>
      )}
      {params.canceled === 'true' && (
        <div className="mb-6 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700">
          Checkout was canceled.
        </div>
      )}
      {params.credits === 'true' && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Credits purchased! Your balance will update shortly.
        </div>
      )}

      {/* Current plan badge */}
      <div className="mb-6">
        <span className="bg-[#fadbdb] text-[#3d0000] px-3 py-1 rounded-full text-sm font-bold">
          Current Plan: {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </span>
      </div>

      {/* Plan Cards */}
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-3xl font-bold tracking-tight text-[#3d0000]">Choose Your Plan</h2>
        <p className="text-[#55423f] text-base">All plans include access to our AI carousel generator.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {plans.map((plan) => {
          const isCurrent = plan.tier === tier
          const tierOrder: Record<SubscriptionTier, number> = { free: 0, plus: 1, pro: 2 }
          const canUpgrade = !isCurrent && plan.tier !== 'free' && tierOrder[plan.tier] > tierOrder[tier]

          return (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 bg-white text-center flex flex-col relative ${
                plan.isPopular ? 'border-[#3d0000] border-2' : 'border-[#dbc1bc]/40'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 bg-[#3d0000] py-0.5 px-2 rounded-bl-xl rounded-tr-xl flex items-center">
                  <Star className="text-white h-4 w-4 fill-current" />
                  <span className="text-white ml-1 font-semibold text-sm">Popular</span>
                </div>
              )}

              <p className="text-base font-semibold text-[#7d6161]">{plan.name}</p>
              <div className="mt-6 flex items-center justify-center gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-[#3d0000]">{plan.price}</span>
                <span className="text-sm font-semibold leading-6 tracking-wide text-[#7d6161]">{plan.period}</span>
              </div>
              <p className="text-xs leading-5 text-[#7d6161]">billed monthly</p>

              <ul className="mt-5 gap-2 flex flex-col flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#3d0000] mt-1 flex-shrink-0" />
                    <span className="text-left text-[#55423f]">{feature}</span>
                  </li>
                ))}
              </ul>

              <hr className="w-full my-4 border-[#dbc1bc]/30" />

              {isCurrent ? (
                <span className="inline-flex items-center justify-center rounded-xl text-sm font-semibold tracking-tight py-3 px-6 w-full bg-[#fadbdb] text-[#3d0000] cursor-default">
                  Current Plan
                </span>
              ) : canUpgrade && plan.priceId ? (
                <form action={async () => {
                  'use server'
                  await createCheckoutSession(plan.priceId!)
                }}>
                  <button
                    type="submit"
                    className={`inline-flex items-center justify-center rounded-xl text-sm font-semibold tracking-tight py-3 px-6 w-full transition-all duration-300 ring-offset-current hover:ring-2 hover:ring-[#3d0000] hover:ring-offset-1 ${
                      plan.isPopular
                        ? 'bg-[#3d0000] text-white hover:bg-[#3d0000]/90'
                        : 'bg-white text-[#3d0000] border border-[#dbc1bc]/40 hover:bg-[#fff0f0]'
                    }`}
                  >
                    Upgrade to {plan.name}
                  </button>
                </form>
              ) : (
                <span className="inline-flex items-center justify-center rounded-xl text-sm font-semibold tracking-tight py-3 px-6 w-full text-[#7d6161] cursor-default">
                  {plan.tier === 'free' ? 'Free Plan' : 'Manage via Portal'}
                </span>
              )}

              <p className="mt-6 text-xs leading-5 text-[#7d6161]">{plan.description}</p>
            </div>
          )
        })}
      </div>

      {/* Buy Credits Section */}
      <div className="bg-white rounded-xl p-6 border border-[#dbc1bc]/10 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[#3d0000]">Need more credits?</h3>
            <p className="text-sm text-[#7d6161] mt-1">Get 10 extra credits for $4.99</p>
            <p className="text-xs text-[#7d6161] mt-1">Current balance: <span className="font-semibold text-[#3d0000]">{balance} credits</span></p>
          </div>
          <form action={createCreditPackCheckout}>
            <button
              type="submit"
              className="bg-[#3d0000] text-white px-6 py-3 rounded-xl font-medium text-sm transition-all hover:bg-[#3d0000]/90 active:scale-95 whitespace-nowrap"
            >
              Buy Credits
            </button>
          </form>
        </div>
      </div>

      {/* Manage Subscription button */}
      <div className="bg-white rounded-xl p-6 border border-[#dbc1bc]/10">
        <ManageSubscriptionButton hasStripeCustomer={hasStripeCustomer} />
        <p className="text-xs text-[#7d6161] mt-2">
          Billing is managed through Stripe. You&apos;ll be redirected to a secure portal.
        </p>
      </div>
    </div>
  )
}
