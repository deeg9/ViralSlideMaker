# Phase 58: AI Tightening + Parity QA + match-photos-to-slides — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** `--auto` (Claude-decided defaults grounded in v2.9 research synthesis + Phase 54/55/56/57 carry-forward + codebase audit + orchestrator hard constraints)

<domain>
## Phase Boundary

This is the FINAL phase of v2.9. Three concerns land together because they
gate the milestone ship: AI prompt tightening (slide-role schema +
diversity gate), the premium-gated promotion of `match-photos-to-slides.ts`
from parked to shipped, and a parity test harness + ship-gate checklist
that verifies non-regression vs. the v2.9-start baseline.

**AI tightening (AIROLE-01..05).** Gemini's response schema in
`src/lib/ai/generate-slides.ts` extends each slide with a `role` field
(closed enum: `cover | reframe | support | pivot | close`) plus an
optional `template_id_override` (closed enum from the registry). The
system prompt in `src/lib/ai/prompts.ts` gains per-role copy guidance.
The Zod schema in `src/lib/ai/schemas.ts` mirrors the additions.
`validateAndRepair` in `src/lib/ai/validate-slides.ts` defaults missing
or invalid `role` to a deterministic flat distribution and silently
strips invalid `template_id_override` values — never throws. A new
`src/lib/ai/__tests__/diversity-corpus.ts` module ships 20 fixed
prompts across creator niches as a reusable fixture; the diversity test
itself runs the corpus through the current prompt path and asserts
hook-opening trigram repetition < 30%, but is **advisory only** in
v2.9 (warns; does not fail CI).

**match-photos-to-slides.ts (MATCH-01..05).** The parked file at
`src/lib/ai/match-photos-to-slides.ts` becomes premium-tier-only via a
tier check in `src/app/(dashboard)/project/[id]/actions.ts` (the only
caller). Free tier falls through to index-order matching (Phase 56's
existing `src/lib/services/photo-match.ts`-style behavior is already
in place — the action's `uploaded.slice(0, clampedCount)` path
becomes the free fallback). `MAX_PHOTOS = 8` enforced (excess photos
fall through to index-order). Result cached by
`(photoSetSHA256, slideManifestSHA256)` key via a new lightweight
`match_photo_cache` Supabase table (lighter-weight than Storage-as-cache
per the research recommendation — ~64 chars/key + JSON value, indexed
on the composite key). 10-second timeout on the Gemini call via
`Promise.race` with `setTimeout`; on timeout/error fall through to
index-order (never blocks generation). Usage tracked as a new
`gemini_vision_match` line in `CREDIT_COSTS` + `CreditTransactionType`,
1 credit per match call, charged via `deductCredit` BEFORE the Gemini
call (refund on timeout/error mirrors the existing `imagen_generation`
refund pattern in `src/lib/services/ai-regen.ts`).

**Parity QA + ship gate (PARITY-01..06).**
- `src/lib/render/__tests__/parity.test.tsx` (NEW): for each of the 3
  Phase 56 templates (editorial-serif, notes-app-chic, brutalist-grid)
  asserts that React preview HTML and Satori SVG output reference the
  same resolver helpers from `src/lib/render/resolve-overlay.ts` —
  proven via instrumented imports + identity assertion (both renderers'
  imports of `renderGrain` / `renderVignette` etc. resolve to the same
  function reference at module load).
- `renderGrain` / `renderVignette` parity already shipped in Phase 55
  and exercised in `slide-preview.tsx` + `render-slide-satori.tsx` —
  Phase 58 only adds a test asserting both renderers consume from the
  same module path (PARITY-02).
- `scripts/render-parity-grid.ts` (NEW): manual / opt-in audit script
  that renders every template × 3 sample slides through both renderers
  and writes a side-by-side PNG grid to `parity-grid.png`. Wired as
  `npm run parity-grid`. **Not in CI** (visual aid only).
- Lint guard (PARITY-04): extend `src/lib/render/__tests__/no-css-filter.test.ts`
  to also scan the 3 new template files (editorial-serif, notes-app-chic,
  brutalist-grid) for `filter: grayscale|blur|sepia|...` substrings using
  the same `stripComments` + regex pattern. New top-level `describe` block.
