# Phase 42: Distribution & Documentation - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss; lean v2.6 scope locked by approved plan)

<domain>
## Phase Boundary

Ship the distribution and documentation layer that gets a user from "I have a vsl_ key" to "Claude Desktop / Cursor / Windsurf / ChatGPT is calling my tools". Three deliverables:
1. `viralslidemaker-mcp` npm package — zero-build stdio bridge wrapping `mcp-remote` against `https://viralslidemaker.com/api/mcp`
2. MCP setup guide (under `/docs` Scalar page or new `docs/MCP-GUIDE.md`) with copy-paste config snippets for Claude Desktop, Cursor, Windsurf, and ChatGPT custom-connector
3. Fourth card on the existing `/settings/api-keys` automation guide cross-linking to the MCP setup

**HARD PAUSE BEFORE NPM PUBLISH.** This phase does NOT run `npm publish` autonomously. The orchestrator stops after the bridge is built + tested + docs written, surfaces the publish step to the user with `npm whoami` confirmation, and lets the user run publish manually (or grant explicit permission).

</domain>

<decisions>
## Implementation Decisions

### Locked from v2.6 plan and REQUIREMENTS.md

- **Bridge package location:** `packages/mcp-cli/` already exists with `package.json` (name: `viralslidemaker-mcp`, version: `0.1.0`, bin: `./bin/cli.js`) and a TypeScript reference at `src/index.ts`. Phase 42 populates `bin/cli.js` (zero-build plain JS).
- **Bridge implementation:** spawn `npx -y mcp-remote https://viralslidemaker.com/api/mcp --header "Authorization:Bearer ${VIRALSLIDEMAKER_API_KEY}"` via `child_process.spawn` with stdio inherited. The TypeScript reference at `packages/mcp-cli/src/index.ts` already shows the intended pattern — port to plain JS.
- **Required env:** `VIRALSLIDEMAKER_API_KEY` (must be set; clear error message pointing to `/settings/api-keys` if missing).
- **Optional env override:** `VIRALSLIDEMAKER_BASE_URL` (defaults to `https://viralslidemaker.com`) for self-hosted / staging.
- **Setup guide:** prefer `docs/MCP-GUIDE.md` for now (markdown, browseable in repo). The `/docs` Scalar page is OpenAPI — adding MCP config snippets there would require Scalar customization. Start with markdown; if/when there's a separate `/docs/mcp` route worth building, that's a v2.7 nice-to-have.
- **Setup guide content:** install command + 4 client snippets (Claude Desktop `claude_desktop_config.json`, Cursor MCP server config, Windsurf, ChatGPT custom-connector). Each snippet uses `npx -y viralslidemaker-mcp` + the `VIRALSLIDEMAKER_API_KEY` env var.
- **Cross-link from API Keys page:** add a fourth card to the existing `src/components/api-keys/automation-guide.tsx` (added earlier this session). The card title is "Use as a native MCP server" and links to the setup guide.
- **npm publish step is GATED:** the executor agent does NOT run `npm publish`. Instead, after building and testing the package, it documents the exact publish command (`cd packages/mcp-cli && npm publish --access public`) in SUMMARY.md, runs a dry-run `npm publish --dry-run` to verify the package layout, and stops. The orchestrator surfaces this to the user.

### Claude's Discretion

- Setup guide structure (single page vs sections per client) — single page recommended for grep-ability
- Cross-link card icon (Material Symbols name) — `extension` or `electrical_services` are reasonable
- Whether to test the bridge end-to-end against the local dev server (recommended — start `npm run dev`, set env, run bridge, verify it proxies `tools/list`)
- Whether to update the existing `automation-guide.tsx` card descriptions to mention MCP exists now (yes — Card 1 mentions "or use the MCP server card below for tighter integration")

### Excluded (per REQUIREMENTS.md "Out of Scope" / Future)

- OAuth, dynamic client registration
- Anonymous tools
- ChatGPT remote MCP (vs custom-connector) — connector landscape evolves; document the most common path and link out for others
- npm publish automation — explicitly user-gated

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/mcp-cli/package.json` — already exists with correct metadata. Just needs `bin/cli.js` populated.
- `packages/mcp-cli/src/index.ts` — TypeScript reference for the bridge implementation. Port to plain JS in `bin/cli.js`.
- `src/components/api-keys/automation-guide.tsx` — three cards exist (Claude/ChatGPT prompt, Cursor IDE rules, curl). Phase 42 adds a fourth: "Use as native MCP server" linking to the setup guide.
- `src/app/(dashboard)/settings/api-keys/page.tsx` — renders `<AutomationGuide />`. No change needed unless the guide layout expands.
- Phase 40 + 41 deliverables — `/api/mcp` is live and serves 4 tools. Bridge connects to this endpoint.

### Established Patterns

- **Zero-build CLI package pattern:** `bin/cli.js` is plain JS, executed directly via shebang `#!/usr/bin/env node`. No tsc, no build step. The TS reference `src/index.ts` is documentation-only.
- **Existing docs page:** `/docs` route uses Scalar to render the OpenAPI spec from `src/lib/api/openapi.ts`. New MCP guide can be a sibling markdown file rather than another Scalar page.

### Integration Points

- Modified: `packages/mcp-cli/bin/cli.js` (NEW file, plain JS)
- Optional new: `packages/mcp-cli/README.md` (npm registry display)
- New: `docs/MCP-GUIDE.md` (or another agreed location)
- Modified: `src/components/api-keys/automation-guide.tsx` (add 4th card, optionally update Card 1 description)
- Possibly: a route at `src/app/docs/mcp/page.tsx` if we want it browseable in-app (low priority — markdown in repo is sufficient)

### Retired v2.3 Reference

- `.planning/phases/28-stdio-package-documentation/28-01-PLAN.md` — original distribution + docs plan. Most decisions carry forward; the 4-tool inventory in the docs is unchanged.

</code_context>

<specifics>
## Specific Ideas

- **The bridge package's main job is convenience, not logic.** It wraps `mcp-remote` (an existing well-maintained package) so users don't have to know about it. Keep `bin/cli.js` under 60 lines.
- **Setup guide MUST be copy-paste-able.** Each snippet should work verbatim once the user replaces `vsl_YOUR_KEY`. No "edit this and add that" — copy, paste, restart, done.
- **Verify against the live REST API on production smoke.** After local build + dry-run, the user should be able to install the package globally (`npm install -g viralslidemaker-mcp`), set the env var, configure Claude Desktop, and see all 4 tools in the picker against `https://viralslidemaker.com/api/mcp`. This is the v2.6 finish line.
- **Acknowledge `/api/render` browser-session limitation in the setup guide.** Phase 41 surfaced that download URLs require browser auth. Setup guide should mention "after `render_carousel` returns URLs, open them in your browser to download — they require your logged-in session".

</specifics>

<deferred>
## Deferred Ideas

- **`npm publish` automation** — explicitly user-gated for v2.6. v2.7+ could add a CI workflow that publishes on tag push.
- **In-app browseable MCP docs page** (`/docs/mcp`) — markdown in repo is sufficient for v2.6. Building a Scalar-style page is v2.7+.
- **Smithery / Cursor MCP directory submission** — discoverability work for v2.7+.
- **OAuth flow for the bridge** — static `vsl_` keys are sufficient. v2.8+ if user demand emerges.

</deferred>
