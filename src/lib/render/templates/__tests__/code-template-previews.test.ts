/**
 * Phase 90 (PREVIEW-01) — forcing-function test: every code template must carry
 * a real, photo-backed preview PNG URL.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ THIS TEST IS RED-BY-DESIGN AT THE END OF PLAN 90-01.                      │
 * │                                                                          │
 * │ Plan 90-01 only BUILDS the preview pipeline (scripts/render-template-     │
 * │ previews.ts) and runs it in --dry-run — it wires NO `preview` URLs onto   │
 * │ the 16 template source files. Those URLs are produced by Plan 90-02's     │
 * │ LIVE run. Until then no code template has a `preview`, so this test       │
 * │ FAILS. That failure is EXPECTED and is NOT a regression.                  │
 * │                                                                          │
 * │ This is the phase's forcing function: once the picker tile becomes a      │
 * │ single-branch <img> (Plan 90-03), a code template without a `preview`     │
 * │ URL renders a broken image — so this test must go (and stay) GREEN        │
 * │ before that simplification ships. Plan 90-02 turns it GREEN.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { describe, it, expect } from 'vitest'
import { templates } from '@/lib/render/templates'

describe('Phase 90 (PREVIEW-01) — every code template has a preview PNG', () => {
  it('every templates[] entry has a non-empty, https URL-shaped preview', () => {
    for (const t of templates) {
      expect(typeof t.preview, `'${t.id}' preview must be a string`).toBe(
        'string',
      )
      expect(
        (t.preview ?? '').length,
        `'${t.id}' preview must be non-empty`,
      ).toBeGreaterThan(0)
      expect(t.preview, `'${t.id}' preview must be an https URL`).toMatch(
        /^https:\/\//,
      )
    }
  })
})