- PNG metadata strip (PARITY-05): new test in
  `src/lib/download/__tests__/zip-metadata.test.ts` (NEW directory) that
  invokes `/api/render` for a sample project + asserts the returned PNG
  contains no EXIF / XMP / C2PA metadata using `image-size` (already a
  transitive dep) or `sharp.metadata()` (already present from Phase 54).
  Asserted via `metadata.exif === undefined` + `metadata.xmp === undefined`
  + no `c2pa` field.
- Cascade-delete audit (PARITY-06): extend
  `src/lib/services/projects.ts: deleteProjectService` to also remove,
  via `admin.storage.from(...).remove(...)`, hero thumbnail (already
  exists from quick-260427-vm2) + `slide-backgrounds-treated` bucket
  files matching the project's slides + `slide-backgrounds` original
  uploads. Test in `src/lib/services/__tests__/projects-delete.test.ts`
  (NEW) with mocked Supabase client asserting all 3 bucket `.remove(...)`
  calls fire with the correct path arrays.

**Ship-gate checklist.** All 13 items from PITFALLS.md "Looks Done But
Isn't" verified before phase completion (recorded in
`58-VERIFICATION.md` as a check table). The `download_zip` tracking
from Phase 54 is exercised by the `v_zip_download_rate` view; the
ship-gate doc records `downloads_baseline = 0`, asserts trivially
passable per `v2.9-METRIC-BASELINE.md` caveat.

**In scope:**
- Schema additions: `role` enum + `template_id_override` (closed enum)
  on `SlideContentSchema` (Zod) + `responseSchema` (Gemini Type) in
  `src/lib/ai/schemas.ts` + `src/lib/ai/generate-slides.ts`.
- Per-role copy guidance prepended to the existing premium addendum +
  base prompt in `src/lib/ai/prompts.ts`. Verbatim text below
  ("Locked Decisions" → D-04).
- Deterministic role distribution helper:
  `assignSlideRoles(slideCount: number): SlideRole[]` in
  `src/lib/ai/role-distribution.ts` (NEW). First slide = `cover`, last =
  `close`. Middle slides distributed by length per D-05.
- Validator: extend `validateAndRepair` to silently default missing /
  invalid `role` values to the deterministic distribution; silently
  strip invalid `template_id_override` values not in the registry.
- Diversity corpus + test: `src/lib/ai/__tests__/diversity-corpus.ts`
  (20 prompts) + `src/lib/ai/__tests__/diversity.test.ts` (advisory).
- `match-photos-to-slides.ts` integration tightening:
  - Premium-tier check in `src/app/(dashboard)/project/[id]/actions.ts`
    (the only caller — free tier falls through to existing
    index-order shortcut).
  - `MAX_PHOTOS = 8` constant inside `match-photos-to-slides.ts`;
    excess photos sliced off + remaining logged as falling through.
  - `Promise.race` against a 10-second `setTimeout` reject; timeout
    catches into existing `indexOrderFallback`.
  - `match_photo_cache` Supabase table + migration; cache key =
    `sha256(JSON.stringify(photoUrls.sort()) || JSON.stringify(slides.map(s => ({ hook: s.hook_text, body: s.body_text, is_cta: s.is_cta }))))`.
  - Credit ledger line: extend `CreditTransactionType` and
    `CREDIT_COSTS` with `gemini_vision_match: 1`. Charge before Gemini
    call; refund on timeout / error (match `imagen_generation` pattern).
- Parity tests as enumerated above.
- Cascade-delete extension to `deleteProjectService`.
- Ship-gate checklist verification document.

