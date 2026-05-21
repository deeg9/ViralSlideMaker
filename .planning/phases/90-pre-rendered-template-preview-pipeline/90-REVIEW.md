---
phase: 90-pre-rendered-template-preview-pipeline
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - scripts/render-template-previews.ts
  - src/components/slides/template-tile-preview.tsx
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/render-slide.ts
  - src/lib/render/resolve-overlay.ts
  - src/lib/render/templates/news-cyan.ts
  - src/lib/render/templates/news-oracle.ts
  - src/lib/render/templates/y2k-pop.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 90: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 90 ships a one-off preview-render pipeline (`render-template-previews.ts`),
a Satori-compat `inline-block` → `flex` fix on the tight-highlight path, and a
simplified single-`<img>` picker tile. No BLOCKER-tier defects were found: the
script's path-injection guard, `upsert: true` idempotency, `resolveTemplate(id)`
snapshot correctness, and credential handling are all sound, and the
service-role key is never logged. The source-file rewrite is genuinely
idempotent for the current 16 well-formed template files.

However, five WARNING-tier issues degrade robustness — most notably (1) the
`flex` shrink-wrap fix does NOT reproduce `inline-block` text-flow for the
specific case it was introduced to handle, creating a real render-geometry risk
for tight-highlight slides, and (2) the regenerated render-parity snapshots do
NOT cover that render path at all (they fingerprint the template *config*
object, so a `preview:` line — not the `flex` change — accounts for the 3 hash
deltas). The `flex` change is effectively shipped with zero pixel-level
regression coverage. The remaining warnings concern partial-failure recovery in
the live run and the `rewriteTemplateSource` regex's structural assumptions.

## Warnings

### WR-01: `display: flex` pill does not reproduce `inline-block` text wrapping for the multi-word case the fix targets

**File:** `src/lib/render/resolve-overlay.ts:411-429` (and the HTML mirror
`src/lib/render/render-slide.ts:165-189`)
**Issue:** The DEVIATION swaps the per-line tight-highlight pill from
`display: inline-block` to `display: flex`. The doc comment claims a
`display: flex` span "shrink-wraps to its text exactly as `inline-block` did."
That is true for the *outer* sizing axis (cross-axis width via `alignSelf`), but
it is NOT equivalent for the pill's *inner* content layout:

- With `inline-block`, the pill's text node is laid out in normal inline flow.
  A long segment-less line (`lineChildren = \`${marker}${line}\``) wraps at
  spaces within the pill once it hits `maxWidth: '100%'`, and `overflowWrap:
  'break-word'` can split an over-long word.
- With `display: flex` and the default `flex-direction: row`, that same text
  string becomes a single anonymous flex item. `overflowWrap: 'break-word'` is
  still set, so a single over-long *word* still breaks — but a multi-word line
  that needs to wrap at a space now depends on flex line-wrapping. The pill span
  sets NO `flexWrap`, so its default is `flex-wrap: nowrap`. A single anonymous
  text flex-item with internal whitespace can still wrap in browsers, but in
  Satori a `nowrap` flex row of one text node is a single non-wrapping line.

  Net effect: a tight-highlight hook/body line long enough to wrap can render as
  a single overflowing pill in the Satori PNG where `inline-block` would have
  produced a multi-line wrapped pill. This is precisely the
  `renderCoverPreviewPng` path the fix was added to un-crash — the crash is
  fixed, but the layout it replaces it with can differ.

  The segmented-text branch (`renderSegments`) is safer because each segment
  becomes its own `<span>` flex child, but those child spans still need
  `flex-wrap: wrap` on the pill to wrap across lines, which is also absent.
