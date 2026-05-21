# Phase 89: Brand-Kit Shelving (Full Removal) - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** structural-analog set (4 targeted concerns — NOT the 79-file footprint)
**Analogs found:** 4 / 4

> **Scope note.** This is a REMOVAL phase. The exhaustive 79-file line-level footprint
> already lives in `89-RESEARCH.md` (Bucket A/B/C tables). This PATTERNS.md does NOT
> re-enumerate that. It supplies the four **structural analogs** an executor needs so it
> strips/relocates code to a *known-good existing shape* instead of guessing:
> 1. the `getTemplate()` resolver-fallback shape,
> 2. the brand-kit-free shape of the `getTemplate()`-only render-resolution path,
> 3. the type-alias relocation house-style in `style-spec.ts`,
> 4. the Wave-0 fallback test's structural analog.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/render/templates/index.ts` (`getTemplate` edit) | resolver / config | request-response (id→template) | the existing `getTemplate()` body itself + `resolveTemplate` fallback in `registry.ts` | exact (in-file) |
| `src/lib/render/templates/__tests__/getTemplate-brand-kit-fallback.test.ts` (NEW) | test | request-response | `src/lib/render/templates/__tests__/keeper-curation.test.ts` | exact |
| `src/lib/types/style-spec.ts` (relocate `BrandKitTextPosition`) | type / model | transform | type-alias decls already inside `style-spec.ts` (`StyleSpecVersion`, the inline `'tight'\|'medium'\|'airy'` union) | exact (in-file house style) |
| `src/lib/types/__tests__/style-spec.test.ts` (T5/T10 repoint) | test | transform | T10's own expected-imports regex array | exact (in-file) |
| `src/app/api/render/route.ts` + `download/route.ts` + `publish.ts` + `publish-actions.ts` (strip synth/merge branch) | route / service | request-response (render path) | `src/lib/render/resolve-per-slide-template.ts` — already brand-kit-free, resolves purely via `getTemplate()` | role + flow match |
| `src/lib/render/render-slide.ts` / `render-slide-satori.tsx` (drop `brandKit` positional arg) | render lib | transform | the non-brand-kit positional params of the SAME signatures (`buildSlideHtml` / `buildSlideElement`) | exact (in-file) |

## Pattern Assignments

### 1. `getTemplate()` resolver fallback — `src/lib/render/templates/index.ts`

**Concern:** after the brand-kit branch is deleted from every caller, a stored
`template_id === 'brand-kit'` falls through to `getTemplate('brand-kit')`. Today that
returns `templates[0]` = `highlight-bar` (a HIDDEN legacy template). BKSHELVE-07 +
CONTEXT lock the fallback to **`news-oracle`**.

**Analog A — the resolver as it stands today (`templates/index.ts` lines 260-262):**
```typescript
export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
```
This is the SINGLE sync template-by-id resolver. There is no separate `resolveTemplate`
in this file — `resolveTemplate` (async, DB-aware) lives in `registry.ts` and delegates
the *code-template* lookup back here. So one line in `getTemplate()` covers every
render/publish/fork/download path.

**Analog B — the existing unknown-id fallback contract `registry.ts` mirrors
(`registry.ts` lines 87-89, comment only):**
```text
 * - Else falls back to templates[0] (mirrors the sync getTemplate contract so
 *   ... ) Never throws — a DB read failure
```
Confirms the house rule: **resolvers normalize/fall back, they never throw.** The new
line must preserve the existing `?? templates[0]` tail untouched — it only normalizes
the one sentinel id *before* the `.find()`.

