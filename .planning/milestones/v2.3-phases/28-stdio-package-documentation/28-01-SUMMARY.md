---
phase: 28-stdio-package-documentation
plan: "01"
subsystem: mcp-cli, docs
tags: [mcp, stdio, npm-package, documentation]
dependency_graph:
  requires: [src/lib/mcp/tools.ts, src/app/api/[transport]/route.ts]
  provides: [packages/mcp-cli, docs/MCP-GUIDE.md verified]
  affects: [developer-experience, mcp-clients]
tech_stack:
  added: [mcp-remote]
  patterns: [stdio-bridge, env-var-config]
key_files:
  created:
    - packages/mcp-cli/package.json
    - packages/mcp-cli/bin/cli.js
    - packages/mcp-cli/src/index.ts
    - packages/mcp-cli/tsconfig.json
  modified:
    - docs/MCP-GUIDE.md
decisions:
  - Plain JS bin/cli.js with zero-build approach (no tsup/esbuild needed)
  - mcp-remote spawned via npx -y for auto-install
  - API key passed via --header flag, never logged (T-28-01)
metrics:
  duration: 88s
  completed: 2026-04-08
  tasks: 2
  files: 5
---

# Phase 28 Plan 01: Stdio Package & Documentation Summary

viralslidemaker-mcp npm package with zero-build CLI that spawns mcp-remote for local AI agent stdio transport, plus MCP-GUIDE.md verified against actual tool implementations.

## Task Results

### Task 1: Create viralslidemaker-mcp stdio npm package
**Commit:** fa60503
**Files:** packages/mcp-cli/package.json, packages/mcp-cli/bin/cli.js, packages/mcp-cli/src/index.ts, packages/mcp-cli/tsconfig.json

Created the complete npm package structure:
- package.json with name=viralslidemaker-mcp, bin entry pointing to bin/cli.js, mcp-remote dependency
- bin/cli.js: shebang entry point that reads VIRALSLIDEMAKER_API_KEY from env, spawns mcp-remote with Bearer auth header, forwards stdio and signals
- src/index.ts: TypeScript reference source documenting the same logic
- tsconfig.json: minimal config for documentation (not used for build)
- Verified: exits with clear error when API key not set

### Task 2: Verify and fix MCP-GUIDE.md against actual implementation
**Commit:** 5b43401
**Files:** docs/MCP-GUIDE.md

Fixed 4 discrepancies between guide and actual tools.ts implementation:
1. Download URL format: changed from `/api/v1/projects/X/download/0` to `/api/render?projectId=X&slide=N&download`
2. Added `creditsRemaining` to create_carousel response documentation and example JSON
3. Fixed edit_slide return format from "Updated slide object" to `{ slide, slideIndex }`
4. Corrected credits section: balance returned in create_carousel response body, not HTTP headers

Verified all tool parameter tables match Zod schemas. Config examples are syntactically valid JSON.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