**Out of scope (deferred or owned elsewhere):**
- `stylize-image.ts` — DO NOT WIRE. Stays parked (orchestrator
  constraint, also Pitfall #7 + Conflict 1 from research SUMMARY).
- Free-tier match-photos fallback heuristics (orchestrator constraint —
  free tier gets index-order, full stop).
- Expanding diversity gate to fail CI (orchestrator constraint —
  v2.9 is advisory; trip threshold logs a warning).
- Adding more roles to the closed enum (orchestrator: 5 roles, no
  scope creep).
- Adding parity tests for all 11 templates (orchestrator: scoped to
  the 3 new templates from Phase 56 + the 2 helpers from Phase 55).
- Schema sunset (legacy `text_boxes[]` migration finalized in v2.8;
  v2.9 does not touch it — pre-PMF discipline).
- Imagen prompt re-tuning (v2.7 baseline holds; D-12).
- Editor UI for `template_id_override` per-slide picker (deferred —
  AI emits the override; users see the resulting template via the
  existing slide preview but cannot manually pick a per-slide template
  in v2.9. UX upgrade for v3.0+).
- New npm dependencies (orchestrator constraint).

**Test growth target:** ~25-35 new tests across the AI / parity / cascade-
delete / metadata-strip surfaces. Phase 56 + 57 baseline will be the
"existing 11 templates byte-identical" regression suite — Phase 58 must
keep it green.

## Dependency Chain

- Phase 54 ships TreatmentSpec, Imagen 4 Fast, slop guardrails, and the
  `download_zip` event + `v_zip_download_rate` view that Phase 58 ship
  gate reads from.
- Phase 55 ships the schema additions (`renderGrain` / `renderVignette`
  in resolve-overlay.ts; `template_id_override?` on Slide schema is
  ALREADY shipped per Phase 55 success criterion 1) and the lint guard
  template (`no-css-filter.test.ts`).
- Phase 56 ships the 3 new templates whose parity Phase 58 tests
  + the decorative asset library + grain PNGs.
- Phase 57 ships `extractPalette`, the editor controls, and the
  cascade-delete groundwork (the `slide-backgrounds-treated` bucket is
  the new cleanup target Phase 58 audits).
- Phase 58 is the LAST phase. After it ships, the milestone audit
  (`/gsd-audit-milestone v2.9`) runs and the milestone archives.

</domain>

<gray_areas>
## Gray Areas Identified

Areas surfaced for discussion. In `--auto` mode, Claude picks the
recommended default for each (recorded as a locked decision below) and
proceeds. The orchestrator's hard constraints from the kickoff prompt
trump any default; gray areas that are resolved by orchestrator
constraint are noted as such.

1. **Role distribution algorithm for middle slides** — RESOLVED via
   D-05 below. Even-split for length ≥ 5; all-`support` for length 3;
   special-cased for length 4. Deterministic, no randomness.

2. **`match_photo_cache` storage mechanism** — table vs. Storage. Table
   is lighter-weight (no MIME / bucket lifecycle / public URL noise).
   RESOLVED: new Supabase table `match_photo_cache` with composite PK
   `(photo_set_sha256, slide_manifest_sha256)` and a `result_jsonb`
   column. RLS off (server-only access via service role). 30-day TTL
   via existing pg_cron pattern.

3. **Credit charge timing** — charge on call vs. charge on success.
   Charge BEFORE call + refund on timeout / error (mirrors
   `imagen_generation` pattern in `src/lib/services/ai-regen.ts` line
   100-108). RESOLVED: charge before, refund on failure.

4. **Diversity test failure mode** — fail CI vs. log warning. Hard
   constraint from orchestrator: ADVISORY ONLY in v2.9 (log warning;
   do not fail CI). RESOLVED.

5. **Cascade-delete scope** — hero thumbnail only vs. full original +
   treated cleanup. RESOLVED: full scope per PARITY-06 success
   criterion 5 (hero + treated background bucket + original-source
   uploads).

6. **`template_id_override` validation strictness** — silent strip vs.
   error. RESOLVED via D-08: silent strip (matches the Phase 47
   documentary opt-out pattern of silent transformation when AI emits
   schema-valid but template-incompatible output).

7. **Refactor scope on the parked match-photos file** — rewrite vs.
   ship-as-is. The current file's logic is sound (validated via Read
   above); only minor refactors needed: `MAX_PHOTOS` constant, timeout
   `Promise.race`, cache lookup + write. RESOLVED via D-09: minor
   refactors only.

8. **Diversity corpus topic distribution** — RESOLVED via D-13: 20
   prompts across 10 creator niches (food, fashion, tech, fitness,
   finance, parenting, travel, beauty, productivity, mental-health),
   2 per niche.

9. **Hook-opening trigram window** — full hook vs. first 3 words.
   RESOLVED via D-14: first 3 whitespace-tokens of `slide.hook_text`
   on `slides[0]` (the cover slide) — that's the literal "hook
   opening" the test name implies, and 3-word repetition is the
   hardest signal to fudge.

