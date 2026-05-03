// Phase 65 Plan 03 (PARITY-04): per-template structural-fingerprint fixtures.
//
// The `fingerprintFixtureSlide` is a minimal-but-content-rich slide reused
// across every registered template. Tests override `template_id_override` to
// point at the template under test; the renderer reads geometry / hook /
// body / custom_image / custom_text / watermark fields from this fixture.
//
// `normalizeFingerprint` strips dynamic noise (React SSR ids, ephemeral
// classes, whitespace, helmet markers) so the fingerprint is stable across
// repeat runs and across React 19 renderer versions.
//
// `computeStructuralFingerprint` returns the normalized HTML directly. Vitest
// snapshots (`.snap` files) handle the resulting strings cleanly — no need
// for a SHA hash. Snapshot files committed alongside the tests ARE the
// v2.11-trailing-edge baseline; future milestones diff against them.

import type { Slide } from '@/lib/types/slide'

/**
 * Single fixture slide reused across every template. Contains:
 *   - 1 hook text-box (top anchor)
 *   - 1 body text-box (bottom anchor)
 *   - 1 custom_image (mid-canvas, deterministic geometry)
 *   - 1 watermark (bottom-right, enabled — exercises the resolver)
 *   - background_url + pexels_photo_id
 *
 * Geometry chosen to land inside every template's safe zone so no template
 * "no-ops" with empty output (which would defeat the purpose of fingerprinting).
 */
export const fingerprintFixtureSlide: Slide = {
  hook_text: 'Fingerprint hook',
  body_text: 'Fingerprint body text for parity baseline',
  image_query: 'parity-fixture',
  is_cta: false,
  background_url: 'https://example.com/fingerprint-bg.jpg',
  pexels_photo_id: 9999,
  custom_images: [
    {
      id: 'ci-fp-1',
      url: 'https://example.com/fingerprint-img.jpg',
      x: 10,
      y: 50,
      width: 30,
      height: 20,
      opacity: 100,
    },
  ],
  text_boxes: [
    {
      id: 'tb-fp-hook',
      role: 'hook',
      text: 'Fingerprint hook',
      position: { anchor: 'top' },
    },
    {
      id: 'tb-fp-body',
      role: 'body',
      text: 'Fingerprint body text for parity baseline',
      position: { anchor: 'bottom' },
    },
  ],
  watermark: {
    id: 'w_0',
    enabled: true,
    customText: 'FP',
    position: 'bottom-right',
  },
}

/**
 * Strip dynamic noise from rendered HTML so the fingerprint is stable across
 * repeat runs. Targets:
 *   - React SSR scoped ids: `_:r0:_`, `_:R1abcd:_` — replaced with literal `_:rN:_`
 *   - React useId() outputs: `:r0:`, `:R5:` — replaced with `:rN:`
 *   - Whitespace runs collapsed to single space (no newlines, no tabs)
 *   - react-helmet markers (data-react-helmet attribute on <title>/<meta>)
 *   - data-rh, data-reactroot leftovers
 *   - Trailing/leading whitespace
 *
 * The result is a deterministic string suitable for snapshot comparison.
 */
export function normalizeFingerprint(html: string): string {
  return html
    // React SSR scoped ids — pattern `_:r…:_` (with optional capital R + alnum)
    .replace(/_:r[a-zA-Z0-9]+:_/g, '_:rN:_')
    // React useId() outputs — pattern `:r…:` or `:R…:` standalone
    .replace(/:[rR][a-zA-Z0-9]+:/g, ':rN:')
    // react-helmet noise
    .replace(/\s*data-react-helmet="[^"]*"/g, '')
    .replace(/\s*data-rh="[^"]*"/g, '')
    .replace(/\s*data-reactroot=""?/g, '')
    // Collapse whitespace runs
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns the normalized HTML directly. Wraps `normalizeFingerprint` to give
 * tests a single named entry-point — keeps callsites tidy and lets us swap
 * to a SHA hash later without changing test code if .snap files balloon.
 */
export function computeStructuralFingerprint(html: string): string {
  return normalizeFingerprint(html)
}
