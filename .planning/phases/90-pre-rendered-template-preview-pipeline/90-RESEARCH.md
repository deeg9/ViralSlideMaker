# Phase 90: Pre-Rendered Template Preview Pipeline - Research

**Researched:** 2026-05-20
**Domain:** Internal codebase integration — one-off render/upload script + picker component simplification
**Confidence:** HIGH (all findings verified by direct codebase read)

## Summary

Phase 90 builds a one-off `tsx` script that gives every code template a real photo-backed `preview` PNG, then deletes the `<SlidePreview>` fallback branch from the picker tile. The codebase already has every primitive this needs: `renderCoverPreviewPng` (the Satori cover-snapshot helper, v2.14 phase 86), the `template-previews` public Storage bucket, the service-role admin client pattern, and the `generateCarousel` service for filling template gaps. This is an *integration* phase — wiring existing parts together in a script — not new-library research.

The work splits cleanly into three concerns: (1) **build the script** — query `buyer@example.com`'s carousels, find per-template exemplars, generate carousels for the gaps, snapshot covers, upload to Storage, rewrite the 16 template source files; (2) **run it live** — incurs real Gemini spend for gap templates and writes to a real Supabase account; (3) **simplify the picker tile** to a single-branch `<img>` and update tests. The live run is the risk surface — it spends money and mutates production data, so it should be its own plan.

**Primary recommendation:** Build `scripts/render-template-previews.ts` reusing `renderCoverPreviewPng` + `createAdminClient` + `generateCarousel` exactly as the existing scripts do, with deterministic Storage path `code-templates/{slug}.png` and `upsert: true` for idempotency. Note one CONTEXT.md inaccuracy up front: there are **16 code templates, not 15** — `y2k-pop` is in the registry and CONTEXT.md's enumerated list omits it. Confirm with the user whether `y2k-pop` needs a preview too (it IS picker-visible, so per the forcing-function rule it does).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Preview photos are sourced from `buyer@example.com`'s own published carousels.** One published cover slide per template, snapshotted and uploaded to the existing `template-previews` Supabase Storage bucket. For templates with **no** exemplar carousel on that account, the pipeline generates a new carousel on that account using that template, then snapshots its cover. Diego's pro account is the canonical "good-looking exemplar" source — sidesteps stock-photo licensing, guarantees the preview is what generation actually produces today.
- **Full autonomous run, INCLUDING the live preview run (user decision, 2026-05-20).** The executor runs the pipeline end-to-end: querying the account, generating new carousels for gap templates (real Gemini API spend), uploading PNGs to Supabase Storage, and wiring URLs into code-template source files. It MAY pause if it hits an un-automatable auth gate (e.g. Supabase credentials missing/invalid in `.env.local`).
- **`<SlidePreview>` fallback is fully deleted.** After this phase every code template MUST have a `preview` URL. `src/components/slides/template-tile-preview.tsx` becomes a single-branch `<img>` component; the `<SlidePreview>` fallback branch and the `makeSampleSlide` import are deleted. A new code template cannot ship without first rendering its preview — intended forcing function.
- **One-off pipeline, idempotent.** `scripts/render-template-previews.ts` is a one-off render at milestone time — NOT a scheduled refresh. Re-running it on an unchanged set is a no-op.

### Claude's Discretion

All other implementation choices — exact script structure, how to query the account's projects, the deterministic storage path scheme (`code-templates/{slug}.png` is suggested in REQUIREMENTS.md), whether to reuse `renderCoverPreviewPng`, how to detect a template's "exemplar" carousel, how to wire the `preview` URL onto each code-template definition.

### Deferred Ideas (OUT OF SCOPE)

- Per-slide / multi-variant previews — one preview per template only.
- Animated or video previews — static PNG only.
- Scheduled / cron preview refresh — one-off render; operator re-runs on redesign.
- Premium-tier picker chrome redesign, picker layout changes — only the tile preview body changes.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREVIEW-01 | Every code template in `src/lib/render/templates/*.ts` has a `preview` field set to a public Supabase Storage URL (real photo + sample text). | `SlideTemplate.preview?: string` field already exists (`index.ts:103`). Each of the 16 template files is a flat object literal — add one line. Script writes URLs back in Plan 2. |
| PREVIEW-02 | All preview PNGs sourced from carousels on the `buyer@example.com` account; generate for missing templates, use the cover slide. | `generateCarousel` service (`carousel.ts:51`) creates+generates+saves a project given a service-role client, userId, topic, templateId. Email→userId resolved via `auth.admin.listUsers` on the service-role client. |
| PREVIEW-03 | One-off `scripts/render-template-previews.ts` automates: query account projects, snapshot covers via existing render pipeline, upload to `template-previews` bucket at `code-templates/{slug}.png`, write URLs into source files. Idempotent. | `renderCoverPreviewPng` (`preview-render.ts:29`) is the snapshot primitive. `createAdminClient` + `.storage.from('template-previews').upload(..., { upsert: true })` + `getPublicUrl` is the upload path (mirrors `api/admin/templates/route.ts:130-139`). Source-file rewrite is a regex/string edit on flat object literals. |
| PREVIEW-04 | `<TemplateTilePreview>` simplified to a single-branch `<img>`; `<SlidePreview>` fallback + `makeSampleSlide` import deleted from `template-tile-preview.tsx` and `template-picker.tsx`. | `template-tile-preview.tsx` currently has the two-branch body (lines 22-46). `template-picker.tsx` does NOT import `makeSampleSlide` directly — only the tile component does. Single-branch version documented below. |
| PREVIEW-05 | Playwright smoke confirms all code templates render as `<img>` with valid `src`; DB templates also render via `<img>`; no broken images. `template-picker.test.tsx` updated to new contract. | Existing tests `src/__tests__/components/template-picker.test.tsx` + `src/components/slides/__tests__/template-tile-preview.test.tsx` assert the OLD `<SlidePreview>` contract — both need rewriting. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Account carousel query | Script (Node/tsx) → Supabase DB | — | Standalone script with service-role client; reads `projects` table directly, bypassing RLS. |
| Carousel generation for gaps | Script → `generateCarousel` service → Gemini API | Pexels API | Reuses the existing server-side generation service; runs in Node context, not a request. |
| Cover snapshot render | Script → `renderCoverPreviewPng` (Satori/`next/og`) | — | Pure render primitive; produces a PNG Buffer from slide+template. |
| PNG upload | Script → Supabase Storage (`template-previews` bucket) | — | Service-role client write; bucket is public-read, deny-default-write. |
| Template `preview` field wiring | Script → source-file edit (`src/lib/render/templates/*.ts`) | — | Mechanical string rewrite of flat object literals; committed to git. |
| Picker tile render | Browser / React client | — | `<img>` element; `template.preview` is now always populated for code templates. |

