/**
 * quick-260515-io9: single source-of-truth Gemini TEXT-model ID.
 *
 * Upgraded from `gemini-2.5-flash` (sunsets 2026-10-16) to
 * `gemini-3.1-flash-lite` — the GA Flash-tier model, ~37% cheaper than
 * 2.5 Flash, with vision + structured-output support.
 *
 * Env-backed: set GEMINI_TEXT_MODEL to override (e.g. roll back to
 * 'gemini-2.5-flash') with ZERO redeploy. The fallback is the chosen target.
 *
 * NOTE: This is the TEXT/VISION model only. The image-generation model
 * 'gemini-2.5-flash-image-preview' (src/lib/imagen/stylize-image.ts) is a
 * SEPARATE model on its own deprecation track — do NOT route it through here.
 */
export const GEMINI_TEXT_MODEL: string =
  process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.1-flash-lite'