**Fix:** Add explicit wrap behavior to the pill span so multi-word / multi-span
content wraps inside the pill the way the old `inline-block` flow did:
```ts
style: {
  display: 'flex',
  flexWrap: 'wrap',          // allow the pill's content to wrap across lines
  backgroundColor: highlight.color,
  color: baseColor,
  padding: `${TIGHT_HIGHLIGHT_PADDING}px ${TIGHT_HIGHLIGHT_PADDING}px`,
  paddingLeft: indentPx ? indentPx + TIGHT_HIGHLIGHT_PADDING : TIGHT_HIGHLIGHT_PADDING,
  alignSelf: pillAlign,
  maxWidth: '100%',
  overflowWrap: 'break-word',
},
```
Apply the same `flex-wrap: wrap` to the HTML `pillStyle` in
`render-slide.ts:175-178`. Then add a targeted Satori-render assertion that a
long single-line tight hook produces a pill no wider than the text container.

### WR-02: Regenerated render-parity snapshots do not exercise the `flex` change — the render-path deviation ships with no pixel-level coverage

**File:** `src/__tests__/render/new-templates-parity.test.tsx:79-86`,
`src/__tests__/render/__snapshots__/new-templates-parity.test.tsx.snap`
**Issue:** The phase regenerated `new-templates-parity` snapshots; the review
intent flagged the risk that the `flex` change "altered rendered output that the
regeneration then masked." Inspection shows the opposite failure mode: the 3
changed hashes (`brutalist-grid`, `editorial-serif`, `notes-app-chic`) are
SHA-256 fingerprints of the template **config object** (`JSON.stringify` of the
`SlideTemplate`), and they changed solely because the additive `preview:` URL
field is now present — confirmed by the in-test comment at lines 82-85. This
test never renders a slide. It therefore provides ZERO coverage of the
`inline-block`→`flex` render-path change. The `tight-highlight-parity` test was
updated to assert `display === 'flex'`, but it only checks the *style property
value*, not rendered geometry — it would pass even if WR-01's wrapping
regression is real. The deviation is effectively shipped untested at the pixel
level.
**Fix:** Add a render-geometry regression test for a long-line tight-highlight
slide (e.g. assert the rendered pill bounding box stays within the text
container width, or snapshot the Satori SVG output, not just the React style
object). Do not treat the config-fingerprint snapshot regeneration as evidence
the render change is safe.

### WR-03: Live run aborts the whole batch on the first per-template failure — no resume / partial-progress recovery

**File:** `scripts/render-template-previews.ts:333-451`
**Issue:** The live loop calls `process.exit(1)` on the first failure of any
step (re-fetch at 371-378, empty `slide_data` at 384-387,
`renderCoverPreviewPng` at 404-410, upload at 421-424). Because gap templates
are generated *inside* the loop with real Gemini Flash spend (step 9a), a
failure on, say, template #12 leaves templates 1-11 uploaded and rewritten,
templates 13-16 untouched, and the partially-generated carousels orphaned on the
account. A re-run is idempotent for storage (`upsert: true`) and for the
source-file rewrite, but it will RE-GENERATE every gap template that did not
complete (and every gap template whose freshly-generated project is now an
"exemplar" will instead be reused — so re-runs are not cost-stable). For a
money-spending one-off this is fragile: a transient Satori error on one template
forces re-spend on Gemini for any not-yet-completed gaps.
**Fix:** Either (a) catch per-template errors, record them, and continue —
emitting a final summary of failures with a non-zero exit only if any failed; or
(b) generate ALL gap carousels up front in a separate pass before any
snapshot/upload, so a later-stage failure never strands Gemini spend. Option (a)
is the smaller change and makes a re-run only retry the genuinely-failed
templates.

### WR-04: `rewriteTemplateSource` insert path can target the wrong `}` for any template file that is not a single flat literal

