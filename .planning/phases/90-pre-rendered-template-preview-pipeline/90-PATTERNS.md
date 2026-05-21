# Phase 90: Pre-Rendered Template Preview Pipeline - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 6 distinct artifacts (1 new script, 16 template-file edits as one class, 1 component edit, 3 test files)
**Analogs found:** 6 / 6 — every artifact has a strong in-repo structural analog

> Scope note: RESEARCH.md (`90-RESEARCH.md`) owns the integration enumeration — signatures, pitfalls, cost surface, the upsert deviation. This file is the **structural-analog companion**: for each new/modified artifact it names the single closest existing file the executor should copy the *shape* from, with concrete excerpts. Do not re-derive what RESEARCH.md already states.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/render-template-previews.ts` | script (Node/tsx, one-off) | batch / file-I/O + DB read + Storage write | `scripts/rerender-hero-by-slug.ts` | exact (service-role one-shot render→upload script) |
| `src/lib/render/templates/{slug}.ts` ×16 | model (flat config object) | transform (one `preview:` line added) | `src/lib/render/templates/highlight-bar.ts` | exact (the simplest flat `SlideTemplate` literal) |
| `src/components/slides/template-tile-preview.tsx` | component (client) | request-response (render) | its own existing `<img>` branch (lines 27-33) | exact (delete one branch, keep the other) |
| `src/lib/render/templates/__tests__/code-template-previews.test.ts` | test (pure data assertion) | — | `src/lib/render/templates/__tests__/keeper-curation.test.ts` | exact (iterate `templates[]`, assert a field invariant) |
| `scripts/__tests__/render-template-previews.test.ts` | test (script-helper unit) | — | `scripts/__tests__/build-shapes.test.ts` | role-match (only existing `scripts/__tests__` test — see note) |
| `src/components/slides/__tests__/template-tile-preview.test.tsx` (REWRITE) | test (component) | — | itself (current file — rewrite to single-branch) | exact |

---

## Pattern Assignments

### `scripts/render-template-previews.ts` (NEW — script, one-off render→upload pipeline)

**Primary analog:** `scripts/rerender-hero-by-slug.ts` — the closest existing file. It is a one-shot `tsx` script that builds a service-role client, fetches a DB row, renders a PNG via a production render helper, uploads to a Storage bucket, reads back the public URL, and updates a row. Phase 90's script is the same skeleton, looped over 16 templates.

**Secondary analog:** `scripts/generate-template-thumbnails.ts` — owns the `templates[]` iteration loop, the `/^[a-z0-9-]+$/` id-safety guard (V5 input-validation control from RESEARCH.md Security Domain), and the `rewriteAssetSrcs` data-URI fallback for `/textures/*` assets (Pitfall 3 fallback).

**Module-doc-comment + run-instructions header** (copy this shape — `rerender-hero-by-slug.ts:1-16`):
```typescript
/**
 * One-off script: render a real photo-backed cover-preview PNG for every code
 * template and wire the resulting public URL onto each template source file.
 * ...
 * Run:
 *   npx tsx scripts/render-template-previews.ts [--user-id=<uuid>] [--dry-run]
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *               GEMINI_API_KEY, PEXELS_API_KEY, NEXT_PUBLIC_APP_URL.
 */