</gray_areas>

<locked_decisions>
## Locked Decisions

D-01: Schema additions land in BOTH `schemas.ts` (Zod) AND
`generate-slides.ts` (Gemini Type/Schema), keeping the pre-Phase-58
two-source-of-truth pattern. `role` is required on the AI emit side
(in the Type schema's `required` array) but optional on the Zod side
(the validator defaults missing values, so post-validation code can
rely on `role` being set). `template_id_override` is fully optional
in both.

D-02: Closed enum for `role`: `'cover' | 'reframe' | 'support' | 'pivot' | 'close'`. Five values, no more, no fewer (orchestrator
hard constraint).

D-03: Closed enum for `template_id_override`: derived at module load
from `templates.map(t => t.id)` in `src/lib/render/templates/index.ts`.
Currently 11 entries (highlight-bar, news-drop, news-cyan, y2k-pop,
bold-yellow, magazine-bold, tr3nding-news, documentary, editorial-serif,
notes-app-chic, brutalist-grid). Defined as a `const TEMPLATE_IDS:
readonly string[]` exported from `templates/index.ts`.

D-04: Per-role copy guidance text — VERBATIM, locked. Inserted as a new
"PER-ROLE COPY GUIDANCE" block in `buildSystemPrompt` BEFORE the
`HOOK PATTERNS` section (it informs all hooks, premium or not). Block
is unconditional — applies to every templateId.

```
PER-ROLE COPY GUIDANCE — every slide has a role; write each accordingly:
- cover (slide 1): pattern-interrupt hook, ≤8 words, designed to stop the scroll
- reframe: introduce a "wait, but" tension that contradicts the cover
- support: concrete evidence, example, or specific number
- pivot: unexpected angle that reframes what came before
- close (last slide): action / CTA / bookmark prompt — tell the viewer what to do next
```

D-05: Deterministic middle-slide role distribution algorithm:
- length 3: `[cover, support, close]`
- length 4: `[cover, reframe, support, close]`
- length 5: `[cover, reframe, support, pivot, close]`
- length 6: `[cover, reframe, support, support, pivot, close]`
- length 7: `[cover, reframe, support, support, pivot, support, close]`
- length 8: `[cover, reframe, support, support, pivot, support, support, close]`
- length 9: `[cover, reframe, support, support, pivot, support, support, pivot, close]`
- length 10: `[cover, reframe, support, support, support, pivot, support, support, pivot, close]`

Implemented as `assignSlideRoles(n)` in `src/lib/ai/role-distribution.ts`
with explicit table for n ∈ [3, 10]. The clampedCount in
`generateCarousel` is already capped at 10 — no defaults needed beyond
this range. Pure function, easily unit-testable.

D-06: `validateAndRepair` extension — for every slide, if `role` is
missing or not in the closed enum, replace with the deterministic
value from `assignSlideRoles(slides.length)[idx]`. NO warning emitted
(silent default — matches Phase 47 documentary-strip silent pattern).
For `template_id_override`, if the value is non-empty and not in
TEMPLATE_IDS, set to `undefined`. NO warning. Both transforms preserve
the never-throws contract.

D-07: `match_photo_cache` schema:
```sql
CREATE TABLE match_photo_cache (
  photo_set_sha256 text NOT NULL,
  slide_manifest_sha256 text NOT NULL,
  result_jsonb jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_set_sha256, slide_manifest_sha256)
);
-- No RLS — server-only access via service role.
-- 30-day TTL via existing pg_cron retention pattern (Phase 54 reused).
```

The `result_jsonb` stores the full `(string | null)[]` result array.
Cache hit: skip Gemini, skip credit charge, return cached result.
Cache miss: Gemini call (with 10s timeout), charge credit, write
result on success.

D-08: Silent strip is the universal validator policy in v2.9 for
schema-valid but template-incompatible AI output. Applies to:
- `role` defaulting (D-06)
- `template_id_override` validation (D-06)
- documentary highlightColor strip (Phase 47, retained verbatim)

Rationale: never-throws contract holds; warnings reserved for
detectable AI mistakes (typos, length caps, orphans) where retry
makes the output measurably better.

D-09: `match-photos-to-slides.ts` SHIPS AS-IS with minor refactors:
- Add `MAX_PHOTOS = 8` constant; `if (photoUrls.length > MAX_PHOTOS) photoUrls = photoUrls.slice(0, MAX_PHOTOS)` early in the function.
- Wrap the Gemini call in `Promise.race([..., timeoutReject(10000)])`.
- Add cache lookup before Gemini call (read from `match_photo_cache`).
- Add cache write after Gemini call success (write to
  `match_photo_cache`).
- DO NOT touch the response schema, the index-order fallback, the
  base64 fetch, or the JSON parse / validation logic. They are
  battle-tested.

The premium-tier gate lives in the CALLER
(`src/app/(dashboard)/project/[id]/actions.ts`), not in
`match-photos-to-slides.ts` — keeps the function pure and testable
without DB / auth context. Caller code:

```typescript
// In actions.ts, around line 162-171:
const isPremium = tier !== 'free'
const usable = uploaded.slice(0, clampedCount)
if (usable.length > 0) {
  const assignments = isPremium
    ? await matchPhotosToSlides(slides, usable, { userId: user.id, admin })
    : indexOrderFallback(slides, usable) // existing inline behavior
  // ...
}
```

Where `matchPhotosToSlides` signature gains an optional `options?: {
userId: string; admin: SupabaseClient }` arg used for cache lookup
and credit deduction. When omitted (e.g., from tests or other
callers), cache + credit are skipped and the function behaves
identically to the parked file.

D-10: Credit-ledger integration — extend `CreditTransactionType` and
`CREDIT_COSTS` in `src/lib/credits/types.ts`:

```typescript
export type CreditTransactionType =
  | 'subscription_grant'
  | 'carousel_generation'
  | 'imagen_generation'
  | 'gemini_vision_match'  // NEW Phase 58
  | 'credit_pack_purchase'
  | 'refund'
  | 'admin_adjustment'

export const CREDIT_COSTS = {
  carousel_generation: 1,
  imagen_generation: 1,
  gemini_vision_match: 1,  // NEW Phase 58
  text_regeneration: 0,
  image_regeneration: 0,
} as const
```

Charged via existing `deductCredit` flow before Gemini call. On
timeout / error / 0-assignment outcome, refund via `credit_transactions`
insert with `type: 'refund'` (mirrors `refundCredit` in
`src/lib/services/ai-regen.ts:100-108`).

D-11: PARITY-01 test mechanism — instrumented identity check, not
visual regression. Both renderers' `renderGrain` import resolves to
the SAME function object at test runtime:

```typescript
import { renderGrain as resolverRenderGrain } from '@/lib/render/resolve-overlay'
import { renderGrain as satoriRenderGrain } from '...satori-import-path'
import { renderGrain as previewRenderGrain } from '...preview-import-path'
expect(satoriRenderGrain).toBe(resolverRenderGrain)
expect(previewRenderGrain).toBe(resolverRenderGrain)
```

Plus a snapshot test that calls each helper with a sample slide +
asserts both renderers' output trees include the same key inline-style
markers (e.g., grain PNG `backgroundImage` URL). This is the cheapest
parity check that catches "renderer secretly forked the helper" — the
exact failure mode Phase 55's TPLREND-05 invariant exists to prevent.

D-12: v2.7 audit baseline preservation. After every prompt change in
this phase, the existing 19/19 v2.7 requirements (premium-tier gate
must still pass) are re-verified by running the full vitest suite. If
any v2.7-tagged test breaks, REVERT the affecting prompt change and
document as follow-up in `58-VERIFICATION.md`. This is the same
discipline applied in Phase 54 (D-15 in v2.9 ROADMAP) for the
Inter→Plus Jakarta Sans swap.

D-13: Diversity corpus topic distribution — 20 prompts across 10
creator niches, 2 per niche, locked verbatim:

```typescript
export const DIVERSITY_CORPUS: ReadonlyArray<string> = [
  // Food
  '5 ways to use leftover rice',
  'why your sourdough never rises',
  // Fashion
  'fall capsule wardrobe in 6 pieces',
  'thrift store outfit for under $20',
  // Tech
  'one Cursor shortcut that 10x my coding',
  'why I switched from Mac to Linux',
  // Fitness
  'how to fix your posture while working from home',
  'one move that fixed my lower back pain',
  // Finance
  'how to budget on $40k a year',
  'the one ETF I bought instead of stocks',
  // Parenting
  'getting a toddler to eat vegetables',
  '3 boundaries that saved my sanity as a new mom',
  // Travel
  'Tokyo on $80 a day',
  'one packing trick that changed my carry-on game',
  // Beauty
  '3-step skincare for sensitive skin',
  'the one mascara worth $30',
  // Productivity
  'how I plan my week in 15 minutes',
  'one habit that doubled my deep-work hours',
  // Mental health
  'how I journal without overthinking',
  'one boundary that improved my anxiety',
] as const
```

Locked once. Future phases can extend (per category, never replace).
The diversity test renders each prompt through the current AI prompt
path with a fixed templateId (`'highlight-bar'` to keep premium-tier
prompts out of the picture in v2.9 — cheaper, more representative of
free-tier baseline).

D-14: Diversity gate metric — for each of the 20 generated carousels,
extract the first 3 whitespace-tokens of `slides[0].hook_text` (case-
folded). Compute trigram repetition rate as `1 - (uniqueTrigrams.size /
20)`. Fail threshold = 0.30 (any rate ≥ 30% is "too repetitive"). In
v2.9, log a warning if the threshold trips; do not fail CI. Document
the 20-sample baseline in `58-VERIFICATION.md`.

D-15: Ship-gate checklist verification — Phase 58 closes with
`58-VERIFICATION.md` containing a check table of all 13 PITFALLS.md
"Looks Done But Isn't" items, each marked PASSED / PARTIAL / N/A
with one-line evidence. The 4 items that don't apply in v2.9 (no
new IG export modal, no Imagen retina, no AI hook A/B selector, no
new template emojis) are marked N/A. The remaining 9 must be PASSED
or the milestone does not ship.

