---
phase: 42
status: findings_present
reviewed: 2026-04-28
critical_count: 0
warning_count: 2
nit_count: 4
---

# Phase 42: Code Review Report

**Reviewed:** 2026-04-28
**Depth:** standard (lightweight, scoped to phase 42 commits)
**Files Reviewed:** 6
**Status:** findings_present (no critical issues; 2 warnings, 4 nits)

## Summary

Phase 42 delivers the v2.6 MCP distribution layer: a 53-line Node bridge (`packages/mcp-cli/bin/cli.js`), a 153-line per-client setup guide (`docs/MCP-GUIDE.md`), a 4th `<GuideCard>` cross-link on `/settings/api-keys`, and a 16-check `verify.sh` harness. Bridge security is sound modulo the documented-and-accepted T-42-01 argv exposure: no shell-string interpolation (env vars flow through Node's `spawn` argv array, not a shell), no eval, no untrusted-input parsing, and the API key is forwarded only to `mcp-remote` over stdio. Setup guide content is accurate against research findings (Claude Desktop / Cursor / Windsurf snippets all use the canonical `mcpServers` shape; ChatGPT section gates correctly on workspace tier + Developer Mode). README's GitHub URL matches the in-app `MCP_GUIDE_URL` constant. The `GuideCardProps` extension (`linkLabel?` + `linkHref?`) is purely additive — both new fields are optional, `<GuideCard>` destructures with sensible defaults, and the JSX uses a guard (`linkHref && linkLabel ? ... : null`) so the existing 3 cards render unchanged. SUMMARY.md and the `npm publish --dry-run` snippet contain no real credentials — only the documented `vsl_YOUR_KEY` placeholder. No `.npmrc` files anywhere in the repo.

Findings below are quality-of-publish-artifact issues, not correctness bugs.

## Warnings

### WR-01: `src/index.ts` reference source has stale error-message URL (drift from `bin/cli.js`)

**File:** `packages/mcp-cli/src/index.ts:23`
**Issue:** `package.json` ships `src/` to the npm tarball (`"files": ["bin/", "src/", "README.md"]`), so `src/index.ts` will appear in the published package as a "TypeScript source reference for the bin/cli.js entry point." The reference's missing-key error string still reads:

```
'Get your API key at https://viralslidemaker.com → Account Settings → API Keys\n'
```

…while the actual executable (`bin/cli.js:21`) was tightened in commit `ba0c5cc` to:

```
'Get your API key at https://viralslidemaker.com/settings/api-keys\n'
```

A user reading the published source will see two different "where to get a key" instructions, one of which (`Account Settings → API Keys`) does not match the current site IA — this contradicts the accept-criteria for T-42-03 ("all key-acquisition pointers go to /settings/api-keys").

**Fix:** Either resync `src/index.ts:21-24` to mirror `bin/cli.js:19-22` exactly, or drop `"src/"` from `package.json`'s `files` array (cleanest — the executable is `bin/cli.js`; the TS reference source has no runtime role and only adds drift surface). Suggested fix:

```diff
   "files": [
     "bin/",
-    "src/",
     "README.md"
   ],
```

If you keep `src/`, then in `src/index.ts:21-24`:

```diff
   process.stderr.write(
     'Error: VIRALSLIDEMAKER_API_KEY environment variable is not set.\n' +
-      'Get your API key at https://viralslidemaker.com → Account Settings → API Keys\n'
+      'Get your API key at https://viralslidemaker.com/settings/api-keys\n'
   )
```

### WR-02: `verify.sh` lacks `set -e` and a `set -o pipefail`-equivalent — silent exec-call failures

**File:** `packages/mcp-cli/scripts/verify.sh:13`
**Issue:** The script sets only `set -u` (nounset). Each `check` invocation runs `bash -c "$cmd"` and inspects its exit status, so the 16 acceptance checks themselves do fail-fast individually. But the bookkeeping arithmetic (`PASS_COUNT=$((...))`, `FAIL_COUNT=$((...))`, the `[ "$FAIL_COUNT" -eq 0 ]` summary check) and the `cd "$REPO_ROOT"` at line 16 will silently continue on failure — e.g. if the `cd` ever fails (broken symlink, permission), every subsequent `check` will run from the wrong cwd and report misleading FAILs (or, worse, accidental PASSes if a sibling repo happens to have matching files). The header says "Exits non-zero on any failure" — strictly true for the 16 checks via the manual `FAIL_COUNT` accounting, but not for harness-internal failures.

**Fix:** Add `set -eo pipefail` alongside `set -u`, but split the `check` function so per-check failures don't trip the harness exit (since failure-counting is the whole point):

```diff
-set -u
+set -uo pipefail
+
+REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)" || {
+  echo "FATAL: cannot resolve REPO_ROOT" >&2; exit 2;
+}
+cd "$REPO_ROOT" || { echo "FATAL: cd $REPO_ROOT failed" >&2; exit 2; }
```

Leave `check` itself as-is — the `if bash -c "$cmd"` already swallows per-check failures intentionally. This change only hardens the *harness* against environmental breakage, which is the actual gap.

**Severity rationale:** Warning, not critical, because in normal local/CI invocation the script does work (and SUMMARY.md shows 16/16 PASS). The risk surfaces only on path-relative misconfig.

## Nits

### NT-01: Bridge silently drops the child exit code on signal exit

**File:** `packages/mcp-cli/bin/cli.js:40-45`
**Issue:** When `mcp-remote` exits via signal (e.g. `SIGTERM` from a stopping client), the bridge maps every signal to `exit(1)`. POSIX convention is `exit(128 + signal_number)`, which lets the parent (the MCP client) distinguish "killed by SIGTERM" (143) from "actually crashed" (1). MCP clients generally do not care, so this is style-level — but it would make the bridge play more nicely with shell pipelines and supervisors.

**Fix (optional):**

```diff
 child.on('exit', (code, signal) => {
   if (signal) {
-    process.exit(1)
+    // Map signal exits to the conventional 128 + N when possible
+    const signalNumbers = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15, SIGKILL: 9 }
+    process.exit(128 + (signalNumbers[signal] ?? 0))
   }
   process.exit(code ?? 0)
 })
```

### NT-02: `cleanup` is declared but never returns, and the listeners can fire twice in fast-shutdown paths

**File:** `packages/mcp-cli/bin/cli.js:48-53`
**Issue:** Forwarding SIGINT/SIGTERM to the child is correct, but no `once` semantics — if a client sends SIGTERM twice in quick succession (common during force-quit), `cleanup` runs twice, which is harmless here (the second `child.kill` is a no-op) but accumulates listener counts under repeated invocations. This is sub-bug-level; flagging because the file is small and easily polished.

**Fix (optional):**

```diff
-process.on('SIGINT', () => cleanup('SIGINT'))
-process.on('SIGTERM', () => cleanup('SIGTERM'))
+process.once('SIGINT', () => cleanup('SIGINT'))
+process.once('SIGTERM', () => cleanup('SIGTERM'))
```

### NT-03: MCP-GUIDE.md troubleshooting row references a `mcp-remote` flag that may not exist

**File:** `docs/MCP-GUIDE.md:153`
**Issue:** The `EventSource` / `SSE` row says "Default is `--transport http-first` — no change needed; if broken, pin it explicitly." `mcp-remote@^0.1.38` does have transport-selection flags, but the canonical flag name in current releases is `--transport` with values like `http-only` / `sse-only` / `http-first` (per `mcp-remote --help`). The text doesn't *show* the user what to type ("pin it explicitly" leaves the literal flag string ambiguous). For a guide users will copy-paste from, give them the exact escape hatch.

**Fix:**

```diff
-| `EventSource` / `SSE` errors in mcp-remote logs                  | Wrong transport selected by older client                  | Default is `--transport http-first` — no change needed; if broken, pin it explicitly.     |
+| `EventSource` / `SSE` errors in mcp-remote logs                  | Wrong transport selected by older client                  | Add `"--transport", "http-only"` (or `"sse-only"`) to the `args` array after `"viralslidemaker-mcp"`. |
```

### NT-04: README "Notes" bullet about `npm install -g mcp-remote` is misleading

**File:** `packages/mcp-cli/README.md:30`
**Issue:** "Advanced users can `npm install -g mcp-remote` to skip the npx auto-install on each invocation." — but the bridge still calls `npx -y mcp-remote ...` from `cli.js:30-31`, not the global binary. `npx` *will* prefer a globally-installed package over re-installing, so the claim is technically true but only because of npx's lookup order, which the user has no way to verify. A more honest note would mention `--prefer-offline` or `--no-install` semantics, or just drop the bullet.

**Fix (optional):** Either remove the bullet or rephrase to:

```diff
-- Advanced users can `npm install -g mcp-remote` to skip the npx auto-install on each invocation.
+- Tip: pre-install `mcp-remote` globally (`npm install -g mcp-remote`) so `npx` picks it up from the global prefix instead of re-resolving on cold caches.
```

---

## Verified — No Issues Found

The following specific concerns from the review prompt were checked and found clean:

- **Shell-injection via env vars (concern 1):** `cli.js:29-33` uses `spawn('npx', [array], { stdio: 'inherit' })` — no shell, no string interpolation into a command line; `apiKey` and `baseUrl` flow through the Node argv array, which `spawn` passes directly to `execvp`. The only documented exposure is argv (T-42-01), already accepted.
- **Credentials hygiene (concern 2):** `grep` for `vsl_[A-Za-z0-9]{16,}`, `sk-[A-Za-z0-9]{16,}`, and `ghp_[A-Za-z0-9]{16,}` across the entire phase-42 surface (`packages/mcp-cli/`, `docs/MCP-GUIDE.md`, `42-01-SUMMARY.md`) returns zero hits — only the placeholder string `vsl_YOUR_KEY`. No `.npmrc` files exist anywhere in the repo (`find . -name .npmrc` is empty).
- **Setup-guide accuracy (concern 3):** Claude Desktop / Cursor / Windsurf snippets (`MCP-GUIDE.md:38-49, 62-73, 89-101`) all use `command: "npx"`, `args: ["-y", "viralslidemaker-mcp"]`, and the canonical `mcpServers` map shape. ChatGPT section (`MCP-GUIDE.md:107`) leads with a blockquote: "Requires a paid ChatGPT workspace tier (Pro|Plus|Business|Enterprise|Edu) AND Developer Mode" — workspace-tier and Developer-Mode gates both present and ordered first.
- **GitHub URL consistency (concern 3):** `README.md:18` → `https://github.com/deeg9/ViralSlideMaker/blob/main/docs/MCP-GUIDE.md`; `automation-guide.tsx:34` → identical. Match.
- **TypeScript safety of GuideCardProps extension (concern 4):** Both new fields (`linkLabel?: string`, `linkHref?: string`) are optional; `<GuideCard>` destructures them with no defaults, and the JSX guards on `linkHref && linkLabel` (`automation-guide.tsx:86`) so the existing 3 cards (which omit both props) render exactly as before. `GuideCard` is not exported and is used only inside `automation-guide.tsx` — confirmed via repo-wide grep, zero external callers.
- **Markdown formatting (concern 6):** 10 fence markers in MCP-GUIDE.md = 5 balanced pairs. Tables on lines 7-12 and 146-153 have matching column counts in header / divider / body rows.

---

_Reviewed: 2026-04-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
