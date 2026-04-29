# Milestones

## v2.6 MCP Server (Shipped: 2026-04-28)

**Phases completed:** 3 phases (40-42), 3 plans, 18/19 requirements (MCP-DIST-06 deferred — npm publish user-gated)

**Status:** tech_debt — code complete; one user-gated deployment step (`npm publish`) awaiting user.

**Key accomplishments:**

- **Phase 40 — MCP Transport & Auth:** `/api/mcp` Streamable HTTP endpoint with `mcp-handler@1.1.0` + `@modelcontextprotocol/sdk@1.29.0`. `vsl_` Bearer auth via `withMcpAuth`, stateless transport for Vercel, Upstash rate limiting (shared `vsl:rl` counter with REST), middleware bypass for `/api/mcp`. Bearer-token verification core extracted to `src/lib/api/auth-core.ts` and shared between REST `withApiAuth` and MCP `verifyToken`. **AuthInfo cross-phase contract** (`extra: { userId, keyId }`) live for Phase 41.
- **Phase 41 — MCP Tool Surface:** 4 outcome-oriented tools (`list_templates`, `create_carousel`, `edit_slide`, `render_carousel`) registered via `server.registerTool` with Zod raw-shape input validation. Tools call services directly (NOT `/api/v1/*`). `create_carousel` mirrors REST credit deduct + refund pattern byte-for-byte. `edit_slide` accepts the same 9-field whitelist as `PATCH /api/v1/projects/{id}/slides/{index}`. Insufficient credits returns in-band `{ isError: true }` content (NOT OAuthError).
- **Phase 42 — Distribution & Documentation:** `viralslidemaker-mcp@0.1.0` npm bridge (zero-build plain JS in `bin/cli.js` wrapping `mcp-remote@0.1.38`). `docs/MCP-GUIDE.md` with copy-paste config snippets for Claude Desktop, Cursor, Windsurf, ChatGPT (with workspace-tier + Developer Mode gate). 4th `GuideCard` added to `/settings/api-keys` automation guide. `npm publish --dry-run --access public` accepted (4 files, 2.0kB tarball, name available on registry).
- **Build-gate regression check (THE point of v2.6):** the v2.3 retirement cause — `mcp-handler` listed in `package.json` but missing from `node_modules` → `/api/mcp` returned 500 — is now blocked by THREE independent layers: (1) static non-type import in `route.ts`, (2) vitest `import-gate.test.ts`, (3) `npm run build` in CI. Triple coverage; cannot recur silently.
- **Tests:** 23/23 MCP tests pass across 9 files, 9/9 REST auth regression tests pass, `npm run build` clean.
- **Code review:** 0 critical findings across all 3 phases. 8 warnings + 14 nits surfaced and addressed (some Phase 41 nits intentionally deferred to v2.7+ as cross-cutting REST refactors).

**Built on:** v2.2 (Bearer auth, rate limiting, service-extraction pattern); v2.5 (carousel/projects/render service signatures stable).

**Closes:** v2.3 MCP Server (retired 2026-04-28 in `quick-260428-rmm`) — root cause now blocked by triple-layer build-gate.

**Out of scope (deferred to v2.7+):** broader MCP tool surface (publish, fork, bookmarks, brand-kit, profile, credits, AI image gen, Pexels search, slide CRUD beyond `edit_slide`), OAuth 2.1, anonymous tools, MCP Resources/Prompts, stateful sessions.

**Awaiting user:** `cd packages/mcp-cli && npm login && npm publish --access public` + Claude Desktop end-to-end smoke test per `docs/MCP-GUIDE.md`.

---

## v2.5 Public REST API Parity (Shipped: 2026-04-28)

**Phases completed:** 6 phases (34–39), 10 plans, 28 requirements

**Key accomplishments:**

- Tier 1 (Phase 34): closed SPEC-01..07. Added `TextSegment`, `TextEffects` (+ shadow/outline/highlight sub-types) schemas. Expanded `Slide`, `StyleOverrides`, `CustomText`, `Project` to match `src/lib/types/slide.ts` and `src/lib/types/project.ts`. Tightened `/carousel` POST 200 response with `required` + descriptions. Zero behavior change.
- Tier 2 (Phases 35–36): `PATCH /projects/{id}` (rename + template), expanded `PATCH /slides/{index}` to 9 fields (was 5), `POST /slides`, `DELETE /slides/{index}` (refuses last-slide delete), `POST /slides/reorder` (full permutation only), `POST/DELETE /projects/{id}/publish`, `GET /me/credits`. New `src/lib/services/publish.ts` for the admin-client publish path.
- Tier 3 (Phases 37–39): `POST /pexels/search`, `POST /slides/{index}/generate-image` (Imagen, 1 credit, refunds on safety filter), `POST /slides/{index}/regenerate-text` (Gemini, free, opt-in persist), `GET /explore` (cursor-paginated 24/page, sort/tag/q), `GET /explore/{slug}`, `POST /explore/{slug}/fork`, `GET/POST /me/bookmarks`, `DELETE /me/bookmarks/{publishedId}`, `GET/PUT /me/brand-kit` + `POST /me/brand-kit/logo-upload-url`, `GET/PATCH /me/profile`. New service modules: `src/lib/services/ai-regen.ts`. New OpenAPI schemas: `BrandKit`, `Profile`, `PublishedCarousel`.
- ~21 new endpoints across the 6 phases, all reusing the existing `withApiAuth` wrapper. No new auth surface; static Bearer tokens cover everything.
- Decisions favored API consistency over dashboard parity where they diverged (e.g. bookmark POST is idempotent on conflict; slide DELETE refuses if it would leave 0 slides; reorder requires full permutation not partial).
- All routes verified to compile and respond 401 to unauthenticated curls; typecheck clean for every touched file.