D-16: ZIP metadata strip implementation — `/api/render/route.ts`
already returns Satori PNG output, which Satori does NOT add EXIF /
XMP / C2PA to (verified by reading `next/og` source: ImageResponse
emits raw resvg-rendered PNG with no metadata writer in the path).
The PARITY-05 test EXISTS to assert this property holds, not to add
new code. If the test fails (e.g., a future Satori version adds
metadata), the fix is a single `sharp(buf).withMetadata({})` pipe
in the render route — but that is a Phase-58-+1 follow-up if needed.

D-17: Cascade-delete implementation — extend `deleteProjectService`
in `src/lib/services/projects.ts`:

```typescript
export async function deleteProjectService(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  admin?: SupabaseClient,  // NEW — optional admin client for storage
) {
  // 1. Read slide_data first to extract storage paths
  const { data: project } = await supabase
    .from('projects')
    .select('slide_data')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  // 2. Collect storage paths from background_url + original_source_url
  const treatedPaths: string[] = []
  const originalPaths: string[] = []
  for (const slide of project?.slide_data ?? []) {
    if (slide.background_url) {
      const path = extractStoragePath(slide.background_url, 'slide-backgrounds-treated')
      if (path) treatedPaths.push(path)
    }
    if (slide.original_source_url) {
      const path = extractStoragePath(slide.original_source_url, 'slide-backgrounds')
      if (path) originalPaths.push(path)
    }
  }

  // 3. Best-effort cleanup (never blocks delete)
  if (admin) {
    if (treatedPaths.length > 0) {
      await admin.storage.from('slide-backgrounds-treated').remove(treatedPaths)
    }
    if (originalPaths.length > 0) {
      await admin.storage.from('slide-backgrounds').remove(originalPaths)
    }
    // hero thumbnail cleanup is already in deletePublishedCarousel
    // from quick-260427-vm2 — re-invoke that path here.
  }

  // 4. Existing delete
  const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('user_id', userId)
  if (error) throw error
}
```

