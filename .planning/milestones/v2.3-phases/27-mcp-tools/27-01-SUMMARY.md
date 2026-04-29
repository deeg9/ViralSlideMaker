---
phase: 27-mcp-tools
plan: "01"
subsystem: mcp
tags: [mcp, tools, api, carousel]
dependency_graph:
  requires: [26-01]
  provides: [mcp-tools]
  affects: [mcp-endpoint]
tech_stack:
  added: []
  patterns: [mcp-tool-registration, credit-gated-tools, admin-supabase-client]
key_files:
  created:
    - src/lib/mcp/tools.ts
  modified:
    - src/app/api/[transport]/route.ts
decisions:
  - Used server.tool() API (deprecated but stable, matches mcp-handler examples)
  - Download URLs are relative paths (no origin prefix) for same-host MCP clients
  - Admin Supabase client per tool call for stateless execution
metrics:
  duration: ~4min
  completed: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 27 Plan 01: MCP Tool Definitions Summary

4 outcome-oriented MCP tools registered on the Phase 26 MCP server enabling full carousel workflow: discover templates, create carousel (credit-gated), edit slides with Pexels search, and get download URLs.

## What Was Done

### Task 1: Create MCP tool definitions module
- Created `src/lib/mcp/tools.ts` with `registerTools(server)` function
- **list_templates**: Returns template id, name, textPosition, textAlign (no credit cost)
- **create_carousel**: Credit balance check + deduction before generation, returns projectId + downloadUrls + zipUrl + creditsRemaining
- **edit_slide**: Supports hookText, bodyText, imageQuery (Pexels search), backgroundUrl (HTTPS-only) modifications
- **render_carousel**: Returns fresh download URLs for all slides in a project
- All tools enforce auth via `authInfo.extra.userId` from Bearer token
- Generic error codes (NOT_FOUND, GENERATION_FAILED, etc.) without stack traces

### Task 2: Register tools on MCP server route
- Updated `src/app/api/[transport]/route.ts` to import and call `registerTools(server)`
- Removed Phase 27 placeholder comments
- Preserved all existing config: maxDuration=60, basePath='/api', withMcpAuth, GET/POST/DELETE exports

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-27-01 Spoofing | userId extracted from authInfo.extra.userId, never accepted as tool parameter |
| T-27-02 Tampering | backgroundUrl validated for https:// scheme before storing |
| T-27-03 Info Disclosure | Generic error codes returned, no stack traces or DB details |
| T-27-04 DoS/Credit Bypass | Balance check + deductCreditAdmin double-gate before generation |
| T-27-05 Cross-user Access | All getProject/updateProjectService calls scoped by userId |
| T-27-06 Bounds Tampering | slideIndex validated against slide_data.length, zod enforces int().min(0) |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- 4 tool registrations confirmed via `grep -c "server.tool" src/lib/mcp/tools.ts`
- registerTools import and call confirmed in route.ts
- deductCreditAdmin present in create_carousel
- searchPhotos present in edit_slide
- TypeScript compiles cleanly (no errors in project files)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b18683a | feat(27-01): create MCP tool definitions module |
| 2 | 7dc0294 | feat(27-01): register MCP tools on server route |

## Self-Check: PASSED
