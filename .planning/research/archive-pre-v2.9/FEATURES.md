# Feature Research: MCP Server for ViralSlideMaker

**Domain:** MCP server integration for SaaS carousel generator
**Researched:** 2026-04-08
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Agents Expect These)

Features that every MCP server must have or agents cannot function. These are non-negotiable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `create_carousel` tool | The core value prop -- one-shot carousel from topic. Without this, the MCP server is pointless. | LOW | Wraps POST `/api/v1/carousel`. Already the highest-value REST endpoint. Must return projectId + download URLs in one response so agents don't need multi-step orchestration. |
| `list_templates` tool | Agents need to discover available styles before creating. Every SaaS MCP server exposes discovery/list tools. | LOW | Wraps GET `/api/v1/templates`. No credit cost. Returns id + name + textPosition + textAlign. |
| `edit_slide` tool | Agents need to refine output after creation. "Create then edit" is the natural agent workflow (Notion, Stripe all follow this). | LOW | Wraps PATCH `/api/v1/projects/{id}/slides/{index}`. Support hookText, bodyText, imageQuery, backgroundUrl. Zero credits. |
| `render_carousel` tool | Agents need to get download URLs after edits. Completes the create-edit-download workflow. | LOW | Wraps POST `/api/v1/projects/{id}/render`. Returns slide download URLs + ZIP URL. Zero credits. |
| Bearer token auth on `/api/mcp` | Every production MCP server requires auth. Stripe uses OAuth 2.1, Notion uses Bearer tokens. Bearer is simpler and matches the existing `vsl_` key system. | LOW | Reuse existing `withApiAuth` middleware. Same keys work for REST and MCP. |
| Streamable HTTP transport | The standard remote transport since MCP spec 2025-03-26. SSE is deprecated. Claude Desktop, Cursor, and all modern clients support Streamable HTTP. | MEDIUM | Single Next.js route at `/api/mcp`. Uses `@modelcontextprotocol/sdk` McpServer + StreamableHTTPServerTransport. |
| stdio transport via npm package | Required for local agent use (Claude Desktop subprocess mode, Cursor local). The other half of the transport story. | MEDIUM | Separate npm package `viralslidemaker-mcp` that wraps the same tool definitions but connects via stdio, calling the REST API internally. |
| Descriptive tool schemas with examples | Agents select tools based on descriptions. Poor descriptions = agents pick wrong tools or pass bad params. Research shows this is the #1 cause of MCP failures. | LOW | Every tool needs: clear description of what it does, when to use it, parameter constraints, what it returns, and credit cost. |
| Structured error responses | Agents need parseable errors to self-correct. "Something went wrong" is useless; "INSUFFICIENT_CREDITS: 0 remaining, need 1" lets agents inform users. | LOW | Already have structured JSON errors from REST API. Pass through as MCP error content with code + message. |

### Differentiators (Competitive Advantage)

