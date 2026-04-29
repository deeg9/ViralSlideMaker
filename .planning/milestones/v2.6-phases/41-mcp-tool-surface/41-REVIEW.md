---
phase: 41
status: findings_present
reviewed: 2026-04-28
critical_count: 0
warning_count: 4
nit_count: 7
---

# Phase 41: MCP Tool Surface — Code Review Report

**Reviewed:** 2026-04-28
**Depth:** standard (with cross-file parity verification against REST)
**Files Reviewed:** 7
**Status:** findings_present (4 warnings, 7 nits, 0 critical)

## Files Reviewed

- `src/lib/mcp/tools.ts` (NEW — 357 lines, main artifact)
- `src/app/api/[transport]/route.ts` (MODIFIED — registerTools wired into setup)
- `src/__tests__/mcp/tools/contract.test.ts` (NEW)
- `src/__tests__/mcp/tools/list_templates.test.ts` (NEW)
- `src/__tests__/mcp/tools/create_carousel.test.ts` (NEW)
- `src/__tests__/mcp/tools/edit_slide.test.ts` (NEW)
- `src/__tests__/mcp/tools/render_carousel.test.ts` (NEW)
- `src/__tests__/mcp/route.test.ts` (MODIFIED — service mocks for transitive imports)

Cross-referenced for parity: `src/app/api/v1/carousel/route.ts`, `src/app/api/v1/projects/[id]/slides/[index]/route.ts`, `src/app/api/v1/projects/[id]/render/route.ts`, `src/app/api/v1/templates/route.ts`, `src/lib/services/carousel.ts`, `src/lib/services/projects.ts`, `src/lib/credits/check-credits.ts`, `src/lib/mcp/auth.ts`, `src/app/api/render/route.ts`.

## Summary

The `registerTools` implementation is solid and cleanly mirrors the REST API behavior it parallels. Credit accounting is correctly ordered (validate → deduct → service → refund-on-failure), the AuthInfo guard correctly returns in-band UNAUTHORIZED, the 9-field edit whitelist matches REST exactly, no `/api/v1/*` re-entry occurs, and `render_carousel` honestly discloses the browser-session limitation. Anti-patterns from RESEARCH.md are all avoided.

No security-critical defects were found. The findings below are bug-class or hygiene-class issues:

- 4 warnings: error-message leakage from `generateCarousel`, missing null-guard on `existingSlide`, unsafe `as string` cast in `getUserId`, validation-order divergence vs REST.
- 7 nits: type-safety casts at handler boundaries, unvalidated `templateId` against real templates (REST parity gap), localhost fallback in production env-misconfig case, redundant phrasing in `edit_slide` description, missing edge-case tests.

