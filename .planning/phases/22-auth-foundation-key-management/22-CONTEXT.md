# Phase 22: Auth Foundation & Key Management - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Developers can create, view, and revoke API keys, and authenticate API requests with Bearer tokens. This phase delivers the database schema, auth middleware bypass, Bearer token authentication pipeline, and the settings UI for key management with quick-start code snippets.

</domain>

<decisions>
## Implementation Decisions

### API Key Data Model
- Max 10 API keys per user — enough for dev/staging/prod, prevents abuse
- Key format: `vsl_` prefix + 32 random hex chars (44 chars total)
- Store: name, prefix (first 8 chars after `vsl_`), SHA-256 hash, created_at, last_used_at
- Migration: `007_api_keys.sql` — next in sequence after `006_storage_buckets.sql`

### Auth Middleware & Pipeline
- Bypass middleware: add `request.nextUrl.pathname.startsWith('/api/v1')` in `src/middleware.ts` — same pattern as webhook bypass
- Auth helper: `authenticateApiKey(request)` function returning `{ userId, keyId }` or throwing
- HOC wrapper: `export const GET = withApiAuth(async (req, ctx) => ...)` where `ctx` includes `userId`, `keyId`, `supabase` (admin client)
- `last_used_at` update: fire-and-forget after auth succeeds (non-blocking)

### Settings UI — Key Management Page
- Nav position: 5th item in settings sidebar — `{ href: '/settings/api-keys', icon: 'key', label: 'API Keys' }`
- Create flow: modal dialog with name input → show full key in copyable code block → "This key won't be shown again" warning
- Key list: table with Name, Key (masked `vsl_abc1...`), Created, Last Used, Actions (Revoke)
- Quick-start snippets: tabbed code blocks in post-creation modal for curl, JavaScript (fetch), Python (requests) — auto-populated with user's key

### Claude's Discretion
- RLS policy design for api_keys table (user can only see/manage own keys)
- Error message wording for 401 responses
- Exact key generation implementation (crypto.randomBytes)
- Table styling to match existing settings pages

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Settings layout with sidebar nav at `src/app/(dashboard)/settings/layout.tsx` — `settingsNav` array to extend
- Admin Supabase client at `src/lib/supabase/admin.ts` — for service role key lookups
- Server Supabase client at `src/lib/supabase/server.ts` — for cookie-based auth in settings pages
- Brand Kit page at `src/app/(dashboard)/settings/brand-kit/page.tsx` — styling pattern to match
- Icon component at `src/components/ui/icon.tsx` — Material Symbols icons

### Established Patterns
- Settings pages: server component page → server action for data → client form component
- Color scheme: `text-[#3d0000]`, `text-[#7d6161]`, `bg-[#fadbdb]`, `bg-white`, `border-[#dbc1bc]/10`
- Card wrapper: `bg-white rounded-xl p-8 border border-[#dbc1bc]/10`
- Existing migrations: numbered SQL files in `supabase/migrations/` (002-006)

### Integration Points
- `src/middleware.ts` — add `/api/v1` bypass (line 6-8 area, same as webhooks)
- `src/app/(dashboard)/settings/layout.tsx` — add API Keys nav item to `settingsNav` array
- New route: `src/app/(dashboard)/settings/api-keys/page.tsx`
- New server actions: `src/app/(dashboard)/settings/api-keys/actions.ts`
- New auth lib: `src/lib/api/auth.ts` — `authenticateApiKey()`
- New HOC: `src/lib/api/with-api-auth.ts` — route handler wrapper

</code_context>

<specifics>
## Specific Ideas

- Research confirmed: use `crypto.timingSafeEqual` for hash comparison (prevent timing attacks)
- Research confirmed: use admin client (service_role) in API route handlers, not cookie-based client
- OpenAPI spec at `src/lib/api/openapi.ts` already defines Bearer auth scheme with `vsl_` prefix
- Settings page should match existing brand-kit page styling (white card, rounded-xl, etc.)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