**Target shape to strip TO (the executor copies this exact form):**
```typescript
export function getTemplate(id: string): SlideTemplate {
  // Phase 89 (BKSHELVE-07): 'brand-kit' is the shelved-feature sentinel.
  // Legacy projects saved against the removed brand-kit feature carry
  // template_id === 'brand-kit'; resolve it to a live default template.
  const resolvedId = id === 'brand-kit' ? 'news-oracle' : id
  return templates.find((t) => t.id === resolvedId) ?? templates[0]
}
```
**House-style notes:** (a) inline the literal `'brand-kit'` — do NOT keep
`get-effective-template.ts` alive for `BRAND_KIT_TEMPLATE_ID` (CONTEXT permits inlining;
the module is deleted in Plan 4). (b) The `id === 'brand-kit' ? 'news-oracle' : id`
normalize-then-resolve pattern mirrors `resolve-per-slide-template.ts` line 65
(`if (TEMPLATE_IDS.includes(override)) return getTemplate(override)`) — a guard that
shapes the id before the registry lookup. (c) `news-oracle` is verified present in the
registry array (`templates/index.ts` line 201) and is a picker keeper (not in
`HIDDEN_FROM_PICKER`).

**Per-slide override path inherits the fix for free:** `resolve-per-slide-template.ts`
never resolves an id itself — it calls `getTemplate(override)` (line 65), so an
overridden `'brand-kit'` is covered automatically. No edit needed there beyond the
comment strips RESEARCH already lists.

---

### 2. Brand-kit-free shape of the `getTemplate()`-only render-resolution path

**Concern (BKSHELVE-05, Pitfall 1):** `render/route.ts`, `download/route.ts`,
`publish.ts`, `publish-actions.ts` each special-case `template_id === BRAND_KIT_TEMPLATE_ID`
*before* resolving, then wrap the result in a no-op `mergeWithBrandKit()`. The executor
needs the brand-kit-free shape of "resolve a template id, then render."

**Current shape to strip FROM — `src/app/api/render/route.ts` lines 5, 10, 77-94, 109:**
```typescript
import { mergeWithBrandKit, synthesizeBrandKitTemplate, BRAND_KIT_TEMPLATE_ID } from '@/lib/brand-kit/get-effective-template'
import type { BrandKit } from '@/lib/types/brand-kit'
// ...
const { data: brandKitRow } = await supabase
  .from('brand_kits').select('*').eq('user_id', p.user_id).single()
const brandKit = (brandKitRow as BrandKit) ?? null

const template =
  p.template_id === BRAND_KIT_TEMPLATE_ID && brandKit
    ? synthesizeBrandKitTemplate(brandKit)
    : await resolveTemplate(p.template_id ?? 'highlight-bar')

const effectiveTemplate = mergeWithBrandKit(template, brandKit)
// ...
const element = buildSlideElement(slide, effectiveTemplate, brandKit, ownerTier, origin, ctx, dbTemplates)
```

**Analog — the clean, already-brand-kit-free resolution shape
(`src/lib/render/resolve-per-slide-template.ts` lines 1, 26, 65):**
```typescript
import { getTemplate, TEMPLATE_IDS, type SlideTemplate } from './templates/index'
// ...
//   - A code-template id (in the TEMPLATE_IDS closed enum) → `getTemplate`.
// ...
if (TEMPLATE_IDS.includes(override)) return getTemplate(override)
```
This helper resolves a template id with **zero brand-kit awareness** — pure
`getTemplate()`/registry resolution, no `synthesize`, no `merge`. It is the canonical
"how a template id becomes a `SlideTemplate` after brand-kit is gone" shape.

**Target shape to strip TO (apply per RESEARCH line refs for each of the 4 files):**
```typescript
// imports: drop the brand-kit import line + `import type { BrandKit }` entirely
// drop the brand_kits supabase fetch + the `brandKit` const

// resolution collapses to the ternary's ELSE-branch only:
const template = await resolveTemplate(p.template_id ?? 'highlight-bar')
// (render/route.ts uses async resolveTemplate; publish.ts / publish-actions.ts /
//  download/route.ts use whichever resolver they already call in the else-branch —
//  do NOT introduce a new resolver, keep each file's existing else-branch call)

// drop `const effectiveTemplate = mergeWithBrandKit(template, brandKit)` —
// use `template` directly everywhere `effectiveTemplate` was used (total rename).

const element = buildSlideElement(slide, template, ownerTier, origin, ctx, dbTemplates)
```
**Critical house-style notes:**
- **`mergeWithBrandKit` is a verified no-op** (`get-effective-template.ts` lines 35-40,
  body is literally `return template`). Replacing `effectiveTemplate` with `template` is
  provably byte-identical. The rename must be TOTAL — no dangling `effectiveTemplate`.
