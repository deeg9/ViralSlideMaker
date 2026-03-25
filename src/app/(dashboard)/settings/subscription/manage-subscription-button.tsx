'use client'

import { createPortalSession } from './actions'

interface ManageSubscriptionButtonProps {
  hasStripeCustomer: boolean
}

export function ManageSubscriptionButton({ hasStripeCustomer }: ManageSubscriptionButtonProps) {
  if (!hasStripeCustomer) {
    return null
  }

  return (
    <form action={createPortalSession}>
      <button
        type="submit"
        className="bg-[#3d0000] text-white px-6 py-3 rounded-xl font-medium text-sm transition-all hover:bg-[#3d0000]/90 active:scale-95 w-full md:w-auto"
      >
        Manage Subscription
      </button>
    </form>
  )
}
