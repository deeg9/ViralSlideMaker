'use client'

import { Icon } from '@/components/ui/icon'
import { Pricing } from '@/components/ui/pricing'

const plans = [
  {
    name: 'Free',
    price: '0',
    yearlyPrice: '0',
    period: 'mo',
    features: [
      '5 carousels/month',
      'Basic templates',
      'Stock images',
      'Standard quality exports',
    ],
    description: 'Perfect for trying out ViralSlideMaker.',
    buttonText: 'Current Plan',
    href: '#',
    isPopular: false,
  },
  {
    name: 'Plus',
    price: '19.99',
    yearlyPrice: '15.99',
    period: 'mo',
    features: [
      '12 carousels/month',
      'All templates + Brand Kit',
      'Stock images + AI-generated images',
      'HD exports',
      'Priority generation',
    ],
    description: 'Best for creators who post regularly.',
    buttonText: 'Upgrade',
    href: '#',
    isPopular: true,
  },
  {
    name: 'Pro',
    price: '49.99',
    yearlyPrice: '39.99',
    period: 'mo',
    features: [
      '30 carousels/month',
      'Everything in Plus',
      'Stock images + AI-generated images',
      'Custom templates',
    ],
    description: 'For power creators and agencies.',
    buttonText: 'Upgrade',
    href: '#',
    isPopular: false,
  },
]

export default function SubscriptionPage() {
  function handleManageSubscription() {
    window.alert('Stripe billing portal coming soon!')
  }

  return (
    <div className="mx-auto max-w-4xl">
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
          Current Plan: Pro
        </span>
      </div>

      {/* Pricing tiers */}
      <Pricing
        plans={plans}
        title="Choose Your Plan"
        description="All plans include access to our AI carousel generator."
      />

      {/* Manage Subscription button */}
      <div className="bg-white rounded-xl p-6 border border-[#dbc1bc]/10 mt-8">
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
