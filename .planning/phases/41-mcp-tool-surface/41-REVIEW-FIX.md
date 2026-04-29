---
phase: 41
fixed_at: 2026-04-28
review_path: .planning/phases/41-mcp-tool-surface/41-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 6
skipped: 5
status: partial
---

# Phase 41: Code Review Fix Report

**Fixed at:** 2026-04-28
**Source review:** .planning/phases/41-mcp-tool-surface/41-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (4 warnings + 7 nits)
- Fixed: 6 (4 warnings + 2 quick nits)
- Skipped: 5 (nits requiring new tests, REST cross-cutting refactors, or low-value polish)

All 4 warnings fixed. 2 nits applied (the ones explicitly tagged "quick" in the request). Remaining 5 nits skipped per instructions ("skip the rest if they require new tests/major changes").

## Fixed Issues

### WR-03: getUserId cast `as string | undefined` removed
**File modified:** `src/lib/mcp/tools.ts`
**Commit:** `3d5357b`
**Applied fix:** Replaced `e?.authInfo?.extra?.userId as string | undefined` with `typeof v === 'string' && v.length > 0 ? v : undefined`. Defense-in-depth — non-string userIds now fail closed via the truthy check rather than silently passing through the type cast.

### WR-01: Raw service error message no longer leaked to MCP client
**File modified:** `src/lib/mcp/tools.ts`
**Commit:** `1dd463e`
**Applied fix:** Replaced `errorContent('GENERATION_FAILED', err instanceof Error ? err.message : 'Unknown error')` with `errorContent('GENERATION_FAILED', 'Carousel generation failed')` plus `console.error('[mcp:create_carousel] generateCarousel failed', err)` for server-side telemetry. Matches REST handler behavior at `src/app/api/v1/carousel/route.ts:114`.

### WR-04: create_carousel validation order + error code aligned with REST
**File modified:** `src/lib/mcp/tools.ts`
**Commit:** `5a09786`
**Applied fix:** Two changes in one commit (single semantic concern — REST parity):
1. Reordered checks: slide-count cap now runs before project-count cap, matching `src/app/api/v1/carousel/route.ts:53-71`.
2. Changed project-cap error code from `PROJECT_LIMIT_EXCEEDED` to `VALIDATION_ERROR` so agents branching on error code see consistent transport behavior.

Note: REVIEW.md suggests filing a v2.7+ follow-up to make REST use `PROJECT_LIMIT_EXCEEDED` (more actionable). Documented in commit body — not done in this iteration to avoid scope creep into REST handlers.

### WR-02: existingSlide null-guard added
**File modified:** `src/lib/mcp/tools.ts`
**Commit:** `ab43aab`
**Applied fix:** Added `if (!existingSlide || typeof existingSlide !== 'object')` returning in-band `NOT_FOUND` with message `'Slide data is corrupt or missing'`. Prevents TypeError-from-spread bypassing the errorContent envelope when slide_data has gaps from a partial-write race.

REST has the same gap at `src/app/api/v1/projects/[id]/slides/[index]/route.ts:102` — flagged in commit body as v2.7+ follow-up per REVIEW.md guidance. **Requires human verification** in a real partial-write scenario: the unit-test mock pre-populates valid slide objects, so this guard is exercised by inspection only.

### IN-03: getAppUrl warns when falling back to localhost in production
**File modified:** `src/lib/mcp/tools.ts`
**Commit:** `3d7cd8b`
**Applied fix:** Added `let warnedLocalhostInProd = false` module-level flag. When `NODE_ENV === 'production'` and the resolved URL contains `localhost`, log once via `console.warn(...)` so operators see the misconfig in production logs without spam on every tool call. Did not throw (per REVIEW.md "log a warning" guidance) — soft-fail preserves availability if some serverless env legitimately proxies through a different mechanism.

### IN-04: edit_slide description deduplicated
**File modified:** `src/lib/mcp/tools.ts`
**Commit:** `3648028`
**Applied fix:** Removed the second enumeration of the 9 patch fields from the tool description text. Canonical list now lives only in `patch.describe()`. Description compressed from 7 lines to 5 with no semantic loss.

## Skipped Issues

### IN-01: Unsafe `as { ... }` casts at handler entries
**File:** `src/lib/mcp/tools.ts:144-149, 253-257, 333`
**Reason:** Skipped — REVIEW.md itself rates this "Low priority" and notes "Or accept the duplication as documented (simpler)." Refactoring to `z.infer<z.ZodObject<typeof shape>>` would touch all 3 handler entries and add a layer of type indirection without changing behavior. Not a bug today.

### IN-02: templateId not validated against real template IDs
**File:** `src/lib/mcp/tools.ts:118-126`
**Reason:** Skipped — REVIEW.md notes "REST has the same gap, so this is parity" and applying the fix "also requires updating REST to match for true parity." Cross-cutting REST refactor is out of scope for this fix iteration. Filed as v2.7+ follow-up implicitly via this skip note.

### IN-05: No test coverage for negative slideIndex
**File:** `src/__tests__/mcp/tools/edit_slide.test.ts`, `render_carousel.test.ts`
**Reason:** Skipped per instruction — "skip the rest if they require new tests." The Zod schema's `.min(0)` already enforces the contract at the SDK boundary; the missing test is a regression-lock, not a defect.

### IN-06: extra arg shape mismatch in test type annotation
**File:** `src/__tests__/mcp/tools/contract.test.ts:46`
**Reason:** Skipped — REVIEW.md rates as "Low priority" and the proposed fix (extract shared helper file) would touch multiple test files. Both files compile and pass; no behavior risk.

### IN-07: errorContent extra-spread sanitization JSDoc
**File:** `src/lib/mcp/tools.ts:53-60`
**Reason:** Skipped — REVIEW.md frames as "pattern hazard" not bug. All current callers pass server-controlled values. JSDoc-only change, no behavior impact, defer to v2.7+ when more callers exist.

## Verification

- `npx vitest run src/__tests__/mcp/`: **23/23 passed** (5 tools test files + 4 supporting MCP test files)
- `npm run build`: **passed** (Next.js prod build, no TypeScript errors, all routes compiled)

---

_Fixed: 2026-04-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
