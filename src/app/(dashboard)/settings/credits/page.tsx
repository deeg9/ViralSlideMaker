import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/ui/icon'
import { getCreditBalance, getUserTier } from '@/lib/credits/check-credits'
import { TIER_CREDITS } from '@/lib/credits/types'
import type { CreditTransaction } from '@/lib/credits/types'

const TYPE_LABELS: Record<string, string> = {
  subscription_grant: 'Monthly Grant',
  carousel_generation: 'Carousel Generation',
  imagen_generation: 'AI Image Generation',
  credit_pack_purchase: 'Credit Pack',
  refund: 'Refund',
  admin_adjustment: 'Adjustment',
}

export default async function CreditsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const balance = await getCreditBalance(user.id)
  const tier = await getUserTier(user.id)
  const monthlyAllowance = TIER_CREDITS[tier]

  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const txns = (transactions as CreditTransaction[]) ?? []

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Icon name="bolt" size="lg" className="text-[#3d0000]" />
        <div>
          <h1 className="text-2xl font-bold text-[#3d0000]">Credit Usage</h1>
          <p className="text-sm text-[#7d6161]">Track your credit balance and history</p>
        </div>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#fadbdb] p-6 rounded-xl">
          <p className="text-[0.75rem] font-bold uppercase tracking-widest text-[#3d0000]">Current Balance</p>
          <p className="text-3xl font-semibold text-[#3d0000] mt-1">{balance}</p>
        </div>
        <div className="bg-[#fff0f0] p-6 rounded-xl">
          <p className="text-[0.75rem] font-bold uppercase tracking-widest text-[#7d6161]">Monthly Allowance</p>
          <p className="text-3xl font-semibold text-[#3d0000] mt-1">{monthlyAllowance}</p>
        </div>
        <div className="bg-[#fff0f0] p-6 rounded-xl">
          <p className="text-[0.75rem] font-bold uppercase tracking-widest text-[#7d6161]">Current Plan</p>
          <p className="text-3xl font-semibold text-[#3d0000] mt-1 capitalize">{tier}</p>
        </div>
      </div>

      {/* Transaction history table */}
      <div className="bg-white rounded-xl border border-[#dbc1bc]/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#dbc1bc]/10">
          <h2 className="text-lg font-semibold text-[#3d0000]">Transaction History</h2>
        </div>
        {txns.length === 0 ? (
          <div className="px-6 py-12 text-center text-[#7d6161]">
            <p>No credit transactions yet.</p>
          </div>
        ) : (
          // bug-260531: a 4-column table doesn't fit 393px and the parent's
          // overflow-hidden clips it; scroll horizontally on mobile (min-w keeps
          // the columns readable).
          <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem]">
            <thead>
              <tr className="text-left text-[0.75rem] font-bold uppercase tracking-widest text-[#7d6161]">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((txn) => (
                <tr key={txn.id} className="border-t border-[#dbc1bc]/10">
                  <td className="px-6 py-4 text-sm text-[#7d6161]">
                    {new Date(txn.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#3d0000]">
                    {TYPE_LABELS[txn.type] ?? txn.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#7d6161]">
                    {txn.description ?? '-'}
                  </td>
                  <td className={`px-6 py-4 text-sm text-right font-semibold ${txn.amount > 0 ? 'text-green-700' : 'text-[#3d0000]'}`}>
                    {txn.amount > 0 ? '+' : ''}{txn.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