Test mocks `admin.storage.from('...').remove(...)` and asserts both
arrays are passed correctly + the row delete fires.

D-18: Test growth budget — ~25-35 new tests:
- `role-distribution.test.ts`: 8 cases (one per length 3-10)
- `validate-slides.test.ts` extension: 4 new role-related cases
- `diversity.test.ts`: 1 advisory test (logs warning, does not fail)
- `match-photos.test.ts` extension: 4 new cases (MAX_PHOTOS,
  timeout, cache hit, cache write)
- `parity.test.tsx`: 6 new cases (3 templates × 2 helpers each)
- `zip-metadata.test.ts`: 2 cases (no EXIF, no XMP)
- `projects-delete.test.ts`: 4 new cases (slide cleanup, hero
  cleanup, no-admin path, error path)

Total: ~29 new tests. Phase 56 + 57 baseline regression suite must
remain green.

</locked_decisions>

<verbatim_text>
## Verbatim Text Locked

### Per-role copy guidance (D-04)

```
PER-ROLE COPY GUIDANCE — every slide has a role; write each accordingly:
- cover (slide 1): pattern-interrupt hook, ≤8 words, designed to stop the scroll
- reframe: introduce a "wait, but" tension that contradicts the cover
- support: concrete evidence, example, or specific number
- pivot: unexpected angle that reframes what came before
- close (last slide): action / CTA / bookmark prompt — tell the viewer what to do next
```

