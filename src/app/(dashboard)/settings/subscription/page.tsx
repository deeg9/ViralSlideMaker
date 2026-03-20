'use client'

import { Icon } from '@/components/ui/icon'

interface PricingTier {
  name: string
  price: string
  period: string
  features: string[]
  highlighted: boolean
  badge?: string
  cta: string
  ctaDisabled: boolean
  isCurrent: boolean
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    features: [
      '5 carousels/month',
      'Basic templates',
      'Standard quality exports',
    ],
    highlighted: false,
    cta: 'Current Plan',
    ctaDisabled: true,
    isCurrent: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/mo',
    features: [
      'Unlimited carousels',
      'All templates + Brand Kit',
      'HD exports',
      'Priority generation',
    ],
    highlighted: true,
    badge: 'Most Popular',
    cta: 'Current Plan',
    ctaDisabled: true,
    isCurrent: true,
  },
  {
    name: 'Business',
    price: '$29',
    period: '/mo',
    features: [
      'Everything in Pro',
      'Team collaboration (coming soon)',
      'Custom templates',
      'API access (coming soon)',
    ],
    highlighted: false,
    cta: 'Contact Sales',
    ctaDisabled: false,
    isCurrent: false,
  },
]

export default function SubscriptionPage() {
  // Hardcoded to "Pro" for v1
  const currentPlan = 'Pro'

  function handleManageSubscription() {
    window.alert('Stripe billing portal coming soon!')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Icon name="credit_card" size="lg" className="text-[#3d0000]" />
        <div>
          <h1 className="text-2xl font-bold text-[#3d0000]">Manage Subscription</h1>
          <p className="text-sm text-[#7d6161]">View your plan and manage billing</p>
        </div>
      </div>

      {/* Current plan badge */}
      <div className="mb-6">
        <span className="bg-[#fadbdb] text-[#3d0000] px-3 py-1 rounded-full text-sm font-bold">
          Current Plan: {currentPlan}
        </span>
      </div>

      {/* Pricing tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`bg-white rounded-xl p-6 border border-[#dbc1bc]/10 flex flex-col relative ${
              tier.highlighted ? 'ring-2 ring-[#3d0000]' : ''
            }`}
          >
            {tier.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#3d0000] text-white text-xs font-bold px-3 py-1 rounded-full">
                  {tier.badge}
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#3d0000]">{tier.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-[#3d0000]">{tier.price}</span>
                <span className="text-sm text-[#7d6161]">{tier.period}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Icon name="check_circle" size="sm" className="text-[#3d0000] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-[#7d6161]">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={tier.ctaDisabled}
              className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all ${
                tier.isCurrent
                  ? 'bg-[#fadbdb] text-[#3d0000] cursor-default'
                  : tier.ctaDisabled
                  ? 'bg-[#fff0f0] text-[#7d6161] cursor-not-allowed'
                  : 'bg-[#3d0000] text-white hover:bg-[#3d0000]/90 active:scale-95'
              }`}
            >
              {tier.isCurrent ? `Current Plan` : tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Manage Subscription button */}
      <div className="bg-white rounded-xl p-6 border border-[#dbc1bc]/10">
        <button
          type="button"
          onClick={handleManageSubscription}
          className="bg-[#3d0000] text-white px-6 py-3 rounded-xl font-medium text-sm transition-all hover:bg-[#3d0000]/90 active:scale-95 w-full md:w-auto"
        >
          Manage Subscription
        </button>
        <p className="text-xs text-[#7d6161] mt-2">
          Billing is managed through Stripe. You&apos;ll be redirected to a secure portal.
        </p>
      </div>
    </div>
  )
}
