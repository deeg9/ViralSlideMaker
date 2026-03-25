import { Icon } from '@/components/ui/icon'
import { Pricing } from '@/components/ui/pricing'
import { getUserTier } from '@/lib/credits/check-credits'
import { createClient } from '@/lib/supabase/server'
import { ManageSubscriptionButton } from './manage-subscription-button'

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

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tier = user ? await getUserTier(user.id) : 'free'
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1)

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
          Current Plan: {tierLabel}
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
        <ManageSubscriptionButton />
        <p className="text-xs text-[#7d6161] mt-2">
          Billing is managed through Stripe. You&apos;ll be redirected to a secure portal.
        </p>
      </div>
    </div>
  )
}