Features that make this MCP server better than a raw API wrapper. Not required, but make the agent experience noticeably better.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Outcome-oriented `create_carousel` response | Return projectId + slideCount + download URLs + ZIP URL all in one response. Agent gets everything needed without a follow-up `render_carousel` call. Follows the "outcomes over operations" MCP best practice. | LOW | The REST API already returns projectId. Add render URLs to the MCP tool response by calling render internally after creation. Saves agents a round-trip. |
| Credit balance in every response | Return `creditsRemaining` in every tool response so agents can proactively warn users before running out. No other carousel MCP server does this. | LOW | Already in REST response headers (`x-credits-remaining`). Surface in MCP response body. |
| `get_project` tool for inspection | Let agents retrieve a project to review current state before editing. Enables "show me slide 3" workflows. | LOW | Wraps GET `/api/v1/projects/{id}`. Returns full project with all slides. |
| Prompt template: `create-carousel` | Pre-built MCP prompt that guides agents through the optimal workflow: pick template, create carousel, review, edit. Reduces agent guesswork. | LOW | MCP prompts are user-invocable templates. Define one that structures the carousel creation flow with argument slots for topic and style preference. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create real problems in the MCP context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Expose ALL 10 REST endpoints as MCP tools | "Feature parity" instinct -- if the API has it, MCP should too | Tool count bloat kills agent accuracy. Research shows accuracy drops from 95% to 71% when tool count gets excessive. `list_projects`, `create_project`, `delete_project`, `get_slide`, `download_slide`, `download_zip` add 6 more tools but agents rarely need them -- they work with one carousel at a time. | Keep to 4-6 curated tools. Agents that need raw CRUD can use the REST API directly. |
| Granular slide-level CRUD tools (add_slide, remove_slide, reorder_slides, duplicate_slide) | Power users want full editor control via agents | Agents are bad at multi-step layout decisions. Adding/removing/reordering slides requires understanding visual flow -- agents generate better results by regenerating with different slide counts than by surgically modifying structure. Also bloats tool count. | Let `create_carousel` accept `slideCount` param. For removal, agents can edit unwanted slides to be CTAs or regenerate. |
| Binary file download tools | "Agent should download the images directly" | MCP tools return text/JSON, not binary. Returning base64-encoded PNGs would bloat context windows massively (a single 1080x1920 PNG is ~500KB = ~700K base64 chars). | Return download URLs. The user or a separate download tool handles fetching. This is how Stripe MCP handles invoices -- returns URLs, not PDFs. |
| Style/theme customization tools | "Agent should control fonts, colors, overlay opacity per slide" | Exposes 15+ style parameters as tool inputs. Agents struggle with visual design decisions (font size 24 vs 28? overlay opacity 60 vs 70?). Creates confusing tool schemas and bad output. | Templates handle styling. The `create_carousel` tool accepts `templateId`. For advanced users, `edit_slide` accepts `style_overrides` as an optional escape hatch but it should not be a separate tool. |
| Real-time streaming of generation progress | "Agent should show progress as slides generate" | MCP tools are request-response, not streaming. The generation takes 5-15 seconds -- acceptable for a tool call. Adding SSE/streaming within MCP adds protocol complexity for marginal UX improvement. | Return the complete result. 5-15s is within normal MCP tool call timeout ranges. |
| `delete_project` as an MCP tool | Agents should be able to clean up | Destructive operations via AI agents are dangerous. One misunderstood instruction and a user's project is gone. Stripe MCP intentionally restricts destructive tools. | Omit from MCP. Users delete via web UI. If needed later, add with confirmation_token pattern. |

## Feature Dependencies

```
[list_templates]
    └──informs──> [create_carousel] (agent picks templateId)
                      └──produces──> [edit_slide] (needs projectId + slideIndex)
                      └──produces──> [render_carousel] (needs projectId)
                      └──produces──> [get_project] (needs projectId)

[Bearer auth middleware]
    └──required by──> ALL tools (auth is enforced before any tool execution)

[REST API v2.2 endpoints]
    └──required by──> ALL MCP tools (MCP tools wrap REST handlers)

[Streamable HTTP transport]
    └──independent of──> [stdio transport] (separate implementations, same tool definitions)

[@modelcontextprotocol/sdk]
    └──required by──> [Streamable HTTP transport]
    └──required by──> [stdio transport]
```

### Dependency Notes

- **All MCP tools require REST API v2.2:** The MCP server is a thin wrapper. It reuses service layer functions, not HTTP calls internally. This means service extraction (already done in v2.2) is the critical dependency.
- **`create_carousel` informs `edit_slide`:** The projectId returned by creation is needed for all subsequent operations. This is the natural agent workflow.
- **Transports are independent:** Streamable HTTP and stdio share tool definitions but have different transport layers. Build tools first, then wire to both transports.
- **`list_templates` informs `create_carousel`:** Agents call `list_templates` first to discover available styles, then pass a `templateId` to `create_carousel`. However, `create_carousel` should have a sensible default (`bold-minimal`) so this step is optional.

## MVP Definition

### Launch With (v2.3)

The minimum viable MCP server that delivers the core agent workflow.

- [ ] `create_carousel` tool -- the entire value proposition in one tool call
- [ ] `list_templates` tool -- template discovery for informed creation
- [ ] `edit_slide` tool -- post-creation refinement
- [ ] `render_carousel` tool -- get download URLs after edits
- [ ] Streamable HTTP transport at `/api/mcp` -- remote agent access
- [ ] Bearer token auth reusing existing `vsl_` API keys
- [ ] Descriptive tool schemas with parameter constraints and credit cost documentation
- [ ] Structured MCP error responses

### Add After Validation (v2.3.x)

Features to add once the core 4 tools are working and agents are using them.

- [ ] `get_project` tool -- when agents need to inspect existing projects before editing
- [ ] stdio npm package (`viralslidemaker-mcp`) -- when users request local agent support
- [ ] MCP prompt template for guided carousel creation -- when usage data shows agents struggling with workflow
- [ ] Credit balance in tool responses -- low effort, high value, add in first iteration if time permits

### Future Consideration (v2.4+)

Features to defer until MCP usage patterns are established.

