---
phase: quick-260518-jhg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/render/templates/news-oracle.ts
  - src/lib/render/templates/index.ts
  - src/lib/ai/categories/news.ts
  - src/lib/ai/prompts.ts
  - src/lib/render/templates/__tests__/keeper-curation.test.ts
autonomous: true
requirements: [TPLREND-05, KEEPER-R7, KEEPER-R8]
must_haves:
  truths:
    - "The template picker shows a new Oracle-style news template and no longer shows News Cyan"
    - "The 3 existing news-cyan carousels still render byte-identically (news-cyan.ts unmodified, news-cyan still resolves via getTemplate)"
    - "validateTemplateRegistry passes at module load with the new template registered"
    - "The News content category resolves only to picker-visible templates (keeper-curation + category-generation tests pass)"
    - "The new template id is treated as a news template by the AI prompt branch (gets the NEWS DROP TEMPLATE addendum), same as news-cyan"
    - "The new template gets additive render-parity fingerprints (PTF13a/PTF13b); all existing templates' fingerprints stay byte-identical"
  artifacts:
    - path: "src/lib/render/templates/news-oracle.ts"
      provides: "New SlideTemplate config capturing the Oracle carousel style DNA"
      contains: "export const newsOracle"
    - path: "src/lib/render/templates/index.ts"
      provides: "New template registered in templates[]; news-cyan added to HIDDEN_FROM_PICKER"
      contains: "newsOracle"
    - path: "src/lib/ai/categories/news.ts"
      provides: "News category templateIds repointed off news-cyan onto the new template"
    - path: "src/lib/ai/prompts.ts"
      provides: "New id added to the NEWS_TEMPLATES set so it gets the news prompt branch"
    - path: "src/lib/render/templates/__tests__/keeper-curation.test.ts"
      provides: "APPROVED_KEEPERS / CULLED_IDS / registry-count assertions updated for the swap"
  key_links:
    - from: "src/lib/render/templates/index.ts"
      to: "src/lib/render/templates/news-oracle.ts"
      via: "import { newsOracle } and push into templates[]"
      pattern: "newsOracle"
    - from: "src/lib/render/templates/index.ts"
      to: "HIDDEN_FROM_PICKER"
      via: "'news-cyan' added to the Set"
      pattern: "news-cyan"
    - from: "src/lib/ai/categories/news.ts"
      to: "new template id"
      via: "templateIds array first entry"
      pattern: "templateIds"
    - from: "src/lib/ai/prompts.ts"
      to: "NEWS_TEMPLATES set"
      via: "new id added to the Set literal"
      pattern: "NEWS_TEMPLATES"
---

<objective>
Add a new picker template ("News Oracle") that captures the visual style DNA of
the user's polished "Oracle Layoff Analysis" carousel, and retire the existing
`news-cyan` template from the picker non-destructively. This is marketing-prep:
the picker should lead with a proven, polished, center-aligned news style.

Purpose: The user is about to start advertising and wants the template picker to
present a proven news look. The Oracle carousel renders on news-drop's base
(Anton, near-black) with heavy per-slide overrides; this plan crystallizes that
look into a flat reusable `SlideTemplate` config.

Output:
- `src/lib/render/templates/news-oracle.ts` — new `SlideTemplate` config.
- `news-oracle` registered in `templates[]`, passing `validateTemplateRegistry`.
- `news-cyan` added to `HIDDEN_FROM_PICKER` (news-cyan.ts itself untouched).
- News content category repointed off `news-cyan` onto `news-oracle`.
- `news-oracle` added to the `NEWS_TEMPLATES` set in `prompts.ts` (registration
  plumbing only — generation recipe is explicitly OUT OF SCOPE).
- `keeper-curation.test.ts` updated for the keeper-list swap.
- Additive render-parity fingerprints (PTF13a/b) for the new template.

OUT OF SCOPE (do NOT touch): the AI generation recipe — `prompts.ts` prompt
*text*, `style-spec-projector.ts`, `style-spec-projector-constants.ts`,
`validate-slides.ts` generation logic. Only the `NEWS_TEMPLATES` set membership
in `prompts.ts` is in scope (registration, not generation).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260518-jhg-add-oracle-style-news-template-and-retir/260518-jhg-CONTEXT.md

