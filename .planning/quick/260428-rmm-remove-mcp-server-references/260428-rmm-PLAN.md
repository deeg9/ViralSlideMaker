# Quick Task 260428-rmm: remove MCP server (not shipped) + clean up API reference

## Why

`/settings/api-keys` and the Create-Key dialog promote a "MCP Server" feature
that doesn't actually work: `mcp-handler` is in `package.json` but missing
from `node_modules`, so `curl /api/mcp` returns HTTP 500 with
`Module not found: Can't resolve 'mcp-handler'`. The feature was never
shipped end-to-end. User confirmed they only ship the REST API; MCP language
is misleading and should go.

While we're in there, the OpenAPI spec rendered at `/docs` (Scalar) carries
one stale path entry — `/projects/{id}/download/{index}` is documented but no
route handler exists.

## What ships

1. **Strip MCP UI** from `src/app/(dashboard)/settings/api-keys/page.tsx` —
   delete the entire `{/* MCP Setup Section */}` block. Keep API Keys table.
2. **Drop Claude Desktop snippet** from
   `src/components/api-keys/create-key-dialog.tsx` — remove from
   `SNIPPET_TABS` and from `getSnippet`'s switch.
3. **Drop `/api/mcp` skip** from `src/middleware.ts:15-18`.
4. **Remove stale path** `/projects/{id}/download/{index}` from
   `src/lib/api/openapi.ts`.
5. **Delete dead code**:
   - `src/app/api/[transport]/route.ts`
   - `src/lib/mcp/auth.ts`
   - `src/lib/mcp/tools.ts`
   - `src/lib/mcp/` directory
   - `docs/MCP-GUIDE.md`
6. **Drop deps** from `package.json`: `mcp-handler`, `@modelcontextprotocol/sdk`.
   Re-resolve `package-lock.json` via `npm install`.

## Out of scope

- `src/lib/profile/reserved-usernames.ts:26` keeps `'mcp'` reserved — leave
  it (defensive against future username squatting).
- A deeper "audit every spec field against every route handler" sweep is a
  separate task.

## Verification

- `npx tsc --noEmit 2>&1 | grep -E "transport|mcp"` returns nothing.
- `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/mcp`
  returns 404 (was 500).
- `grep -rln "MCP\|mcp-handler\|api/mcp\|mcpServers" src/ docs/` returns no
  matches.
- `grep -c "mcp-handler\|@modelcontextprotocol" package-lock.json` returns 0.
- Visit `/settings/api-keys` — no MCP card, table + Create button still
  work, Create-Key dialog has 3 tabs (curl/JS/Python).
- Visit `/docs` — `/projects/{id}/download` (bulk zip) present;
  `/projects/{id}/download/{index}` gone.
