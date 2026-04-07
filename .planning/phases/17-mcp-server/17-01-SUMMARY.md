---
phase: 17-mcp-server
plan: 01
name: MCP Server Core Tools
subsystem: api/mcp
tags: [mcp, api, tools, auth]
dependency_graph:
  requires: [15-01, 16-01, 16-02]
  provides: [mcp-endpoint, mcp-tools]
  affects: [api-routes]
tech_stack:
  added: [mcp-handler, "@modelcontextprotocol/sdk"]
  patterns: [mcp-tool-registration, bearer-auth-adapter, service-layer-delegation]
key_files:
  created:
    - src/lib/mcp/tools.ts
    - src/lib/mcp/auth.ts
    - src/app/api/mcp/route.ts
    - src/__tests__/mcp/tools.test.ts
    - src/__tests__/mcp/auth.test.ts
    - src/__tests__/setup.ts
  modified:
    - package.json
decisions:
  - "Used deprecated server.tool() API over registerTool() for simpler 4-arg call pattern (name, description, schema, handler)"
  - "Tools return relative URL paths for downloads -- clients add base URL"
  - "list_templates has no auth requirement in tool logic (server-level auth still applies via withMcpAuth)"
metrics:
  duration: 4min
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
  tests_added: 13
  tests_passing: 13
---

# Phase 17 Plan 01: MCP Server Core Tools Summary

MCP server at /api/mcp with 4 tools (create_carousel, edit_slide, render_carousel, list_templates) using mcp-handler Streamable HTTP transport and Bearer token auth via existing API key infrastructure.

## What Was Built

### Task 1: MCP Auth Adapter and Route Handler
- Installed `mcp-handler` and `@modelcontextprotocol/sdk` packages
- Created `verifyMcpToken` adapter that validates `vsl_` prefixed Bearer tokens against the `api_keys` DB table (same logic as REST `authenticateApiKey` but adapted for mcp-handler's `verifyToken` signature returning `AuthInfo`)
- Created `/api/mcp` route using `createMcpHandler` wrapped with `withMcpAuth(required: true)`
- Server info: `{ name: "viralslidemaker", version: "1.0.0" }`
- 5 auth tests covering valid/invalid/revoked/missing token scenarios

### Task 2: MCP Tool Definitions
- **list_templates**: Returns array of `{ id, name, textPosition, textAlign }` from existing template registry
- **create_carousel**: Creates project via `createProjectService`, generates content via `generateCarouselService`, returns `{ projectId, slideCount, downloadUrls, zipUrl }`
- **edit_slide**: Maps camelCase MCP params (`hookText` -> `hook_text`, `bodyText` -> `body_text`, etc.) to snake_case `updateSlide` service call
- **render_carousel**: Fetches project to determine slide count, returns download URL paths for each slide PNG plus ZIP
- All tools extract `userId` from `extra.authInfo.extra.userId` (populated by `verifyMcpToken`)
- All tools use `createAdminClient()` for DB access (same pattern as REST API routes)
- 8 tool tests covering registration, service delegation, error handling

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 41ec507 | Install mcp-handler, create MCP auth adapter and route handler |
| 2 | d04b48e | Define 4 MCP tools wrapping existing service layer |

## Decisions Made

1. **Used `server.tool()` over `registerTool()`**: The deprecated `tool(name, description, schema, handler)` 4-arg pattern is simpler and still fully functional. Can migrate to `registerTool` config object pattern later if needed.
2. **Relative download URLs**: Tools return paths like `/api/v1/projects/{id}/download/{index}` rather than absolute URLs. MCP clients add the base URL. This matches the REST API pattern.
3. **list_templates is auth-light**: No userId extraction needed in tool logic since it reads from a static in-memory template array. Server-level `withMcpAuth(required: true)` still enforces authentication at the transport level.

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Surface Verification

All 6 threats from the plan's threat model are mitigated:
- T-17-01 (Spoofing): `withMcpAuth(required: true)` + `verifyMcpToken` validates key hash against DB, rejects revoked keys
- T-17-02 (Tampering): Zod schemas on all tool inputs; UUID validation on projectId; bounds on slideCount/slideIndex
- T-17-03 (Information Disclosure): All service calls pass userId from auth; services filter by user_id in DB queries
- T-17-04 (Elevation of Privilege): adminClient passed only to services that enforce user_id filtering
- T-17-05 (DoS): maxDuration=60 set on both route config and mcp-handler config
- T-17-06 (backgroundUrl injection): Zod `z.string().url()` validates URL format; editor service rejects non-https URLs

## Known Stubs

None -- all tools are fully wired to existing service layer.

## Self-Check: PASSED

All 6 created files verified on disk. Both commit hashes (41ec507, d04b48e) confirmed in git log.