### Diversity corpus (D-13)

20 prompts, locked above. Lives at `src/lib/ai/__tests__/diversity-corpus.ts`.

### Credit ledger string (D-10)

```
'gemini_vision_match'  // 1 credit per match-photos-to-slides call
```

</verbatim_text>

<files_touched>
## Files Touched (Plan-Level Estimate)

**New files:**
- `src/lib/ai/role-distribution.ts` (assignSlideRoles helper)
- `src/lib/ai/__tests__/role-distribution.test.ts`
- `src/lib/ai/__tests__/diversity-corpus.ts` (20-prompt fixture)
- `src/lib/ai/__tests__/diversity.test.ts` (advisory test)
- `src/lib/render/__tests__/parity.test.tsx`
- `src/lib/download/__tests__/zip-metadata.test.ts`
- `src/lib/services/__tests__/projects-delete.test.ts`
- `scripts/render-parity-grid.ts` (manual audit aid)
- Supabase migration: `match_photo_cache` table + retention pg_cron
  extension (one new file under `supabase/migrations/`)

**Modified files:**
- `src/lib/ai/schemas.ts` — add `role` enum + `template_id_override`
- `src/lib/ai/generate-slides.ts` — Gemini schema mirror + role
  distribution call site
- `src/lib/ai/prompts.ts` — per-role copy guidance block
- `src/lib/ai/validate-slides.ts` — role default + override strip
- `src/lib/ai/match-photos-to-slides.ts` — MAX_PHOTOS, timeout, cache,
  optional userId+admin args
- `src/lib/ai/__tests__/match-photos.test.ts` (NEW or extension)
- `src/app/(dashboard)/project/[id]/actions.ts` — premium gate +
  credit ledger call + cache wiring
- `src/lib/credits/types.ts` — `gemini_vision_match` enum + cost
- `src/lib/services/projects.ts` — cascade-delete extension
- `src/lib/render/__tests__/no-css-filter.test.ts` — extend to
  scan 3 new template files
- `src/lib/render/templates/index.ts` — export TEMPLATE_IDS const
- `package.json` — `parity-grid` script
- `.planning/phases/58-ai-tightening-parity-qa-match-photos/58-VERIFICATION.md`

**No new dependencies** (orchestrator hard constraint).

**No npm dep changes** other than the script entry.

</files_touched>

<unknowns>
## Unknowns Surfaced (Tracked, Non-Blocking)

These are known unknowns; they do NOT block planning but the planner
should keep them in mind:

U-01: Gemini's response when a `template_id_override` is suggested but
the topic doesn't fit the visual rhythm of the override — e.g., AI
picks `documentary` for slide 3 but the slide is a cheerful product
demo. Mitigation: validator silently strips invalid IDs (D-06); the
user can override per-slide template manually post-generation in v3.0+.

U-02: Cache hit rate on `match_photo_cache` — depends on whether real
users repeat photo uploads. Likely low in v2.9 (each user uploads
unique photos for each topic), but the cache is cheap to maintain.
Worth measuring at v3.0 audit; do not over-engineer in v2.9.

U-03: The diversity gate threshold of 30% is research-grounded
(monoculture-risk papers) but not user-validated. Phase 58 ships it
advisory-only; v3.0+ may tighten to fail-CI once a stable baseline is
measured.

