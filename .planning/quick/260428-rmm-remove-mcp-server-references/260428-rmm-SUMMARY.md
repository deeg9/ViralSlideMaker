---
name: 260428-rmm summary
description: Removed dead MCP server code, UI, deps, and docs; pruned stale OpenAPI path
type: project
status: complete
---

# Quick Task 260428-rmm — SUMMARY

## What shipped

`/settings/api-keys` is now REST-only and `/docs` (the Scalar reference)
no longer carries the dead `/projects/{id}/download/{index}` path. The
broken `/api/mcp` route is removed in full — `mcp-handler` was listed in
`package.json` but never installed, so the route returned HTTP 500 with
"Module not found: Can't resolve 'mcp-handler'". Nothing in the app was
calling MCP, but the UI was advertising it.

## Files

- **Modified** `src/app/(dashboard)/settings/api-keys/page.tsx` —
  deleted the entire "MCP Server" card (How it works + Quick setup +
  full-docs link). Kept the API Keys table and added a slim
  "Full documentation: API Reference →" footer link to `/docs`.
- **Modified** `src/components/api-keys/create-key-dialog.tsx` —
  dropped `'Claude Desktop'` from `SNIPPET_TABS` (now 3 tabs:
  curl / JavaScript / Python) and removed the corresponding case in
  `getSnippet`.
- **Modified** `src/middleware.ts` — removed the `/api/mcp` skip block.
  The remaining `/api/v1` skip covers all Bearer-token surfaces left.
- **Modified** `src/lib/api/openapi.ts` — removed the stale
  `/projects/{id}/download/{index}` path entry. `find src/app/api/v1`
  confirms no handler exists for it.
- **Modified** `package.json` — dropped `mcp-handler@^1.1.0` and
  `@modelcontextprotocol/sdk@^1.26.0` from `dependencies`. Re-ran
  `npm install` to resync `package-lock.json`.
- **Deleted** `src/app/api/[transport]/route.ts` — the broken
  `createMcpHandler` route.
- **Deleted** `src/lib/mcp/auth.ts` — Bearer verifier (only consumer
  was the route above).
- **Deleted** `src/lib/mcp/tools.ts` — `list_templates` /
  `create_carousel` / `edit_slide` / `render_carousel` definitions
  (only consumer was the route above).
- **Deleted** `src/lib/mcp/` directory (now empty).
- **Deleted** `docs/MCP-GUIDE.md` — 227-line guide promoting the
  broken feature.

## Verification

- `npx tsc --noEmit 2>&1 | grep -E "transport|mcp"` → no output ✓
- `grep -rln "MCP\|mcp-handler\|api/mcp\|mcpServers" src/ docs/` → no
  matches (only `src/lib/profile/reserved-usernames.ts` keeps `'mcp'`
  reserved, intentionally) ✓
- `grep -c "mcp-handler" package-lock.json` → 0 ✓
- `curl /api/mcp` → 307 (login redirect, was 500). Behavior is correct:
  no handler exists, middleware now treats it as any other authed
  request and bounces unauthenticated callers to login.
- `curl /docs` → 200 ✓

## Notes

`@modelcontextprotocol/sdk` still appears in `package-lock.json` as a
transitive dep of the `shadcn` CLI (line 10842 of the lockfile). That's
unrelated to our MCP route — `shadcn` is a build-time CLI, not bundled
into the app, and nothing in `src/` imports the SDK after this change.
Leaving it alone.

The reserved username `'mcp'` in `src/lib/profile/reserved-usernames.ts`
stays — defensive against future username squatting on a path that
previously existed.

A deeper "audit every OpenAPI spec field against every v1 route handler"
sweep is a separate task. The obvious staleness (the dead
`/download/{index}` entry) is fixed; the other 7 paths in the spec
correspond to real route files.
