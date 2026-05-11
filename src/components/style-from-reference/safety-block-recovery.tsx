'use client'

// Phase 76 Plan 03 (PREVIEW-12):
// SafetyBlockRecovery — full-panel surface that REPLACES the spec-preview
// panel when extract returns safety_blocked. Critical for the
// fitness/lifestyle/fashion churn pitfall (Pitfall 7): a generic
// "Something went wrong" banner here is a churn event; specific
// guidance + a path to retry is the defense.
//
// Three affordances per CONTEXT.md PREVIEW-12 spec:
//   1. Recovery suggestion text from Phase 75 (verbatim — Phase 75 sets
//      specific suggestions like "Try cropping high-skin areas").
//   2. "Try a different image" CTA — dispatches UPLOAD_RESET with an
//      empty references array; reducer translates that to "fresh upload
//      set" which resets retriesRemaining to 2 (Plan 76-01 contract).
//   3. "Describe the style in text" alternative — DISABLED stub for v2.13
//      (Phase 77 emit's user-copy mode wires this). We render the
//      affordance now as a disabled button + sr-only tooltip so the path
//      is visible to users (NOT removed — no scope reduction).
//
// LEGAL-03 forward-compat: zero forbidden mimicry-framing tokens.

import type { Dispatch } from 'react'
import type { SpecPreviewAction } from './state-machine'

const TOOLTIP_ID = 'describe-in-text-tooltip'

export interface SafetyBlockRecoveryProps {
  recoverySuggestion: string | undefined
  dispatch: Dispatch<SpecPreviewAction>
}

export function SafetyBlockRecovery({
  recoverySuggestion,
  dispatch,
}: SafetyBlockRecoveryProps) {
  return (
    <section
      data-testid="safety-block-recovery"
      role="region"
      aria-label="Recovery options for blocked reference"
      className="rounded-2xl border-2 border-[#f0c674] bg-[#fffdf5] p-6 space-y-4"
    >
      <header className="flex items-start gap-3">
        {/* Inline shield icon — visual hint that this is a different surface
            from the spec-preview panel. Pure SVG, no extra dep. */}
        <svg
          aria-hidden="true"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#a87100] flex-shrink-0 mt-0.5"
          data-testid="safety-block-icon"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#3d0000]">
            We couldn&apos;t analyze that reference
          </h2>
          <p className="text-sm text-[#5a3a3a]">
            Google&apos;s safety filters blocked the image. This sometimes
            happens with fitness, lifestyle, or fashion images even when the
            content is benign.
          </p>
        </div>
      </header>

      {recoverySuggestion ? (
        <div
          data-testid="recovery-suggestion-text"
          className="text-sm bg-white border border-[#e2cfcf] rounded-lg p-3"
        >
          <strong className="text-[#3d0000]">Suggestion: </strong>
          <span className="text-[#5a3a3a]">{recoverySuggestion}</span>
        </div>
      ) : null}

      <ul className="text-sm text-[#5a3a3a] list-disc pl-5 space-y-1">
        <li>Try cropping out areas with high skin exposure.</li>
        <li>Try a different reference image.</li>
        <li>Describe the style in your own words instead.</li>
      </ul>

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          data-testid="try-different-image-cta"
          onClick={() => dispatch({ type: 'UPLOAD_RESET', references: [] })}
          className="rounded-xl bg-[#3d0000] px-4 py-2 text-sm font-bold text-white hover:bg-[#5a0000]"
        >
          Try a different image
        </button>
        <button
          type="button"
          data-testid="describe-in-text-cta"
          disabled
          aria-describedby={TOOLTIP_ID}
          title="Coming in the next update"
          className="rounded-xl border border-[#3d0000] px-4 py-2 text-sm font-bold text-[#3d0000] opacity-60 cursor-not-allowed"
        >
          Describe the style in text
        </button>
        <span id={TOOLTIP_ID} role="tooltip" className="sr-only">
          Coming in the next update — the user-copy emit path lands soon.
        </span>
      </div>
    </section>
  )
}
