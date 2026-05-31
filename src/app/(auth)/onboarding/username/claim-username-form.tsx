'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AvailabilityResult,
  checkUsernameAvailable,
  claimUsername,
} from './actions'
import { normalizeUsername } from '@/lib/profile/username-validation'

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'invalid'; message: string }
  | { kind: 'reserved'; message: string }
  | { kind: 'taken'; message: string }

export function ClaimUsernameForm({
  initialSuggestion,
  next,
  mode = 'claim',
  currentUsername = null,
}: {
  initialSuggestion: string
  next: string
  mode?: 'claim' | 'change'
  currentUsername?: string | null
}) {
  const router = useRouter()
  const [username, setUsername] = useState(initialSuggestion)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, startSubmit] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const value = normalizeUsername(username)
    if (!value) {
      setStatus({ kind: 'idle' })
      return
    }
    setStatus({ kind: 'checking' })
    debounceRef.current = setTimeout(async () => {
      const result: AvailabilityResult = await checkUsernameAvailable(value)
      if (result.available) {
        setStatus({ kind: 'available' })
      } else if (result.reason === 'reserved') {
        setStatus({ kind: 'reserved', message: result.message ?? 'Reserved' })
      } else if (result.reason === 'taken') {
        setStatus({ kind: 'taken', message: result.message ?? 'Taken' })
      } else {
        setStatus({ kind: 'invalid', message: result.message ?? 'Invalid' })
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [username])

  const normalizedNow = normalizeUsername(username)
  const isSameAsCurrent =
    mode === 'change' && currentUsername !== null && normalizedNow === currentUsername
  const canSubmit = status.kind === 'available' && !isSubmitting && !isSameAsCurrent

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    startSubmit(async () => {
      const result = await claimUsername(username)
      if (result.success) {
        router.push(next)
        router.refresh()
      } else {
        setSubmitError(result.error)
      }
    })
  }

  const normalized = normalizeUsername(username)

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-semibold text-[#3d0000] mb-1.5"
        >
          Username
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#7d6161]">
            @
          </span>
          <input
            id="username"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-[#dbc1bc]/60 bg-white pl-7 pr-10 py-3 text-base md:text-sm text-[#3d0000] placeholder:text-[#7d6161]/60 focus:border-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#3d0000]/20"
            placeholder="username"
            maxLength={24}
          />
          <StatusIndicator status={status} />
        </div>
        <StatusMessage status={status} />
      </div>

      {normalized.length >= 3 && (
        <p className="text-xs text-[#7d6161]">
          Your profile URL: <span className="font-semibold text-[#3d0000]">viralslidemaker.com/{normalized}</span>
        </p>
      )}

      {submitError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {isSameAsCurrent && (
        <p className="text-xs text-[#7d6161]">Pick a different handle to change your username.</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full inline-flex items-center justify-center bg-[#3d0000] text-white px-6 py-3 rounded-xl font-medium text-sm transition-all hover:bg-[#3d0000]/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {isSubmitting
          ? mode === 'change' ? 'Saving…' : 'Claiming…'
          : mode === 'change' ? 'Save username' : 'Claim username'}
      </button>

      <p className="text-xs text-[#7d6161]/70 text-center">
        3-24 characters. Letters, numbers, dots and underscores. No spaces.
      </p>
    </form>
  )
}

function StatusIndicator({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  const base =
    'absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full'
  if (status.kind === 'checking') {
    return <span className={`${base} bg-[#7d6161]/40 animate-pulse`} />
  }
  if (status.kind === 'available') {
    return <span className={`${base} bg-green-500`} />
  }
  return <span className={`${base} bg-red-500`} />
}

function StatusMessage({ status }: { status: Status }) {
  if (status.kind === 'available') {
    return <p className="text-xs text-green-600 mt-1.5">Available</p>
  }
  if (status.kind === 'invalid' || status.kind === 'reserved' || status.kind === 'taken') {
    return <p className="text-xs text-red-600 mt-1.5">{status.message}</p>
  }
  return null
}