<interfaces>
<!-- Key contracts the executor needs — extracted from the codebase. Use directly; no exploration needed. -->

SlideTemplate interface (src/lib/render/templates/index.ts) — RELEVANT fields:
  id: string
  name: string
  thumbnail: string
  fontFamily: string
  hookFontSize: string          // e.g. '130px'
  bodyFontSize: string
  textColor: string
  backgroundColor: string
  overlayColor: string
  overlayOpacity: number
  textAlign: 'left' | 'center' | 'right'
  textPosition: 'top' | 'center' | 'bottom'
  hookStyle: 'uppercase' | 'normal' | 'italic'
  hookFontWeight?: number       // MUST be 400 for Anton (single-weight on Google Fonts)
  accentColor?: string
  sample?: {
    hook_text: string
    body_text: string
    hook_segments?: TextSegment[]
    layout?: 'cover' | 'body'
  }
  // NOTE: there is NO template-level `highlightStyle` field. Pill highlights are
  // expressed PER-SEGMENT in sample.hook_segments via TextSegment.highlightStyle.

TextSegment (src/lib/types/slide.ts):
  text: string
  accent?: boolean              // accent:true → painted with template.accentColor
  highlightColor?: string
  highlightStyle?: 'pill' | 'block'

news-drop.ts (the base the Oracle carousel actually renders on) — full config:
  id: 'news-drop', fontFamily: "'Anton', sans-serif", hookFontSize: '110px',
  hookFontWeight: 400, bodyFontSize: '38px', textColor: '#ffffff',
  backgroundColor: '#000000', overlayColor: '#000000', overlayOpacity: 0,
  textAlign: 'left', textPosition: 'bottom', hookStyle: 'uppercase',
  accentColor: '#C8FF00'  — NO overlays, NO backgroundMode (newsZone full-bleed path).

news-cyan.ts (closest analog, the slot being vacated) — full config:
  id: 'news-cyan', hookFontSize: '124px', hookFontWeight: 400,
  overlayColor: '#0a0a0a', overlayOpacity: 0.45, textAlign: 'left',
  accentColor: '#00E5FF'  — NO overlays, NO backgroundMode.

HIDDEN_FROM_PICKER (index.ts) currently:
  Set(['highlight-bar','news-drop','magazine-bold','documentary',
       'notes-app-chic','brutalist-grid','paper-essay'])

templates[] order (index.ts): highlightBar, newsDrop, newsCyan, y2kPop,
  boldYellow, magazineBold, tr3ndingNews, documentary, editorialSerif,
  notesAppChic, brutalistGrid, paperEssay  (12 total).

news category (src/lib/ai/categories/news.ts):
  templateIds: ['news-cyan', 'tr3nding-news'] as const

NEWS_TEMPLATES set in src/lib/ai/prompts.ts line 17:
  const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan'])
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create the News Oracle template and register it (hide news-cyan)</name>
  <files>src/lib/render/templates/news-oracle.ts, src/lib/render/templates/index.ts</files>
  <action>
Create `src/lib/render/templates/news-oracle.ts` exporting `export const newsOracle: SlideTemplate`. It captures the Oracle "Layoff Analysis" carousel style DNA (CONTEXT.md `<specifics>`, DB-extracted 2026-05-18). Use news-drop as the structural base (the Oracle carousel renders on news-drop) plus the news-cyan dark-overlay treatment.

