/**
 * Phase 56 (TPL-04, D-13): leaf module hosting the DecorativeAsset closed-enum
 * + DECORATIVE_ASSETS constant.
 *
 * Lives in a leaf module (mirrors Phase 55's premium-tier.ts pattern, D-21)
 * so that templates/validate.ts can import the runtime constant WITHOUT
 * triggering the import cycle:
 *   templates/index.ts → templates/validate.ts → templates/index.ts (TDZ).
 *
 * Re-exported from templates/index.ts for public API consumers.
 */
export type DecorativeAsset =
  | 'tape-strip-1' | 'tape-strip-2' | 'tape-strip-3'
  | 'sticky-note-yellow' | 'sticky-note-pink' | 'sticky-note-blue'
  | 'halftone-dots-light' | 'halftone-dots-dense'
  | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right'
  | 'polaroid-frame'
  | 'paper-torn-edge'

export const DECORATIVE_ASSETS: ReadonlyArray<DecorativeAsset> = [
  'tape-strip-1', 'tape-strip-2', 'tape-strip-3',
  'sticky-note-yellow', 'sticky-note-pink', 'sticky-note-blue',
  'halftone-dots-light', 'halftone-dots-dense',
  'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
  'polaroid-frame',
  'paper-torn-edge',
] as const