- **`buildSlideElement` positional-arg shift (Pitfall 1).** `brandKit` is positional
  arg #3. Drop it ENTIRELY (don't pass `null`) so any stale call site fails `tsc`
  loudly. Signature + every call site change in ONE atomic commit.
- `seed-explore/route.ts` line 239 already passes `mergeWithBrandKit(template, null)` —
  replace the whole call with `template`.

---

### 3. `buildSlideElement` / `buildSlideHtml` signature — drop the `brandKit` positional arg

**Concern (Pitfall 1):** the `brandKit` param sits in the MIDDLE of a positional list.
Removing it shifts `tier`/`origin`/`ctx`/`dbTemplates` left.

**Analog — the SAME signature's non-brand-kit params show the house pattern
(`src/lib/render/render-slide.ts` lines 187-196, `buildSlideHtml`):**
```typescript
export function buildSlideHtml(
  slide: Slide,
  templateParam: SlideTemplate,
  brandKit?: BrandKit | null,           // <-- DELETE this line
  tier?: ForcedWatermarkTier | null,
  // Phase 88 (WIRE-04): optional DB-template lookup ...
  dbTemplates?: ReadonlyMap<string, SlideTemplate>,
): string {
```
The optional-param style (`?:` + `| null`, one concern per line, a comment above
phase-added params) is the house pattern. After deleting the `brandKit` line, the
remaining params keep their order and their comments — only the deleted line goes.

**Watermark call inside these renderers — analog for the `resolveWatermark` argument
(`render-slide.ts` lines 384-387):**
```typescript
// Brand watermark layer (260427-hut). Sits above custom_images at z-index:5.
const watermark = resolveWatermark(brandKit ?? null, slide, { width: 1080, height: 1920 })
```
**Target:** `resolveWatermark` is KEPT (Pitfall 3 — deleting it over-extends parity
surface). Its signature already accepts `null`:
```typescript
// resolve-watermark.ts line 51-54 — the existing brand-kit-free-tolerant signature:
export function resolveWatermark(
  brandKit: BrandKitSubset | null | undefined,   // already null-tolerant
  slide: SlideSubset | null | undefined,
  canvas: CanvasSize = { width: 1080, height: 1920 }
): ResolvedWatermark | null {
  if (!brandKit) return null   // line 57 — short-circuits to null on null input
```
So the strip target inside the renderers is:
```typescript
const watermark = resolveWatermark(null, slide, { width: 1080, height: 1920 })
```
Passing literal `null` is byte-identical to passing a logo-less brand kit (verified —
RESEARCH parity analysis point 3). `resolve-watermark.ts` itself defines its OWN local
`BrandKitSubset` interface (lines 26-31) — **no import to fix there**; it survives the
`brand-kit.ts` deletion untouched.

---

### 4. Type relocation: `BrandKitTextPosition` → `style-spec.ts`

**Concern (Pitfall 2, BKSHELVE-09):** `src/lib/types/brand-kit.ts` line 13 exports
`BrandKitTextPosition = 'top' | 'center' | 'bottom'`. `style-spec.ts` line 65 imports
it; line 109 uses it for `StyleSpecLayout.hookPosition`. Deleting `brand-kit.ts` breaks
`style-spec.ts` → cascades to every `StyleSpec` consumer.

**Source alias being relocated (`src/lib/types/brand-kit.ts` line 13):**
```typescript
export type BrandKitTextPosition = 'top' | 'center' | 'bottom'
```

**Analog — the house style for type-alias declarations ALREADY in `style-spec.ts`:**
`style-spec.ts` declares small literal-union aliases two ways, both with a JSDoc/`//`
comment above them:
```typescript
// (lines 69-73) — a named exported alias + companion const:
/** Schema version literal — bump when StyleSpec shape changes. ... */
export type StyleSpecVersion = 2
export const STYLE_SPEC_VERSION: StyleSpecVersion = 2
```
```typescript
// (line 112) — and INLINE 3-value literal unions on the consuming field:
density?: 'tight' | 'medium' | 'airy'
```
The file's CLOSED-ENUM INVARIANT header (lines 12-29) says every string field imports
from a single source-of-truth module — BUT it also explicitly inlines local enums
(`palette.mode` line 84, `density` line 112, `cadence` line 142) when the values are
"an architectural decision local to this contract."