## Standard Stack

This phase uses **only** existing in-repo modules and dependencies. No new packages.

### Core (existing modules the script reuses)

| Module | Path | Purpose | Why Standard |
|--------|------|---------|--------------|
| `renderCoverPreviewPng` | `src/lib/render/preview-render.ts` | Render a single slide → 1080×1920 PNG Buffer via the shared Satori pipeline | Phase 86's cover-snapshot primitive — exact same path the admin Save-as-Template flow uses; render parity guaranteed. |
| `createAdminClient` | `src/lib/supabase/admin.ts` | Service-role Supabase client (bypasses RLS) | The only client that can read another user's projects + write to `template-previews`. |
| `generateCarousel` | `src/lib/services/carousel.ts` | Full carousel generation: create project, Gemini content, fetch images, save | The script-usable generation entry point — explicitly designed for "admin supabase client (no session cookies)". |
| `resolveTemplate` | `src/lib/render/templates/registry.ts` | DB-aware id → `SlideTemplate` | Needed to pass the resolved template to `renderCoverPreviewPng`. |
| `templates` / `TEMPLATE_IDS` | `src/lib/render/templates/index.ts` | The 16 code-template registry | Iteration source for "which templates need a preview". |

### Supporting (existing deps, already in `package.json`)

| Dependency | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `tsx` | ^4.21.0 `[VERIFIED: package.json]` | Run TypeScript scripts directly | Script invocation: `npx tsx scripts/render-template-previews.ts`. |
| `@supabase/supabase-js` | ^2.99.3 `[VERIFIED: package.json]` | Supabase client + Storage + `auth.admin` | DB query, Storage upload, email→userId resolution. |
| `next/og` (`ImageResponse`) | bundled with `next` `[VERIFIED]` | Satori→resvg render — used *inside* `renderCoverPreviewPng` | Transitive; the script imports `renderCoverPreviewPng`, not `next/og` directly. |
| `vitest` | (in repo) `[VERIFIED: vitest.config.ts]` | Test framework | Unit tests for the picker tile + picker. |
| `@playwright/test` | ^1.58.2 `[VERIFIED: package.json]` | E2E smoke | PREVIEW-05 picker smoke. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `renderCoverPreviewPng` | A fresh `ImageResponse` call inline (like `generate-template-thumbnails.ts` does) | The thumbnails script predates phase 86 and uses `makeSampleSlide` (synthetic, no photo). Phase 90 explicitly wants the REAL cover with a real photo — so reuse `renderCoverPreviewPng` and feed it the carousel's actual slide 0. `[CITED: 90-CONTEXT.md "Specific Ideas"]` |
| Service-role direct query | `getProject` from `projects.ts` | `getProject` filters `.eq('user_id', userId)` and `.single()` — fine once you HAVE the user id, but you still need a service-role client and the email→id step. Direct `.from('projects').select(...).eq('user_id', id)` is simpler for the "list all of this account's carousels" query. |

**Installation:** None — no new packages.

**Version verification:** `tsx@^4.21.0`, `@supabase/supabase-js@^2.99.3`, `@playwright/test@^1.58.2`, `sharp@^0.33.5`, `node-vibrant@^4.0.4` all confirmed present in `package.json` `[VERIFIED: package.json read 2026-05-20]`. No registry lookups needed — phase adds zero dependencies.

## Architecture Patterns

### System Architecture Diagram

```
                       scripts/render-template-previews.ts  (npx tsx)
                                      │
              ┌───────────────────────┼────────────────────────────┐
              │                       │                            │
              ▼                       ▼                            ▼
   1. load .env.local         2. createAdminClient()      iterate templates[] (16)
   (process.env via tsx)      (service-role key)                   │
                                      │                            │
                                      ▼                            ▼
                       3. resolve email → userId           4. per template: does the
                       auth.admin.listUsers()                 account have an exemplar
                       find buyer@example.com        carousel using this id?
                                      │                            │
                       ┌──────────────┴──────────┐    ┌────────────┴────────────┐
                       │                         │    │ EXEMPLAR FOUND          │ NO EXEMPLAR
                       ▼                         ▼    ▼                         ▼
              query projects WHERE         use existing project       5. generateCarousel(
              user_id = <id>               (slide_data[0])               adminClient, userId,
              AND template_id = ...                                      { topic, templateId,
              (and/or join published_carousels)                          slideCount: 3 })
                       │                                                 ──> REAL GEMINI SPEND
                       └──────────────┬──────────────────────────────────────┘
                                      ▼
                       6. renderCoverPreviewPng(slide0, resolveTemplate(id),
                                      { slideIndex:0, totalSlides:N, topic })
                                      ──> PNG Buffer (1080×1920)
                                      │
                                      ▼
                       7. adminClient.storage.from('template-previews')
                              .upload('code-templates/{slug}.png', buf,
                                      { contentType:'image/png', upsert:true })
                              .getPublicUrl(...)  ──> public URL
                                      │
                                      ▼
                       8. rewrite src/lib/render/templates/{slug}.ts
                              add  preview: '<public-url>'  to the object literal
                                      │
                                      ▼
                       9. (Plan 3) <TemplateTilePreview> = single <img src={preview}>
                          picker renders the PNG for every tile
```

### Recommended Project Structure

```
scripts/
└── render-template-previews.ts   # NEW — the one-off pipeline (Plan 1)

src/
├── lib/render/
│   ├── preview-render.ts          # UNCHANGED — reused as the snapshot primitive
│   └── templates/
│       ├── *.ts                   # 16 template files — each gains a `preview:` line (Plan 2)
│       └── index.ts               # UNCHANGED — SlideTemplate.preview already exists
├── components/slides/
│   ├── template-tile-preview.tsx  # SIMPLIFIED — single-branch <img> (Plan 3)
│   └── template-picker.tsx        # UNCHANGED unless it imports makeSampleSlide (it does NOT)
└── __tests__/components/
    └── template-picker.test.tsx   # REWRITTEN — new <img> contract (Plan 3)

src/components/slides/__tests__/
└── template-tile-preview.test.tsx # REWRITTEN — single-branch contract (Plan 3)
```

### Pattern 1: Standalone script env + service-role client

