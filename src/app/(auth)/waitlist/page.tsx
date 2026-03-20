'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { joinWaitlist } from './actions'

export default function WaitlistPage() {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await joinWaitlist(email)
    setResult(res)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#fff8f7] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <Image src="/logo.png" alt="ViralSlideMaker" width={32} height={32} className="rounded-lg" />
            <span className="text-2xl font-semibold tracking-tighter text-[#3d0000]">ViralSlideMaker</span>
          </Link>
          <h1 className="text-3xl font-bold text-[#3d0000] mb-2">Join the Waitlist</h1>
          <p className="text-[#7d6161]">
            We&apos;re launching soon. Be the first to create viral carousels with AI.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0px_40px_80px_rgba(61,0,0,0.08)] border border-[#dbc1bc]/20">
          {result?.success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-[#fadbdb] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3d0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[#3d0000] font-semibold text-lg mb-2">You&apos;re in!</p>
              <p className="text-[#7d6161] text-sm">{result.message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#3d0000] mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-[#fff0f0] border border-[#dbc1bc]/30 focus:border-[#3d0000] focus:ring-1 focus:ring-[#3d0000] transition-all text-[#3d0000] placeholder:text-[#dbc1bc]"
                />
              </div>

              {result && !result.success && (
                <p className="text-red-600 text-sm">{result.message}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#3d0000] text-white py-3 rounded-xl font-medium transition-all hover:bg-[#3d0000]/90 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join the Waitlist'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-[#7d6161] mt-6">
          Already have access?{' '}
          <Link href="/login" className="text-[#3d0000] font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
