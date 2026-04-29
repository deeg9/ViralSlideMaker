---
phase: 42
fixed_at: 2026-04-28
review_path: .planning/phases/42-distribution-documentation/42-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 42: Code Review Fix Report

**Fixed at:** 2026-04-28
**Source review:** `.planning/phases/42-distribution-documentation/42-REVIEW.md`
**Iteration:** 1
**Mode:** --auto (fix scope: WR-* required, NT-* trivial-only)

**Summary:**
- Findings in scope: 6 (2 warnings + 4 nits)
- Fixed: 5 (WR-01, WR-02, NT-02, NT-03, NT-04)
- Skipped: 1 (NT-01 — non-trivial behavioral change, out of "trivial nits" scope)

## Fixed Issues

### WR-01: `src/index.ts` reference source has stale error-message URL

**Files modified:** `packages/mcp-cli/src/index.ts`
**Commit:** `e543e1b`
**Applied fix:** Replaced the missing-key error string in the TypeScript reference source so it now reads `Get your API key at https://viralslidemaker.com/settings/api-keys` — exactly matching the executable at `bin/cli.js:21`. Chose the resync option over dropping `src/` from `package.json` files because the file is explicitly documented as a TS reference for the bin entry-point and removing it would lose that documentation value. Drift surface eliminated.

### WR-02: `verify.sh` lacks `set -e` / `set -o pipefail`

**Files modified:** `packages/mcp-cli/scripts/verify.sh`
**Commit:** `7cc5360`
**Applied fix:** Added `set -eo pipefail` on a new line above the existing `set -u`, hardening the harness against environmental breakage (REPO_ROOT resolution failure, broken cd, pipeline mid-failure). Per-check failures continue to be swallowed correctly because `bash -c "$cmd"` runs inside an `if` conditional — `set -e` does not trip on commands inside conditionals. Verified by re-running the harness: 16/16 checks PASS, exit 0.

### NT-02: `cleanup` listeners can fire twice on fast double-signal

**Files modified:** `packages/mcp-cli/bin/cli.js`
**Commit:** `da5297b`
**Applied fix:** Switched both signal forwarders from `process.on(...)` to `process.once(...)` so a double SIGINT or SIGTERM (common during force-quit) attaches each handler only once. Behavior identical for normal-shutdown paths; cleaner listener bookkeeping under repeated invocation. node --check passed.

### NT-03: MCP-GUIDE.md troubleshooting row vague about transport flag

**Files modified:** `docs/MCP-GUIDE.md`
**Commit:** `521d1b2`
**Applied fix:** Replaced the vague "pin it explicitly" troubleshooting text in the SSE-error row with the concrete recipe: add `"--transport", "http-only"` (or `"sse-only"`) to the `args` array after `"viralslidemaker-mcp"`. Now copy-pasteable for users hitting the failure mode.

### NT-04: README "Notes" bullet about `npm install -g mcp-remote` was misleading

**Files modified:** `packages/mcp-cli/README.md`
**Commit:** `6f3dcbd`
**Applied fix:** Reworded the bullet to describe the actual mechanism (npx prefers globally-installed packages over re-resolving on cold caches) instead of the misleading "skip the npx auto-install" framing — the bridge always invokes `npx -y mcp-remote`, the global install just changes where npx finds it.

## Skipped Issues

### NT-01: Bridge maps signal exits to `exit(1)` instead of `exit(128 + N)`

**File:** `packages/mcp-cli/bin/cli.js:40-45`
**Reason:** Out of scope for `--auto` mode's "trivial nits only" filter. The fix is a behavioral change (introduces a signal-name → number lookup table and changes the exit code MCP clients see for signal-killed bridges), not a typo or one-character polish. REVIEW.md explicitly marks it as `**Fix (optional):**` and notes that "MCP clients generally do not care, so this is style-level." Defer to a future polish pass if the maintainer decides shell-pipeline / supervisor friendliness is worth the behavior change.
**Original issue:** When `mcp-remote` exits via signal, the bridge maps every signal to `exit(1)` instead of the POSIX-conventional `exit(128 + signal_number)`.

---

## Post-fix verification gates

All three gates green:

1. **`bash packages/mcp-cli/scripts/verify.sh`** → 16/16 PASS, exit 0 (re-run after WR-02 hardening to confirm stricter mode does not break any of the 16 acceptance checks).
2. **`npx vitest run src/__tests__/mcp/`** → 23/23 tests PASS across 9 files in 678 ms (Phase 40 + 41 MCP regression suite untouched).
3. **`npm run build`** → Compiled successfully in 4.1s; 37/37 static pages generated; no errors.

**`npm publish` was NOT run** — packaging/distribution remains a manual step gated on this fix-pass landing. Only `npm run build` (the Next.js app build) was executed, which has no relationship to publishing the `viralslidemaker-mcp` package to the npm registry.

## Commits (chronological)

```
e543e1b fix(42): WR-01 sync src/index.ts missing-key URL with bin/cli.js
7cc5360 fix(42): WR-02 add set -eo pipefail to verify.sh harness
da5297b fix(42): NT-02 use process.once for SIGINT/SIGTERM forwarders
521d1b2 fix(42): NT-03 give exact transport-flag escape hatch in troubleshooting
6f3dcbd fix(42): NT-04 rephrase README global-install bullet to be accurate
```

---

_Fixed: 2026-04-28_
_Fixer: Claude (gsd-code-fixer, Opus 4.7 1M)_
_Iteration: 1_
