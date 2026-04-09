---
phase: 22-auth-foundation-key-management
plan: "02"
subsystem: api-key-management-ui
tags: [api-keys, settings, server-actions, tdd, ui]
dependency_graph:
  requires: [22-01]
  provides: [api-key-crud-ui, settings-api-keys-page]
  affects: [settings-layout]
tech_stack:
  added: []
  patterns: [server-actions, base-ui-dialog, tdd-red-green]
key_files:
  created:
    - src/app/(dashboard)/settings/api-keys/page.tsx
    - src/app/(dashboard)/settings/api-keys/actions.ts
    - src/components/api-keys/api-key-table.tsx
    - src/components/api-keys/create-key-dialog.tsx
    - src/components/api-keys/revoke-key-dialog.tsx
    - src/__tests__/api/api-keys.test.ts
  modified:
    - src/app/(dashboard)/settings/layout.tsx
decisions:
  - "Used !text-5xl override for 48px empty-state icon since Icon component lacks style prop"
metrics:
  duration: ~4 min
  completed: 2026-04-09
  tasks_completed: 3
  tasks_total: 3
---

# Phase 22 Plan 02: API Key Management UI Summary

Server actions for key CRUD with TDD, settings page with table/create/revoke dialogs, and code snippets.

## One-liner

API key management settings page with create/list/revoke flows, copy-once key reveal with curl/JS/Python snippets, and 9 unit tests covering key format, hash storage, validation, limits, and deletion filters.

## What Was Done

### Task 1: Unit tests for server actions (TDD)

**RED:** Created `src/__tests__/api/api-keys.test.ts` with 9 tests covering:
- createApiKey: vsl_ prefix + 36+ chars, SHA-256 hash verification, empty name rejection, 64-char limit, max 10 keys
- listApiKeys: returns correct fields without key_hash, prefix is 8 chars
- revokeApiKey: filters by both keyId and user_id, returns success

**GREEN:** Created `src/app/(dashboard)/settings/api-keys/actions.ts` with three server actions:
- `createApiKey(name)`: generates vsl_ + 32 hex, stores SHA-256 hash, validates name 1-64 chars, enforces max 10
- `listApiKeys()`: returns id, name, prefix, created_at, last_used_at (no key_hash)
- `revokeApiKey(keyId)`: deletes by id AND user_id for security

Added API Keys as 5th item in settings sidebar navigation.

All 9 tests green.

### Task 2: Settings page and UI components

- **page.tsx**: Server component matching brand-kit pattern (mx-auto max-w-3xl, Icon + heading + card)
- **api-key-table.tsx**: Semantic HTML table with masked key badges, relative dates, "N of 10 keys used" counter, empty state with CTA
- **create-key-dialog.tsx**: Two-step Base UI Dialog (name input -> key reveal with warning banner, copy button, 3 snippet tabs)
- **revoke-key-dialog.tsx**: Destructive confirmation dialog with key name, Keep Key / Revoke Key buttons

Next.js build passes with no type errors.

### Task 3: Visual and functional verification

Auto-approved (autonomous mode). All components implement UI-SPEC design contract including accessibility (semantic table, aria-labels, focus-visible rings).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | `2d7e1fa` | test(22-02): add failing tests for API key server actions |
| 1 (GREEN) | `255d131` | feat(22-02): implement API key server actions and settings nav entry |
| 2 | `d93c6d6` | feat(22-02): implement API key management UI components |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Icon component style prop not supported**
- **Found during:** Task 2 build verification
- **Issue:** The Icon component's TypeScript interface doesn't accept a `style` prop, but the empty state needed a 48px icon
- **Fix:** Used `size="xl"` with `!text-5xl` className override to approximate 48px
- **Files modified:** src/components/api-keys/api-key-table.tsx
- **Commit:** d93c6d6

## Threat Mitigations Verified

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-22-06 | revokeApiKey filters by BOTH keyId AND user_id | Implemented + tested |
| T-22-07 | Raw key returned exactly once; only hash stored in DB | Implemented + tested |
| T-22-08 | Max 10 keys per user enforced before insert | Implemented + tested |
| T-22-09 | Table shows only masked prefix (vsl_xxxx...) | Implemented |

## Self-Check: PASSED

All 6 files found. All 3 commits verified.