**File:** `scripts/render-template-previews.ts:161-180`
**Issue:** When no `preview:` line exists, the insert path uses
`src.lastIndexOf('\n}')` to find "the closing `}` of the export literal." This
is correct ONLY because every current template file ends in exactly `\n}\n` with
no trailing code. The doc comment even concedes the assumption ("verified
against highlight-bar.ts / news-oracle.ts"). It is not robust: any template file
that later gains a trailing helper, a second `export`, a multi-line type
annotation containing `}`, or even a trailing block comment with `\n}` would
cause the URL to be inserted into the wrong brace — silently corrupting the file.
There is no validation that the located `}` actually closes the
`export const ...: SlideTemplate` literal, and no post-write parse/type check.
Note this is mitigated in practice: all 16 current files already received the
`preview:` field, so future runs take the *replace* branch (regex-anchored,
safe). But the insert branch remains a latent foot-gun for the next code
template added without a `preview:` line.
**Fix:** Either anchor the insertion to the specific export — e.g. locate
`export const <name>: SlideTemplate = {` and insert before its matching closing
brace via brace-depth counting — or, at minimum, after writing, re-`require`/
`import` the rewritten module (or run `tsc --noEmit` on it) and fail loudly if
it no longer parses. A one-off script that mutates source files should verify
its own output.

### WR-05: `resolveUserIdByEmail` pagination can silently miss a user past page 20 / on an exact 1000-multiple boundary

**File:** `scripts/render-template-previews.ts:203-220`
**Issue:** Two edge cases: (1) the loop caps at `page <= 20` (20,000 users) and
then throws `No auth user for ${email}` — indistinguishable from "user does not
exist." (2) The break condition `if (data.users.length < 1000) break` means when
the final page has *exactly* 1000 users, the loop requests a 21st page (or stops
at the cap) rather than recognizing termination. Practically the account count
makes both unreachable today, but the error message on a genuine pagination
overflow would mislead an operator into thinking the account was deleted. This
is a script-only / low-blast-radius concern, hence WARNING not BLOCKER.
**Fix:** Distinguish "scanned N pages without a match" from "no more pages."
Prefer the admin API's email-filter if available
(`listUsers` supports filtering in newer `@supabase/supabase-js`), or page until
`data.users.length === 0` and surface the page count in the failure message.

## Info

### IN-01: `textAlign` computed but unused in both render builders

**File:** `src/lib/render/render-slide-satori.tsx:185`,
`src/lib/render/render-slide.ts:225`
**Issue:** `const textAlign = slideAlign` is assigned in both files with a
comment ("Kept for unrelated callers below" / "Kept as the default for callers
below") but no subsequent reference exists — hook/body/custom-text paths all use
`hookTextAlign` / `bodyTextAlign` / `ct.text_align`. Dead variable. Pre-existing,
not introduced by Phase 90, but adjacent to the reviewed render-path change.
**Fix:** Remove the unused `textAlign` binding in both files.

### IN-02: `TIGHT_HIGHLIGHT_PADDING` duplicated as two un-linked constants

**File:** `src/lib/render/render-slide.ts:117` vs
`src/lib/render/resolve-overlay.ts:333`
**Issue:** The HTML renderer redefines `TIGHT_HIGHLIGHT_PADDING = 8` with a
comment that it "duplicates the value" from `resolve-overlay.ts` to keep the
three paths in sync. The 90-02 `flex` change had to be made in both files; a
future tweak to the pill inset must remember both sites or the paths drift —
exactly the parity hazard the rest of this module works hard to avoid.
**Fix:** `import { TIGHT_HIGHLIGHT_PADDING } from './resolve-overlay'` in
`render-slide.ts` and delete the local copy (it is already `export`ed).

### IN-03: Picker `<img>` has no load-failure fallback for a missing preview

**File:** `src/components/slides/template-tile-preview.tsx:10-18`
**Issue:** The component is correctly simplified to a single `<img>` with no
dead imports or props (the review-intent goal is met). However, `template.preview`
is typed `string | undefined` on `SlideTemplate` (`templates/index.ts:103`), and
a DB template row maps `preview: row.preview ?? undefined`. If any template ever
reaches the picker without a `preview` URL — or the Supabase object 404s — the
tile renders a broken-image icon with no `onError` fallback and no
skeleton/placeholder. The old removed branch was a live-render fallback; nothing
replaced it. Low severity because all 16 code templates now carry a `preview`,
but DB templates are not guaranteed to.
**Fix:** Add an `onError` handler (or a CSS background-color placeholder) so a
missing/failed preview degrades to a neutral tile rather than a broken-image
glyph. Optionally narrow the picker to skip templates with no `preview`.

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