- [ ] `list_projects` tool -- only if agents need to browse existing work (unlikely for creation-focused tool)
- [ ] MCP resources for template thumbnails -- once MCP resource support matures in clients
- [ ] Webhook/notification on generation complete -- if generation times increase significantly
- [ ] OAuth 2.1 auth flow -- if distributing via MCP marketplaces that require it

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `create_carousel` tool | HIGH | LOW | P1 |
| `list_templates` tool | HIGH | LOW | P1 |
| `edit_slide` tool | HIGH | LOW | P1 |
| `render_carousel` tool | HIGH | LOW | P1 |
| Streamable HTTP transport | HIGH | MEDIUM | P1 |
| Bearer auth on `/api/mcp` | HIGH | LOW | P1 |
| Tool schema documentation | HIGH | LOW | P1 |
| Structured MCP errors | MEDIUM | LOW | P1 |
| `get_project` tool | MEDIUM | LOW | P2 |
| stdio npm package | MEDIUM | MEDIUM | P2 |
| Credit balance in responses | MEDIUM | LOW | P2 |
| MCP prompt templates | LOW | LOW | P3 |
| `list_projects` tool | LOW | LOW | P3 |
| OAuth 2.1 | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- the 4-tool MCP server with Streamable HTTP
- P2: Should have, add in same milestone if time permits
- P3: Nice to have, defer to future milestone

## Competitor Feature Analysis

| Aspect | Stripe MCP (27 tools) | Notion MCP (18 tools) | Supabase MCP (20+ tools) | ViralSlideMaker MCP (4-6 tools) |
|--------|----------------------|----------------------|--------------------------|-------------------------------|
| Tool count | 27 (too many -- causes context bloat) | 18 (moderate, well-organized) | 20+ (grouped by feature flags) | 4-6 (focused, outcome-oriented) |
| Read vs Write ratio | 15 read / 12 write | ~10 read / 8 write | Mostly read, writes gated | 1 read / 3 write |
| Auth model | OAuth 2.1 | Bearer token | Access token | Bearer token (existing `vsl_` keys) |
| Transport | Remote HTTP + local npm | Hosted + stdio | stdio primarily | Streamable HTTP + stdio npm |
| Destructive ops | Restricted (refunds gated) | Available (delete pages) | Read-only mode available | Omitted entirely |
| Design philosophy | Comprehensive coverage | Comprehensive coverage | Developer infrastructure | Curated outcomes |

**Key insight:** Stripe and Notion are platform products with broad API surfaces, so high tool counts make sense. ViralSlideMaker is a focused creation tool -- the MCP server should reflect that focus. 4 tools that work perfectly beats 15 that confuse agents.

## Tool Count Guidance from Research

Industry best practice from philschmid.de and multiple sources:
- **5-15 tools per server** is the sweet spot
- **40+ tools** causes Cursor to truncate (hard limit)
- **Agent accuracy drops 24 percentage points** when tool count gets excessive
- **GitHub MCP server alone consumes 42,000 tokens** of context just for definitions
- **"One server, one job"** -- ViralSlideMaker's job is carousel creation, not a general content platform

The proposed 4-tool MVP with 2 optional additions (6 max) is well within the sweet spot and leaves plenty of context budget for the agent's actual reasoning.

## Sources

- [MCP Best Practices - philschmid.de](https://www.philschmid.de/mcp-best-practices) - Tool granularity, naming, outcome-oriented design (HIGH confidence)
- [Notion MCP Supported Tools](https://developers.notion.com/guides/mcp/mcp-supported-tools) - 18-tool reference implementation (HIGH confidence)
- [Stripe MCP Documentation](https://docs.stripe.com/mcp) - 27-tool enterprise MCP server (HIGH confidence)
- [Supabase MCP Server](https://supabase.com/blog/mcp-server) - Feature-flagged tool groups (HIGH confidence)
- [MCP Context Overload](https://eclipsesource.com/blogs/2026/01/22/mcp-context-overload/) - Tool count impact on agent accuracy (MEDIUM confidence)
- [MCP Tool Overload Solutions](https://www.lunar.dev/post/why-is-there-mcp-tool-overload-and-how-to-solve-it-for-your-ai-agents) - Context window consumption data (MEDIUM confidence)
- [Nordic APIs MCP Best Practices](https://nordicapis.com/8-tips-and-best-practices-for-mcp-server-development/) - Server design patterns (MEDIUM confidence)
- [Next.js MCP Guide](https://nextjs.org/docs/app/guides/mcp) - Next.js integration patterns (HIGH confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK (HIGH confidence)
- [WorkOS MCP Features Guide](https://workos.com/blog/mcp-features-guide) - Tools vs Resources vs Prompts (MEDIUM confidence)

---
*Feature research for: MCP Server integration for ViralSlideMaker SaaS*
*Researched: 2026-04-08*