```

**Flag parsing** (copy `rerender-hero-by-slug.ts:23-27` — the `--slug=` parser; phase 90 needs `--user-id=` + a boolean `--dry-run`):
```typescript
function parseFlag(argv: string[], name: string): string | undefined {
  const flag = argv.find((a) => a.startsWith(`--${name}=`))
  return flag ? flag.slice(`--${name}=`.length) : undefined
}
// boolean flag: argv.includes('--dry-run')
```

**Env preflight — `requireEnv`** (copy VERBATIM — `rerender-hero-by-slug.ts:29-36`; this is the established `scripts/` convention, identical to the pattern RESEARCH.md cites):
```typescript
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`[render-previews] missing env: ${name}`)
    process.exit(1)
  }
  return v
}
```

**Service-role client construction** (copy VERBATIM — `rerender-hero-by-slug.ts:54-59`; `auth: { persistSession: false, autoRefreshToken: false }` is the script-correct option set):
```typescript
const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
```
> Note: `src/lib/supabase/admin.ts::createAdminClient()` is the alternative (reads env internally). The inline `createClient` form above is the *established `scripts/` convention* — both `rerender-hero-by-slug.ts` and the admin route work; for a `scripts/` file, copy the inline form for consistency with sibling scripts.

**`main()` structure** (copy the shape — `rerender-hero-by-slug.ts:52-163`): numbered steps, `console.log('[render-previews] ...')` prefixed at every step, `process.exit(1)` on each error branch (NOT thrown — fail loud and exit), a final `console.log('[render-previews] STATUS: ok')`.

**Script-bottom invocation** (copy VERBATIM — `rerender-hero-by-slug.ts:165-168`; identical in `generate-template-thumbnails.ts:100-103` and `test-murphy-carousel.ts:102-105` — the universal `scripts/` tail):
```typescript
main().catch((err) => {
  console.error('[render-previews] fatal:', err)
  process.exit(1)
})
```

**`templates[]` iteration + id-safety guard** (copy — `generate-template-thumbnails.ts:77-79`; this is the V5 path-injection control):
```typescript
for (const template of templates) {
  if (!/^[a-z0-9-]+$/.test(template.id)) {
    throw new Error(`[render-previews] Unsafe template id '${template.id}' — must match [a-z0-9-]+`)
  }
  // ...gap detect → snapshot → upload → rewrite
}
```

**`/textures/*` asset fallback** — if `origin = NEXT_PUBLIC_APP_URL` proves unreachable (Pitfall 3), port `rewriteAssetSrcs` + `resolveLocalAssetToDataUri` VERBATIM from `generate-template-thumbnails.ts:37-72`. Preferred path per RESEARCH.md is passing `origin` to `renderCoverPreviewPng` — keep the data-URI port as the documented fallback only.

**Pure helpers to export separately from `main()`** (so `scripts/__tests__/render-template-previews.test.ts` can unit-test them — see Wave 0): a gap-map builder, a `code-templates/${id}.png` path builder, and an idempotent source-file rewriter. `build-shapes.ts` is the precedent for a `scripts/` file that exports testable helpers alongside its `main()`.

---

### `src/lib/render/templates/{slug}.ts` ×16 (MODIFIED — add one `preview:` line)

**Analog:** `src/lib/render/templates/highlight-bar.ts` — the shortest, plainest flat `SlideTemplate` literal in the directory. Every one of the 16 template files follows the identical `export const <camelName>: SlideTemplate = { ... }` shape (verified against `highlight-bar.ts` and `news-oracle.ts`).

**Target — append `preview:` as the last field before the closing brace:**
```typescript
export const highlightBar: SlideTemplate = {
  id: 'highlight-bar',
  name: 'Highlight Bar',
  thumbnail: '/templates/highlight-bar.png',
  // ...all existing fields, unchanged...
  sample: {
    hook_text: 'HOW I GAINED 50K FOLLOWERS',
    body_text: 'In 30 days using only carousel posts.',
  },
  preview: 'https://<project>.supabase.co/storage/v1/object/public/template-previews/code-templates/highlight-bar.png',
}
```

**The 16 files** (canonical = `TEMPLATE_IDS`; CONTEXT.md's "15" omits `y2k-pop` — Pitfall 4):
`bold-yellow`, `brutalist-grid`, `chrome-pulse`, `documentary`, `editorial-serif`, `highlight-bar`, `magazine-bold`, `news-cyan`, `news-drop`, `news-oracle`, `notes-app-chic`, `paper-essay`, `soft-sage`, `sunset-tabloid`, `tr3nding-news`, `y2k-pop`.
(`db-template-row.ts`, `decorative.ts`, `premium-tier.ts`, `registry.ts`, `validate.ts`, `index.ts` are NOT templates — skip; they have no `export const ...: SlideTemplate` literal.)

**The `preview` field already exists on the type** — `src/lib/render/templates/index.ts:103` declares `preview?: string`. No type change needed; the 16 files just set a value.

**Idempotent rewriter contract:** if a file already has a `preview:` line, *replace its value*; else *insert before the closing `}`*. Each file is a flat object literal ending in `\n}\n` — a re-run on unchanged data must produce a no-op `git diff` (RESEARCH.md "Idempotency strategy").

---

### `src/components/slides/template-tile-preview.tsx` (MODIFIED — collapse two branches to one)

**Analog:** its own existing `<img>` branch — the component ALREADY contains the exact target markup. Phase 90 deletes the fallback branch and the now-dead imports; it does not write new JSX.

**Current two-branch body** (`template-tile-preview.tsx:17-47`) — the `<img>` branch is lines 22-33, the `<SlidePreview>` fallback is lines 36-46:
```typescript
export function TemplateTilePreview({ template }: { template: SlideTemplate }) {
  if (typeof template.preview === 'string' && template.preview.length > 0) {
    return (
      <img
        src={template.preview}
        alt={`Preview of ${template.name}`}
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }
  // Fallback — the existing live picker tile body, unchanged.
  return (
    <SlidePreview slide={makeSampleSlide(template)} template={template}
      index={0} slideIndex={0} totalSlides={1} editable={false} />
  )
}
```

**Target single-branch body** — keep the `<img>` JSX VERBATIM (lines 28-32), drop the `if`, drop the fallback `return`, and delete the two now-unused imports (`makeSampleSlide` line 14, `SlidePreview` line 15):
```typescript
'use client'

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
- Update the top doc-comment (lines 3-11) — it currently describes the two-branch ADMIN-02 behavior; rewrite to the phase-90 single-branch forcing-function rationale (RESEARCH.md "Code Examples" has drop-in comment text).
- **Do NOT delete the `makeSampleSlide` module itself** — `scripts/generate-template-thumbnails.ts:29` still imports it. Only the import *in this component* is removed.
- `template-picker.tsx` needs NO change — it does not import `makeSampleSlide` (verified by RESEARCH.md; it only renders `<TemplateTilePreview>`).

---

### `src/lib/render/templates/__tests__/code-template-previews.test.ts` (NEW — Wave 0, PREVIEW-01)

**Analog:** `src/lib/render/templates/__tests__/keeper-curation.test.ts` — same directory, same shape: imports `templates` from `@/lib/render/templates`, iterates the array, asserts a per-entry invariant. Phase 90's test asserts every entry has a non-empty, URL-shaped `preview`.

**Imports + describe shape to copy** (`keeper-curation.test.ts:14-21, 53`):
```typescript
import { describe, it, expect } from 'vitest'
import { templates } from '@/lib/render/templates'

describe('Phase 90 (PREVIEW-01) — every code template has a preview PNG', () => {
  it('every templates[] entry has a non-empty, URL-shaped preview', () => {
    for (const t of templates) {
      expect(typeof t.preview, `'${t.id}' preview must be a string`).toBe('string')
      expect((t.preview ?? '').length, `'${t.id}' preview must be non-empty`).toBeGreaterThan(0)
      expect(t.preview, `'${t.id}' preview must be an https URL`).toMatch(/^https:\/\//)
    }
  })
})
```
> Per-entry message strings (`` `'${t.id}' ...` ``) are the established convention in `keeper-curation.test.ts` — a failure names the offending template. This test is RED until Plan 2's live run wires the URLs; it locks the forcing function.

---

### `scripts/__tests__/render-template-previews.test.ts` (NEW — Wave 0, PREVIEW-02/03)

**Analog:** `scripts/__tests__/build-shapes.test.ts` — the ONLY existing `scripts/__tests__/` test, and the directly relevant precedent (a test for a one-off `scripts/` generator). It demonstrates two things phase 90's test needs:
1. **Pure-helper unit testing** — phase 90's script must `export` its gap-map builder, path builder, and source-file rewriter separately from `main()` so the test imports and exercises them WITHOUT a live DB. `build-shapes.test.ts` is the precedent for testing a `scripts/` file's logic.
2. **Idempotency assertion** — `build-shapes.test.ts:206-220` (Test 11) re-runs the operation and hashes outputs to prove a no-op second run. Phase 90's source-file rewriter must be asserted idempotent the same way (run rewriter twice on the same input string → identical output).

**Imports + describe shape to copy** (`build-shapes.test.ts:12, 55`):
```typescript
import { describe, it, expect } from 'vitest'
// import the pure helpers the script exports:
// import { buildGapMap, previewStoragePath, rewriteTemplateSource } from '../render-template-previews'

describe('render-template-previews — pure helpers', () => {
  it('previewStoragePath builds code-templates/{slug}.png', () => {
    expect(previewStoragePath('news-oracle')).toBe('code-templates/news-oracle.png')
  })
  it('rewriteTemplateSource is idempotent — second run is a no-op', () => {
    const once = rewriteTemplateSource(SRC, 'https://x/p.png')
    const twice = rewriteTemplateSource(once, 'https://x/p.png')
    expect(twice).toBe(once)
  })
})
```
> Difference from the analog: `build-shapes.test.ts` runs the WHOLE script via `execSync` (it has no side-effect-free helpers to import). Phase 90 should prefer **importing pure helpers directly** (no `execSync`, no live DB, no Gemini spend) — only the rewriter/path/gap-map logic is unit-tested here; the live pipeline is verified manually in Plan 2.

---

### `src/components/slides/__tests__/template-tile-preview.test.tsx` (REWRITE — Wave 0, PREVIEW-04)

**Analog:** itself — the current file already uses the correct stack (`render`/`screen` from `@testing-library/react`, `pickerTemplates` fixtures). The rewrite *deletes* the fallback-branch assertions.

**Current tests assert the DELETED contract** (`template-tile-preview.test.tsx:34-38`) — these must be removed:
```typescript
// DELETE — the fallback branch no longer exists:
it('renders <SlidePreview> ... when template.preview is absent', () => {
  render(<TemplateTilePreview template={codeTemplate} />)
  expect(screen.getByTestId('slide-preview')).toBeTruthy()
  ...
})
```

**Keep + generalize the `<img>` assertions** (`template-tile-preview.test.tsx:27-32, 40-43`) — these already test the surviving branch; rewrite so a code template ALSO renders `<img>`, never `slide-preview`:
```typescript
it('always renders the preview <img>, never <SlidePreview>', () => {
  render(<TemplateTilePreview template={{ ...pickerTemplates[0], preview: 'https://example.com/cover.png' }} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/cover.png')
  expect(screen.queryByTestId('slide-preview')).toBeNull()
})
```

**Sibling rewrite — `src/__tests__/components/template-picker.test.tsx`** (PREVIEW-05): RESEARCH.md flags it does `getAllByTestId('slide-preview')` and expects `pickerTemplates.length` previews. After PREVIEW-04 there are zero `slide-preview` nodes — switch the assertion to `getAllByRole('img')` count. Same `@testing-library/react` stack; treat it as the same rewrite class.

---

## Shared Patterns

### Service-role client (any cross-account / RLS-bypassing access)
**Source:** `scripts/rerender-hero-by-slug.ts:54-59` (inline `createClient` — the `scripts/` convention) — secondary `src/lib/supabase/admin.ts::createAdminClient()`.
**Apply to:** the new script's DB query, Storage upload, and `auth.admin.listUsers` email→userId step.
```typescript
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
```

### Storage upload + public URL (the snapshot upload, step 7)
**Source:** `src/app/api/admin/templates/route.ts:130-139` — the verified upload+`getPublicUrl` pair against the SAME `template-previews` bucket.
**Apply to:** the new script's per-template upload.
```typescript
// admin route uses upsert:false + a fresh `${admin.id}/${id}.png` path.
const previewPath = `code-templates/${template.id}.png`        // deterministic — re-runs overwrite
const { error: uploadErr } = await adminClient.storage
  .from('template-previews')
  .upload(previewPath, previewBuffer, {
    contentType: 'image/png',
    upsert: true,            // <-- CRITICAL DEVIATION from the analog (was false)
  })
if (uploadErr) throw new Error(`upload failed: ${uploadErr.message}`)
const { data: pub } = adminClient.storage.from('template-previews').getPublicUrl(previewPath)
const previewUrl = pub.publicUrl
```
> **The one mandatory deviation from the copied code:** the deterministic `code-templates/{slug}.png` path REQUIRES `upsert: true`. Copying `route.ts`'s `upsert: false` verbatim breaks the second run (Pitfall 2). This is the single most error-prone copy in the phase — flag it in the plan.

### Cover snapshot render (the snapshot, step 6)
**Source:** `src/app/api/admin/templates/route.ts:96-104` — the verified `renderCoverPreviewPng` call shape; helper itself at `src/lib/render/preview-render.ts:29-43`.
**Apply to:** the new script's per-template cover render.
```typescript
const template = await resolveTemplate(templateId)       // resolveTemplate from registry.ts
const buffer = await renderCoverPreviewPng(
  slides[0],                                             // real cover slide w/ photo background_url
  template,
  { slideIndex: 0, totalSlides: slides.length, topic: project.topic ?? undefined },
  process.env.NEXT_PUBLIC_APP_URL,                       // origin — admin route passes new URL(request.url).origin; a script has no request
)
```
> Deviation from the analog: the admin route's `origin` is `new URL(request.url).origin`. A standalone script has no request — pass `NEXT_PUBLIC_APP_URL` (Pitfall 3). Style fidelity comes from the `template` arg passed here, NOT the project's `template_id` (Pitfall 1 mitigation).

### Carousel generation for gap templates (step 5)
**Source:** `src/lib/services/carousel.ts::generateCarousel` (signature verified in RESEARCH.md Pattern 5). Closest *script-side* usage precedent for a generation call from a `tsx` script: `scripts/test-murphy-carousel.ts` (it calls the lower-level `generateSlideContent` + render loop — same script idiom, prefer the higher-level `generateCarousel`).
**Apply to:** filling templates with no exemplar on the account.
```typescript
const { projectId } = await generateCarousel(admin, userId, {
  topic: TOPIC_MAP[templateId],   // curated evergreen topic — see RESEARCH.md Open Question 2
  templateId,
  slideCount: 3,                  // floor — minimum cost
  imageSource: 'stock',           // Pexels — cheap; NEVER 'ai' (Imagen per slide)
})
// Pitfall 1: the returned project's template_id may be SNAPPED. Ignore it —
// snapshot via resolveTemplate(templateId), not the project row.
```

### Standalone-script idioms (every `scripts/` file)
**Source:** common to `rerender-hero-by-slug.ts`, `generate-template-thumbnails.ts`, `test-murphy-carousel.ts`.
**Apply to:** the whole new script.
- Module-level doc comment with a `Run:` line and a `Requires env:` line.
- `[script-name]`-prefixed `console.log` at every step.
- `main()` + `main().catch((err) => { console.error(...); process.exit(1) })` tail.
- `process.exit(1)` on each handled error inside `main()` (fail loud — do not silently continue).

---

## No Analog Found

None. Every artifact has a strong in-repo structural analog:

| Artifact | Note |
|----------|------|
| Email→userId via `auth.admin.listUsers` | No in-repo precedent for this specific call (RESEARCH.md Pattern 2 confirms). Mitigated structurally: RESEARCH.md recommends a `--user-id=` flag as the primary input — the flag parser HAS an analog (`rerender-hero-by-slug.ts:23-27`). `listUsers` is plain `@supabase/supabase-js` API; no analog needed. |

---

## Metadata

**Analog search scope:** `scripts/`, `scripts/__tests__/`, `src/lib/render/`, `src/lib/render/templates/`, `src/lib/render/templates/__tests__/`, `src/components/slides/`, `src/components/slides/__tests__/`, `src/app/api/admin/templates/`.
**Files read for extraction:** `template-tile-preview.tsx`, `news-oracle.ts`, `highlight-bar.ts`, `rerender-hero-by-slug.ts`, `generate-template-thumbnails.ts`, `test-murphy-carousel.ts`, `build-shapes.test.ts`, `api/admin/templates/route.ts`, `preview-render.ts`, `db-template-row-preview.test.ts`, `keeper-curation.test.ts`, `template-tile-preview.test.tsx`, `templates/index.ts` (preview field).
**Pattern extraction date:** 2026-05-20
**Early stopping:** 6 artifacts, 6 strong analogs — no broader search needed.