**Built on:** v2.2 (REST API foundation), v2.3 retired in quick-260428-rmm, v2.4 (Explore + Remix infrastructure).

**Out of scope (deferred to v2.6+):** API-key CRUD via API, Stripe billing endpoints, webhooks for project events, OAuth 2.1, anonymous Explore reads, avatar upload via signed URL, username-claim via API.

---

## v2.5 Public REST API Parity (Planning Snapshot — superseded by Shipped section above)

The original planning scope, kept for historical reference. All requirements below were closed in the shipped milestone.

**Goal:** Bring the public REST API up to full feature parity with the dashboard so a customer with an API key can do everything they can do in the UI — manage projects, slides, custom text/images, AI image generation, Pexels search, publishing, Explore browsing, bookmarks, forking, brand kit, credits.

**Why now:** v2.3 (MCP) was retired in quick-260428-rmm because it never shipped end-to-end (mcp-handler missing from node_modules → /api/mcp returned HTTP 500). The REST API at `/api/v1/*` is the only programmatic surface we ship; right now it covers ~30% of dashboard capabilities. Audit captured 2026-04-28 in this conversation.

### Scope (3 tiers, all in-scope for v2.5)

#### Tier 1 — Spec accuracy (no new endpoints, just docs)

Update `src/lib/api/openapi.ts` to fully document everything the existing 7 routes already accept and return. Surfaced via Scalar at `/docs`.

- [ ] **SPEC-01**: `Slide` schema documents `hook_segments` and `body_segments` (TextSegment[]) used by news-headline two-color rendering
- [ ] **SPEC-02**: `StyleOverrides` schema documents `hook_text_effects`, `body_text_effects` (TextEffects: shadow / outline / highlight), `layout` ('cover' | 'body'), `hide_watermark` boolean
- [ ] **SPEC-03**: `CustomText` schema documents `text_effects` and `segments` fields
- [ ] **SPEC-04**: New `TextSegment` schema (text + accent boolean)
- [ ] **SPEC-05**: New `TextEffects` schema with `TextShadowEffect` / `TextOutlineEffect` / `TextHighlightEffect` sub-schemas matching `src/lib/types/slide.ts`
- [ ] **SPEC-06**: `Project` schema documents `description` and `generation_status` fields
- [ ] **SPEC-07**: `/carousel` POST 200 response schema accurately reflects the actual `{ success, projectId, slideCount }` shape

#### Tier 2 — Close the small/medium-low capability gaps

Each item is a real new endpoint or expanded handler.

- [ ] **API-01**: `PATCH /projects/{id}` — rename project (`title`, `description`, `template_id`)
- [ ] **API-02**: `PATCH /projects/{id}/slides/{index}` accepts `custom_texts`, `custom_images`, `hook_segments`, `body_segments`, `hide_watermark` (today only allows 5 fields)
- [ ] **API-03**: `POST /projects/{id}/slides` — append a new slide (or insert at index)
- [ ] **API-04**: `DELETE /projects/{id}/slides/{index}` — remove a slide
- [ ] **API-05**: `POST /projects/{id}/slides/reorder` — reorder via array of indices
- [ ] **API-06**: `POST /projects/{id}/publish` — publish to Explore (mirrors `publishProjectToExplore` server action: hero render + `publish_carousel` RPC); accepts title, description, tags
- [ ] **API-07**: `DELETE /projects/{id}/publish` — unpublish (calls `unpublish_carousel` RPC)
- [ ] **API-08**: `GET /me/credits` — return tier + balance (reuses `getCreditBalance` + `getUserTier`)

#### Tier 3 — AI / Pexels / Explore / Bookmarks / Brand Kit (full parity)