**What:** Scripts run via `npx tsx`, read `process.env` (tsx auto-loads `.env.local` in Next.js projects, but the existing scripts also explicitly `requireEnv`), and build a service-role client directly.
**When to use:** Any script that must bypass RLS or act across user accounts.
**Example:**
```typescript
// Source: scripts/rerender-hero-by-slug.ts:29-59 (verified pattern)
import { createClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) { console.error(`[render-previews] missing env: ${name}`); process.exit(1) }
  return v
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
```
Note: `src/lib/supabase/admin.ts::createAdminClient()` does the same thing but reads the env vars internally — either is fine. The existing `scripts/` files build the client inline (they predate `admin.ts` being reusable from a script). For consistency with `api/admin/templates/route.ts`, importing `createAdminClient` is acceptable; the inline form is the established *scripts/* convention.

### Pattern 2: Email → user id resolution (service-role `auth.admin`)

**What:** No in-repo code currently resolves an email to a Supabase user id. The service-role client exposes `auth.admin` for this.
**When to use:** The script needs `buyer@example.com`'s `user_id` to query their `projects`.
**Example:**
```typescript
// [CITED: supabase-js auth.admin API — standard service-role usage]
// listUsers is paginated (default 50/page). Diego's project likely has few users,
// but page through to be safe.
async function resolveUserIdByEmail(admin: SupabaseClient, email: string): Promise<string> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id
    if (data.users.length < 1000) break
  }
  throw new Error(`No auth user for ${email}`)
}
```
`[ASSUMED]` — the script could *also* be passed the user id directly as a `--user-id=` flag if `listUsers` proves slow or the operator already knows the id. Project memory `reference_dev_accounts.md` notes `buyer@example.com` is the PRO account. A `--user-id` flag is a safer fallback and avoids any ambiguity if multiple users share an email-like alias. **Recommend the planner add a `--user-id` flag as the primary input, with email resolution as a convenience.**

### Pattern 3: Cover snapshot via the shared render helper

**What:** `renderCoverPreviewPng(slide, template, ctx, origin?)` — renders one slide to a 1080×1920 PNG Buffer.
**Exact signature** `[VERIFIED: src/lib/render/preview-render.ts:29-43]`:
```typescript
export async function renderCoverPreviewPng(
  slide: Slide,                                              // slide 0 of the carousel = the cover
  template: SlideTemplate,                                   // resolved template style
  ctx: { slideIndex: number; totalSlides: number; topic?: string },
  origin?: string,                                           // optional — absolute asset URL base
): Promise<Buffer>                                           // PNG bytes, 1080×1920
```
- **Inputs:** a `Slide` object (the real cover slide, including its `background_url` photo), a resolved `SlideTemplate`, and a render context. It internally calls `buildSlideElement(slide, template, 'free', origin, ctx)` + `loadFontBuffersForSlide` and wraps them in `next/og`'s `ImageResponse`.
- **Output:** a PNG `Buffer`.
- **Confirmed it can render a code template's cover from a real project's first slide:** YES. The admin endpoint already does exactly this — `api/admin/templates/route.ts:99-104` calls `renderCoverPreviewPng(slides[0], sourceTemplate, { slideIndex: 0, totalSlides: slides.length, topic: project.topic })`. The phase-90 script does the identical call, just with a code template instead of a DB template.
- **`origin` caveat:** the admin endpoint passes `new URL(request.url).origin`. A standalone script has no request. The `generate-template-thumbnails.ts` script handles this by rewriting relative `/textures/*` and `/overlays/*` asset paths to `data:` URIs (its `rewriteAssetSrcs` helper). **The phase-90 script renders REAL carousels whose `background_url` is already an absolute Supabase/Pexels URL** — so for the photo background there is no relative-path problem. BUT some templates declare `grainMode` / decorative overlays that resolve to `/textures/*` and `/overlays/*`. Pass `origin = process.env.NEXT_PUBLIC_APP_URL` (present in `.env.local`) so Satori can fetch those assets over HTTP from the deployed app, OR port the `rewriteAssetSrcs` data-URI trick. **Recommend: pass `NEXT_PUBLIC_APP_URL` as origin** — simplest, and the deployed app serves `/textures/*`. Flag this as a verification point in Plan 1.

**Example (the snapshot call):**
```typescript
// Source: src/app/api/admin/templates/route.ts:96-104 (verified — same call shape)
import { renderCoverPreviewPng } from '@/lib/render/preview-render'
import { resolveTemplate } from '@/lib/render/templates/registry'

const template = await resolveTemplate(templateId)          // code template
const buffer = await renderCoverPreviewPng(
  slides[0],                                                // real cover slide w/ photo
  template,
  { slideIndex: 0, totalSlides: slides.length, topic: project.topic ?? undefined },
  process.env.NEXT_PUBLIC_APP_URL,                          // origin for /textures asset fetch
)
```

### Pattern 4: Upload to `template-previews` Storage bucket

**What:** Upload the PNG Buffer to the public `template-previews` bucket and read back its public URL.
**When to use:** Step 7 of the pipeline.
**Exact pattern** `[VERIFIED: src/app/api/admin/templates/route.ts:130-139]`:
```typescript
// The admin endpoint uses path `${admin.id}/${id}.png`. Phase 90's deterministic
// path is `code-templates/{slug}.png` (per REQUIREMENTS.md) — so re-runs OVERWRITE.
const previewPath = `code-templates/${template.id}.png`
const { error: uploadErr } = await adminClient.storage
  .from('template-previews')
  .upload(previewPath, previewBuffer, {
    contentType: 'image/png',
    upsert: true,            // <-- CHANGED from false: idempotent re-run overwrites in place
  })
if (uploadErr) throw new Error(`upload failed: ${uploadErr.message}`)
const { data: pub } = adminClient.storage.from('template-previews').getPublicUrl(previewPath)
const previewUrl = pub.publicUrl
```
**Critical idempotency note:** the admin endpoint uses `upsert: false` (it always writes to a fresh `{adminId}/{newId}.png` path). Phase 90 uses a *deterministic* path `code-templates/{slug}.png`, so it MUST use **`upsert: true`** — otherwise a re-run fails with "object already exists". This is the single most important deviation from the copied pattern.

**Bucket / RLS confirmed** `[VERIFIED: supabase/migrations/20260519_phase86_template_previews_bucket.sql]`:
- Bucket `template-previews` exists, `public = true`.
- Policy: `"Template previews are publicly accessible"` — `FOR SELECT TO public USING (bucket_id = 'template-previews')`. Public read works for every picker user.
- **NO INSERT/UPDATE/DELETE policy by design** — deny-by-default writes. Writes succeed ONLY through the service-role client (it bypasses RLS). The phase-90 script uses the service-role client, so writes succeed. An anon/publishable client would be rejected.
- **Operational prerequisite:** STATE.md "Open Items" flags that this migration may not yet be applied to the shared Supabase project. **The script must verify the bucket exists** (or the planner adds an explicit "confirm migration applied" pre-step). If the bucket is missing, `upload` returns a "Bucket not found" error — the script should fail loudly with a clear message.

### Pattern 5: Generate a carousel for a missing template

**What:** For templates the account has no exemplar carousel for, generate one.
**When to use:** Step 5 of the pipeline.
**Exact entry point** `[VERIFIED: src/lib/services/carousel.ts:51-89]`:
```typescript
export async function generateCarousel(
  supabase: SupabaseClient,        // pass the service-role admin client
  userId: string,                 // buyer@example.com's user id
  input: {
    topic: string                 // required — a representative topic string
    templateId: string            // the code template id to generate against
    slideCount?: number           // default 7; use the MINIMUM viable (3) to cut cost
    imageSource?: 'stock' | 'ai' | 'none'  // default 'stock' — Pexels, cheap
    category?: string             // optional — see snap caveat below
    advancedOptions?: { font?; fontColor?; imagePrompt? }
  },
): Promise<{ projectId: string; slideCount: number }>
```
- **Minimal viable call:** `generateCarousel(admin, userId, { topic: '<topic>', templateId: '<slug>', slideCount: 3, imageSource: 'stock' })`. `slideCount` is clamped to `[3, 20]` internally (`carousel.ts:100`), so 3 is the floor.
- **Cost surface — read carefully:**
  - `generateCarousel` calls `generateSlideContent` → **1 Gemini text-generation call per carousel** (`carousel.ts:101`). With `imageSource: 'stock'` it then does Pexels searches (cheap/free under `PEXELS_API_KEY`). With `imageSource: 'ai'` it would ALSO call Imagen per slide — **do NOT use `'ai'`**; use `'stock'`.
  - **Cost = one Gemini Flash text call per GAP template.** Worst case (account has zero exemplars) = 16 Gemini calls. Realistically far fewer. Project memory `feedback_gemini_cost.md`: Gemini 2.5 Flash chosen for cost — a 3-slide generation is cheap (cents). Still, the planner should **log every gap-fill generation** so the operator sees exactly what was spent.
  - `generateCarousel` does NOT call credit gating — its docstring explicitly says *"Does NOT call ensureSubscription/checkCredits — the caller must handle credit gating."* So a script call **will not be blocked by credits and will not consume the account's credit ledger.** No auth/credit gate to worry about. `[VERIFIED: carousel.ts:48-50 docstring]`
- **Snap caveat — IMPORTANT:** `generateCarousel` does NOT blindly honor the submitted `templateId`. It resolves an `effectiveTemplateId` from the `category` (`carousel.ts:70-82`): if the submitted `templateId` is not in the resolved category's curated `templateIds` list, it **snaps to the category default**. The 8 picker-hidden templates (`highlight-bar`, `news-drop`, `news-cyan`, `magazine-bold`, `documentary`, `notes-app-chic`, `brutalist-grid`, `paper-essay` — see `index.ts:236` `HIDDEN_FROM_PICKER`) are NOT in any category's curated list, so a naive `generateCarousel(... { templateId: 'magazine-bold' })` will silently produce a carousel with a DIFFERENT template. **Mitigation:** after `generateCarousel` returns, the script must `UPDATE projects SET template_id = '<intended-slug>'` on the returned `projectId` to force the exact template, then re-fetch `slide_data`. OR — simpler and recommended — **do not rely on `generateCarousel`'s template fidelity at all**: generate to get good slide *content + photos*, then snapshot the cover using `resolveTemplate('<intended-slug>')` regardless of what `template_id` the project ended up with. The snapshot's *visual* style comes from the template passed to `renderCoverPreviewPng`, not from the project row. This sidesteps the snap entirely. **Flag this for the planner — it is the subtlest pitfall in the phase.**
- **Auto-publish:** `generateCarousel` calls `autoPublishOnGenerate` (`carousel.ts:266`) — every generated carousel is auto-published to the account's Explore feed. This is fine (it's Diego's own pro account, and project memory `feedback_public_by_default.md` mandates public-by-default), but the planner should be aware the live run adds public carousels to `buyer@example.com`'s published feed.

### Pattern 6: Querying the account's carousels for exemplars

**What:** Find which code templates the account already has a carousel for.
**Schema** `[VERIFIED: supabase/schema.sql:4-12 + migrations/002_add_template_and_topic.sql]`:

`public.projects` columns relevant here:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK `auth.users(id)` — filter by the resolved account id |
| `title` | text | |
| `slide_data` | jsonb | array of `Slide` objects; `slide_data[0]` is the cover |
| `template_id` | text | added by `002_add_template_and_topic.sql` — the template the carousel uses |
| `topic` | text | added by `002` — pass to `renderCoverPreviewPng` ctx |
| `generation_status` | text | added by `002` — `'complete'` means a finished carousel |
| `category` | text | added by a later migration (Phase 82) — nullable |
| `created_at` / `updated_at` | timestamptz | |

**Query for exemplars:**
```typescript
// All of the account's completed carousels, newest first.
const { data: projects } = await admin
  .from('projects')
  .select('id, title, topic, template_id, slide_data, generation_status, updated_at')
  .eq('user_id', userId)
  .eq('generation_status', 'complete')
  .order('updated_at', { ascending: false })
// Build a Map<template_id, project>. First match per template_id = the freshest exemplar.
```
- **`projects` vs `published_carousels`:** prefer `projects`. `projects.slide_data[0]` is the live, current cover. `published_carousels` (`migrations/20260427_explore_remix_phase29.sql:19`) is a *snapshot* taken at publish time and may be stale; it has `source_project_id`, `slide_data`, `template_id`, `owner_id` but no `topic`. The CONTEXT.md says "published carousels" loosely — but for snapshot freshness, query `projects` directly. (`published_carousels` *could* be a cross-check that the exemplar is genuinely a published, presentable carousel — optional.)
- **Exemplar quality filter:** an exemplar is only good if `slide_data[0]` has a real photo `background_url`. Skip color-only templates' need for a photo (`paper-essay`, `brutalist-grid` are `backgroundMode: 'color'` — pure typography, no photo by design). For those, "exemplar" just means a completed carousel; the preview is the styled typography cover.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Render a slide to PNG | A fresh Satori/`ImageResponse` setup | `renderCoverPreviewPng` from `preview-render.ts` | Phase 86 already built it; reusing it guarantees byte-parity with the admin Save-as-Template preview and the live `/api/render` path. |
| Service-role Supabase client | Manual `createClient` with hand-pasted keys | `createAdminClient` (`admin.ts`) or the verified inline `requireEnv` pattern | Established pattern; consistent env-var error messages. |
| Carousel generation | A custom Gemini prompt + image fetch loop | `generateCarousel` (`carousel.ts`) | It already orchestrates content + photos + recipe + save + auto-publish, and is explicitly script-safe (no session cookies, no credit gate). |
| Storage public URL | String-concatenating the Supabase URL | `.storage.from(bucket).getPublicUrl(path)` | The SDK builds the correct `/storage/v1/object/public/...` path. |
| Email → user id | A `profiles`-table join guess | `admin.auth.admin.listUsers()` (or a `--user-id` flag) | `auth.users` is not directly queryable from a normal client; `auth.admin` is the supported path. |

**Key insight:** This entire phase is a *composition* of phase-86 primitives plus the generation service. The only genuinely new code is the script's glue logic (gap detection, idempotent path, source-file rewrite) and the picker-tile simplification. Resist any urge to build a parallel render or upload path.

## Runtime State Inventory

> This phase WRITES runtime state (Storage objects + new DB projects) rather than renaming things. Inventory of what the live run mutates:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New `projects` rows on `buyer@example.com`'s account — one per gap template (each also auto-published → a `published_carousels` row). | None to undo — these are real, presentable carousels on Diego's account. The planner should note they will appear in his Explore feed. |
| Live service config | Supabase Storage objects at `template-previews/code-templates/{slug}.png` — up to 16 PNGs. | Created by the script; `upsert: true` makes re-runs idempotent. |
| OS-registered state | None — no OS-level registrations. | None. |
| Secrets/env vars | Script reads `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `PEXELS_API_KEY`, `NEXT_PUBLIC_APP_URL` from `.env.local`. All confirmed PRESENT and populated in `.env.local` `[VERIFIED 2026-05-20]`. No new env var needed. | None — verify presence at script start with `requireEnv`. |
| Build artifacts | The 16 template source files are edited (a `preview:` line added) → committed to git. No compiled artifacts. | Commit the edited template files in Plan 2. |

**Nothing found in OS-registered state** — verified: this is a Next.js web app, no scheduled tasks involved (the phase explicitly excludes cron refresh).

## Common Pitfalls

### Pitfall 1: `generateCarousel` template snap silently swaps the template
**What goes wrong:** You call `generateCarousel(... { templateId: 'magazine-bold' })` for a gap, but the returned project has `template_id: 'news-oracle'` (the category default) because `magazine-bold` is in `HIDDEN_FROM_PICKER` and not in any category's curated list.
**Why it happens:** `carousel.ts:70-82` resolves an `effectiveTemplateId` from `category`; a submitted id not in the curated list snaps to `templateIds[0]`.
**How to avoid:** Don't trust the project's `template_id`. Snapshot the cover with `resolveTemplate('<intended-slug>')` passed explicitly to `renderCoverPreviewPng` — the visual style is determined by the template argument, not the project row. The generated slide_data gives you good *content + photo*; the template gives you the *look*.
**Warning signs:** Two gap templates produce visually identical previews → they both snapped to the same category default.

### Pitfall 2: `upsert: false` breaks idempotent re-runs
**What goes wrong:** The script works the first time, then fails on the second run with "The resource already exists".
**Why it happens:** The copied admin pattern uses `upsert: false` (it always writes a fresh path). Phase 90 uses a *deterministic* path.
**How to avoid:** Use `upsert: true` on the `.upload()` call. This is the intended idempotency mechanism — same path, overwrite in place.
**Warning signs:** Second run errors only on Storage upload, render succeeds.

### Pitfall 3: Satori can't fetch relative `/textures/*` asset paths from a script
**What goes wrong:** Templates with `grainMode` / decorative overlays render with missing textures, or `renderCoverPreviewPng` throws because Satori requires absolute asset URLs.
**Why it happens:** In production, Next.js serves `/textures/grain-medium.png` over HTTP. A standalone script has no server and no request `origin`.
**How to avoid:** Pass `origin: process.env.NEXT_PUBLIC_APP_URL` to `renderCoverPreviewPng` so Satori fetches assets from the deployed app. Fallback: port `generate-template-thumbnails.ts`'s `rewriteAssetSrcs` data-URI trick. The photo `background_url` itself is already absolute (Supabase/Pexels) — only the decorative `/textures` and `/overlays` assets are at risk.
**Warning signs:** Render works for plain templates, throws/blanks for `paper-essay`, `chrome-pulse`, etc. (templates with grain/decorative).

### Pitfall 4: CONTEXT.md says "15 templates" — there are 16
**What goes wrong:** The plan wires previews into 15 files; `y2k-pop` is missed; after the picker becomes single-branch `<img>`, `y2k-pop`'s tile shows a broken image.
**Why it happens:** CONTEXT.md and REQUIREMENTS.md enumerate 15 template slugs and omit `y2k-pop`. `grep -l "SlideTemplate = {"` confirms **16** template files; `y2k-pop` is in `templates[]` (`index.ts:184-206`) AND picker-visible (NOT in `HIDDEN_FROM_PICKER`).
**How to avoid:** Treat the canonical list as `TEMPLATE_IDS` (`index.ts:215`) — all 16. Generate a preview for `y2k-pop` too. Surface this discrepancy to the user/planner explicitly — it may need a quick decision, but the forcing-function rule ("every code template MUST have a preview") strongly implies all 16.
**Warning signs:** PREVIEW-05's smoke finds 15 valid `<img>` and one broken tile.

### Pitfall 5: Account has no exemplar AND generation produces an ugly cover
**What goes wrong:** A gap-fill generation produces a carousel whose cover photo is unflattering, so the preview misrepresents the template.
**Why it happens:** Gemini + Pexels are non-deterministic; a single 3-slide generation can land a poor stock photo.
**How to avoid:** This is inherent to "generate the gap" — but mitigate by picking strong, evergreen topics per template (a curated topic map in the script, not random). The operator reviews the resulting PNGs after the run. Accept that a redesign-grade preview may need a manual re-run with a different topic — the script is idempotent so that's cheap.
**Warning signs:** Visual review after the live run; flag any preview that looks off for a one-template re-run.

### Pitfall 6: `template-previews` bucket not yet applied to the shared Supabase project
**What goes wrong:** Every upload fails with "Bucket not found".
**Why it happens:** STATE.md "Open Items" notes `20260519_phase86_template_previews_bucket.sql` may not be applied to the shared (remote-only) Supabase project. Supabase is remote-only — no local DB.
**How to avoid:** The script should probe the bucket first (`admin.storage.getBucket('template-previews')` or list buckets) and fail with a clear "apply migration X" message. Add an explicit pre-flight check to Plan 1 / Plan 2.
**Warning signs:** Render succeeds, every upload fails identically.

## Code Examples

### The simplified `<TemplateTilePreview>` (PREVIEW-04)

Current `[VERIFIED: src/components/slides/template-tile-preview.tsx]` has two branches. Post-phase-90 single-branch version:
```typescript
'use client'

// Phase 90 (PREVIEW-04): every code AND DB template now carries a `preview` URL
// (a rendered cover-snapshot PNG). The picker tile is a single <img>. The
// <SlidePreview> live-render fallback and the makeSampleSlide import are gone —
// a new code template cannot ship without first rendering its preview.

import type { SlideTemplate } from '@/lib/render/templates/index'

export function TemplateTilePreview({ template }: { template: SlideTemplate }) {
  return (
    <img
      src={template.preview}
      alt={`Preview of ${template.name}`}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
}
```
Note: `template.preview` is typed `preview?: string` (optional). After phase 90 every code template sets it, but the type stays optional (DB templates can still be created without one in theory). The single-branch `<img>` with an `undefined` src would render a broken image — that is the *intended* forcing function. Consider whether the planner wants a dev-time `console.warn` if `preview` is falsy; CONTEXT.md frames the broken image itself as the forcing signal, so a plain `<img>` is acceptable.

### Adding the `preview` field to a template file (PREVIEW-01/02/03)

Each template file is a flat object literal `[VERIFIED: highlight-bar.ts]`. The script appends one line:
```typescript
export const highlightBar: SlideTemplate = {
  id: 'highlight-bar',
  name: 'Highlight Bar',
  thumbnail: '/templates/highlight-bar.png',
  // ...existing fields...
  preview: 'https://<project>.supabase.co/storage/v1/object/public/template-previews/code-templates/highlight-bar.png',
}
```
The source-file rewrite can be done with a regex that inserts `preview: '<url>',` before the closing `}` of the export — every file follows the identical `export const <name>: SlideTemplate = { ... }` shape.

### Idempotency strategy

- **Deterministic Storage path:** `code-templates/{template.id}.png` — re-runs hit the same object, `upsert: true` overwrites.
- **Source-file rewrite:** if the file already has a `preview:` line, *replace* its value; else *insert*. A re-run on unchanged data produces a no-op git diff (`git diff --quiet` after the run confirms idempotency).
- **Exemplar reuse:** if the account already has an exemplar carousel for a template, skip generation entirely (no Gemini spend on re-run).
- **Gap generation is the only non-idempotent step** — each run creates new carousels for still-missing templates. After the first successful run those carousels exist as exemplars, so a second run finds them and does NOT regenerate. So the *first* run spends Gemini for gaps; subsequent runs spend nothing. This is the correct idempotency model for "generate once, reuse forever."

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Picker tile = live `<SlidePreview>` for every code template | DB templates render a `preview` PNG; code templates still live-render | v2.14 Phase 86 | `SlideTemplate.preview` field + `template-previews` bucket + `renderCoverPreviewPng` shipped. Phase 90 extends the PNG path to code templates too. |
| Synthetic `makeSampleSlide` swatches in the picker | Real photo-backed cover snapshots | Phase 90 (this phase) | The picker finally shows what generation actually produces. |

**Deprecated/outdated after this phase:**
- The `<SlidePreview>` fallback branch in `template-tile-preview.tsx` — deleted (PREVIEW-04).
- `makeSampleSlide` import *in the picker tile* — deleted. (`makeSampleSlide` itself stays — `scripts/generate-template-thumbnails.ts` still uses it; do NOT delete the module.)
- The OLD assertions in `template-picker.test.tsx` / `template-tile-preview.test.tsx` that expect `data-testid="slide-preview"` — rewritten (PREVIEW-05).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `buyer@example.com`'s user id is best resolved at runtime via `auth.admin.listUsers`; a `--user-id` flag is a safer primary input. | Pattern 2 | Low — if `listUsers` is slow/ambiguous, the `--user-id` flag is the fallback. Operator can supply the id directly. |
| A2 | All 16 code templates (including `y2k-pop`) need a preview, despite CONTEXT.md/REQUIREMENTS.md enumerating only 15. | Pitfall 4 | Medium — if the user actually wants `y2k-pop` excluded, the plan over-generates one preview (cheap, harmless). If included as assumed, the forcing-function rule is satisfied. **Surface to user.** |
| A3 | Passing `origin = NEXT_PUBLIC_APP_URL` lets Satori fetch `/textures` + `/overlays` assets for grain/decorative templates. | Pitfall 3 | Medium — if the deployed app is unreachable or the path differs, grain/decorative templates render without textures. Fallback: data-URI rewrite. Verify in Plan 1. |
| A4 | A 3-slide `imageSource: 'stock'` generation per gap template is the minimum-cost path and incurs ~1 Gemini Flash text call each. | Pattern 5 | Low — `generateSlideContent` is one call; `slideCount` clamps at 3 min. Cost is cents-scale per gap. |
| A5 | The `template-previews` bucket migration is applied to the shared Supabase project. | Pitfall 6 | High if wrong — every upload fails. STATE.md flags it as possibly NOT applied. **Must pre-flight check.** |
| A6 | `generateCarousel` script calls do not consume the account's credit ledger and are not credit-gated. | Pattern 5 | Low — verified by the `carousel.ts:48-50` docstring ("Does NOT call ensureSubscription/checkCredits"). |

## Open Questions

1. **`y2k-pop` — 15 or 16 templates?**
   - What we know: `TEMPLATE_IDS` has 16 ids; `y2k-pop` is picker-visible.
   - What's unclear: CONTEXT.md/REQUIREMENTS.md explicitly list 15 and omit `y2k-pop`.
   - Recommendation: Generate previews for all 16 (forcing-function rule). Flag the discrepancy to the user at plan time; the cost of an extra preview is negligible.

2. **Topic selection for gap-fill generations.**
   - What we know: `generateCarousel` needs a `topic` string; a random/generic topic risks an unflattering cover.
   - What's unclear: which topics best showcase each template.
   - Recommendation: the script should carry a small curated `templateId → topic` map (evergreen, visually strong topics) rather than one generic topic for all. Discretion-area; the planner can seed it.

3. **Is `published_carousels` a required cross-check?**
   - What we know: CONTEXT.md says previews come from "published carousels"; querying `projects` directly is fresher.
   - What's unclear: whether the operator wants the exemplar to be specifically a *published* carousel.
   - Recommendation: query `projects` for the cover (fresh `slide_data`), optionally intersect with `published_carousels.source_project_id` to prefer published exemplars. Low stakes — it's Diego's own account.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `tsx` | Running the script | ✓ | ^4.21.0 (`package.json`) | — |
| `@supabase/supabase-js` | DB query + Storage + auth.admin | ✓ | ^2.99.3 | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role client | ✓ | populated in `.env.local` (`sb_secret_1G...`) | — |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | ✓ | populated (`https://mzfe...`) | — |
| `GEMINI_API_KEY` | Gap-fill generation | ✓ | populated (`AIzaSyAm-HZ7...`) | — |
| `PEXELS_API_KEY` | Stock photos in generation | ✓ | present in `.env.local` | — |
| `NEXT_PUBLIC_APP_URL` | Satori asset origin | ✓ | present in `.env.local` | data-URI rewrite (`rewriteAssetSrcs`) |
| `template-previews` Storage bucket | PNG upload | ⚠ UNVERIFIED | — | Apply `20260519_phase86_template_previews_bucket.sql` to the shared project |

**Missing dependencies with no fallback:** None confirmed missing — all env vars are present.

**Missing dependencies with fallback:**
- `template-previews` bucket — STATE.md flags it may not be applied to the remote project. Fallback: apply the existing migration SQL. The script MUST pre-flight check and fail loudly if absent.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (jsdom environment, `@vitejs/plugin-react`) `[VERIFIED: vitest.config.ts]` |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/components/slides/__tests__/template-tile-preview.test.tsx src/__tests__/components/template-picker.test.tsx` |
| Full suite command | `npx vitest run` |
| Setup file | `src/__tests__/setup.ts` (ResizeObserver + getBoundingClientRect polyfills) |
| Playwright | `@playwright/test@^1.58.2` for the picker smoke (PREVIEW-05) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PREVIEW-01 | All 16 code templates have a non-empty `preview` string | unit | `npx vitest run src/lib/render/templates/__tests__/code-template-previews.test.ts` | ❌ Wave 0 — new test: assert every `templates[]` entry has `preview` set + URL-shaped |
| PREVIEW-02/03 | Script logic: gap detection, deterministic path, idempotent rewrite | unit (pure helpers) | `npx vitest run scripts/__tests__/render-template-previews.test.ts` | ❌ Wave 0 — extract pure helpers (gap-map builder, path builder, source-file rewriter) so they are unit-testable without a live DB |
| PREVIEW-03 | Live run actually populates Storage + source files | manual / live | (the live pipeline run itself — Plan 2) | N/A — manual verification: `git diff` shows 16 `preview:` lines, 16 PNGs in bucket |
| PREVIEW-04 | `<TemplateTilePreview>` renders a single `<img>`, never `<SlidePreview>` | unit | `npx vitest run src/components/slides/__tests__/template-tile-preview.test.tsx` | ✅ exists — must be REWRITTEN (current tests assert the deleted fallback branch) |
| PREVIEW-05 | Picker renders all tiles as `<img>` with valid `src`, no broken images; DB templates too | unit + e2e | `npx vitest run src/__tests__/components/template-picker.test.tsx` + Playwright smoke | ✅ unit exists — must be REWRITTEN (asserts `slide-preview` testid). ❌ Playwright smoke is Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run <touched test file>` — under 30s.
- **Per wave merge:** `npx vitest run` (full vitest suite) — confirm the 3 fixture suites stay GREEN at 45/45 and no NEW failures vs. the pre-v2.16 baseline.
- **Phase gate:** Full vitest suite + the Playwright picker smoke green before `/gsd-verify-work`. Plus a manual visual review of all 16 generated PNGs.

### Wave 0 Gaps

- [ ] `src/lib/render/templates/__tests__/code-template-previews.test.ts` — asserts every `templates[]` entry has a non-empty, URL-shaped `preview`. Locks PREVIEW-01 + the forcing function.
- [ ] `scripts/__tests__/render-template-previews.test.ts` — unit tests for the script's pure helpers (gap-map builder, `code-templates/{slug}.png` path builder, idempotent source-file rewriter). Requires the script to export these helpers separately from `main()`.
- [ ] Playwright picker smoke spec — navigates to the project picker, asserts every tile is an `<img>` with a non-empty `src`, asserts zero `<SlidePreview>` / `data-testid="slide-preview"` nodes, checks no broken images (`naturalWidth > 0`). Per project memory `feedback_playwright_react_clicks`, use `mcp__playwright__browser_click` for any React interaction (not eval-side `.click()`).
- [ ] REWRITE `src/components/slides/__tests__/template-tile-preview.test.tsx` — current 3 tests assert the two-branch behavior (the `<SlidePreview>` fallback). After PREVIEW-04 the component is single-branch; tests must assert `<img>` always, never `slide-preview`.
- [ ] REWRITE `src/__tests__/components/template-picker.test.tsx` — current tests do `getAllByTestId('slide-preview')` and expect `pickerTemplates.length` previews. After PREVIEW-04 there are zero `slide-preview` nodes; assert `getAllByRole('img')` count instead.

*(Framework already installed — no install step needed.)*

## Security Domain

> `security_enforcement` not explicitly set in config — treated as enabled. This phase has a narrow security surface: a service-role script + a public-read Storage bucket.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth flow — script uses the service-role key out-of-band. |
| V3 Session Management | no | No sessions — standalone script. |
| V4 Access Control | yes | Script uses the service-role client (bypasses RLS by design) — keep it a *script*, never an unauthenticated route. The `template-previews` bucket is public-read (intended — picker images), deny-default-write (intended — only service-role writes). |
| V5 Input Validation | partial | Template ids written into Storage paths must match `[a-z0-9-]+` (mirror `generate-template-thumbnails.ts:78`'s unsafe-id guard) before being used in `code-templates/{slug}.png` — prevents any path-injection into the bucket. |
| V6 Cryptography | no | No crypto — uses Supabase SDK only. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role key leakage (script logs / committed code) | Information Disclosure | Read the key from `.env.local` via `process.env`; never log it; never hard-code. `.env.local` is gitignored. |
| Storage path injection via a crafted template id | Tampering | Validate `template.id` against `/^[a-z0-9-]+$/` before composing the upload path — the same guard `generate-template-thumbnails.ts` already uses. All 16 ids already pass. |
| Public PNG over-exposure | Information Disclosure | Acceptable by design — preview PNGs are marketing assets meant to be public. The bucket's public-read policy is intentional (phase 86). |
| Generating carousels on a real account | — | Limited to Diego's own pro account, user-approved. Auto-publish adds public carousels to his Explore feed — expected, not a vulnerability. |

## Suggested Plan Breakdown

Three plans. Plan 2 is the LIVE run (real Gemini spend + real Supabase writes) and depends on Plan 1.

### Plan 1 — Build the pipeline script (no live writes)
- Create `scripts/render-template-previews.ts` with pure, separately-exported helpers (gap-map builder, path builder, source-file rewriter) + a `main()`.
- Wire: env preflight (`requireEnv`), `template-previews` bucket existence check, email→userId (or `--user-id` flag), `projects` query, exemplar gap-map.
- Wire the snapshot path (`renderCoverPreviewPng` with `origin = NEXT_PUBLIC_APP_URL`) and the upload path (`upsert: true`, `code-templates/{slug}.png`).
- Wire `generateCarousel` for gaps (`slideCount: 3`, `imageSource: 'stock'`) with the Pitfall-1 mitigation (snapshot via `resolveTemplate('<intended-slug>')`, ignore the project's snapped `template_id`).
- Support a `--dry-run` flag: do everything except Storage upload + source-file write (logs the plan + Gemini cost estimate).
- **Wave 0 tests:** `scripts/__tests__/render-template-previews.test.ts` for the pure helpers; `code-template-previews.test.ts` skeleton.
- **No live writes in this plan** — `--dry-run` only.

### Plan 2 — Run the pipeline LIVE + wire URLs into the 16 template files
- **Depends on Plan 1.** This is the cost-incurring, data-mutating plan.
- Run the script for real: query the account, generate gap carousels (log every Gemini call), snapshot, upload, rewrite the 16 `src/lib/render/templates/*.ts` files.
- Verify: `git diff` shows up to 16 `preview:` lines added; the bucket holds the PNGs; re-run the script → no-op (`git diff --quiet`).
- Manual visual review of all 16 PNGs; re-run individual templates with a better topic if a cover is poor.
- Make `code-template-previews.test.ts` GREEN (all 16 templates have a URL).
- Commit the edited template files.

### Plan 3 — Picker `<img>` simplification + tests + Playwright smoke
- **Depends on Plan 2** (every code template must have a `preview` before deleting the fallback).
- Simplify `template-tile-preview.tsx` to the single-branch `<img>`; delete the `<SlidePreview>` branch + `makeSampleSlide` import. Confirm `template-picker.tsx` needs no change (it does not import `makeSampleSlide`).
- REWRITE `template-tile-preview.test.tsx` + `template-picker.test.tsx` to the new `<img>` contract.
- Add the Playwright picker smoke (PREVIEW-05) — all 16 code tiles + live DB tiles render `<img>` with valid `src`, no broken images. Use `mcp__playwright__browser_click` for any React interaction.
- Full `npx vitest run` + Playwright smoke green; verify the 3 fixture suites stay 45/45 GREEN.

**Cross-plan dependencies:** Plan 1 → Plan 2 (script must exist before the live run) → Plan 3 (fallback can't be deleted until all 16 previews exist). The picker simplification in Plan 3 is irreversible-feeling but trivially safe once Plan 2 confirms 16/16 previews. Plan 2 is the only plan that spends money or mutates production data.

## tsc / Test Baseline

- **`tsc --noEmit` baseline:** exactly **20 errors** `[VERIFIED: npx tsc --noEmit 2>&1 | grep -c "error TS" → 20, run 2026-05-20]`. These are pre-existing test-mock typing errors (e.g. `projects-delete.test.ts` Mock generic mismatch) — unrelated to phase 90. The phase must NOT increase this count. The script is new code and must be clean; the picker simplification removes code so it should not add errors.
- **vitest baseline:** STATE.md — the 3 fixture suites (`legacy-templates-byte-identical`, `-regression`, `new-templates-parity`) GREEN at 45/45; the failing baseline is unrelated tests (auth/stripe/legal/api-keys/editorial-serif fixture-regen). Phase 90 must introduce ZERO new failures and keep the fixture suites GREEN.

## Sources

### Primary (HIGH confidence — direct codebase read, 2026-05-20)
- `src/lib/render/preview-render.ts` — `renderCoverPreviewPng` signature + behavior
- `src/app/api/admin/templates/route.ts` — Storage upload pattern, `getPublicUrl`, bucket usage
- `src/lib/supabase/admin.ts` — `createAdminClient` service-role pattern
- `src/lib/services/carousel.ts` — `generateCarousel` signature, cost surface, template snap, credit-gate docstring
- `src/lib/services/projects.ts` — `getProject` / `listProjects` query shapes
- `src/lib/render/templates/index.ts` — `SlideTemplate.preview` field, `templates[]`, `TEMPLATE_IDS`, `HIDDEN_FROM_PICKER`, `pickerTemplates`
- `src/lib/render/templates/registry.ts` — `resolveTemplate`, `getPickerDbTemplates`
- `src/components/slides/template-tile-preview.tsx` + `template-picker.tsx` — current picker tile
- `src/components/slides/__tests__/template-tile-preview.test.tsx` + `src/__tests__/components/template-picker.test.tsx` — existing tests to rewrite
- `scripts/rerender-hero-by-slug.ts`, `generate-template-thumbnails.ts`, `test-murphy-carousel.ts` — script conventions (env, service-role client, render loop, asset rewrite)
- `supabase/migrations/20260519_phase86_template_previews_bucket.sql` — bucket existence + RLS
- `supabase/schema.sql` + `migrations/002_add_template_and_topic.sql` + `migrations/20260427_explore_remix_phase29.sql` — `projects` + `published_carousels` schemas
- `vitest.config.ts`, `package.json` — test framework + dependency versions
- `.env.local` (key presence only) — confirmed `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `GEMINI_API_KEY`, `PEXELS_API_KEY`, `NEXT_PUBLIC_APP_URL` all populated
- `npx tsc --noEmit` — 20-error baseline

### Secondary (MEDIUM confidence)
- `auth.admin.listUsers` usage — standard `@supabase/supabase-js` service-role API; no in-repo precedent, so a `--user-id` flag is recommended as the primary input.

### Tertiary (LOW confidence)
- None — every claim is grounded in a direct file read.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module reused is read directly; zero new dependencies.
- Architecture: HIGH — the pipeline is a composition of verified phase-86 primitives + `generateCarousel`.
- Pitfalls: HIGH — the `generateCarousel` template-snap, `upsert` flag, asset-origin, and 15-vs-16 discrepancy are all confirmed against source.
- One MEDIUM item: `template-previews` bucket may not be applied to the remote project (STATE.md flags it) — script must pre-flight check.

**Research date:** 2026-05-20
**Valid until:** ~2026-06-20 (stable — internal codebase, no fast-moving externals). Re-verify if phase 89's brand-kit removal lands changes to `template-picker.tsx` or the templates registry before phase 90 executes.
