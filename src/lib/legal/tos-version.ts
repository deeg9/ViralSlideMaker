// Phase 79 (LEGAL-02, Plan 01): single source of truth for the
// style-from-reference Terms of Service revision string.
//
// This literal is consumed in three places:
//   1. The audit-log helpers (src/lib/legal/audit-log.ts) write it into the
//      `tos_version` column when recording acceptance and read it back when
//      asking "did this user accept the current ToS?".
//   2. The clickwrap modal (Plan 79-02) imports it to label the
//      "I have read and agree to the Terms (v2026-05-10-v1)" copy and to pass
//      to the server action that records acceptance.
//   3. The Style-from-Reference section of `src/app/terms/page.tsx`
//      (Plan 79-02 / LEGAL-05) renders the same literal so the displayed
//      version always matches what gets recorded.
//
// BUMP DISCIPLINE: bump this constant on any substantive change to the
// Style-from-Reference ToS clause. Because `hasUserAcceptedCurrentTos()`
// matches on the literal, bumping it forces every existing user to re-accept
// before their next upload — that is the intended legal effect.
//
// FORMAT: `YYYY-MM-DD-vN` — date the clause was authored, plus a same-day
// revision counter. The audit-log stores it as opaque text; only the format
// test in __tests__/tos-version.test.ts enforces the convention.

export const STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-10-v1' as const

export type StyleFromReferenceTosVersion = typeof STYLE_FROM_REFERENCE_TOS_VERSION

/**
 * Returns the currently-active style-from-reference ToS version literal.
 *
 * Prefer this function over importing `STYLE_FROM_REFERENCE_TOS_VERSION`
 * directly when the consumer is a runtime helper that may want to be mocked
 * in a future test (constants can't be re-mocked at module scope without
 * `vi.doMock`; a function call indirection makes targeted overrides cheap).
 */
export function getStyleFromReferenceTosVersion(): StyleFromReferenceTosVersion {
  return STYLE_FROM_REFERENCE_TOS_VERSION
}