- [ ] **API-09**: `POST /pexels/search` — proxy `searchPhotos` with `?q=`, `?orientation=`, `?per_page=`
- [ ] **API-10**: `POST /projects/{id}/slides/{index}/generate-image` — Imagen AI background generation (1 credit)
- [ ] **API-11**: `POST /projects/{id}/slides/{index}/regenerate-text` — AI hook/body rewrite (free per current pricing)
- [ ] **API-12**: `GET /explore` — Explore feed with `?sort=trending|new|featured`, `?tag=`, `?q=` (mirrors current /explore page query)
- [ ] **API-13**: `GET /explore/{slug}` — single published carousel detail (mirrors current `/explore/[slug]` server fetch)
- [ ] **API-14**: `POST /explore/{slug}/fork` — fork into a new private project (calls `fork_published_carousel` RPC)
- [ ] **API-15**: `POST /me/bookmarks` — bookmark a published carousel by id
- [ ] **API-16**: `DELETE /me/bookmarks/{publishedId}` — remove bookmark
- [ ] **API-17**: `GET /me/bookmarks` — list my bookmarks
- [ ] **API-18**: `GET /me/brand-kit` — read brand kit
- [ ] **API-19**: `PUT /me/brand-kit` — upsert brand kit (logo URL, colors, fonts; logo upload uses an upload-URL pattern, TBD)
- [ ] **API-20**: `GET /me/profile` — read public profile (display name, bio, avatar URL, socials)
- [ ] **API-21**: `PATCH /me/profile` — update profile fields

### Out of scope for v2.5

| Feature | Reason |
|---|---|
| Stripe checkout / portal / subscription sync | Session-auth surface, not API-key surface; covered by web flow |
| Create/list/revoke API keys via API | Chicken-and-egg; stays in `/settings/api-keys` |
| Webhooks for "project published" / "carousel forked" | Defer to v2.6 if customer demand |
| OAuth 2.1 / per-scope tokens | Static Bearer tokens cover v1 |
| Rate-limit-tier upgrades for paid users | Existing flat 60-rpm enough for now |

### Locked decisions

- All new endpoints follow the existing Bearer-token + rate-limit pattern (`withApiAuth` from `src/lib/api/with-api-auth.ts`).
- Credit-deducting endpoints (carousel generation, AI image gen) deduct via `deductCreditAdmin` and surface `x-credits-remaining` / `x-credits-used` headers per the existing convention.
- Each new endpoint adds a matching OpenAPI path entry in the same commit. No "ship route, document later."
- Tier 1 ships first as a single spec-only PR — no risk, immediate value to /docs.

### Phase suggestion (for /gsd-new-milestone)

- **Phase 34**: Tier 1 — spec accuracy (1 PR, no new behavior)
- **Phase 35**: Tier 2.A — project/slide CRUD + reorder (API-01 through API-05)
- **Phase 36**: Tier 2.B — publish + credits read (API-06, 07, 08)
- **Phase 37**: Tier 3.A — AI + Pexels (API-09, 10, 11)
- **Phase 38**: Tier 3.B — Explore + Bookmarks + Fork (API-12 through API-17)
- **Phase 39**: Tier 3.C — Brand kit + profile (API-18 through API-21)

When ready to execute, run `/gsd-new-milestone v2.5` and feed it this scope.

---

## v2.3 MCP Server (Shipped: 2026-04-09)

**Phases completed:** 3 phases, 3 plans, 6 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] AuthInfo type import path
- Commit:

---

## v2.2 Public REST API (Shipped: 2026-04-09)

**Phases completed:** 4 phases, 8 plans, 9 tasks

**Key accomplishments:**

- 1. [Rule 1 - Bug] timingSafeEqual test approach changed
- RED:
- 1. [Rule 3 - Blocking] Copied auth.ts from phase 22 parallel branch
- 1. [Rule 2 - Missing Auth] Added authentication check to server actions
- Templates listing and projects listing REST endpoints with auth, rate limiting, and OpenAPI-compliant responses.
- 1. [Rule 3 - Blocking] TypeScript error with JSZip buffer type

---

## v2.1 Text Effects (Shipped: 2026-04-07)

**Phases completed:** 3 phases, 5 plans

**Key accomplishments:**

- Text shadow with toggle, color picker, and S/M/L size presets
- Text outline with toggle, color picker, and thickness slider (1-8px)
- Background highlight with toggle, color picker, tight/full-width style, and padding slider
- Per-element independence for all effects (hook, body, each custom text box)
- Native Satori CSS support confirmed (textShadow, WebkitTextStroke) — no workarounds needed
- Effects in all three renderers (preview, Satori PNG, HTML export)
- 845 lines added across 8 source files, zero new dependencies

## v2.0 API & MCP Platform (Shipped: 2026-04-07)

**Phases completed:** 1 phases, 0 plans, 2 tasks

**Key accomplishments:**

- Commit:

---
