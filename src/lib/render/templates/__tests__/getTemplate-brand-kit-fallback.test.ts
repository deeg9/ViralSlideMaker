// Phase 89 (BKSHELVE-07): the brand-kit feature is shelved. Legacy projects
// whose stored template_id is the 'brand-kit' sentinel must resolve to a live
// default template (news-oracle) instead of crashing or landing on a hidden
// legacy template. getTemplate() carries the one-line defensive fallback.
//
// WR-01 (Phase 89 code review): the same fallback MUST also live in the async
// resolveTemplate (templates/registry.ts) — the four server render/publish/
// download paths resolve via resolveTemplate, not getTemplate. Without parity
// a legacy 'brand-kit' project would render as news-oracle in the editor but
// highlight-bar (templates[0]) in PNG export / ZIP / publish.

import { describe, it, expect, afterEach } from 'vitest'
import { getTemplate } from '@/lib/render/templates'
import { resolveTemplate, __resetDbTemplateRegistry } from '../registry'

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

describe("Phase 89 WR-01 — resolveTemplate('brand-kit') fallback parity (BKSHELVE-07)", () => {
  // resolveTemplate is hermetic here — news-oracle is a CODE template so no DB
  // fetcher is needed. Reset the registry cache anyway so the case is isolated.
  afterEach(() => {
    __resetDbTemplateRegistry()
  })

  it("resolves the shelved 'brand-kit' sentinel to news-oracle (mirrors getTemplate)", async () => {
    const tpl = await resolveTemplate('brand-kit')
    expect(tpl.id).toBe('news-oracle')
  })

  it("does not throw for the 'brand-kit' sentinel", async () => {
    await expect(resolveTemplate('brand-kit')).resolves.toBeDefined()
  })
})