The credit-deduction integrity check passed: the catch at `tools.ts:210` covers all `generateCarousel` error paths (the service's own catch re-throws after marking the project as `error`), and all input validation runs BEFORE deduction so malformed input cannot burn credits.

## Warnings

### WR-01: Raw service error message leaked to MCP client in `GENERATION_FAILED` response

**File:** `src/lib/mcp/tools.ts:218-221`

**Issue:** When `generateCarousel` throws, the catch returns the raw `err.message` to the MCP client:
```ts
return errorContent(
  'GENERATION_FAILED',
  err instanceof Error ? err.message : 'Unknown error'
)
```

The REST equivalent at `src/app/api/v1/carousel/route.ts:114` returns a generic `'Carousel generation failed'` and does NOT propagate the underlying error message. `generateCarousel` can throw Supabase errors with database-internal context (column names, constraint violations, RLS policy names) and Pexels/Imagen errors that may include URLs, request IDs, or stack-trace fragments. Leaking these to the agent client weakens information-hiding parity with REST and could surface internal schema details to a malicious agent who triggers errors deliberately.

**Fix:**
```ts
} catch (err) {
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: 1,
    description: 'Carousel generation failed (MCP)',
  })
  // Match REST: generic message, log raw error server-side
  console.error('[mcp:create_carousel] generateCarousel failed', err)
  return errorContent('GENERATION_FAILED', 'Carousel generation failed')
}
```

### WR-02: `existingSlide` may be `undefined`/`null`, dereferenced without guard

**File:** `src/lib/mcp/tools.ts:291-298`

**Issue:** After:
```ts
const slideData = (project.slide_data as Record<string, unknown>[] | null) ?? []
if (slideIndex >= slideData.length) {
  return errorContent('NOT_FOUND', 'Slide not found')
}
const existingSlide = slideData[slideIndex]
```
`existingSlide` is typed as `Record<string, unknown>` but the runtime value could be `null` or `undefined` if the array contains gaps (data corruption, partial-write race in `generateCarousel`'s middle-of-loop slide assignments). Lines 294 (`existingSlide.style_overrides`) and 297 (spread of `existingSlide`) would then throw a TypeError that escapes the handler. mcp-handler will surface this as a generic internal error, but it's a non-deterministic failure mode that bypasses the `errorContent` envelope.

REST has the same gap (`src/app/api/v1/projects/[id]/slides/[index]/route.ts:102`) — parity is preserved — but worth flagging as a robustness improvement applicable to both.

**Fix:**
```ts
const existingSlide = slideData[slideIndex]
if (!existingSlide || typeof existingSlide !== 'object') {
  return errorContent('NOT_FOUND', 'Slide data is corrupt or missing')
}
```

### WR-03: `getUserId` cast `as string | undefined` is unsafe — non-string `userId` passes the truthy check

**File:** `src/lib/mcp/tools.ts:48-51`

**Issue:**
```ts
function getUserId(extra: unknown): string | undefined {
  const e = extra as { authInfo?: { extra?: Record<string, unknown> } } | undefined
  return e?.authInfo?.extra?.userId as string | undefined
}
```
The trailing `as string | undefined` cast is a type-system lie — if `userId` were ever non-string (e.g., a number, due to a future refactor of `verifyApiKeyHash`), the cast hides the bug. The current Phase 40 code stores `userId` from a Supabase `string` column, so today this is safe, but the cast removes a defense-in-depth check.

**Fix:**
```ts
function getUserId(extra: unknown): string | undefined {
  const e = extra as { authInfo?: { extra?: Record<string, unknown> } } | undefined
  const v = e?.authInfo?.extra?.userId
  return typeof v === 'string' && v.length > 0 ? v : undefined
}
```

### WR-04: Validation-order divergence from REST in `create_carousel`

**File:** `src/lib/mcp/tools.ts:155-170` vs `src/app/api/v1/carousel/route.ts:54-71`

**Issue:** The MCP handler runs checks in this order:
1. `checkProjectLimit` → PROJECT_LIMIT_EXCEEDED
2. Free-tier slide-count cap → VALIDATION_ERROR
3. Credit balance → INSUFFICIENT_CREDITS

REST runs:
1. Free-tier slide-count cap → VALIDATION_ERROR
2. `checkProjectLimit` → VALIDATION_ERROR (different code)
3. Credit balance → INSUFFICIENT_CREDITS

For a free-tier user who is over the project limit AND requested 5 slides, REST returns the slide-count error first; MCP returns the project-limit error first. Also note MCP uses error code `PROJECT_LIMIT_EXCEEDED` while REST uses `VALIDATION_ERROR` for the same condition — this means an agent that branches on error code will see different behavior between transports.

The MCP error code is arguably better (`PROJECT_LIMIT_EXCEEDED` is more actionable than `VALIDATION_ERROR`), but the divergence should be either documented as intentional or aligned with REST.

**Fix:** Either reorder to match REST (and change `PROJECT_LIMIT_EXCEEDED` → `VALIDATION_ERROR` for code parity), OR document the deliberate divergence in the file-top comment block. Recommended: align REST to use `PROJECT_LIMIT_EXCEEDED` too in a follow-up — the MCP error code is more useful.

## Nits

### IN-01: Unsafe `as { ... }` casts at every handler entry

**File:** `src/lib/mcp/tools.ts:144-149, 253-257, 333`

**Issue:** Each handler does e.g.:
```ts
const { topic, templateId, slideCount, imageSource } = args as {
  topic: string
  templateId: string
  slideCount?: number
  imageSource?: 'stock' | 'ai'
}
```
Zod has already validated `args` against the `inputSchema` so the cast is sound at runtime, but the schema and the cast are duplicated by hand. If a schema field is renamed and the cast isn't, TypeScript won't catch the mismatch.

**Fix:** Define the input shape via `z.infer`:
```ts
const createCarouselInputSchema = {
  topic: z.string().min(1).max(500),
  templateId: z.string().min(1),
  slideCount: z.number().int().min(3).max(10).optional(),
  imageSource: z.enum(['stock', 'ai']).optional(),
}
type CreateCarouselInput = z.infer<z.ZodObject<typeof createCarouselInputSchema>>
// then: const { topic, ... } = args as CreateCarouselInput
```
Or accept the duplication as documented (simpler). Low priority.

### IN-02: `templateId` is not validated against real template IDs — credit deducted for invalid template

**File:** `src/lib/mcp/tools.ts:118-126`

**Issue:** The schema is `z.string().min(1)` — any non-empty string passes. If an agent passes `templateId: "doesnt-exist"`, the credit is deducted and `generateCarousel` proceeds. The slides save with `template_id: "doesnt-exist"`, and at render time `getTemplate("doesnt-exist") ?? 'highlight-bar'` falls back silently, so the user gets an unexpected template. REST has the same gap, so this is parity, but the MCP tool description explicitly tells agents to call `list_templates` first — adding a server-side `z.enum([...templates.map(t => t.id)])` validation would catch the typo before the credit hits.

**Fix:** Build the enum from `templates`:
```ts
const TEMPLATE_IDS = templates.map((t) => t.id) as [string, ...string[]]
// in schema:
templateId: z.enum(TEMPLATE_IDS).describe('Template ID from list_templates. REQUIRED.')
```
Note: this also requires updating REST to match for true parity.

### IN-03: `getAppUrl()` falls back to `http://localhost:3000` in production env-misconfig

**File:** `src/lib/mcp/tools.ts:41-46`

**Issue:** If neither `NEXT_PUBLIC_APP_URL` nor `VERCEL_URL` is set (misconfigured production), `getAppUrl()` returns `http://localhost:3000`. The agent will receive `dashboardUrl: http://localhost:3000/project/...` and `downloadUrl: http://localhost:3000/api/render?...` — both useless. REST handlers use `new URL(req.url).origin` which is always correct.

**Fix:** Either pass the request origin to `registerTools` (architecturally heavier), OR fail fast if the helper resolves to `localhost` while `NODE_ENV === 'production'`:
```ts
function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  if (process.env.NODE_ENV === 'production' && url.includes('localhost')) {
    throw new Error('NEXT_PUBLIC_APP_URL or VERCEL_URL must be set in production')
  }
  return url
}
```

### IN-04: `edit_slide` description repeats the 9-field list twice

**File:** `src/lib/mcp/tools.ts:230-237` (description body) and `src/lib/mcp/tools.ts:244-246` (patch field describe)

**Issue:** The 9 allowed field names appear in the tool description AND again in the `patch` field's `.describe(...)`. Slight redundancy that consumes tokens for AI agents. Not a bug — just verbose.

**Fix (optional):** Reference the field list once. Low priority.

### IN-05: No test coverage for negative `slideIndex`

**File:** `src/__tests__/mcp/tools/edit_slide.test.ts`, `src/__tests__/mcp/tools/render_carousel.test.ts`

**Issue:** Zod schema `z.number().int().min(0)` filters out negative indices, but there's no explicit test asserting that behavior. If someone later loosens the schema (e.g., removes `.min(0)`), `slideData[-1]` returns `undefined` and the existing slide spread would throw. Adding a `slideIndex: -1 → VALIDATION_ERROR` test would lock in the schema contract.

**Fix:** Add one test per file:
```ts
it('rejects negative slideIndex via Zod schema', async () => {
  const tool = getEditSlide()
  // Note: this would be caught by mcp-handler before reaching the handler
  // in production. Document the schema contract here.
  // ...
})
```

### IN-06: `extra` arg shape mismatch in test type annotation

**File:** `src/__tests__/mcp/tools/contract.test.ts:46`

**Issue:** The inline type annotation `Record<string, { handler: (args: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }>` declares `content: { text: string }[]`, but `render_carousel.test.ts:31` uses `text?: string; type: string` (text is optional). The two test files have slightly divergent assumptions about the SDK return shape. Both work for the assertions made, but a shared type alias would prevent drift.

**Fix:** Extract a shared type to a test helper file (`src/__tests__/mcp/tools/_helpers.ts`) and import it. Low priority.

### IN-07: `description` field inside `errorContent` extra spreads onto JSON without sanitization

**File:** `src/lib/mcp/tools.ts:53-60`

**Issue:** `errorContent(code, message, extra)` does `{ error: code, message, ...extra }`. Today, all callers pass server-controlled values (e.g., `{ creditsRemaining: balance }`). If a future caller passes user-controlled data into `extra`, it'd be JSON-stringified into the response. Not a bug today — flag it as a pattern hazard.

**Fix:** Add a JSDoc note to `errorContent` warning callers to never pass user-controlled keys. Low priority.

## Positive Observations

- **Refund-pattern code parity** with REST is line-for-line correct (`tools.ts:210-222` matches `carousel/route.ts:91-115`).
- **Whitelist-filter pattern** in `edit_slide` reproduces REST exactly using a shared constant array shape.
- **Anti-pattern guards** in the file-top comment block (`tools.ts:16-23`) clearly enumerate the 7 retired-version pitfalls. This is excellent documentation discipline.
- **Open Q1 honesty**: the `render_carousel` description explicitly tells agents the URLs require a browser session, instead of pretending it works headlessly. This is the right call.
- **Test mock hygiene**: every test file mocks ALL service modules (carousel, projects, check-credits, supabase/admin) regardless of which the test exercises, blocking transitive Pexels init. Documented in 41-01-SUMMARY.md as a reusable pattern.
- **`vi.hoisted`** correctly used for mocks referenced inside `vi.mock` factories (avoids the hoisting trap).
- **`tool.handler` not `tool.callback`** — verified against the SDK's actual API surface, not assumed from the plan's draft.
- **Build-gate `import` at top of route** preserved — Phase 40's MCP-TRANS-06 invariant intact.
- **No `fetch('/api/v1/...')` calls** in tools.ts — the 2 `grep -c "api/v1"` hits in the source are anti-pattern docstring warnings, not actual calls.

## Out-of-Scope (per request)

- Open Q1 about `/api/render` requiring a browser session is already disclosed by the executor in the tool description.
- Phase 40 code (auth, route transport) was already reviewed.
- Pre-existing test failures in unrelated suites (Stripe, projects/crud).

---

_Reviewed: 2026-04-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard with cross-file REST-parity verification_
