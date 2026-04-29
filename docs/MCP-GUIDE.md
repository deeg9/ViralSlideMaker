# ViralSlideMaker MCP Setup Guide

Connect Claude Desktop, Cursor, Windsurf, or ChatGPT to your ViralSlideMaker account. The MCP server gives the model native tool access to create, edit, and render TikTok / Instagram carousels — no prompt-engineering or REST-call wiring needed.

## What you get

| Tool              | Cost      | What it does                                       |
| ----------------- | --------- | -------------------------------------------------- |
| `list_templates`  | free      | List available visual style templates              |
| `create_carousel` | 1 credit  | Generate a full carousel from a topic              |
| `edit_slide`      | free      | Patch any slide field (headline, body, image, etc) |
| `render_carousel` | free      | Get download URLs for all slides in a project      |

## Prerequisites

1. A `vsl_` API key — get one at https://viralslidemaker.com/settings/api-keys
2. Node.js 18+ installed (so `npx` works)

## Install

```bash
npx -y viralslidemaker-mcp
```

You usually do not need to run this manually — most MCP clients invoke `npx -y viralslidemaker-mcp` automatically based on your config file. Run it once by hand only if you want to verify Node and npm are set up correctly (it will exit with an error about the missing `VIRALSLIDEMAKER_API_KEY`, which is expected).

## Claude Desktop

Edit your Claude Desktop config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude-desktop/claude_desktop_config.json`

Add the following block (merging into an existing `mcpServers` map if you already have one):

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

Replace `vsl_YOUR_KEY` with your actual key from https://viralslidemaker.com/settings/api-keys, then fully quit and restart Claude Desktop. The 4 ViralSlideMaker tools will appear in the tool picker (hammer icon).

## Cursor

Edit one of:

- Global: `~/.cursor/mcp.json`
- Per-project: `.cursor/mcp.json` in your repo root

The schema is identical to Claude Desktop — paste the same snippet:

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

Replace `vsl_YOUR_KEY`, then restart Cursor.

## Windsurf

Edit your Windsurf MCP config:

- macOS / Linux: `~/.codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

You can also reach this via the UI: Cmd/Ctrl+, → Windsurf Settings → Manage MCP Servers → "View raw config".

The schema is the same `mcpServers` shape:

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

Replace `vsl_YOUR_KEY`, then restart Windsurf.

## ChatGPT (custom connector)

> **Requires a paid ChatGPT workspace tier (Pro|Plus|Business|Enterprise|Edu) AND Developer Mode** enabled by your workspace admin (Settings → Permissions & Roles → Connected Data → Developer mode). **Free tier is not supported.** Plus / Pro individual users get read-only connectors only; write-capable tools (`create_carousel`, `edit_slide`) require Business, Enterprise, or Edu.

ChatGPT does not spawn the bridge locally — it talks to the remote MCP endpoint directly. Setup is a UI flow, not a JSON paste:

1. ChatGPT → Settings → Connectors → Create
2. Connector name: `ViralSlideMaker`
3. Description: `Generate TikTok carousel slides`
4. Server URL: `https://viralslidemaker.com/api/mcp`
5. Auth: Bearer token = your `vsl_` key from https://viralslidemaker.com/settings/api-keys

After saving, the connector appears in your tool picker on supported workspaces.

## Verifying it works

- Fully quit and restart your MCP client (config files are read once on startup).
- In Claude Desktop / Cursor / Windsurf, look for the tool picker / hammer icon and confirm the 4 ViralSlideMaker tools appear.
- Try a quick test: ask the agent to "list ViralSlideMaker templates" — `list_templates` should fire and return the template list.

## Limitations

- **Render URLs require a browser session.** After `render_carousel` returns download URLs, open them in your logged-in browser to download — they require your active session cookie, not your API key. (This is a known limitation surfaced in Phase 41; future versions may add Bearer-aware downloads.)
- **`-y` auto-install on each invocation.** `npx -y` re-installs `mcp-remote` if it is missing from the npx cache. To avoid this overhead, run `npm install -g mcp-remote` once.
- **Argv exposure on shared hosts.** The bridge passes `Authorization:Bearer <key>` as a process argument to `mcp-remote`, which means the key is visible to anyone who can run `ps aux` on the same machine. Avoid running on shared / multi-user servers.

## Self-hosted / staging

Set `VIRALSLIDEMAKER_BASE_URL=https://staging.example.com` in the `env` block of any of the JSON snippets above to redirect the bridge to a self-hosted or staging deployment:

```json
"env": {
  "VIRALSLIDEMAKER_API_KEY": "vsl_YOUR_KEY",
  "VIRALSLIDEMAKER_BASE_URL": "https://staging.example.com"
}
```

The bridge will then connect to `https://staging.example.com/api/mcp` instead of the default production endpoint.

## Troubleshooting

| Symptom                                                          | Likely cause                                              | Fix                                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `VIRALSLIDEMAKER_API_KEY environment variable is not set`        | Env var not passed to subprocess                          | Confirm the `env` block is present in the client config; restart the client.              |
| `401 Unauthorized` from any tool call                            | Key revoked, mistyped, or wrong                           | Re-issue at https://viralslidemaker.com/settings/api-keys and update the config.          |
| `command not found: npx`                                         | Node not on PATH                                          | Install Node 18+; reopen the client so it inherits the new PATH.                          |
| Tools do not appear in the picker                                | Client was not restarted, or the config has a syntax error | `cat <config-file>` and `jq . <config-file>` to validate JSON, then restart the client.   |
| "I don't see the Connectors menu" (ChatGPT)                      | Free tier or Developer Mode not enabled                   | See workspace requirements above.                                                         |
| `EventSource` / `SSE` errors in mcp-remote logs                  | Wrong transport selected by older client                  | Add `"--transport", "http-only"` (or `"sse-only"`) to the `args` array after `"viralslidemaker-mcp"`. |