U-04: PARITY-05 metadata-strip test — the assumption is that Satori +
resvg-js currently emit zero metadata. If this assumption fails, the
fix is a `sharp({ ... }).withMetadata({})` pipe in `/api/render`. NOT
done preemptively in v2.9; the test catches a future regression.

U-05: Free-tier `match-photos-to-slides` parity — index-order is the
free fallback. If a power free user complains, v3.0+ may surface a
"upgrade for AI photo matching" CTA in the editor. Out of scope for
v2.9.

</unknowns>

<v27_audit_baseline>
## v2.7 audit baseline (re-verified each AI prompt change in Phase 58)

The 19/19 requirements from v2.7's milestone audit (premium-tier audit
baseline) MUST stay green after every Phase 58 prompt change. If any
test breaks, revert the affecting prompt change and document as
follow-up. v2.7 baseline file:
`.planning/milestones/v2.7-MILESTONE-AUDIT.md`. The verifier loop
should rerun the full vitest suite at end-of-phase and confirm zero
new failures vs. the Phase 57 end-of-phase baseline.

</v27_audit_baseline>

<ship_gate>
## Ship-Gate Verification

Recorded in `58-VERIFICATION.md` at end of phase. Items:

| # | Item | Source | Phase 58 Verdict |
|---|---|---|---|
| 1 | Each new template renders byte-identical-or-better in Satori PNG vs React preview (snapshot test) | PITFALLS.md ship-gate | Phase 56 + 58 PARITY-01 verify |
| 2 | No new template uses CSS not on the Satori allowlist | PITFALLS.md ship-gate | Phase 55 + 58 PARITY-04 verify |
| 3 | No emoji in template defaults | PITFALLS.md ship-gate | Audit Phase 56 templates (manual) |
| 4 | AI-prompt diversity test: 20 carousels generate ≥X distinct hook openings | PITFALLS.md ship-gate | Phase 58 AIROLE-02 (advisory) |
| 5 | Per-carousel AI cost projection ≤ budget for free tier | PITFALLS.md ship-gate | Phase 54 already audited; no v2.9 cost regressions |
| 6 | If photo-match shipped: MAX_PHOTOS cap, fallback path tested, content-hash cache verified | PITFALLS.md ship-gate | Phase 58 MATCH-01..05 |
| 7 | If stylize shipped: face-detect refusal | PITFALLS.md ship-gate | N/A — stylize-image.ts deferred to v3.0+ |
| 8 | Export ZIP PNG metadata is clean (no EXIF, XMP, C2PA) | PITFALLS.md ship-gate | Phase 58 PARITY-05 |
| 9 | Editor canvas shows IG-grid safe-zone overlay | PITFALLS.md ship-gate | Phase 57 EDITOR-03 |
| 10 | Each phase has one quantitative success metric defined and instrumented | PITFALLS.md ship-gate | Phase 54 v_zip_download_rate view |
| 11 | Cascade-delete: deleting a project removes hero thumbnail + cached intermediate assets | PITFALLS.md ship-gate | Phase 58 PARITY-06 |
| 12 | Template versioning policy in place (no in-place mutation of shipped templates) | PITFALLS.md ship-gate | Phase 56 conventions: new IDs, never mutate |
| 13 | No regression on the v2.8 542 test count; new tests added per new template / per new AI feature | PITFALLS.md ship-gate | Vitest end-of-phase baseline check |
| 14 | `download_zip` event tracking from Phase 54 confirmed working post-launch | Phase 58 orchestrator | v_zip_download_rate view returns sensible data |
| 15 | Post-launch ZIP download rate ≥ baseline (0%, trivially true) | Phase 58 orchestrator | Phase 58 documents in VERIFICATION.md |

</ship_gate>

<next_steps>
## Next Steps

1. `gsd-plan-phase 58 --skip-research` (planner consumes this CONTEXT.md
   and produces ~3-4 atomic plans).
2. `gsd-execute-phase 58 --no-transition` (executes all plans;
   verifier runs ship-gate checklist + diversity gate + cascade-delete
   audit).
3. `gsd-audit-milestone v2.9` (after Phase 58 ships — milestone-wide
   audit before archive).
4. `gsd-complete-milestone v2.9` (archive + start v3.0 cycle).

</next_steps>
