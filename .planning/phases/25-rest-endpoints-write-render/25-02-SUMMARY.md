---
phase: 25-rest-endpoints-write-render
plan: 02
subsystem: rest-api
tags: [api, render, download, zip, satori]
dependency_graph:
  requires: [with-api-auth, projects-service, render-slide-satori, load-font, templates, brand-kit]
  provides: [render-endpoint, download-endpoint]
  affects: [api-v1-routes]
tech_stack:
  added: []
  patterns: [satori-png-rendering, jszip-archive, content-disposition-sanitization]
key_files:
  created:
    - src/app/api/v1/projects/[id]/render/route.ts
    - src/app/api/v1/projects/[id]/download/route.ts
  modified: []
decisions:
  - Used existing /api/render endpoint URLs for per-slide download_url (reuse over duplication)
  - Sequential slide rendering in download endpoint to limit memory pressure
  - arraybuffer JSZip output type for NextResponse compatibility
metrics:
  duration: ~3 min
  completed: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 25 Plan 02: Render & Download Endpoints Summary

REST API render and download endpoints using Satori/ImageResponse pipeline with JSZip for ZIP archive generation.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | POST /render endpoint with download URLs | 534da22 | src/app/api/v1/projects/[id]/render/route.ts |
| 2 | GET /download endpoint returning ZIP | c9b0f58 | src/app/api/v1/projects/[id]/download/route.ts |

## What Was Built

### POST /api/v1/projects/{id}/render
- Returns JSON with per-slide download URLs and a zip_url
- Each slide entry has `index` and `download_url` pointing to existing `/api/render` endpoint
- `zip_url` points to the new `/api/v1/projects/{id}/download` endpoint
- Protected by `withApiAuth` (Bearer token, rate limiting, CORS)
- No credit deduction (informational endpoint)
- Returns 404 for missing project or empty slides

### GET /api/v1/projects/{id}/download
- Renders all slides server-side using Satori/ImageResponse (same pipeline as /api/render)
- Creates ZIP archive using JSZip with files named slide-01.png, slide-02.png, etc.
- Returns binary application/zip with Content-Disposition header
- Sanitizes project title in filename to prevent header injection (T-25-11 mitigation)
- Sequential rendering to avoid memory pressure on serverless
- Protected by `withApiAuth` (Bearer token, rate limiting, CORS)
- maxDuration=60 to handle multi-slide rendering within Vercel limits

## Decisions Made

1. **Reuse existing render endpoint for per-slide URLs** -- The POST /render endpoint returns download_url values pointing to the existing `/api/render?projectId=...&slide=...&download` endpoint rather than duplicating the rendering pipeline. This keeps the render endpoint lightweight (no actual rendering).

2. **Sequential slide rendering** -- Download endpoint renders slides one at a time in a for-loop rather than Promise.all to limit peak memory usage on serverless (each ImageResponse allocates a canvas).

3. **arraybuffer output for JSZip** -- Used `generateAsync({ type: 'arraybuffer' })` instead of `nodebuffer` or `uint8array` for TypeScript compatibility with NextResponse body parameter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript error with JSZip buffer type**
- **Found during:** Task 2 verification
- **Issue:** `nodebuffer` and `uint8array` JSZip output types not assignable to NextResponse body (TS2345)
- **Fix:** Changed to `arraybuffer` type which is compatible with NextResponse constructor
- **Files modified:** src/app/api/v1/projects/[id]/download/route.ts
- **Commit:** c9b0f58

## Verification Results

- TypeScript compiles (no new errors)
- POST export exists in render route
- GET export exists in download route
- JSZip used in download route
- ImageResponse used in download route

## Threat Model Compliance

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-25-07 (Spoofing) | mitigate | Done -- withApiAuth validates Bearer token on both endpoints |
| T-25-08 (Elevation) | mitigate | Done -- getProject filters by userId on both endpoints |
| T-25-09 (DoS) | mitigate | Done -- rate limiting via withApiAuth, sequential rendering, maxDuration=60 |
| T-25-10 (Info Disclosure) | accept | Accepted -- render URLs point to session-auth endpoint, documented |
| T-25-11 (Tampering) | mitigate | Done -- sanitizeFilename strips quotes and special chars from Content-Disposition |

## Self-Check: PASSED

- render/route.ts: FOUND
- download/route.ts: FOUND
- Commit 534da22: FOUND
- Commit c9b0f58: FOUND
