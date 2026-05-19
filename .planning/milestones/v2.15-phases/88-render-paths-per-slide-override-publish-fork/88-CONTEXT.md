# Phase 88: Render Paths + Per-Slide Override + Publish/Fork - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A carousel built on a DB-backed template renders faithfully everywhere and
survives publish/fork — closing the consumption side of v2.14's DB templates.

**In scope:** converting the sync code-only `getTemplate(id)` call sites that a
DB `template_id` can now reach to async `resolveTemplate(id)` — the three render
paths (canvas preview, Satori PNG export, HTML export), `prompts.ts`
`buildSystemPrompt`, and the editor's project-template resolution; making
per-slide `template_id_override` DB-aware; fork inheriting the source carousel's
`template_id`; render-parity + byte-identity re-verification; an end-to-end
dry-run. WIRE-03, WIRE-04, WIRE-05, WIRE-06.

**Out of scope:** the picker + generation-snap wiring (done in Phase 87); any
schema migration (the `templates` table + `category` column already exist); new
template authoring (v2.14). No new Gemini tier.

This is the final phase of milestone v2.15.

</domain>

<decisions>
## Implementation Decisions

### Sync→Async Render-Path Conversion (WIRE-03)
- Convert `getTemplate(id)` → `await resolveTemplate(id)` at all four render
  call sites: `src/app/api/render/route.ts`, `src/app/api/v1/projects/[id]/download/route.ts`,
  `src/app/(dashboard)/project/[id]/publish-actions.ts`, `src/lib/services/publish.ts`.
  Each is already in an async context — verify individually during execution.
- Include the editor canvas path: whatever resolves the editor's project
  `template_id` (the canvas preview is one of the three render paths WIRE-03
  names) is converted too.
- Convert `prompts.ts` `buildSystemPrompt`'s `getTemplate(templateId)` as well —
  after Phase 87 a DB `templateId` reaches it, and a sync code-only lookup
  yields the wrong template's `aiVoiceNote` / `accentColor` in the prompt.
- Preserve the unknown-id fallback: `resolveTemplate` falls back to
  `templates[0]` exactly like `getTemplate` — the conversion is behavior-neutral
  for code template ids.

### Per-Slide Override (WIRE-04)
- `src/lib/render/resolve-per-slide-template.ts` — its `TEMPLATE_IDS.includes(override)`
  gate currently rejects DB ids. Make resolution DB-aware: `resolvePerSlideTemplate`
  becomes async and uses `resolveTemplate` / `isKnownTemplateId`.
- Preserve STYLESPEC-10 semantics: a genuinely-unknown override id still falls
  back silently to the project template — only the rejection of *valid* DB
  override ids is the bug being fixed.
- Thread `await` through the render paths that call it (they are already going
  async in the WIRE-03 conversion).
- Full fix — per-slide `template_id_override` is exactly how Oracle-style
  carousels carry their per-slide look, so it must accept DB ids.

### Publish / Fork (WIRE-05)
- Fork currently hardcodes `template_id: 'highlight-bar'` (in
  `src/app/api/v1/explore/[slug]/fork/route.ts`). Change it to inherit the
  source carousel's `template_id`. Also verify the `fork_published_carousel`
  Postgres RPC does not separately override `template_id`; fix wherever the
  hardcode actually lives.
- Publish render is covered by the WIRE-03 conversion (`publish.ts`
  `getTemplate` → `resolveTemplate`); `published_carousels.template_id` already
  persists the id (Phase 82) — no schema change.
- A fork whose source `template_id` is a DB template later deleted: accept the
  graceful `resolveTemplate` → `templates[0]` fallback — no dead-ref detection.

### Verification (WIRE-06 + End-to-End)
- DB-template render parity: extend the Phase 83 `db-template-parity` test —
  render a fixture DB-template carousel across canvas / Satori / HTML and assert
  parity.