Required field values (Claude's Discretion on id/name/exact numerics — these are the derived sensible values):
  - id: `'news-oracle'`
  - name: `'News Oracle'`
  - thumbnail: `'/templates/news-oracle.png'` (string path only — a real PNG asset is an explicit follow-up per CONTEXT.md; the picker renders a live tile from `sample`)
  - fontFamily: `"'Anton', sans-serif"`
  - hookFontSize: `'130px'` (representative single value — project runs 120-140px; news-cyan 124, news-drop 110)
  - hookFontWeight: `400` — REQUIRED. Anton ships single-weight on Google Fonts; 400 keeps Satori PNG export matching browser preview (see SlideTemplate.hookFontWeight doc comment).
  - bodyFontSize: `'38px'`
  - textColor: `'#ffffff'` (template textColor stays white per CONTEXT.md — the cream `#fadbdb` cover color is a per-slide override, reflect it only in the picker sample below if feasible)
  - backgroundColor: `'#0a0a0a'` (near-black)
  - overlayColor: `'#0a0a0a'`
  - overlayOpacity: `0.45` (dark photo overlay for headline legibility — same model as news-cyan)
  - textAlign: `'center'` — THE main visual differentiator vs news-cyan/news-drop (which are left-aligned). Oracle hooks are centered.
  - textPosition: `'bottom'`
  - hookStyle: `'uppercase'`
  - accentColor: `'#00E5FF'` (cyan — cover slide uses #24ddeb, rest use #00E5FF; #00E5FF is the representative value, matching news-cyan)
  - sample: mirror the Oracle cover slide:
      hook_text: `'ORACLE CUTS 30,000 JOBS IN MASSIVE SHAKEUP'`
      body_text: `''` (news templates are headline-only)
      layout: `'cover'`
      hook_segments: 7 runs reproducing the FULL hook_text concatenated —
        `{ text: 'ORACLE' }`, `{ text: 'CUTS' }`, `{ text: '30,000' }`,
        `{ text: 'JOBS' }`, `{ text: 'IN' }`,
        `{ text: 'MASSIVE', accent: true, highlightStyle: 'pill' }`,
        `{ text: 'SHAKEUP', accent: true, highlightStyle: 'pill' }`.
      The pill highlights are expressed PER-SEGMENT via `highlightStyle: 'pill'`
      (there is NO template-level highlightStyle field). Leave `highlightColor`
      unset on the segments so the renderer falls back to `accentColor`.
  - Do NOT set `overlays`, `backgroundMode`, `coverLayout`, `grainMode`,
    `vignette`, `photoTreatment`, `paletteMode`, or `aiVoiceNote`. Leaving these
    undefined keeps the newsZone full-bleed render path (mirroring news-drop /
    news-cyan) and keeps `templates.test.ts` happy (non-legacy ids that are NOT
    backgroundMode templates must have `overlays` undefined).
Add a top-of-file comment block explaining: this is the Oracle-style news
keeper added for the marketing-launch picker; it captures the style DNA of
project "Oracle Layoff Analysis" which renders on news-drop with per-slide
overrides; center-aligned is the differentiator vs news-cyan/news-drop.

Then edit `src/lib/render/templates/index.ts`:
  1. Add `import { newsOracle } from './news-oracle'` alongside the other
     template imports (near `newsCyan` import).
  2. Add `newsOracle` to the `templates[]` array. Append it at the END of the
     array (after `paperEssay`) — appending preserves picker order for existing
     users and keeps existing templates at their current indices, so the
     registry-driven fingerprint test assigns the new template PTF13.
  3. Add `'news-cyan'` to the `HIDDEN_FROM_PICKER` Set. Update the doc comment
     above `HIDDEN_FROM_PICKER` and `pickerTemplates` if it enumerates the
     keeper ids verbatim (it currently lists "news-cyan, tr3nding-news,
     bold-yellow, editorial-serif, y2k-pop" — swap news-cyan → news-oracle).
Do NOT modify `news-cyan.ts` (non-destructive — TPLREND-05 invariant: the 3
existing news-cyan carousels must render byte-identically; news-cyan still
resolves via `getTemplate('news-cyan')`).
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/render/templates.test.ts src/lib/render/templates/validate.test.ts --reporter=dot</automated>
  </verify>
  <done>
news-oracle.ts exists exporting `newsOracle`. index.ts imports it, appends it to
templates[] (13 entries), and includes 'news-cyan' in HIDDEN_FROM_PICKER.
`validateTemplateRegistry` passes at module load (no `[template-registry]`
throw). news-cyan.ts is byte-identical to its pre-task state.
  </done>
</task>

<task type="auto">
  <name>Task 2: Repoint News category + NEWS_TEMPLATES set, fix keeper-curation test</name>
  <files>src/lib/ai/categories/news.ts, src/lib/ai/prompts.ts, src/lib/render/templates/__tests__/keeper-curation.test.ts</files>
  <action>
Three coordinated edits so the keeper swap is consistent across the registry,
the AI news branch, and the curation guard.

1. `src/lib/ai/categories/news.ts` — repoint the News category off the now-hidden
   `news-cyan` onto the new keeper. Change `templateIds: ['news-cyan', 'tr3nding-news']`
   to `templateIds: ['news-oracle', 'tr3nding-news']`. `templateIds[0]` is the
   News default template — `news-oracle` becomes the default. REQUIRED: without
   this, `keeper-curation.test.ts` and `category-generation.test.ts` both fail
   (a category must never resolve to a picker-hidden template — SPEC R7). Update
   the inline comment on the `templateIds` line that mentions "news-cyan is a
   registered news-style template" → reference `news-oracle`.

2. `src/lib/ai/prompts.ts` — add `'news-oracle'` to the local `NEWS_TEMPLATES`
   set at line 17: `const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan', 'news-oracle'])`.
   This makes `buildSystemPrompt('news-oracle')` emit the "NEWS DROP TEMPLATE
   (active)" addendum, treating the new id as a news template for generation
   exactly like news-cyan. This is REGISTRATION plumbing only — do NOT change
   the prompt text inside `newsDropAddendum` and do NOT touch `news-cyan`'s
   continued membership in the set (news-cyan stays — its 3 saved carousels and
   the `buildSystemPrompt('news-cyan')` test still depend on it).
   NOTE: there are two other independent `NEWS_TEMPLATES` Sets — in
   `src/lib/services/carousel.ts` and `src/app/(dashboard)/project/[id]/actions.ts`.
   Those gate photo-fetching behavior. They are NOT in scope for this quick task
   (changing them would alter generation behavior). Leave them unchanged.

3. `src/lib/render/templates/__tests__/keeper-curation.test.ts` — update the
   hardcoded curation lists for the swap (the suite pins the cull so it cannot
   drift; the swap is intentional and must be reflected):
   - `APPROVED_KEEPERS`: replace `'news-cyan'` with `'news-oracle'`. The 5
     keepers become: news-oracle, tr3nding-news, bold-yellow, editorial-serif,
     y2k-pop.
   - `CULLED_IDS`: add `'news-cyan'`. The cull list grows from 7 to 8 ids.
   - The test `'the registry still holds all 12 templates (no deletions —
     hide-not-delete)'`: update the description and `expect(templates.length)`
     to `13` (12 existing + news-oracle). The loop over
     `[...APPROVED_KEEPERS, ...CULLED_IDS]` now covers 13 ids — all still in the
     registry, correct.
   - Update the top-of-file comment block and any inline comment that says
     "5 polished keepers" / "7 culled ids" only if the NUMBER is now wrong:
     keepers stay 5 (swap, not addition); culled goes 7 → 8; registry 12 → 13.
   Do NOT loosen any assertion — keep them exact. The `category-generation.test.ts`
   and `category-routing.test.ts` suites are registry/category-DYNAMIC (they
   iterate `CATEGORIES` and `pickerTemplates`) so they need no edits — the
   news.ts repoint in step 1 keeps them green.
  </action>
  <verify>
    <automated>npx vitest run src/lib/render/templates/__tests__/keeper-curation.test.ts src/lib/ai/__tests__/category-generation.test.ts src/lib/ai/categories/__tests__/category-routing.test.ts src/__tests__/ai/prompts.test.ts --reporter=dot</automated>
  </verify>
  <done>
News category `templateIds` is `['news-oracle', 'tr3nding-news']`. prompts.ts
`NEWS_TEMPLATES` includes `news-oracle` (news-cyan and news-drop retained).
keeper-curation.test.ts: APPROVED_KEEPERS has news-oracle (not news-cyan),
CULLED_IDS includes news-cyan, registry-count assertion is 13. All four named
test files pass with no skipped/failed cases.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add additive render-parity fingerprints for news-oracle</name>
  <files>src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap</files>
  <action>
The render-parity fingerprint suite (`parity.template-fingerprint.test.tsx`) is
registry-driven — it does `templates.forEach((template, idx) => ...)`, so the
newly-appended `news-oracle` (index 12) automatically gets a PTF13a + PTF13b
test pair. No test code changes are needed; only the committed snapshot file
needs the two new `news-oracle` entries appended.

Run the fingerprint suite in update mode to ADDITIVELY write the PTF13a/PTF13b
snapshots:

  npx vitest run src/lib/render/__tests__/parity.template-fingerprint.test.tsx -u

CRITICAL — additive only:
  - news-oracle is APPENDED to templates[] (Task 1), so every existing template
    keeps its index → PTF1..PTF12 snapshot keys are unchanged. `-u` writes ONLY
    the two brand-new PTF13 keys; it must NOT rewrite any PTF1..PTF12 or PTL1..2
    entry. If `git diff` on the .snap file shows ANY change to a non-PTF13 line,
    STOP — that means an existing template's render output drifted (a TPLREND-05
    violation) and Task 1 introduced an unintended regression. Investigate
    before proceeding.
  - The PTF13a (SlidePreview) and PTF13b (Satori) entries should reflect the
    `fingerprintFixtureSlide` rendered through news-oracle: Anton font,
    background-color `#0a0a0a`, overlay opacity `0.45`, `text-align: center` /
    `justify-content: center` (the centered differentiator).
  - The `PARITY-04 (registry sanity)` test asserts `templates.length >= 11` —
    still passes at 13. No edit needed there.
After updating, run the full fingerprint suite once more WITHOUT `-u` to confirm
the snapshot is now stable (all PTF/PTL tests pass against the committed file).
  </action>
  <verify>
    <automated>npx vitest run src/lib/render/__tests__/parity.template-fingerprint.test.tsx --reporter=dot && git diff --stat src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap</automated>
  </verify>
  <done>
The snapshot file contains two new `PTF13 (news-oracle)` entries (PTF13a +
PTF13b) and the existing PTF1..PTF12 / PTL1..PTL2 entries are byte-identical to
their pre-task state (git diff shows additions only, no modifications to
existing keys). The fingerprint suite passes with no `-u` flag.
  </done>
</task>

</tasks>

<verification>
Full-suite regression sweep covering every consumer touched or adjacent:

```
npx vitest run \
  src/__tests__/render/templates.test.ts \
  src/lib/render/templates/validate.test.ts \
  src/lib/render/templates/__tests__/keeper-curation.test.ts \
  src/lib/ai/__tests__/category-generation.test.ts \
  src/lib/ai/categories/__tests__/category-routing.test.ts \
  src/__tests__/ai/prompts.test.ts \
  src/lib/render/__tests__/parity.template-fingerprint.test.tsx \
  src/__tests__/render/legacy-templates-byte-identical.test.ts \
  src/__tests__/render/legacy-templates-regression.test.tsx \
  --reporter=dot
```

`legacy-templates-byte-identical` and `legacy-templates-regression` are the
TPLREND-05 guard for news-cyan's 3 existing carousels — they MUST stay green
(news-cyan.ts unmodified).

Also confirm news-cyan.ts is untouched:
```
git diff --exit-code src/lib/render/templates/news-cyan.ts
```
(exit 0 = unchanged — required.)
</verification>

<success_criteria>
- [ ] `src/lib/render/templates/news-oracle.ts` exists, exports `newsOracle`,
      center-aligned, Anton, near-black bg, 0.45 dark overlay, cyan accent,
      ~130px hook, hookFontWeight 400, sample mirrors the Oracle cover slide
      with 7 hook_segments (MASSIVE + SHAKEUP as accent pills).
- [ ] `newsOracle` appended to `templates[]`; `validateTemplateRegistry` passes.
- [ ] `'news-cyan'` added to `HIDDEN_FROM_PICKER`; `news-cyan.ts` itself
      byte-identical (git diff --exit-code clean).
- [ ] News category `templateIds` repointed to `['news-oracle', 'tr3nding-news']`.
- [ ] `news-oracle` added to the `NEWS_TEMPLATES` set in `prompts.ts` (the
      carousel.ts / actions.ts copies left untouched).
- [ ] `keeper-curation.test.ts` lists news-oracle as a keeper, news-cyan as
      culled, registry count 13.
- [ ] Additive PTF13a/PTF13b fingerprints written; PTF1..PTF12 / PTL1..2
      snapshots unchanged.
- [ ] The full regression sweep above passes; legacy byte-identical guards green.
- [ ] No file in the OUT-OF-SCOPE list (`style-spec-projector*.ts`,
      `validate-slides.ts`, `newsDropAddendum` prompt text) was modified.
</success_criteria>

<output>
After completion, create
`.planning/quick/260518-jhg-add-oracle-style-news-template-and-retir/260518-jhg-SUMMARY.md`
</output>
