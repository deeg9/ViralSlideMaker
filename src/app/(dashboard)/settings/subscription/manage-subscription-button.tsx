'use client'

export function ManageSubscriptionButton() {
  function handleManageSubscription() {
    window.alert('Stripe billing portal coming soon!')
  }

  return (
    <button
      type="button"
      onClick={handleManageSubscription}
      className="bg-[#3d0000] text-white px-6 py-3 rounded-xl font-medium text-sm transition-all hover:bg-[#3d0000]/90 active:scale-95 w-full md:w-auto"
    >
      Manage Subscription
    </button>
  )
}
