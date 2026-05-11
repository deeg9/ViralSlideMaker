'use client'

// Phase 76 Plan 03 (PREVIEW-10/12 + recovery routing):
// ErrorRouter — switches by state.error.kind to render the right
// recovery surface. Each user-facing error kind gets a SPECIFIC surface
// (no generic "Something went wrong" — Pitfall 6/7 explicitly call out
// generic errors as a churn event).
//
// Routing table:
//   safety_blocked        → <SafetyBlockRecovery /> (PREVIEW-12 full panel)
//   cap_reached           → daily-cap panel + Upgrade link to /pricing
//   insufficient_credits  → out-of-credits panel + Get-credits link to /pricing
//   extraction_failed     → generic-extract-failed panel + Try again (CLEAR_ERROR)
//   no-retries-left       → fresh-upload prompt + Start over (UPLOAD_RESET [])
//   no-references         → inline hint (reducer-guard violation)
//   preview-required      → inline hint (reducer-guard violation)
//   no-aspects-selected   → null (PerAspectToggles owns this hint, Plan 76-02)
//
// Mounted at the shell's error slot — replaces the placeholder ErrorMount
// stub from Plan 76-01.
//
// LEGAL-03 forward-compat: zero forbidden mimicry-framing tokens.

import type { Dispatch } from 'react'
import Link from 'next/link'
import type { SpecPreviewState, SpecPreviewAction } from './state-machine'
import { SafetyBlockRecovery } from './safety-block-recovery'

export interface ErrorRouterProps {
  state: SpecPreviewState
  dispatch: Dispatch<SpecPreviewAction>
}

export function ErrorRouter({ state, dispatch }: ErrorRouterProps) {
  if (!state.error) return null

  switch (state.error.kind) {
    case 'safety_blocked':
      return (
        <SafetyBlockRecovery
          recoverySuggestion={state.error.recovery_suggestion}
          dispatch={dispatch}
        />
      )

    case 'cap_reached':
      return (
        <section
          data-testid="error-cap-reached"
          role="region"
          aria-label="Daily extraction limit reached"
          className="rounded-2xl border border-[#fadbdb] bg-[#fff0f0] p-6 space-y-3"
        >
          <h2 className="text-lg font-bold text-[#3d0000]">
            You&apos;ve reached today&apos;s extraction limit
          </h2>
          <p className="text-sm text-[#5a3a3a]">
            Free tier allows 5 reference extractions per day. Try again tomorrow,
            or upgrade for higher limits.
          </p>
          <Link
            href="/pricing"
            data-testid="upgrade-link"
            className="inline-block rounded-xl bg-[#3d0000] px-4 py-2 text-sm font-bold text-white hover:bg-[#5a0000]"
          >
            Upgrade
          </Link>
        </section>
      )

    case 'insufficient_credits':
      return (
        <section
          data-testid="error-insufficient-credits"
          role="region"
          aria-label="Out of credits"
          className="rounded-2xl border border-[#fadbdb] bg-[#fff0f0] p-6 space-y-3"
        >
          <h2 className="text-lg font-bold text-[#3d0000]">Out of credits</h2>
          <p className="text-sm text-[#5a3a3a]">
            Your wallet is empty. Top up to keep extracting style specs.
          </p>
          <Link
            href="/pricing"
            data-testid="get-credits-link"
            className="inline-block rounded-xl bg-[#3d0000] px-4 py-2 text-sm font-bold text-white hover:bg-[#5a0000]"
          >
            Get credits
          </Link>
        </section>
      )

    case 'extraction_failed':
      return (
        <section
          data-testid="error-extraction-failed"
          role="region"
          aria-label="Extraction failed"
          className="rounded-2xl border border-[#fadbdb] bg-[#fff0f0] p-6 space-y-3"
        >
          <h2 className="text-lg font-bold text-[#3d0000]">
            We couldn&apos;t extract a style from these references
          </h2>
          <p className="text-sm text-[#5a3a3a]">
            The extraction timed out or returned an unexpected response. Try
            again, or upload a different reference set.
          </p>
          {state.error.detail && (
            <p
              data-testid="error-extraction-detail"
              className="text-xs text-[#5a3a3a] font-mono break-all bg-white/60 p-2 rounded"
            >
              Detail: {state.error.detail}
            </p>
          )}
          <button
            type="button"
            data-testid="try-again-cta"
            onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
            className="rounded-xl bg-[#3d0000] px-4 py-2 text-sm font-bold text-white hover:bg-[#5a0000]"
          >
            Try again
          </button>
        </section>
      )

    case 'no-retries-left':
      return (
        <section
          data-testid="error-no-retries"
          role="region"
          aria-label="No free retries remaining"
          className="rounded-2xl border border-[#fadbdb] bg-[#fff0f0] p-6 space-y-3"
        >
          <h2 className="text-lg font-bold text-[#3d0000]">
            Free retries used
          </h2>
          <p className="text-sm text-[#5a3a3a]">
            Upload a new reference set to try again. Each fresh upload comes
            with 2 free re-extracts.
          </p>
          <button
            type="button"
            data-testid="reset-uploads-cta"
            onClick={() => dispatch({ type: 'UPLOAD_RESET', references: [] })}
            className="rounded-xl bg-[#3d0000] px-4 py-2 text-sm font-bold text-white hover:bg-[#5a0000]"
          >
            Start over
          </button>
        </section>
      )

    case 'preview-required':
    case 'no-references':
      return (
        <p
          data-testid="error-inline-hint"
          role="alert"
          className="text-xs text-[#a30000]"
        >
          {state.error.kind === 'no-references'
            ? 'Upload at least one reference image to extract a style.'
            : 'Review the spec preview before generating.'}
        </p>
      )

    case 'no-aspects-selected':
      // PerAspectToggles owns the no-aspects-selected hint (Plan 76-02
      // Test 6). Returning null here avoids a redundant hint surface.
      return null

    default: {
      // Exhaustiveness check: adding a new ErrorKind without a case here
      // fails this assignment at TS compile time.
      const _exhaustive: never = state.error.kind
      void _exhaustive
      return null
    }
  }
}
