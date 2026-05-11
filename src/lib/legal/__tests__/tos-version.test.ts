// Phase 79 (LEGAL-02, Plan 01): contract test for the ToS version constant.
// The constant is the single source of truth for which ToS revision a user
// accepted; bumping the literal forces re-acceptance because the audit-log
// helper compares (user_id, tos_version) when deciding whether to skip the
// clickwrap modal on subsequent uploads. Tests pin both the literal value
// and the helper return-shape so Plan 79-02's clickwrap and the migration's
// `tos_version` column stay aligned with the same string.

import { describe, it, expect } from 'vitest'
import {
  STYLE_FROM_REFERENCE_TOS_VERSION,
  getStyleFromReferenceTosVersion,
} from '@/lib/legal/tos-version'

describe('tos-version', () => {
  it('exports the locked v2.13 ToS version literal', () => {
    expect(STYLE_FROM_REFERENCE_TOS_VERSION).toBe('2026-05-10-v1')
  })

  it('getStyleFromReferenceTosVersion() returns the same literal', () => {
    expect(getStyleFromReferenceTosVersion()).toBe(STYLE_FROM_REFERENCE_TOS_VERSION)
    expect(getStyleFromReferenceTosVersion()).toBe('2026-05-10-v1')
  })

  it('the literal is a non-empty date-versioned string (YYYY-MM-DD-vN shape)', () => {
    // Defense in depth — bump-discipline reminder. The migration column
    // stores text but the convention is `YYYY-MM-DD-vN` so audit rows are
    // human-readable and chronologically sortable.
    expect(STYLE_FROM_REFERENCE_TOS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}-v\d+$/)
  })
})
