// Phase 77 Plan 02 (EMIT-01..04): generateFromStyleSpec type contracts.
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
// ContentSource is the discriminated union the emit endpoint accepts:
//   - 'ai-copy': user supplies a topic; Gemini generates new copy in
//     the spec's voice (spec.voice_note REPLACES template.aiVoiceNote
//     per EMIT-05).
//   - 'user-copy': user supplies per-slide copy strings; Gemini
//     STRUCTURES them into Slide segments + assigns role + decoration
//     choices. Gemini MUST NOT change wording (defended in
//     buildFromSpecPrompt).
//
// Mode is the discriminator. The Gemini prompt switches on this field
// in buildFromSpecPrompt; the silent-drop pipeline at the emit boundary
// is identical for both modes.
// =====================================================================

import type { SlideTemplate } from '@/lib/render/templates'

export interface AiCopyContent {
  mode: 'ai-copy'
  /** The carousel topic — Gemini generates copy about this in the spec's voice. */
  topic: string
}

export interface UserCopyContent {
  mode: 'user-copy'
  /** Per-slide copy strings; one entry per slide. Gemini structures these
      into hook/body segments without changing wording. */
  lines: string[]
}

/**
 * Discriminated union — the two content paths the emit endpoint accepts.
 * Mode is the discriminator. Plan 04's regenerateAction validates shape
 * (ai-copy requires topic; user-copy requires non-empty lines[]) before
 * the orchestrator passes ContentSource into generateFromStyleSpec.
 */
export type ContentSource = AiCopyContent | UserCopyContent

/**
 * Optional knobs for generateFromStyleSpec. slideCount overrides the
 * spec.rhythm-suggested count (default 5). template defaults to
 * templates[0] when undefined — a future plan will pick "best match"
 * from the spec instead.
 */
export interface GenerateFromStyleSpecOptions {
  slideCount?: number
  template?: SlideTemplate
}

/**
 * Discriminated-union result of generateFromStyleSpec. Success carries
 * the resolved CarouselWithTextBoxes; error carries a typed code. The
 * orchestrator (generateCarouselFromReferences) maps these into
 * RegenerateActionResult.
 *
 * Note: generateFromStyleSpec itself THROWS typed errors on the unhappy
 * path (matching the existing generateSlideContent contract); the
 * orchestrator catches and maps. This type is exported for the orchestrator
 * + tests to share the error vocabulary.
 */
export type GenerateFromStyleSpecError =
  | 'carousel-shape-failed'
  | 'gemini-empty-response'
  | 'token-budget-exceeded'

export interface GenerateFromStyleSpecResult<T = unknown> {
  ok: boolean
  data?: T
  error?: GenerateFromStyleSpecError
  detail?: string
}
