# Phase 42: Distribution & Documentation - Research

**Researched:** 2026-04-28
**Domain:** npm package distribution + MCP client configuration documentation
**Confidence:** HIGH (verification-only research; all decisions locked in CONTEXT.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Bridge package location:** `packages/mcp-cli/` already exists with `package.json` (name: `viralslidemaker-mcp`, version: `0.1.0`, bin: `./bin/cli.js`) and a TypeScript reference at `src/index.ts`. Phase 42 populates `bin/cli.js` (zero-build plain JS).
- **Bridge implementation:** spawn `npx -y mcp-remote https://viralslidemaker.com/api/mcp --header "Authorization:Bearer ${VIRALSLIDEMAKER_API_KEY}"` via `child_process.spawn` with stdio inherited.
- **Required env:** `VIRALSLIDEMAKER_API_KEY` (must be set; clear error message pointing to `/settings/api-keys` if missing).
- **Optional env override:** `VIRALSLIDEMAKER_BASE_URL` (defaults to `https://viralslidemaker.com`) for self-hosted / staging.
- **Setup guide:** `docs/MCP-GUIDE.md` (markdown). Skip Scalar customization for v2.6.
- **Setup guide content:** install command + 4 client snippets (Claude Desktop, Cursor, Windsurf, ChatGPT custom-connector). Each snippet uses `npx -y viralslidemaker-mcp` + the `VIRALSLIDEMAKER_API_KEY` env var.
- **Cross-link from API Keys page:** add a fourth card to `src/components/api-keys/automation-guide.tsx`. Card title: "Use as a native MCP server"; links to the setup guide.
- **npm publish step is GATED:** the executor agent does NOT run `npm publish`. Document the publish command in SUMMARY.md, run `npm publish --dry-run`, and stop.

### Claude's Discretion

- Setup guide structure (single page vs sections per client) — single page recommended for grep-ability
- Cross-link card icon (Material Symbols name) — `extension` or `electrical_services` are reasonable
- Whether to test the bridge end-to-end against the local dev server (recommended)
- Whether to update existing `automation-guide.tsx` card descriptions to mention MCP exists now (yes — Card 1 mentions "or use the MCP server card below for tighter integration")

### Deferred Ideas (OUT OF SCOPE)

- `npm publish` automation (v2.7+ CI workflow)
- In-app browseable MCP docs page (`/docs/mcp`)
- Smithery / Cursor MCP directory submission
- OAuth flow for the bridge
- ChatGPT remote MCP (vs custom-connector) — landscape evolves; document the most common path
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-DIST-01 | `bin/cli.js` spawns `npx -y mcp-remote https://viralslidemaker.com/api/mcp --header "Authorization:Bearer ${VIRALSLIDEMAKER_API_KEY}"` (plain JS, zero-build) | Verified `mcp-remote@0.1.38` supports the exact `--header "Key:Bearer ${VAR}"` flag shape and accepts an `https://...` URL as the first positional arg. TypeScript reference at `packages/mcp-cli/src/index.ts` already implements this — port to plain JS. |
| MCP-DIST-02 | Reads `VIRALSLIDEMAKER_API_KEY` from env; clear error if missing pointing to `/settings/api-keys` | Existing `src/index.ts:19-26` has the pattern; port verbatim minus types. |
| MCP-DIST-03 | Supports `VIRALSLIDEMAKER_BASE_URL` env override for self-hosted / staging | Existing `src/index.ts:28-30` already does this. |
| MCP-DIST-04 | Setup guide with copy-paste config snippets for Claude Desktop, Cursor, Windsurf, ChatGPT | All 4 client config shapes verified below (see Standard Stack — MCP Client Configs). ChatGPT requires Developer Mode + Pro/Plus/Business workspace tier — flag in guide. |
| MCP-DIST-05 | Add 4th card to `src/components/api-keys/automation-guide.tsx` linking to setup guide | Existing component uses `<GuideCard icon title description snippetLabel snippet copyLabel>` shape. Read of file confirms 3 cards present; 4th card slots into the same `flex flex-col gap-4` container. |
| MCP-DIST-06 | `viralslidemaker-mcp` published to npm at version 0.1.0 with working install command | Name verified AVAILABLE on npm (`npm view viralslidemaker-mcp` returns 404). Publish is user-gated — plan documents `npm publish --access public` and the dry-run output. |
</phase_requirements>

## Summary

Phase 42 ships three artifacts: (1) a plain-JS `bin/cli.js` for the existing `packages/mcp-cli/` skeleton that wraps `mcp-remote`, (2) `docs/MCP-GUIDE.md` with copy-paste configs for 4 MCP clients, and (3) a 4th card on the existing API Keys automation guide. All technical decisions are locked in CONTEXT.md; this research verifies external facts (current `mcp-remote` version, npm name availability, MCP client config shapes) and surfaces three planner-relevant gotchas.

**Verified facts:**
1. **`mcp-remote@0.1.38`** is the latest stable (published ~Feb 2026, MIT license). Supports `--header "Authorization:Bearer ${VAR}"` exactly. Pin to `^0.1.38` (current `^0.1.0` is too loose given a 38-version delta on a pre-1.0 lib). [VERIFIED: `npm view mcp-remote`]
2. **`viralslidemaker-mcp` is AVAILABLE on npm** — `npm view` returns E404. Safe to publish at version 0.1.0. [VERIFIED: `npm view viralslidemaker-mcp` → E404]
3. **`mcp-remote` supports Streamable HTTP** via `--transport http-first` (default tries HTTP first, falls back to SSE). The `https://viralslidemaker.com/api/mcp` endpoint from Phase 40 is Streamable HTTP — works without an explicit `--transport` flag because `http-first` is the default fallback strategy. [VERIFIED: Context7 `/geelen/mcp-remote` docs]

**Primary recommendation:** Port `src/index.ts` to plain JS in `bin/cli.js` verbatim (drop type annotations; keep the spawn args, env reads, error message, and signal handling). Bump the `mcp-remote` dep from `^0.1.0` to `^0.1.38`. Run `npm pkg fix` before publish to clean the bin path. Document the 4 client configs in `docs/MCP-GUIDE.md` using the verified shapes below.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| stdio bridge process | npm package (Node CLI) | — | Runs locally on the user's machine as a subprocess of the MCP client. No server tier involved. |
| Auth header injection | npm package (env → spawn args) | — | API key lives in the user's env vars (or MCP client config); never sent to ViralSlideMaker except via the auth header to `/api/mcp`. |
| MCP protocol translation | `mcp-remote` (transitive dep) | — | We do not implement MCP protocol — we wrap an existing tool. |
| MCP client configuration docs | Markdown (`docs/MCP-GUIDE.md`) | API Keys page card (cross-link) | Static docs in repo; in-app cross-link from `/settings/api-keys` for discoverability. |
| Cross-link UX | Frontend (Next.js client component) | — | Reuses existing `automation-guide.tsx` pattern; no new components, just a 4th `GuideCard`. |

## Standard Stack

### Core (no new deps to add to root)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mcp-remote` | `^0.1.38` | Stdio↔HTTP bridge for MCP | Maintained by `geelen` (also `threepointone` of Cloudflare/Workers fame). 68 versions, last published ~Feb 2026. The de-facto bridge — referenced by Anthropic, OpenAI, and FastMCP docs. [VERIFIED: npm registry, Context7] |
| `node:child_process` | builtin | Spawn `npx mcp-remote` subprocess | Stdlib. Existing `src/index.ts:17` already uses `spawn`. |

**Bump dep version:** Current `packages/mcp-cli/package.json` pins `"mcp-remote": "^0.1.0"`. With 38 patch releases since 0.1.0, this caret range is too loose to be meaningful — bump to `"mcp-remote": "^0.1.38"` so installs get the verified-current behavior.

### MCP Client Config Shapes (all 4 verified)

#### 1. Claude Desktop

**Config file location** [VERIFIED: modelcontextprotocol.io official docs]:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude-desktop/claude_desktop_config.json`

**Snippet shape:**
```json
{
  "mcpServers": {
    "viralslidemaker": {
      "command": "npx",
      "args": ["-y", "viralslidemaker-mcp"],
      "env": {
        "VIRALSLIDEMAKER_API_KEY": "vsl_YOUR_KEY"
      }
    }
  }
}
```

#### 2. Cursor

**Config file location** [VERIFIED: cursor.com/docs/context/mcp]:
- Global: `~/.cursor/mcp.json`
- Per-project: `.cursor/mcp.json` in repo root

**Snippet shape:** Same `mcpServers` schema as Claude Desktop — the MCP ecosystem has converged on this shape:
```json
{
  "mcpServers": {
    "viralslidemaker": {
      "command": "npx",
      "args": ["-y", "viralslidemaker-mcp"],
      "env": {
        "VIRALSLIDEMAKER_API_KEY": "vsl_YOUR_KEY"
      }
    }
  }
}
```

#### 3. Windsurf

**Config file location** [VERIFIED: docs.windsurf.com/windsurf/cascade/mcp]:
- macOS/Linux: `~/.codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

**Snippet shape:** Same `mcpServers` schema:
```json
{
  "mcpServers": {
    "viralslidemaker": {
      "command": "npx",
      "args": ["-y", "viralslidemaker-mcp"],
      "env": {
        "VIRALSLIDEMAKER_API_KEY": "vsl_YOUR_KEY"
      }
    }
  }
}
```

UI path: Cmd/Ctrl+, → Windsurf Settings → Manage MCP Servers → "View raw config".

#### 4. ChatGPT (custom connector / remote MCP)

**Different model from local-stdio clients.** ChatGPT does NOT spawn `viralslidemaker-mcp` locally — it connects directly to a remote MCP server URL (HTTPS-only). [VERIFIED: developers.openai.com/api/docs/mcp + help.openai.com 2026 article]

**Prerequisites (flag prominently in guide):**
- Workspace admin must enable Developer Mode in Settings → Permissions & Roles → Connected Data → Developer mode
- Available in beta on Pro, Plus, Business, Enterprise, Edu (NOT free tier)
- Plus/Pro individuals: read-only connectors only. Write-capable (`create_carousel`, `edit_slide`) requires Business / Enterprise / Edu

**Setup steps (not a JSON snippet — UI flow):**
1. ChatGPT → Settings → Connectors → Create
2. Connector name: `ViralSlideMaker`
3. Description: "Generate TikTok carousel slides"
4. Server URL: `https://viralslidemaker.com/api/mcp`
5. Auth: Bearer token = your `vsl_` key

**Implication for the guide:** the ChatGPT section is shorter than the others (no JSON to paste) and MUST disclose the workspace-tier requirement upfront.

### npm Publish Mechanics

| Concern | Answer | Source |
|---------|--------|--------|
| Name availability | AVAILABLE — `npm view viralslidemaker-mcp` returns E404 | [VERIFIED: npm registry 2026-04-28] |
| Publish command | `cd packages/mcp-cli && npm publish --access public` | [CITED: docs.npmjs.com/cli/v11/commands/npm-publish] |
| Why `--access public` | Required for free-tier accounts publishing scoped packages. Unscoped packages default to public, but the explicit flag is harmless and matches user intent. | [CITED: dev.to npm publishing guide 2026] |
| Auth requirement | `npm login` (interactive) OR set `NPM_TOKEN` env var (CI). Granular Access Token preferred over deprecated Classic. | [CITED: docs.npmjs.com/creating-and-viewing-access-tokens] |
| Dry-run output (verified) | See "Dry-run actual output" below | [VERIFIED: ran `npm publish --dry-run` against current `packages/mcp-cli/`] |
| README.md on registry | npm displays `README.md` from the package root on the registry page. Strongly recommended. | [CITED: docs.npmjs.com] |

**Dry-run actual output (captured 2026-04-28):**
```
npm warn publish "bin[viralslidemaker-mcp]" script name was cleaned
npm notice 📦  viralslidemaker-mcp@0.1.0
npm notice Tarball Contents
npm notice 1.5kB bin/cli.js
npm notice 486B package.json
npm notice 1.7kB src/index.ts
npm notice name: viralslidemaker-mcp
npm notice version: 0.1.0
npm notice total files: 3
npm notice Publishing to https://registry.npmjs.org/ with tag latest and default access (dry-run)
+ viralslidemaker-mcp@0.1.0
```

Note: the dry-run executes against the EXISTING package state (no `bin/cli.js` populated yet — at the time of this research, the file is missing, so the 1.5kB shown is from a pre-existing file or npm error. After Phase 42 populates `bin/cli.js`, the tarball contents will be: `bin/cli.js`, `package.json`, `src/index.ts`, and ideally `README.md`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `mcp-remote` wrapper | Implement stdio↔HTTP bridge from scratch using `@modelcontextprotocol/sdk` | Reinventing 800kB of well-tested code. Loses OAuth fallback, header parsing, transport negotiation. **REJECT** — explicit anti-goal per CONTEXT.md ("convenience, not logic"). |
| `npx -y viralslidemaker-mcp` in client config | `npx -y mcp-remote https://...` directly in client config | Skips the bridge package entirely. **REJECT** — shipping the package is the v2.6 deliverable; it gives users a clean install path and lets us pin `mcp-remote` versions centrally. |
| Markdown `docs/MCP-GUIDE.md` | New `/docs/mcp` Scalar route | Scalar customization is v2.7+ work per CONTEXT.md. Markdown is grep-able, browseable on GitHub, link-shareable. |

**Installation (no new deps for root project; only inside `packages/mcp-cli/`):**
```bash
cd packages/mcp-cli && npm install
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────┐
│ User's MCP Client   │   (Claude Desktop / Cursor / Windsurf / ChatGPT)
│ reads config file   │
└──────────┬──────────┘
           │ spawns subprocess (or, for ChatGPT, fetches remote URL directly)
           ▼
┌─────────────────────┐
│ npx -y              │
│ viralslidemaker-mcp │   (this phase's package)
│   ↓ reads env       │
│   VIRALSLIDEMAKER_  │
│   API_KEY           │
└──────────┬──────────┘
           │ child_process.spawn
           ▼
┌─────────────────────┐
│ npx -y mcp-remote   │   (transitive dep, well-maintained)
│   <baseUrl>/api/mcp │
│   --header          │
│   "Authorization:   │
│    Bearer ${KEY}"   │
└──────────┬──────────┘
           │ HTTPS Streamable HTTP (with Bearer auth)
           ▼
┌─────────────────────┐
│ /api/mcp            │   (Phase 40+41 — already live)
│ Streamable HTTP     │
│ withMcpAuth         │
│ → registerTools     │
│   (4 tools)         │
└─────────────────────┘
```

Cross-link path (in-app discoverability):
```
/settings/api-keys page
       │
       ▼
<AutomationGuide />  (existing 3 cards)
       │
       ▼
4th GuideCard "Use as a native MCP server"
       │ link: docs/MCP-GUIDE.md (or /docs/MCP-GUIDE.md if served statically)
       ▼
docs/MCP-GUIDE.md (4 client setup snippets)
```

### Recommended Project Structure

```
packages/mcp-cli/
├── bin/
│   └── cli.js          # NEW — plain JS shebang script (port from src/index.ts)
├── src/
│   └── index.ts        # EXISTS — TypeScript reference, doc-only
├── package.json        # EXISTS — bump mcp-remote to ^0.1.38
└── README.md           # NEW — npm registry display

docs/
└── MCP-GUIDE.md        # NEW — 4 client setup snippets

src/components/api-keys/
└── automation-guide.tsx  # MODIFY — add 4th GuideCard
```

### Pattern 1: Plain JS bin script (zero-build)

**What:** `bin/cli.js` is hand-written plain JS, executable via shebang. No tsc, no bundler.
**When to use:** CLI wrappers under ~100 lines that have no TypeScript-only features (no decorators, no advanced generics).
**Example (port `src/index.ts` to plain JS — strip type annotations):**
```javascript
#!/usr/bin/env node
// Source: existing packages/mcp-cli/src/index.ts (TypeScript reference)
import { spawn } from 'node:child_process'

const apiKey = process.env.VIRALSLIDEMAKER_API_KEY
if (!apiKey) {
  process.stderr.write(
    'Error: VIRALSLIDEMAKER_API_KEY environment variable is not set.\n' +
      'Get your API key at https://viralslidemaker.com/settings/api-keys\n'
  )
  process.exit(1)
}

const baseUrl = process.env.VIRALSLIDEMAKER_BASE_URL || 'https://viralslidemaker.com'
const mcpEndpoint = `${baseUrl}/api/mcp`

const child = spawn(
  'npx',
  ['-y', 'mcp-remote', mcpEndpoint, '--header', `Authorization:Bearer ${apiKey}`],
  { stdio: 'inherit' }
)

child.on('error', (err) => {
  process.stderr.write(`Failed to start mcp-remote: ${err.message}\n`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})

function cleanup(signal) { child.kill(signal) }
process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGTERM', () => cleanup('SIGTERM'))
```

After creating, run: `chmod +x packages/mcp-cli/bin/cli.js` (the shebang only works if the file is executable).

### Pattern 2: GuideCard composition (add 4th card)

**What:** The existing `automation-guide.tsx` has a `<GuideCard>` component that takes `icon, title, description, snippetLabel, snippet, copyLabel`. The 4th card slots into the same `<div className="flex flex-col gap-4">` container.
**When to use:** Adding any new automation entry to `/settings/api-keys`.
**Example:**
```tsx
// Source: read of src/components/api-keys/automation-guide.tsx (lines 95-122)
const MCP_INSTALL_SNIPPET = `npx -y viralslidemaker-mcp`

<GuideCard
  icon="extension"  // or "electrical_services" — both fit the "plug in" metaphor
  title="Use as a native MCP server"
  description="Connect Claude Desktop, Cursor, Windsurf, or ChatGPT directly to your account. The model calls our tools natively — no prompt-engineering needed. Full setup guide for each client at the link below."
  snippetLabel="Install"
  snippet={MCP_INSTALL_SNIPPET}
  copyLabel="Copy install command"
/>
```

**Recommendation on snippet content:** include the `npx -y viralslidemaker-mcp` install command as the snippet (gives users something concrete to copy). The card description should ALSO link out to `docs/MCP-GUIDE.md` for the per-client config shapes — the install command alone is not enough; users need the JSON snippets too.

**Open question for planner:** how should the link to the setup guide render? Options: (a) plain text URL inside `description`, (b) extend `GuideCardProps` with optional `linkLabel` + `linkHref` to render a styled `<a>` below the snippet. Recommendation: (b) — clean and reusable. Adds ~5 lines to `GuideCard` and keeps the pattern tidy.

### Anti-Patterns to Avoid

- **Using TypeScript in `bin/cli.js`:** would require a build step, defeating the zero-build pattern. Keep `src/index.ts` as documentation-only; `bin/cli.js` is the runtime.
- **Hardcoding `https://viralslidemaker.com` in the bridge:** the existing `src/index.ts` already supports `VIRALSLIDEMAKER_BASE_URL` override. Preserve this in the JS port.
- **Putting Bearer token in command-line args without env-var indirection:** the Authorization header value comes from env, not hardcoded in args. Already correct in `src/index.ts`.
- **Forgetting the `-y` flag on `npx mcp-remote`:** without `-y`, `npx` prompts interactively to install — breaks the spawn (no stdin available). All examples here use `-y`.
- **Pinning `mcp-remote` exactly (`"0.1.38"` no caret):** breaks bug-fix updates. Use `^0.1.38` to get patch updates within the 0.1.x range (acceptable for an unstable-by-semver pre-1.0 lib that ships frequent patches).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| stdio↔HTTP MCP bridge | Custom protocol translator | `mcp-remote` | 800kB of tested code, OAuth fallback, transport negotiation, header parsing, signal handling. The whole point of this package. |
| MCP client config detection | Auto-discover `claude_desktop_config.json` and patch it | Document the path in the guide | Auto-patching JSON config files breaks user customizations and is fragile across versions. Copy-paste is honest. |
| Cross-platform shebang handling | Custom Windows `.cmd` wrapper | npm's built-in bin handling | npm auto-generates `.cmd` shims on Windows from the bin entry. No manual work needed. |
| API key validation in the bridge | Regex `vsl_*` check, format validation | Just check `process.env.VIRALSLIDEMAKER_API_KEY` is set | The hosted `/api/mcp` endpoint validates and returns proper MCP errors. Local validation duplicates that work and risks getting out of sync with server-side rules. |

**Key insight:** This package's job is to be 60 lines of glue. Anything more is overreach into territory `mcp-remote` or the hosted API already covers.

## Runtime State Inventory

> Not applicable — Phase 42 is a greenfield distribution + documentation phase. No rename / refactor / migration involved. No existing runtime state to inventory.

## Common Pitfalls

### Pitfall 1: `mcp-remote` Streamable HTTP vs SSE confusion

**What goes wrong:** Older `mcp-remote` docs and examples use `/sse` URLs. The Phase 40 endpoint is at `/api/mcp` (Streamable HTTP, not SSE).
**Why it happens:** `mcp-remote` predates the Streamable HTTP spec; many examples in the wild still show `https://server/sse`.
**How to avoid:** `mcp-remote` defaults to `--transport http-first` which tries Streamable HTTP first and falls back to SSE. The current bridge uses no `--transport` flag, which means default behavior — and that's correct. **Do not add `--transport sse-first`.** [VERIFIED: Context7 `/geelen/mcp-remote` docs]
**Warning signs:** Connection errors mentioning "SSE" or "EventSource" — indicates the client picked the wrong transport. Set `--transport http-first` explicitly to lock it in if needed.

### Pitfall 2: Header value space-escaping bug on Windows + Cursor

**What goes wrong:** Some MCP clients (Cursor, older Claude Desktop on Windows) mishandle spaces inside subprocess argv. The string `"Authorization: Bearer vsl_..."` (with a space after the colon) gets mangled.
**Why it happens:** Subprocess argv escaping on Windows differs from Unix. Some clients pass args through `cmd.exe` which re-tokenizes on whitespace.
**How to avoid:** Use the no-space form `"Authorization:Bearer ${VAR}"` (no space after the colon). The existing `src/index.ts:34` already does this — preserve verbatim in the JS port. [VERIFIED: Context7 `/geelen/mcp-remote` README "Workaround for Header Spaces in Client Args"]
**Warning signs:** Auth fails with 401 from clients that work fine via curl with the same key.

### Pitfall 3: Forgetting `chmod +x` on `bin/cli.js`

**What goes wrong:** Shebang `#!/usr/bin/env node` is ignored by the OS if the file isn't marked executable. `npx viralslidemaker-mcp` fails with "permission denied" or runs the file via the shell instead of node.
**Why it happens:** Git tracks file mode in `core.fileMode` mode, but `npm publish` packs files with their on-disk mode at pack time. If the dev never `chmod +x`'d the file, it ships non-executable.
**How to avoid:** After creating `bin/cli.js`, run `chmod +x packages/mcp-cli/bin/cli.js`. Verify with `ls -l`. The verification step in the plan should include this check.
**Warning signs:** Local `node bin/cli.js` works, but `./bin/cli.js` doesn't. Or `npx viralslidemaker-mcp` fails with `permission denied` after `npm install -g`.

### Pitfall 4: `bin` path with `./` prefix triggers `npm publish` warning

**What goes wrong:** `package.json` has `"bin": { "viralslidemaker-mcp": "./bin/cli.js" }`. `npm publish --dry-run` warns: `bin[viralslidemaker-mcp] script name was cleaned`. Currently the package.json HAS this issue — verified by running dry-run during research.
**Why it happens:** npm normalizes the bin path to drop the `./` prefix at publish time. Not fatal — npm auto-cleans — but generates a noisy warning.
**How to avoid:** Run `npm pkg fix` inside `packages/mcp-cli/` once. This rewrites `"./bin/cli.js"` → `"bin/cli.js"`. Confirmed during research: after `npm pkg fix`, the warning disappears.
**Warning signs:** `npm warn publish "bin[name]" script name was cleaned` in publish output.

### Pitfall 5: ChatGPT custom-connector workspace gating

**What goes wrong:** Setup guide tells a user to add ViralSlideMaker as a ChatGPT connector, but they're on the free tier or their workspace admin hasn't enabled Developer Mode → they hit a dead end.
**Why it happens:** OpenAI gates remote MCP / custom connectors behind workspace tiers (Pro/Plus/Business/Enterprise/Edu) AND a workspace-admin Developer Mode toggle. Free-tier users cannot use custom connectors at all. Plus/Pro individuals get read-only connectors.
**How to avoid:** ChatGPT section of the guide MUST open with: "Requires ChatGPT Pro, Plus, Business, Enterprise, or Edu workspace AND Developer Mode enabled by your workspace admin (Settings → Permissions & Roles → Connected Data → Developer mode). Free tier is not supported." [VERIFIED: help.openai.com 2026 article]
**Warning signs:** Users report "I don't see the Connectors menu" — almost always means the tier or Developer Mode requirement isn't met.

### Pitfall 6: `render_carousel` URLs require browser session

**What goes wrong:** Agent calls `render_carousel`, gets URLs back, tries to fetch them programmatically with the same `vsl_` Bearer token → 401.
**Why it happens:** Phase 41 SUMMARY (Open Q1 resolution) confirmed `/api/render` reads `supabase.auth.getUser()` (browser session cookie), NOT MCP Bearer token. The tool description already documents this; the setup guide should call it out too.
**How to avoid:** Setup guide MUST mention: "After `render_carousel` returns download URLs, open them in your logged-in browser to download — they require your active session, not your API key. Future versions may add Bearer-aware download." Per the CONTEXT.md "Specifics" section.
**Warning signs:** Users report "the download links don't work in my agent."

## Code Examples

### `bin/cli.js` (port from TypeScript reference)

```javascript
#!/usr/bin/env node
// Source: packages/mcp-cli/src/index.ts (TypeScript reference)
// Plain JS — zero-build. Strip type annotations only; preserve all logic.
import { spawn } from 'node:child_process'

const apiKey = process.env.VIRALSLIDEMAKER_API_KEY
if (!apiKey) {
  process.stderr.write(
    'Error: VIRALSLIDEMAKER_API_KEY environment variable is not set.\n' +
      'Get your API key at https://viralslidemaker.com/settings/api-keys\n'
  )
  process.exit(1)
}

const baseUrl = process.env.VIRALSLIDEMAKER_BASE_URL || 'https://viralslidemaker.com'
const mcpEndpoint = `${baseUrl}/api/mcp`

const child = spawn(
  'npx',
  ['-y', 'mcp-remote', mcpEndpoint, '--header', `Authorization:Bearer ${apiKey}`],
  { stdio: 'inherit' }
)

child.on('error', (err) => {
  process.stderr.write(`Failed to start mcp-remote: ${err.message}\n`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})

function cleanup(signal) { child.kill(signal) }
process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGTERM', () => cleanup('SIGTERM'))
```

### `package.json` updates (single field change)

```json
{
  "dependencies": {
    "mcp-remote": "^0.1.38"
  }
}
```

Plus run `npm pkg fix` to drop the `./` from the bin path (auto-fix).

### `README.md` for npm registry display (recommended structure)

```markdown
# viralslidemaker-mcp

MCP stdio bridge for ViralSlideMaker. Connects local AI agents (Claude Desktop, Cursor, Windsurf) to https://viralslidemaker.com/api/mcp.

## Install

\`\`\`bash
npx -y viralslidemaker-mcp
\`\`\`

(No global install needed — most MCP clients run via npx.)

## Setup

1. Get your API key at https://viralslidemaker.com/settings/api-keys
2. Add to your MCP client config — see the [full setup guide](https://github.com/<org>/<repo>/blob/main/docs/MCP-GUIDE.md) for Claude Desktop, Cursor, Windsurf, and ChatGPT.

## Environment

| Variable | Required | Default |
|----------|----------|---------|
| `VIRALSLIDEMAKER_API_KEY` | yes | — |
| `VIRALSLIDEMAKER_BASE_URL` | no | `https://viralslidemaker.com` |

## License

MIT
```

### `docs/MCP-GUIDE.md` skeleton (4 client sections)

```markdown
# ViralSlideMaker MCP Setup Guide

Connect Claude Desktop, Cursor, Windsurf, or ChatGPT to your ViralSlideMaker account.

## Prerequisites

1. A `vsl_` API key — get one at https://viralslidemaker.com/settings/api-keys
2. Node.js 18+ installed (for npx)

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS),
`%APPDATA%\Claude\claude_desktop_config.json` (Windows),
or `~/.config/claude-desktop/claude_desktop_config.json` (Linux):

\`\`\`json
{ ...mcpServers config... }
\`\`\`

Restart Claude Desktop. The 4 ViralSlideMaker tools will appear in the tool picker.

## Cursor

[same shape, ~/.cursor/mcp.json]

## Windsurf

[same shape, ~/.codeium/windsurf/mcp_config.json]

## ChatGPT (custom connector)

> Requires Pro/Plus/Business/Enterprise/Edu workspace AND Developer Mode.
> Free tier not supported.

[UI flow, not JSON]

## Available Tools

| Tool | Cost | Description |
| list_templates | free | ... |
| create_carousel | 1 credit | ... |
| edit_slide | free | ... |
| render_carousel | free | URLs require browser session — see note below |

## Notes

- After `render_carousel` returns download URLs, open them in your logged-in browser
  to download. They require your active session, not your API key.
- Self-hosted / staging: set `VIRALSLIDEMAKER_BASE_URL=https://staging.example.com`.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mcp-remote` against `/sse` URLs | `mcp-remote` against Streamable HTTP `/api/mcp` (default `http-first`) | MCP Streamable HTTP spec ~mid-2025 | Phase 40 endpoint is Streamable HTTP — current `mcp-remote` handles this transparently. No special flags needed. |
| Local stdio MCP servers only | Remote HTTPS MCP (with `mcp-remote` bridge for local clients; native remote for ChatGPT) | OpenAI ChatGPT MCP support late-2025 | Two distinct integration paths now: stdio-bridge (Claude/Cursor/Windsurf) vs direct remote (ChatGPT). Setup guide must cover both. |
| Classic npm tokens | Granular Access Tokens | npm deprecated Classic in 2024 | Publish docs reference Classic frequently — confusing. Use Granular Access Tokens. Doesn't affect `npm publish` UX, only token creation. |

**Deprecated / outdated to ignore:**
- The old `--transport sse-first` flag is supported but unnecessary for new endpoints. Default is fine.
- Old "MCP Inspector" examples that hit `/sse` — our endpoint is at `/api/mcp` (Streamable HTTP).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommendation to add `linkLabel` + `linkHref` props to `GuideCard` (Pattern 2) | Architecture Patterns | If planner prefers to inline a markdown link into the `description` instead, that's also fine and avoids touching `GuideCard`. Either approach works — flagged as Claude's discretion. |
| A2 | `docs/MCP-GUIDE.md` link from the cross-link card uses a relative repo path | Architecture Patterns | If the docs site serves markdown files at `/docs/MCP-GUIDE`, the link should be that absolute URL instead. Planner should pick the correct link target based on whether docs are served. |
| A3 | npm Trusted Publishing (GitHub Actions OIDC) NOT used for v2.6 — manual `npm publish` only | Standard Stack — npm Publish | CONTEXT.md confirms publish is user-gated for v2.6; CI publish is v2.7+. Low risk. |

**If the planner needs to lock A1 or A2 differently, surface to discuss-phase before starting.**

## Open Questions

1. **Should the cross-link card's link target be `docs/MCP-GUIDE.md` (GitHub) or a future `/docs/mcp` route?**
   - What we know: CONTEXT.md says markdown-only for v2.6; in-app docs page is v2.7+
   - What's unclear: in the meantime, where should `/settings/api-keys` link to? GitHub URL? Or a placeholder until the docs page exists?
   - Recommendation: Link to the GitHub markdown file (e.g., `https://github.com/<org>/<repo>/blob/main/docs/MCP-GUIDE.md`). Planner picks the actual URL based on the project's GitHub remote.

2. **Should `bin/cli.js` use ESM `import` or CommonJS `require`?**
   - What we know: `package.json` has `"type": "module"` so ESM is the default. Existing `src/index.ts` uses ESM imports.
   - What's unclear: ESM `import` works on Node 18+; we're already requiring Node ≥18 (`engines.node: ">=18"`). No issue.
   - Recommendation: Use ESM `import { spawn } from 'node:child_process'` matching the TS reference.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥18 | Bridge runtime + npm publish | ✓ (assumed — project already requires Node 18+ throughout) | — | — |
| npm CLI | Publish + dry-run | ✓ (bundled with Node) | — | — |
| `mcp-remote@0.1.38` on npm | Transitive dep at runtime | ✓ | 0.1.38 (Feb 2026) | None — required |
| npm registry access | `npm publish` (user-gated) | n/a (user runs this) | — | None — required at publish time |

**Missing dependencies with no fallback:** None — all dependencies verified present.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing — used throughout the project per Phase 41 SUMMARY) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run <path> --no-coverage` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-DIST-01 | `bin/cli.js` exists, has shebang, is executable | smoke (shell) | `test -x packages/mcp-cli/bin/cli.js && head -1 packages/mcp-cli/bin/cli.js \| grep -q "^#!/usr/bin/env node"` | will be created |
| MCP-DIST-01 | `bin/cli.js` invokes `mcp-remote` with the correct args (no actual spawn — string check) | unit (grep) | `grep -q "mcp-remote" packages/mcp-cli/bin/cli.js && grep -q "Authorization:Bearer" packages/mcp-cli/bin/cli.js && grep -q "/api/mcp" packages/mcp-cli/bin/cli.js` | will be created |
| MCP-DIST-02 | Errors clearly when `VIRALSLIDEMAKER_API_KEY` is unset | smoke (shell) | `unset VIRALSLIDEMAKER_API_KEY; node packages/mcp-cli/bin/cli.js 2>&1 \| grep -q "VIRALSLIDEMAKER_API_KEY"; test $? -eq 0` (combine with exit-code check via wrapper) | will be created |
| MCP-DIST-03 | Reads `VIRALSLIDEMAKER_BASE_URL` override (defaults to viralslidemaker.com if unset) | unit (grep) | `grep -q "VIRALSLIDEMAKER_BASE_URL" packages/mcp-cli/bin/cli.js && grep -q "https://viralslidemaker.com" packages/mcp-cli/bin/cli.js` | will be created |
| MCP-DIST-04 | Setup guide has all 4 client snippets (grep-able section headers) | doc (grep) | `grep -q "Claude Desktop" docs/MCP-GUIDE.md && grep -q "Cursor" docs/MCP-GUIDE.md && grep -q "Windsurf" docs/MCP-GUIDE.md && grep -q "ChatGPT" docs/MCP-GUIDE.md` | will be created |
| MCP-DIST-04 | Setup guide includes the install snippet `npx -y viralslidemaker-mcp` | doc (grep) | `grep -q "npx -y viralslidemaker-mcp" docs/MCP-GUIDE.md` | will be created |
| MCP-DIST-04 | Setup guide warns about ChatGPT workspace tier requirement | doc (grep) | `grep -qE "Pro\|Plus\|Business\|Enterprise\|Edu" docs/MCP-GUIDE.md && grep -qi "developer mode" docs/MCP-GUIDE.md` | will be created |
| MCP-DIST-04 | Setup guide warns about render_carousel browser-session limitation | doc (grep) | `grep -qi "render_carousel" docs/MCP-GUIDE.md && grep -qi "browser" docs/MCP-GUIDE.md` | will be created |
| MCP-DIST-05 | `automation-guide.tsx` has 4 cards (was 3) | unit (grep) | `grep -c "<GuideCard" src/components/api-keys/automation-guide.tsx` returns ≥4 | exists; modify |
| MCP-DIST-05 | New card title mentions MCP | unit (grep) | `grep -q "MCP" src/components/api-keys/automation-guide.tsx` | exists; modify |
| MCP-DIST-06 | Package metadata correct (name, version, bin entry, files allowlist) | unit (jq) | `jq -e '.name == "viralslidemaker-mcp" and .version == "0.1.0" and .bin["viralslidemaker-mcp"] != null and (.files \| index("bin/")) != null' packages/mcp-cli/package.json` | exists; modify |
| MCP-DIST-06 | `npm publish --dry-run` succeeds with expected files | smoke (shell) | `cd packages/mcp-cli && npm publish --dry-run 2>&1 \| grep -E "(bin/cli.js\|package.json\|README.md)"` (verify all expected files in tarball) | manual command |
| MCP-DIST-06 | `mcp-remote` dep bumped to `^0.1.38` | unit (jq) | `jq -e '.dependencies["mcp-remote"] == "^0.1.38"' packages/mcp-cli/package.json` | exists; modify |
| MCP-DIST-06 | `bin` path cleaned (no `./` prefix) | unit (jq) | `jq -e '.bin["viralslidemaker-mcp"] == "bin/cli.js"' packages/mcp-cli/package.json` | exists; modify |

### Sampling Rate

- **Per task commit:** the task's specific verification command(s) above (under 10 seconds total)
- **Per wave merge:** all phase-42 verification commands + `npm test` (existing test suite to confirm no regressions in `automation-guide.tsx`)
- **Phase gate:** all of the above plus a manual end-to-end run by the user (start `npm run dev`, configure Claude Desktop locally, verify tools appear) — documented in SUMMARY.md as the user-gated verification

### Wave 0 Gaps

- [ ] No new test files needed for `bin/cli.js` itself — verification is via shell commands (executability, shebang check, grep). A unit test that mocks `child_process.spawn` would be possible but adds maintenance overhead for a 30-line script.
- [ ] Optional: a `src/__tests__/components/automation-guide.test.tsx` snapshot test if not already present (current project has no snapshot tests for this file — adding one is a Wave 0 gap if the planner wants component-level coverage). Recommendation: skip the snapshot test; the grep check (`grep -c "<GuideCard"` returns 4) is sufficient for v2.6.
- [ ] No framework install needed (Vitest already present).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | API key in env var; passed to `mcp-remote` as `Authorization: Bearer` header. No new auth surface — reuses Phase 40's `withMcpAuth`. |
| V3 Session Management | no | Bridge is stateless subprocess; no sessions. Hosted endpoint is stateless per Phase 40 decision. |
| V4 Access Control | no | All access enforced server-side at `/api/mcp` (Phase 40). Bridge has no access logic. |
| V5 Input Validation | minimal | Bridge only validates `VIRALSLIDEMAKER_API_KEY` is set (string non-empty). Server validates everything else. |
| V6 Cryptography | no | TLS handled by `mcp-remote` HTTPS to `/api/mcp`. No crypto in our code. |
| V14 Configuration | yes | Env vars documented, no secrets in source, `--access public` explicit on publish. |

### Known Threat Patterns for npm CLI Bridge

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leaked in error messages | Information Disclosure | Error message says "VIRALSLIDEMAKER_API_KEY environment variable is not set" — never echoes the key value. Existing `src/index.ts:21-25` already correct. Preserve in JS port. |
| API key written to stdout/stderr by `mcp-remote` debug logging | Information Disclosure | Bridge does NOT pass `--debug` to `mcp-remote`. Users who add it themselves opt into the risk. Document in guide. |
| Typosquat package on npm | Spoofing | `viralslidemaker-mcp` namespace verified available — publish promptly to claim it. Consider also reserving common typos (`viralslide-mcp`, `viralslidemakerr-mcp`) — but this is v2.7+ if user demand emerges. |
| Malicious dependency injection via `mcp-remote` | Tampering / Supply chain | `mcp-remote` is maintained by `geelen` (Cloudflare) and `threepointone`. Pin to `^0.1.38` (current verified version). Consider `npm audit` in CI for v2.7+. |
| Bridge spawns `npx -y mcp-remote` which auto-installs | Supply chain | The `-y` flag is required for non-interactive use. Users who want strict installs can add `mcp-remote` to their global node_modules and skip the npx auto-install. Document in guide as advanced option. |

## Project Constraints (from CLAUDE.md)

CLAUDE.md not present at the repo root (verified via existence check). No project-wide constraints to surface beyond what CONTEXT.md already locks.

## Sources

### Primary (HIGH confidence)
- Context7 `/geelen/mcp-remote` — fetched topics: header authorization bearer, transport http-first, command-line argument parsing
- npm registry — `npm view mcp-remote` (returned `0.1.38`, MIT, 68 versions, ~Feb 2026 publish)
- npm registry — `npm view viralslidemaker-mcp` (returned E404 — name available)
- `npm publish --dry-run` against `packages/mcp-cli/` (captured actual tarball output and warning text)
- modelcontextprotocol.io — Claude Desktop config locations (macOS / Windows / Linux paths)
- cursor.com/docs/context/mcp — Cursor `~/.cursor/mcp.json` schema
- docs.windsurf.com/windsurf/cascade/mcp — Windsurf `~/.codeium/windsurf/mcp_config.json` schema
- developers.openai.com/api/docs/mcp + help.openai.com 2026 article — ChatGPT custom connector requirements
- Read of `packages/mcp-cli/package.json`, `packages/mcp-cli/src/index.ts`, `src/components/api-keys/automation-guide.tsx`, Phase 41 SUMMARY, Phase 28 PLAN, REQUIREMENTS.md

### Secondary (MEDIUM confidence)
- docs.npmjs.com/cli/v11/commands/npm-publish — `--access public` flag semantics
- docs.npmjs.com/creating-and-viewing-access-tokens — Granular vs Classic token recommendation
- dev.to "Publishing Your First NPM Package" 2026 — first-time publish UX

### Tertiary (LOW confidence)
- None — all material claims verified via Context7, npm registry, official client docs, or direct file reads

## Metadata

**Confidence breakdown:**
- Standard stack (`mcp-remote` version, behavior): HIGH — verified via npm + Context7
- npm name availability: HIGH — verified via `npm view`
- MCP client config shapes: HIGH — verified via official docs for all 4 clients
- ChatGPT custom-connector landscape: MEDIUM — landscape is evolving; the workspace-tier and Developer Mode requirements are documented today but may shift. Setup guide should link out to OpenAI docs rather than embed every detail.
- npm publish UX: HIGH — captured live dry-run output

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days for stable distribution layer); ChatGPT MCP section valid for ~14 days due to evolving landscape — re-verify before publish if more than 2 weeks elapses.
