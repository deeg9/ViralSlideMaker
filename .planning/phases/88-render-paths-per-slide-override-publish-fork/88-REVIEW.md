---
phase: 88-render-paths-per-slide-override-publish-fork
status: clean
depth: standard
date: 2026-05-19
files-reviewed: 14
findings: { critical: 0, warning: 0, info: 1 }
---

# Phase 88 Code Review — Render Paths + Per-Slide Override + Publish/Fork

**Status: CLEAN** — no Critical or Warning findings. 1 Info note.

## Scope

14 source files changed across plans 88-01 / 88-02 / 88-03 (tests + docs
excluded from this review):

- `src/app/api/render/route.ts`
- `src/app/api/v1/projects/[id]/download/route.ts`
- `src/app/(dashboard)/project/[id]/publish-actions.ts`
- `src/lib/services/publish.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/generate-slides.ts`
- `src/app/(dashboard)/project/[id]/actions.ts`
- `src/components/editor/slide-editor.tsx`
- `src/app/(dashboard)/project/[id]/page.tsx`
- `src/lib/render/templates/registry.ts`
- `src/lib/render/resolve-per-slide-template.ts`
- `src/lib/render/render-slide.ts`
- `src/lib/render/render-slide-satori.tsx`
- `src/app/api/v1/explore/[slug]/fork/route.ts`

## Findings

### Critical (0)
None.

### Warning (0)
None.

### Info (1)

**[Info] Render routes issue two registry reads per request.** The render route,
download route, and publish paths each call `await resolveTemplate(...)` (which
runs `getDbRows()` internally) AND `await getDbTemplatesMap()` (which also runs
`getDbRows()`). This is two awaits but NOT two network round-trips: both go
through the registry's shared ~60s TTL cache (`getDbRows()` serves the warm
cache on the second call within the same request). No fix needed — the cost is
one DB fetch per request window. Noted only for completeness; consolidating
into a single combined accessor is a possible (optional) future micro-opt.

## Correctness review

- **Sync→async render-path conversions (5 sites):** each `getTemplate(id)` →
  `await resolveTemplate(id)` swap was verified to sit in an already-`async`
  function/handler. The `synthesizeBrandKitTemplate` brand-kit branch is
  untouched at every site. `resolveTemplate` is code-first — byte-identical to
  `getTemplate` for the 13 code ids (proven by `wire-async-resolution-byte-
  identity.test.ts`). CORRECT.
- **`buildSystemPrompt` optional param:** `resolvedTemplate ?? (templateId ?
  getTemplate(templateId) : undefined)` — correct precedence; the function
  stays sync; the `getTemplate` import is correctly retained as the fallback.
  `generate-slides.ts` passes `resolvedTemplate` as the 4th arg with `undefined`
  in the 3rd (recipe) slot — correct, the existing call passed only 2 args.
- **`resolvePerSlideTemplate` DB-awareness:** `if (code) getTemplate; else if
  (dbMatch) dbMatch; else projectTemplate` — STYLESPEC-10 silent-fallback
  preserved for genuinely-unknown ids; TPLREND-05 reference identity preserved
  for no-override. Stays synchronous. CORRECT.
- **Builder param threading:** `buildSlideElement` (7th param) and
  `buildSlideHtml` (5th param) add an OPTIONAL trailing `dbTemplates` —
  every existing call shape (incl. the parity-test-pinned shapes) is
  unaffected. CORRECT.
- **`slide-editor.tsx` editor canvas:** `TEMPLATE_IDS.includes(id) ?
  getTemplate(id) : (dbMatch?.template ?? getTemplate(id))` — a code id
  resolves sync; a DB id resolves from the server-fetched list; a deleted DB
  id falls through to `getTemplate`'s `templates[0]` graceful fallback. No
  async added to the client render body. CORRECT.
- **Fork route:** `.select` now fetches `template_id`; `.insert` uses
  `(published.template_id as string | null) ?? 'bold-minimal'` — matches the
  `fork_published_carousel` RPC's `COALESCE(pub.template_id,'bold-minimal')`
  exactly. The RPC is correctly left untouched (it already inherits). CORRECT.
- **`getDbTemplatesMap`:** drops code-id-collision rows via
  `CODE_TEMPLATE_ID_SET`; never throws (delegates to the never-throwing
  `getDbRows`). CORRECT.

## Security review

- No new external-input trust boundary. `resolveTemplate` / `getDbTemplatesMap`
  read `public.templates` via the RLS-respecting registry layer and never
  throw — a DB read failure degrades to code-templates-only / an empty map.
- The fork route's `template_id` now flows from a DB column (`published_carousels.
  template_id`) into a `projects` insert; the closed-enum / registry-fallback
  discipline means an unknown/deleted id renders via `templates[0]` — no
  injection or crash surface. No `template_id` user-input path widened.
- No schema migration; no auth/credit logic touched; no secrets.

## Quality

- `npx tsc --noEmit` — zero errors in all 14 Phase 88 source files.
- Comments are accurate and reference the phase/requirement (WIRE-03/04/05).
- The flagged CONTEXT.md deviations (sync helpers via optional params instead
  of asyncification) are documented in-code and in the plan SUMMARYs — an
  intentional, well-reasoned design choice, not an oversight.

## Verdict

**CLEAN** — Phase 88's 14 source files contain no Critical or Warning issues.
The single Info note is a benign double-read masked by the registry TTL cache.
No fixes required.
