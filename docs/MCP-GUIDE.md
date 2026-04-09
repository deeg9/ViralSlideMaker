# ViralSlideMaker MCP Server Guide

Connect AI agents (Claude Desktop, Cursor, or any MCP-compatible client) to ViralSlideMaker to create TikTok and Instagram carousel images programmatically.

Two transport options are available:

- **Streamable HTTP** -- connect to the hosted server (no local install)
- **stdio** -- run the MCP server locally via npm

## Prerequisites

1. A ViralSlideMaker account at [viralslidemaker.com](https://viralslidemaker.com)
2. An API key (starts with `vsl_`). Generate one at **Account Settings > API Keys**.
3. Sufficient credits -- carousel creation costs 1 credit per project.

## Streamable HTTP Transport

Use this for remote/hosted connections. No local installation required.

**Endpoint:** `https://viralslidemaker.com/api/mcp`
(For local development: `http://localhost:3000/api/mcp`)

**Auth:** Bearer token (your API key) in the `Authorization` header.

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "viralslidemaker": {
      "url": "https://viralslidemaker.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Cursor Configuration

Add the same configuration in **Cursor Settings > MCP Servers**:

```json
{
  "mcpServers": {
    "viralslidemaker": {
      "url": "https://viralslidemaker.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## Stdio Transport

Use this to run the MCP server locally as a subprocess. The npm package handles the HTTP connection to the ViralSlideMaker API internally.

### Installation

```bash
npx viralslidemaker-mcp
```

### Claude Desktop Configuration (stdio)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "viralslidemaker": {
      "command": "npx",
      "args": ["viralslidemaker-mcp"],
      "env": {
        "VIRALSLIDEMAKER_API_KEY": "YOUR_API_KEY",
        "VIRALSLIDEMAKER_BASE_URL": "https://viralslidemaker.com"
      }
    }
  }
}
```

### Cursor Configuration (stdio)

Add in **Cursor Settings > MCP Servers**:

```json
{
  "mcpServers": {
    "viralslidemaker": {
      "command": "npx",
      "args": ["viralslidemaker-mcp"],
      "env": {
        "VIRALSLIDEMAKER_API_KEY": "YOUR_API_KEY",
        "VIRALSLIDEMAKER_BASE_URL": "https://viralslidemaker.com"
      }
    }
  }
}
```

## Available Tools

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| `list_templates` | List available carousel visual styles/templates | None | Array of `{ id, name, textPosition, textAlign }` |
| `create_carousel` | Create a new carousel from a topic. Costs **1 credit**. | `topic` (required), `templateId?`, `slideCount?` (3-20, default 7), `imageSource?` ("stock" or "ai") | `{ projectId, slideCount, downloadUrls, zipUrl, creditsRemaining }` |
| `edit_slide` | Edit a slide in an existing project | `projectId` (required), `slideIndex` (required, 0-based), `hookText?`, `bodyText?`, `imageQuery?`, `backgroundUrl?` (https only) | `{ slide, slideIndex }` |
| `render_carousel` | Get download URLs for all slides. **No credit cost.** | `projectId` (required) | `{ projectId, slideCount, downloadUrls, zipUrl }` |

### Tool Parameter Details

**create_carousel**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | Yes | The topic or prompt for the carousel (1-500 chars) |
| `templateId` | string | No | Visual template ID. Use `list_templates` to see options. Default: `bold-minimal` |
| `slideCount` | integer | No | Number of slides to generate (3-20). Default: 7 |
| `imageSource` | string | No | `"stock"` for Pexels photos or `"ai"` for AI-generated images. Default: `"stock"` |

**edit_slide**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string (UUID) | Yes | The project ID |
| `slideIndex` | integer | Yes | Zero-based slide index |
| `hookText` | string | No | New hook/title text |
| `bodyText` | string | No | New body text |
| `imageQuery` | string | No | New image search query (triggers Pexels search) |
| `backgroundUrl` | string (URL) | No | Direct background image URL (must be https) |

## Example Workflow

Here is a typical workflow for creating a carousel with an AI agent:

### 1. Browse available templates

```
> Use the list_templates tool
```

Returns templates like `bold-minimal`, `gradient-overlay`, `split-screen`, etc.

### 2. Create a carousel

```
> Use create_carousel with topic "5 Morning Habits That Changed My Life" and templateId "bold-minimal"
```

Returns:
```json
{
  "projectId": "a1b2c3d4-...",
  "slideCount": 7,
  "downloadUrls": [
    "/api/render?projectId=a1b2c3d4-...&slide=0&download",
    "/api/render?projectId=a1b2c3d4-...&slide=1&download",
    "..."
  ],
  "zipUrl": "/api/v1/projects/a1b2c3d4-.../download",
  "creditsRemaining": 9
}
```

### 3. Edit a specific slide

```
> Use edit_slide with projectId "a1b2c3d4-...", slideIndex 2, hookText "Wake Up at 5 AM"
```

Returns `{ slide: { ...updatedSlideData }, slideIndex: 2 }`.

### 4. Get download URLs

```
> Use render_carousel with projectId "a1b2c3d4-..."
```

Returns fresh download URLs for all slides plus the ZIP download.

## Credits

| Action | Credit Cost |
|--------|-------------|
| `create_carousel` | 1 credit |
| `edit_slide` | 0 credits |
| `render_carousel` | 0 credits |
| `list_templates` | 0 credits |

Credit balance is returned in the `create_carousel` response body as `creditsRemaining`. MCP tool responses do not expose HTTP headers to agents.

## Troubleshooting

### 401 Unauthorized

- Verify your API key starts with `vsl_`
- Check that the key has not been revoked in Account Settings
- Ensure the `Authorization` header format is `Bearer vsl_...`

### 429 Rate Limited

- You have exceeded the request limit for your tier
- The `Retry-After` header tells you how many seconds to wait
- Free tier: 10 requests/minute. Pro tier: 60 requests/minute.

### 402 Insufficient Credits

- Your account does not have enough credits to create a carousel
- Purchase additional credits or upgrade your plan at viralslidemaker.com/pricing
- Use `render_carousel` and `edit_slide` (0 credits) to work with existing projects

### Connection Refused (stdio)

- Ensure `VIRALSLIDEMAKER_API_KEY` environment variable is set
- Ensure `VIRALSLIDEMAKER_BASE_URL` points to the correct server
- Try running `npx viralslidemaker-mcp` directly to check for errors

### Tool Not Found

- Restart your MCP client after updating configuration
- Verify the MCP server name matches in your config (`viralslidemaker`)
