---
phase: 22-auth-foundation-key-management
verified: 2026-04-08T17:10:00Z
status: human_needed
score: 9/9
overrides_applied: 0
human_verification:
  - test: "Create API key end-to-end flow"
    expected: "Navigate to /settings/api-keys, create a key, see full vsl_ token once with copy button and 3 snippet tabs (curl, JavaScript, Python), close dialog, key appears in table with masked prefix"
    why_human: "UI interaction and visual rendering cannot be verified programmatically — dialogs, clipboard API, tab switching, and copy-then-checkmark behavior"
  - test: "Revoke API key flow"
    expected: "Click Revoke on a key, confirmation dialog shows key name, clicking Revoke Key removes it from table immediately"
    why_human: "Destructive UI action with confirmation dialog requires visual and functional verification in browser"
  - test: "Settings sidebar navigation"
    expected: "API Keys appears as 5th item in sidebar, active state highlighted when on /settings/api-keys"
    why_human: "Sidebar rendering and active state require browser navigation to verify"
  - test: "Styling matches brand kit pattern"
    expected: "Page matches brand-kit page styling: mx-auto max-w-3xl, #3d0000 headings, white card with border, consistent typography"
    why_human: "Visual design conformance cannot be verified with code inspection alone"
---

# Phase 22: Auth Foundation & Key Management — Verification Report

