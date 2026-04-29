# viralslidemaker-mcp

MCP stdio bridge for ViralSlideMaker. Connects local AI agents (Claude Desktop, Claude Code, Cursor) to the hosted ViralSlideMaker MCP endpoint at `https://viralslidemaker.com/api/mcp`.

The bridge wraps [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) and injects your API key as an `Authorization: Bearer` header so your agent can call the 5 carousel tools natively:

- `list_templates` — discover available visual styles
- `create_carousel` — generate a carousel from a topic (1 credit)
- `upload_image` — upload a base64 image and get back a public URL (free, daily quota)
- `edit_slide` — patch any slide field (free)
- `render_carousel` — get download URLs for all slides (free)

The CLI itself is a stdio passthrough — `0.2.0` matches the v2.7 server adding `upload_image`. `0.1.x` only sees the original 4 tools.

## Install

```bash
npx -y viralslidemaker-mcp
```

(No global install needed — most MCP clients run via npx automatically.)

## Setup

1. Get a `vsl_` API key at https://viralslidemaker.com/settings/api-keys
2. Add the bridge to your MCP client config — see the [full setup guide](https://github.com/deeg9/ViralSlideMaker/blob/main/docs/MCP-GUIDE.md) for Claude Desktop, Claude Code, Cursor, and ChatGPT.

## Environment

| Variable                   | Required | Default                       |
| -------------------------- | -------- | ----------------------------- |
| `VIRALSLIDEMAKER_API_KEY`  | yes      | —                             |
| `VIRALSLIDEMAKER_BASE_URL` | no       | `https://viralslidemaker.com` |

## Notes

- After `render_carousel` returns download URLs, open them in your logged-in browser to download — they require your active session, not your API key.
- Tip: pre-install `mcp-remote` globally (`npm install -g mcp-remote`) so `npx` picks it up from the global prefix instead of re-resolving on cold caches.
- Avoid running on shared / multi-user servers — process listings expose the API key as a header argument.

## License

MIT
