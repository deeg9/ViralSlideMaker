import { Icon } from '@/components/ui/icon'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserTier, getCreditBalance } from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { STRIPE_PRICES } from '@/lib/stripe/config'
import { createCheckoutSession, createCreditPackCheckout, createPortalSession, syncSubscriptionAction } from './actions'
import { Check, Star } from 'lucide-react'
import type { SubscriptionTier } from '@/lib/credits/types'

const plans = [
  {
    name: 'Free',
    tier: 'free' as SubscriptionTier,
    price: '$0',
    period: '/mo',
    features: [
      '3 credits/month',
      'Up to 3 slides per carousel',
      'Basic templates',
      'Stock images',
      'ViralSlideMaker.com watermark on exports',
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
      'No watermark — clean exports',
      'All templates',
      'Stock images + AI-generated images',
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
      'No watermark — clean exports',
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
  searchParams: Promise<{ success?: string; canceled?: string; credits?: string; error?: string; synced?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  await ensureSubscription(user.id)

  const tier = await getUserTier(user.id)
  const balance = await getCreditBalance(user.id)

  // Look up subscription details for manage button + cancellation banner
  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, cancel_at_period_end, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle()
  const hasStripeCustomer = !!sub?.stripe_customer_id
  const isCanceling = sub?.cancel_at_period_end === true
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null

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
      {params.synced && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Synced — your plan is now <span className="font-semibold capitalize">{params.synced}</span>.
          {params.credits === 'true' && ' Credits granted.'}
        </div>
      )}
      {params.error === 'upgrade_required' && (
        <div className="mb-6 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700">
          Upgrade to Plus or Pro to buy extra credits.
        </div>
      )}

      {/* Cancellation banner */}
      {isCanceling && tier !== 'free' && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <Icon name="info" size="sm" className="text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Your {tier.charAt(0).toUpperCase() + tier.slice(1)} plan has been canceled
              </p>
              <p className="text-sm text-amber-700 mt-1">
                You still have access to all {tier.charAt(0).toUpperCase() + tier.slice(1)} features
                {periodEnd ? (
                  <> until <span className="font-semibold">{periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></>
                ) : null}.
                After that, your plan will revert to Free. You won&apos;t be charged again.
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Changed your mind? Click &quot;Manage Subscription&quot; below to reactivate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current plan badge */}
      <div className="mb-6">
        <span className="bg-[#fadbdb] text-[#3d0000] px-3 py-1 rounded-full text-sm font-bold">
          Current Plan: {tier.charAt(0).toUpperCase() + tier.slice(1)}{isCanceling ? ' (Canceling)' : ''}
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
                hasStripeCustomer ? (
                  <form action={createPortalSession}>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-xl text-sm font-semibold tracking-tight py-3 px-6 w-full bg-[#3d0000] text-white hover:bg-[#3d0000]/90 transition-all active:scale-95"
                    >
                      Manage Subscription
                    </button>
                  </form>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-xl text-sm font-semibold tracking-tight py-3 px-6 w-full bg-[#fadbdb] text-[#3d0000] cursor-default">
                    Current Plan
                  </span>
                )
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
                  {plan.name} Plan
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
            {tier === 'free' && (
              <p className="text-xs font-semibold text-[#3d0000] mt-2">Available on Plus and Pro plans</p>
            )}
            <p className="text-xs text-[#7d6161]/70 mt-2">1 credit = carousel generation &middot; 1 credit per AI image &middot; Text &amp; stock image regen = free</p>
          </div>
          {tier === 'free' ? (
            <span className="inline-flex items-center justify-center bg-[#fadbdb] text-[#3d0000] px-6 py-3 rounded-xl font-medium text-sm whitespace-nowrap cursor-default">
              Upgrade to buy credits
            </span>
          ) : (
            <form action={createCreditPackCheckout}>
              <button
                type="submit"
                className="bg-[#3d0000] text-white px-6 py-3 rounded-xl font-medium text-sm transition-all hover:bg-[#3d0000]/90 active:scale-95 whitespace-nowrap"
              >
                Buy Credits
              </button>
            </form>
          )}
        </div>
      </div>

      {/* How Credits Work */}
      <div className="bg-[#fff8f7] rounded-xl p-6 border border-[#dbc1bc]/10 mb-8">
        <h3 className="text-lg font-semibold text-[#3d0000] mb-4">How Credits Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <Icon name="bolt" size="sm" className="text-[#3d0000] mt-0.5" />
            <div>
              <p className="font-semibold text-[#3d0000]">1 credit = 1 carousel</p>
              <p className="text-[#7d6161]">Generate a full carousel with any number of slides using stock photos.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="auto_awesome" size="sm" className="text-[#3d0000] mt-0.5" />
            <div>
              <p className="font-semibold text-[#3d0000]">1 credit = 1 AI image</p>
              <p className="text-[#7d6161]">AI-generated background images cost 1 credit each, on top of the carousel charge.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="refresh" size="sm" className="text-[#3d0000] mt-0.5" />
            <div>
              <p className="font-semibold text-[#3d0000]">Free: text &amp; stock image regen</p>
              <p className="text-[#7d6161]">Rewriting text and swapping stock photos costs nothing.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="calendar_month" size="sm" className="text-[#3d0000] mt-0.5" />
            <div>
              <p className="font-semibold text-[#3d0000]">Credits refresh monthly</p>
              <p className="text-[#7d6161]">Your plan credits reset at the start of each billing cycle.</p>
            </div>
          </div>
        </div>
      </div>

      {hasStripeCustomer && (
        <div className="bg-white rounded-xl p-6 border border-[#dbc1bc]/10">
          <form action={syncSubscriptionAction}>
            <button
              type="submit"
              className="text-sm font-semibold text-[#3d0000] underline underline-offset-2 hover:text-[#3d0000]/80"
            >
              Sync from Stripe
            </button>
          </form>
          <p className="text-xs text-[#7d6161] mt-1">
            Already paid but plan still says Free? Click to refresh from Stripe.
          </p>
        </div>
      )}
    </div>
  )
}