**Phase Goal:** Developers can create, view, and revoke API keys, and authenticate API requests with Bearer tokens
**Verified:** 2026-04-08T17:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | API key hash lookups work against the api_keys table with RLS policies | VERIFIED | `supabase/migrations/007_api_keys.sql` creates table with `ENABLE ROW LEVEL SECURITY`, SELECT/INSERT/DELETE policies scoped to `auth.uid() = user_id`, indexes on `key_hash` and `user_id` |
| 2 | Bearer vsl_ tokens authenticate via SHA-256 hash lookup with timing-safe comparison | VERIFIED | `src/lib/api/auth.ts` imports `timingSafeEqual` from crypto, hashes raw key, queries `api_keys` table via admin client, performs buffer comparison — 6 unit tests pass |
| 3 | Middleware skips Supabase session auth for /api/v1/* routes | VERIFIED | `src/middleware.ts` lines 11-13: early return for `pathname.startsWith('/api/v1')` before `updateSession()` call |
| 4 | withApiAuth HOC provides userId, keyId, and admin Supabase client to route handlers | VERIFIED | `src/lib/api/with-api-auth.ts` calls `authenticateApiKey`, then `createAdminClient()`, passes both to handler as `ApiContext` — 4 unit tests pass |
| 5 | Developer can create a named API key and sees the full vsl_ token exactly once | VERIFIED (code) | `createApiKey` server action generates `vsl_` + 32 hex chars, returns `rawKey` to client, stores only SHA-256 hash in DB; `create-key-dialog.tsx` renders key in reveal step and resets on close |
| 6 | Developer can view a list of their keys showing name, masked prefix, created date, and last used | VERIFIED (code) | `listApiKeys` queries `id, name, prefix, created_at, last_used_at` (no `key_hash`); `api-key-table.tsx` renders semantic table with `vsl_{prefix}...` badge and relative dates |
| 7 | Developer can revoke a key and it is immediately deleted | VERIFIED (code) | `revokeApiKey` deletes by both `id` and `user_id`; `revoke-key-dialog.tsx` calls action and triggers `onRevoked()` callback; unit test confirms double-filter |
| 8 | Settings page shows quick-start code snippets (curl, JavaScript, Python) after key creation | VERIFIED (code) | `create-key-dialog.tsx` step='reveal' renders 3 tabs with `getSnippet()` interpolating the actual `rawKey` into curl/JavaScript/Python templates |
| 9 | API Keys appears as 5th item in settings sidebar navigation | VERIFIED | `src/app/(dashboard)/settings/layout.tsx` line 12: `{ href: '/settings/api-keys', icon: 'key', label: 'API Keys' }` — 5th entry in `settingsNav` array |

**Score:** 9/9 truths verified (automated checks pass; UI flows require human verification per items above)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/007_api_keys.sql` | api_keys table with RLS and indexes | VERIFIED | 27 lines — full schema with UNIQUE key_hash, 2 indexes, 3 RLS policies, no UPDATE policy |
| `src/lib/api/auth.ts` | authenticateApiKey function | VERIFIED | Exports `authenticateApiKey`, 42 lines, uses `timingSafeEqual`, fire-and-forget `last_used_at` |
| `src/lib/api/with-api-auth.ts` | withApiAuth HOC wrapper | VERIFIED | Exports `withApiAuth` and `ApiContext`, 401 error body matches spec |
| `src/__tests__/api/auth.test.ts` | Unit tests for authenticateApiKey | VERIFIED | 6 tests — all pass |
| `src/app/(dashboard)/settings/api-keys/page.tsx` | API Keys settings page (server component) | VERIFIED | Calls `listApiKeys()`, renders Icon + heading + card + `<ApiKeyTable>` |
| `src/app/(dashboard)/settings/api-keys/actions.ts` | Server actions for key CRUD | VERIFIED | Exports `createApiKey`, `listApiKeys`, `revokeApiKey` — 87 lines |
| `src/components/api-keys/api-key-table.tsx` | Key list table component | VERIFIED | Semantic HTML table, masked prefix badge, relative dates, empty state |
| `src/components/api-keys/create-key-dialog.tsx` | Create key dialog with snippets | VERIFIED | Two-step dialog: name input → key reveal with copy button and 3 snippet tabs |
| `src/components/api-keys/revoke-key-dialog.tsx` | Revoke confirmation dialog | VERIFIED | Destructive dialog with key name, Keep Key / Revoke Key buttons, loading spinner |
| `src/__tests__/api/api-keys.test.ts` | Unit tests for server actions | VERIFIED | 9 tests — all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/api/auth.ts` | `src/lib/supabase/admin.ts` | `createAdminClient` import | VERIFIED | Line 2: `import { createAdminClient } from '@/lib/supabase/admin'` |
| `src/lib/api/with-api-auth.ts` | `src/lib/api/auth.ts` | `authenticateApiKey` import | VERIFIED | Line 2: `import { authenticateApiKey } from './auth'` |
| `src/middleware.ts` | `/api/v1` | early return before updateSession | VERIFIED | Lines 11-13: `startsWith('/api/v1')` early return |
| `src/app/(dashboard)/settings/api-keys/page.tsx` | `src/app/(dashboard)/settings/api-keys/actions.ts` | `listApiKeys` import | VERIFIED | Line 1: `import { listApiKeys } from './actions'` — called at line 6 |
| `src/components/api-keys/create-key-dialog.tsx` | `src/app/(dashboard)/settings/api-keys/actions.ts` | `createApiKey` import | VERIFIED | Line 6: imports `createApiKey`, called at line 85 |
| `src/app/(dashboard)/settings/layout.tsx` | `/settings/api-keys` | settingsNav array entry | VERIFIED | Line 12: 5th `settingsNav` entry with `href: '/settings/api-keys'` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `api-key-table.tsx` | `keys` prop | `listApiKeys()` server action → `supabase.from('api_keys').select(...)` | Yes — DB query, no static fallback | FLOWING |
| `create-key-dialog.tsx` | `rawKey` state | `createApiKey()` server action → `randomBytes(16).toString('hex')` | Yes — generated cryptographically | FLOWING |
| `page.tsx` | `keys` | `listApiKeys()` called at render time | Yes — real Supabase query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All phase 22 tests pass | `npx vitest run ...4 test files...` | 24/24 tests pass | PASS |
| timingSafeEqual used in auth.ts | `grep "timingSafeEqual" src/lib/api/auth.ts` | Found on lines 1 and 30 | PASS |
| /api/v1 bypass in middleware | `grep "startsWith.*api/v1" src/middleware.ts` | Found on line 11 | PASS |
| createAdminClient used in withApiAuth | `grep "createAdminClient" src/lib/api/with-api-auth.ts` | Found on line 3 | PASS |
| RLS enabled in migration | `grep "ENABLE ROW LEVEL SECURITY" 007_api_keys.sql` | Found on line 14 | PASS |
| api-keys 5th in settings nav | `grep "api-keys" settings/layout.tsx` | Found at line 12 (5th entry) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| KEY-01 | 22-02 | User can create an API key with a name, receiving a `vsl_` prefixed token shown once | SATISFIED | `createApiKey` generates `vsl_` + 32 hex; dialog reveals once in step='reveal', resets on close |
| KEY-02 | 22-01 | API key stored as SHA-256 hash in Supabase with RLS policies | SATISFIED | `007_api_keys.sql` has RLS + `key_hash` UNIQUE; `createApiKey` stores hash, not raw key |
| KEY-03 | 22-02 | User can list keys showing name, prefix, created date, last used | SATISFIED | `listApiKeys` selects `id, name, prefix, created_at, last_used_at` (no `key_hash`); table renders all columns |
| KEY-04 | 22-02 | User can revoke a key, immediately invalidating it | SATISFIED | `revokeApiKey` deletes by `id` AND `user_id`; unit test verifies double filter |
| KEY-05 | 22-02 | Settings page shows quick-start code snippets (curl/JS/Python) after key creation | SATISFIED | `create-key-dialog.tsx` step='reveal' renders 3 tabs with real key interpolated |
| AUTH-01 | 22-01 | API routes accept `Authorization: Bearer vsl_...` header via SHA-256 hash lookup | SATISFIED | `authenticateApiKey` validates `Bearer vsl_*` prefix, hashes, looks up in `api_keys` table |
| AUTH-02 | 22-01 | Hash comparison uses `crypto.timingSafeEqual` to prevent timing attacks | SATISFIED | `auth.ts` line 1 imports `timingSafeEqual`, used at line 30 for buffer comparison |
| AUTH-03 | 22-01 | Middleware skips Supabase session auth for `/api/v1/*` routes | SATISFIED | `middleware.ts` lines 11-13: early return before `updateSession()` |
| AUTH-04 | 22-01 | Route handlers use Supabase admin client (service role) with manual user_id filtering | SATISFIED | `withApiAuth` injects `createAdminClient()` as `ctx.supabase`; convention documented in threat model |

All 9 requirements for Phase 22 are satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/__tests__/auth/middleware.test.ts` | — | Missing `/api/v1` bypass test from Plan 01 Task 3 | Warning | Test coverage gap — SUMMARY claims 6 middleware tests but only 5 exist. The middleware bypass itself works correctly. No impact on production behavior. |

### Human Verification Required

#### 1. Create API Key End-to-End

**Test:** Run `npm run dev`, navigate to http://localhost:3000/settings/api-keys, click "Create API Key", enter a name, click "Create Key"
**Expected:** Full `vsl_` token shown in reveal dialog with copy button (icon changes to checkmark after copy), warning banner "Copy your API key now. It will not be shown again.", three snippet tabs (curl, JavaScript, Python) each showing the actual key value, "Done" button closes dialog and key appears in table
**Why human:** Dialog UI, clipboard API, tab switching, icon state transitions require browser execution

#### 2. Revoke API Key Flow

**Test:** Click "Revoke" button on an existing key row
**Expected:** Confirmation dialog opens showing the key's name in the description, "Keep Key" and "Revoke Key" buttons present, clicking "Revoke Key" shows loading spinner then closes dialog and removes key from table
**Why human:** Browser interaction required for dialog open/close and table refresh

#### 3. Settings Sidebar Navigation

**Test:** Navigate to http://localhost:3000/settings, check sidebar, click "API Keys"
**Expected:** "API Keys" with key icon appears as 5th item below "Brand Kit", active state (bg-[#fadbdb] text-[#3d0000]) applied when on /settings/api-keys
**Why human:** Active state routing behavior requires browser navigation

#### 4. Styling Matches Brand Kit Pattern

**Test:** Compare /settings/api-keys with /settings/brand-kit visually
**Expected:** Consistent layout — same max-w-3xl container, same icon/heading treatment, same white card with border, same color palette (#3d0000 headings, #7d6161 body text)
**Why human:** Visual design conformance requires side-by-side comparison in browser

### Gaps Summary

No gaps found. All 9 must-have truths are verified by code inspection and automated tests. The one finding is a test coverage warning (missing `/api/v1` middleware bypass test in `middleware.test.ts`) — the SUMMARY overcounted at 6 tests when 5 exist. This is informational only; the production feature is correctly implemented and the other 5 middleware tests cover related behavior.

The phase is blocked on human verification for UI flows (4 items above) before the `passed` gate can be cleared.

---

_Verified: 2026-04-08T17:10:00Z_
_Verifier: Claude (gsd-verifier)_