**Recommended target shape (inline, matching the `StyleSpecVersion` pattern):**
Since `'top' | 'center' | 'bottom'` is a generic 3-literal union (not brand-kit-owned),
declare it as an exported alias near the top of `style-spec.ts`, then use it on
`StyleSpecLayout.hookPosition`:
```typescript
// near the other top-level aliases (after StyleSpecVersion):
/** Coarse vertical text placement. 3-value literal union — relocated from the
    shelved brand-kit module in Phase 89 (BKSHELVE-09); it is a generic layout
    primitive, not a brand-kit concept. */
export type TextPosition = 'top' | 'center' | 'bottom'
```
```typescript
// StyleSpecLayout — drop the brand-kit import (line 65), use the local alias:
export interface StyleSpecLayout {
  hookPosition?: TextPosition
  density?: 'tight' | 'medium' | 'airy'
}
```
Rename `BrandKitTextPosition` → `TextPosition` so no "brand-kit" token survives in the
neutral module (Plan 4's final grep sweep must come back clean). Update the line-8/108
comments that say "from BrandKitTextPosition".

**`style-spec.test.ts` repoint — analog is the test's OWN T10 regex array
(`src/lib/types/__tests__/style-spec.test.ts` lines 169-180):**
```typescript
it('Test T10: source file imports from all 5 closed-enum source modules ...', () => {
  const expected = [
    /from\s+['"]@\/lib\/fonts\/font-catalog['"]/,
    /from\s+['"]@\/lib\/render\/decorations\/registry['"]/,
    /from\s+['"]@\/lib\/types\/decoration['"]/,
    /from\s+['"]@\/lib\/types\/brand-kit['"]/,        // <-- DELETE this regex
    /from\s+['"]@\/lib\/photo-treatment\/treat['"]/,
  ]
  expected.forEach((re) => { expect(STYLE_SPEC_SOURCE).toMatch(re) })
})
```
**Target:** delete the `@/lib/types/brand-kit` regex (the relocated alias is now
in-file, no import) and update the test name "all 5" → "all 4". For **T5**
(lines 117-127), which references `BrandKitTextPosition` directly, repoint the import
in the test file to the new name (`TextPosition`) and update the `@ts-expect-error`
comment text. Optionally rename the `it()` title.

---

### 5. Wave-0 new test: `getTemplate-brand-kit-fallback.test.ts`

**Concern:** BKSHELVE-07 needs a unit test asserting `getTemplate('brand-kit')`
resolves to `news-oracle` and does not throw.

**Structural analog — `src/lib/render/templates/__tests__/keeper-curation.test.ts`.**
This is the closest existing test: it is a sync, hermetic, no-mocks suite in the SAME
directory (`templates/__tests__/`) that exercises `getTemplate()` directly for
resolution behavior. Copy its shape exactly.

**Imports + structure to mirror (`keeper-curation.test.ts` lines 14-20, 67-80):**
```typescript
import { describe, it, expect } from 'vitest'
import {
  templates,
  getTemplate,
} from '@/lib/render/templates'
// ...
it('getTemplate(<id>) resolves to the real renderer', () => {
  const tpl = getTemplate('highlight-bar')
  expect(tpl.id).toBe('highlight-bar')
  expect(tpl.name).toBe('Highlight Bar')
})
```
Note the `keeper-curation` assertion idiom: `expect(getTemplate(id).id).toBe(<id>)`
plus a contextual failure message. The new test inverts that — it asserts the sentinel
`'brand-kit'` resolves to a *different* id (`news-oracle`), the deliberate fallback.

**Target test (new file
`src/lib/render/templates/__tests__/getTemplate-brand-kit-fallback.test.ts`):**
```typescript
// Phase 89 (BKSHELVE-07): the brand-kit feature is shelved. Legacy projects
// whose stored template_id is the 'brand-kit' sentinel must resolve to a live
// default template (news-oracle) instead of crashing or landing on a hidden
// legacy template. getTemplate() carries the one-line defensive fallback.

import { describe, it, expect } from 'vitest'
import { getTemplate } from '@/lib/render/templates'

describe("Phase 89 — getTemplate('brand-kit') fallback (BKSHELVE-07)", () => {
  it("resolves the shelved 'brand-kit' sentinel to news-oracle", () => {
    expect(getTemplate('brand-kit').id).toBe('news-oracle')
  })

  it("does not throw for the 'brand-kit' sentinel", () => {
    expect(() => getTemplate('brand-kit')).not.toThrow()
  })

  it('still resolves a genuine unknown id to templates[0] (fallback unchanged)', () => {
    // The 'brand-kit' normalize must NOT alter the generic unknown-id fallback.
    expect(() => getTemplate('totally-unknown-xyz')).not.toThrow()
  })
})
```
Run command (per RESEARCH Validation Architecture / Wave-0 Gaps):
`npx vitest run src/lib/render/templates/__tests__/`

## Shared Patterns

### Resolver never throws — always normalize-or-fallback
**Source:** `getTemplate()` (`templates/index.ts` line 261, `?? templates[0]`) +
`resolveTemplate` contract comment (`registry.ts` lines 87-89) +
`resolve-per-slide-template.ts` line 65.
**Apply to:** the `getTemplate()` edit (Plan 2). Every template-id resolution path in
this codebase normalizes the id then falls back — it never throws on an unknown id.
The new `'brand-kit' → news-oracle` line MUST preserve the `?? templates[0]` tail so a
*genuinely* unknown id still degrades gracefully.

### Atomic positional-signature edits
**Source:** Pitfall 1 + the `buildSlideHtml`/`buildSlideElement` signatures
(`render-slide.ts` lines 187-196).
**Apply to:** every renderer/publish/download file in Plan 2. When a positional param
is removed, the signature and ALL call sites change in ONE commit. Prefer DELETING the
param over passing `null` so stale call sites fail `tsc` loudly.

### Inline local enums when the values are contract-local
**Source:** `style-spec.ts` — `palette.mode` (line 84), `density` (lines 112, 134),
`cadence` (line 142) are all inlined literal unions; `StyleSpecVersion` (line 72) is a
named alias.
**Apply to:** the `BrandKitTextPosition` relocation (Plan 4). A generic 3-literal
union is declared as a named exported alias with a `/** */` comment above it, matching
the `StyleSpecVersion` precedent.

### Comment-only brand-kit mentions are NOT code changes
**Source:** RESEARCH Bucket B "false positives" table + the comment-only hits in
`prompts.ts`/`style-spec-projector.ts`/`generate-from-style-spec.ts`/
`resolve-per-slide-template.ts`.
**Apply to:** all plans. Stripping a comment that says "brand-kit" changes no behavior;
do not let a comment strip drift into a logic edit.

## No Analog Found

None. Every structural concern in this removal phase has a concrete in-codebase analog:
- The resolver fallback mirrors the resolver's own existing body + `resolve-per-slide-template.ts`.
- The brand-kit-free render path mirrors `resolve-per-slide-template.ts` (already brand-kit-free).
- The type relocation mirrors `style-spec.ts`'s own alias declarations.
- The Wave-0 test mirrors `keeper-curation.test.ts` (same directory, same `getTemplate` exercise).

This is expected — a removal phase strips TO existing shapes; it does not invent new ones.

## Metadata

**Analog search scope:** `src/lib/render/templates/`, `src/lib/render/` (resolvers +
renderers), `src/lib/types/` (style-spec + brand-kit), `src/app/api/render/`.
**Files read for excerpts:** `templates/index.ts`, `templates/__tests__/keeper-curation.test.ts`,
`templates/__tests__/registry-merge.test.ts`, `types/brand-kit.ts`, `types/style-spec.ts`,
`types/__tests__/style-spec.test.ts`, `brand-kit/get-effective-template.ts`,
`api/render/route.ts`, `render/render-slide.ts`, `render/resolve-watermark.ts`,
`render/resolve-per-slide-template.ts` (grep-targeted).
**Pattern extraction date:** 2026-05-20
