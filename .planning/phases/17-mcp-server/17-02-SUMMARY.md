---
phase: 17-mcp-server
plan: 02
name: Stdio MCP Server Entry Point
subsystem: mcp/stdio
tags: [mcp, stdio, npm-package, http-client]
dependency_graph:
  requires: [17-01]
  provides: [stdio-mcp-server, npm-bin-entry]
  affects: [package.json]
tech_stack:
  added: [tsup]
  patterns: [stdio-transport, http-client-wrapper, env-var-auth]
key_files:
  created:
    - src/mcp/http-client.ts
    - src/mcp/stdio-server.ts
    - src/mcp/index.ts
    - tsconfig.mcp.json
    - src/__tests__/mcp/stdio.test.ts
  modified:
    - package.json
decisions:
  - "HTTP client wrapper pattern instead of direct service imports -- npm package needs only API key + base URL, no DB credentials"
  - "tsup for MCP package bundling -- handles path aliases and produces standalone ESM output"
  - "Env var auth (VIRALSLIDEMAKER_API_KEY) instead of interactive auth flow -- standard for MCP stdio servers"
metrics:
  duration: 2min
  completed: "2026-04-06"
  tasks_completed: 1
  tasks_total: 1
  files_created: 5
  files_modified: 1
  tests_added: 10
  tests_passing: 10
---

# Phase 17 Plan 02: Stdio MCP Server Entry Point Summary

Standalone npm-publishable stdio MCP server that wraps REST API via fetch-based HTTP client, enabling local AI agents (Claude Code, Cursor) to run as subprocess with env var auth.

## What Was Built

### Task 1: Stdio MCP Server with HTTP Client and Build Config

- **`src/mcp/http-client.ts`**: Fetch-based wrapper for 4 REST API endpoints (createCarousel, listTemplates, editSlide, renderCarousel). Reads API key and base URL from env vars. Masks API keys in error messages (T-17-07). Throws on missing API key (T-17-08).

- **`src/mcp/stdio-server.ts`**: Creates McpServer with StdioServerTransport, registers same 4 tools as the Streamable HTTP server (list_templates, create_carousel, edit_slide, render_carousel). Validates API key at startup, logs to stderr only. Uses http-client functions instead of direct service imports.

- **`src/mcp/index.ts`**: Shebang entry point (`#!/usr/bin/env node`) that calls startStdioServer(). Includes usage docs for Claude Code/Cursor MCP config JSON.

- **`tsconfig.mcp.json`**: Standalone TypeScript config targeting ES2022/NodeNext for non-Next.js compilation. Only includes `src/mcp/**/*.ts`.

- **`package.json`**: Added `bin.viralslidemaker-mcp` pointing to `dist/mcp/index.js`, `build:mcp` script using tsup, installed tsup as devDependency.

- **`src/__tests__/mcp/stdio.test.ts`**: 10 tests covering HTTP client request construction (URLs, methods, headers, body mapping), auth header injection, camelCase-to-snake_case field mapping, error handling with API key masking, base URL trailing slash handling, and default value behavior.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 94eec2a | Create standalone stdio MCP server with HTTP client |

## Decisions Made

1. **HTTP client wrapper over direct service imports**: The stdio server calls the deployed REST API via fetch instead of importing service layer code directly. This means the npm package needs only an API key and base URL -- zero Supabase/DB credentials. Clean separation.

2. **tsup for bundling**: Handles Next.js path alias resolution and produces standalone ESM output suitable for npm publishing.

3. **Env var auth at startup**: Standard pattern for MCP stdio servers. API key is validated once when the server starts, before any tools are registered.

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Surface Verification

- T-17-07 (Information Disclosure): All server logging goes to stderr; API keys are masked with `vsl_***` in error messages; keys never appear in tool response text.
- T-17-08 (Spoofing/Missing key): Server exits immediately with descriptive error if VIRALSLIDEMAKER_API_KEY is not set.
- T-17-09 (DoS): Accepted risk -- rate limiting enforced server-side by REST API.

## Known Stubs

None -- all 4 tools are fully wired to HTTP client which calls the REST API.

## Self-Check: PASSED

All 5 created files verified on disk. Commit hash 94eec2a confirmed in git log. 10/10 tests passing. Zero TypeScript errors.