- WIRE-06 baseline (CORRECTED — the STATE "6 failures" note is stale, fixed in
  v2.14 commit `e525c99`): the three suites `legacy-templates-byte-identical`,
  `legacy-templates-regression`, `new-templates-parity` are GREEN (45/45,
  verified 2026-05-19) and MUST stay green; the real failing baseline is 41
  OTHER tests (auth / stripe / legal / api-keys / editorial-serif-name). Phase
  88 introduces no new failure.
- Add a guard test asserting code-template id resolution is behavior-identical
  sync (`getTemplate`) vs async (`resolveTemplate`) — mirrors Phase 83's
  `legacy-byte-identity-after-storage`.
- End-to-end dry-run is a `human_needed` verification item: admin saves a
  template → it appears in the picker → a carousel generated on it is
  recipe-shaped → renders across all three paths → survives publish + fork.
  This is now possible locally (`ADMIN_USER_IDS` set in `.env.local`, the
  `template-previews` bucket migration applied 2026-05-19). The orchestrator
  drives it via Playwright after execution.

</decisions>

<code_context>
## Existing Code Insights

(From the 2026-05-19 blast-radius investigation —
`.planning/DB-TEMPLATE-WIRING-SPEC.md`.)

### Reusable Assets
- `src/lib/render/templates/registry.ts` — `resolveTemplate(id)` (async,
  code+DB, `templates[0]` fallback), `isKnownTemplateId(id)` (async),
  `getPickerDbTemplates()` / `templateCategory(id)` (added Phase 87).
- `getTemplate(id)` (sync, code-only, `templates[0]` fallback) — stays for
  genuinely code-only call sites.
- Phase 83 tests `db-template-parity` + `legacy-byte-identity-after-storage` —
  the parity / byte-identity test patterns to extend.

### Call sites to convert (verified)
- `src/app/api/render/route.ts` (~L92)
- `src/app/api/v1/projects/[id]/download/route.ts` (~L63)
- `src/app/(dashboard)/project/[id]/publish-actions.ts` (~L48, L81)
- `src/lib/services/publish.ts` (~L55)
- `src/lib/render/resolve-per-slide-template.ts` (~L43 — `TEMPLATE_IDS` gate)
- `src/lib/ai/prompts.ts` — `buildSystemPrompt` `getTemplate(templateId)`
- the editor's project-template resolution (canvas render path)
- `src/app/api/v1/explore/[slug]/fork/route.ts` (~L37 — hardcoded
  `'highlight-bar'`); plus the `fork_published_carousel` RPC.

### Established Patterns
- The three render functions receive a resolved `SlideTemplate` OBJECT — only
  the *callers* resolve by id; converting the callers is sufficient.
- `resolveTemplate` resolves code templates from the same `templates[]` array,
  code-first — byte-identical to `getTemplate` for code ids.
- Render-parity (TPLREND-05): all three paths share resolver helpers.

### Integration Points
- Render routes / server actions → `resolveTemplate`.
- `resolve-per-slide-template.ts` → async, DB-aware.
- Fork route / RPC → inherit `template_id`.

</code_context>

<specifics>
## Specific Ideas

- Phase 87 already made DB templates pickable + generation preserves the DB
  `template_id`; Phase 88 makes the resulting carousel render and propagate
  correctly — together they close v2.14's TSTORE-02 / TSTORE-03 in the running
  app.
- WIRE-06: byte-identity for the 13 code templates + ~82 existing carousels —
  the `getTemplate`→`resolveTemplate` conversion must be behavior-neutral for
  code ids; the three fixture suites stay green at 45/45.
- The end-to-end dry-run is the real proof the whole v2.14+v2.15 loop works.

</specifics>

<deferred>
## Deferred Ideas

- End-user / community template authoring + the picker surfacing community
  templates — deferred.
- Editing/deleting a saved DB template — still save-new-only.
- Explicit registry cache invalidation on write — v1 accepts the ≤60s TTL.
- Fixing the pre-existing 41-test failing baseline — out of scope; WIRE-06 only
  requires no NEW regression.

</deferred>
