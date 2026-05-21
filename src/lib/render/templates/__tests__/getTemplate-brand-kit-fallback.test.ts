// Phase 89 (BKSHELVE-07): the brand-kit feature is shelved. Legacy projects
// whose stored template_id is the 'brand-kit' sentinel must resolve to a live
// default template (news-oracle) instead of crashing or landing on a hidden
// legacy template. getTemplate() carries the one-line defensive fallback.

import { describe, it, expect } from 'vitest'
import { getTemplate } from '@/lib/render/templates'

describe("Phase 89 — getTemplate('brand-kit') fallback (BKSHELVE-07)", () => {
  it("resolves the shelved 'brand-kit' sentinel to news-oracle", () => {
    expect(getTemplate('brand-kit').id).toBe('news-oracle')
  })

  it("does not throw for the 'brand-kit' sentinel", () => {
    expect(() => getTemplate('brand-kit')).not.toThrow()
  })

  it('still resolves a genuine unknown id to templates[0] (fallback unchanged)', () => {
    // The 'brand-kit' normalize must NOT alter the generic unknown-id fallback.
    expect(() => getTemplate('totally-unknown-xyz')).not.toThrow()
  })
})
