---
phase: quick-260515-nhf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/render/resolve-overlay.ts
  - src/components/slides/slide-preview.tsx
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/render-slide.ts
autonomous: true
requirements: [BUGFIX-NHF-01]

must_haves:
  truths:
    - "A hook text box whose stored text is mixed-case renders mixed-case on the editor canvas (template uppercase no longer forced)"
    - "A hook text box with no user font/casing override renders byte-identically to today (template uppercase still applies as fallback)"
    - "The Satori PNG export honors the user's per-TextBox hook font family, matching the editor canvas"
    - "The editor canvas and Satori export agree on hook casing, font family, and size for every slide"
  artifacts:
    - path: "src/lib/render/resolve-overlay.ts"
      provides: "resolveHookTypography shared helper — single source of truth for hook casing/font/size precedence"
      contains: "export function resolveHookTypography"
    - path: "src/lib/render/render-slide-satori.tsx"
      provides: "Satori hook style consuming resolveHookTypography (closes hook_font_family parity gap)"
  key_links:
    - from: "src/components/slides/slide-preview.tsx"
      to: "resolveHookTypography"
      via: "import + call to build hook textTransform/fontFamily/fontSize"
      pattern: "resolveHookTypography"
    - from: "src/lib/render/render-slide-satori.tsx"
      to: "resolveHookTypography"
      via: "import + call to build hook textTransform/fontFamily/fontSize"
      pattern: "resolveHookTypography"
---

<root_cause>
## Root Cause (verified in code)

The hypothesis was correct on mechanism, partially off on detail. Findings:

**1. Forced ALL CAPS — the user genuinely cannot fix it.**
Both render paths apply uppercase straight from the template, with NO per-TextBox
or per-override escape hatch:
- `src/components/slides/slide-preview.tsx:888` — `textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : undefined`
- `src/lib/render/render-slide-satori.tsx:293-295` — `if (template.hookStyle === 'uppercase') hookStyle.textTransform = 'uppercase'`
- `src/lib/render/render-slide.ts:285` — same.

The slide in the screenshot uses the **`highlight-bar`** template
(`src/lib/render/templates/highlight-bar.ts`: `fontFamily: "'Inter', sans-serif"`,
`hookFontSize: '96px'`, `hookStyle: 'uppercase'`) — matching the inspector's
"Inter / 96". `hookStyle: 'uppercase'` is a CSS `text-transform`, so the *stored*
TextBox text stays mixed-case (what the inspector shows) while the canvas paints
caps. There is **no `text_transform` field on the `TextBox` type**
(`src/lib/types/slide.ts:131-166`) and no `text_transform` on `SlideStyleOverrides`
(lines 168-213) — so the inspector literally has nothing to write. This is why the
user "can't even fix it."

**2. Font/size mismatch — a real Satori-export parity gap, plus a perception effect.**
- The dual-write adapter DOES persist inspector edits:
  `src/lib/editor/text-box-adapter.ts:225-226` maps `hookBox.font_family →
  style_overrides.hook_font_family` and `hookBox.font_size → hook_font_size`.
- The editor canvas (`slide-preview.tsx:719`) DOES honor
  `overrides.hook_font_family ?? template.headingFontFamily ?? template.fontFamily`.
- **BUG:** the Satori export (`render-slide-satori.tsx:290`) hardcodes
  `fontFamily: template.headingFontFamily ?? template.fontFamily` — it never reads
  `overrides.hook_font_family`. So a user who picks a different hook font sees it on
  the editor canvas but the exported PNG silently reverts to the template font.
  This is a direct TPLREND-05 violation.
- The render-slide.ts HTML path (`render-slide.ts:282`) inherits the hook font from
  the root `template.fontFamily` (line 264) and likewise ignores
  `overrides.hook_font_family`.
- The "different font" the user perceives on the canvas is largely the uppercase
  transform: Inter at 96px in ALL CAPS reads very differently from the mixed-case
  inspector preview. Font *size* itself resolves correctly for `highlight-bar`
  (it is NOT in `HOOK_FIT_REGISTRY` — `src/lib/render/hook-fit.ts:15`, so no
  auto-shrink runs); the size "mismatch" is the visual consequence of the caps +
  the same export-vs-editor divergence on font family making the export look wrong.

**Net root cause:** hook typography resolution lacks a precedence rule. Casing is
template-locked with no override path at all; hook font family is honored in the
editor but not in either export path. Explicit user TextBox values must win;
template values must remain the fallback.

**Fix shape:** add a `text_transform` field to `TextBox` + `SlideStyleOverrides`,
add one shared `resolveHookTypography` helper in `resolve-overlay.ts` (the existing
TPLREND-05 single-source-of-truth module), and route all three render paths through
it. No-override slides resolve to exactly today's values → legacy byte-identity
preserved.
</root_cause>

<objective>
Fix the slide-editor hook text box rendering bug where the template's hardcoded
`hookStyle: 'uppercase'` and font family override the user's explicit per-TextBox
edits, with no way for the user to correct it.

Purpose: User-set TextBox values (text casing, font family, font size) must take
precedence over template hardcoded defaults across the editor canvas AND both
export paths. Template values remain the fallback for un-overridden slides.

Output: A new `text_transform` field on the data model, a shared
`resolveHookTypography` resolver, and all three render paths (editor preview,
Satori PNG export, HTML render) consuming it — keeping editor/export byte-identical
(TPLREND-05) and legacy slides byte-identical to today.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@src/lib/types/slide.ts
@src/lib/render/resolve-overlay.ts
@src/lib/render/render-slide-satori.tsx
@src/lib/render/render-slide.ts
@src/components/slides/slide-preview.tsx
@src/components/editor/text-rail/ActiveTextBoxCard.tsx
@src/lib/editor/text-box-adapter.ts

<interfaces>
<!-- Key contracts the executor needs — extracted from the codebase. -->

TextBox (src/lib/types/slide.ts:131) — per-TextBox fields already include
`font_family?: string`, `font_size?: number`, `font_weight?`, `font_style?`.
A new `text_transform?: 'uppercase' | 'none'` field is added by Task 1.

SlideStyleOverrides (src/lib/types/slide.ts:168) — already carries
`hook_font_family?`, `hook_font_size?`. A new `hook_text_transform?: 'uppercase' | 'none'`
field is added by Task 1 (dual-write target — mirrors hook_font_family precedent).

text-box-adapter.ts:221-241 — `deriveSliceFromSlide` / dual-write maps
`hookBox.font_family → patch.hook_font_family`, `hookBox.font_size →
patch.hook_font_size`. Task 1 adds the parallel
`hookBox.text_transform → patch.hook_text_transform` line.

Current hook typography resolution (3 divergent sites — to be unified):
- slide-preview.tsx:719  `hookFontFamily = overrides.hook_font_family ?? template.headingFontFamily ?? template.fontFamily`
- slide-preview.tsx:888  `textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : undefined`
- render-slide-satori.tsx:290  `fontFamily: template.headingFontFamily ?? template.fontFamily`  ← MISSING override
- render-slide-satori.tsx:293  `if (template.hookStyle === 'uppercase') hookStyle.textTransform = 'uppercase'`
- render-slide.ts:282/285  hook font inherits root `template.fontFamily`; `text-transform` from `template.hookStyle`

SlideTemplate (src/lib/render/templates/index.ts:63) — `hookStyle: 'uppercase' | 'normal' | 'italic'`,
`fontFamily: string`, `headingFontFamily?: string`, `hookFontSize: string`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add text_transform to data model + dual-write + shared resolveHookTypography helper</name>
  <files>src/lib/types/slide.ts, src/lib/editor/text-box-adapter.ts, src/lib/render/resolve-overlay.ts, src/lib/render/__tests__/resolve-hook-typography.test.ts</files>
  <behavior>
    resolveHookTypography(overrides, hookTextBox, template):
    - No overrides, no TextBox override → returns template values verbatim:
      { textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : 'none',
        fontFamily: template.headingFontFamily ?? template.fontFamily,
        fontStyle: template.hookStyle === 'italic' ? 'italic' : 'normal' }
      (LEGACY BYTE-IDENTITY — this is the critical test).
    - overrides.hook_text_transform === 'none' → textTransform 'none' even when
      template.hookStyle === 'uppercase' (user un-caps a template-uppercase hook).
    - overrides.hook_text_transform === 'uppercase' → textTransform 'uppercase'
      even when template.hookStyle === 'normal'.
    - overrides.hook_font_family set → fontFamily = that value (wins over template).
    - hookTextBox.text_transform set but overrides.hook_text_transform absent →
      textTransform from the TextBox (defense-in-depth; both should agree post-dual-write).
    - Precedence order asserted: explicit override > TextBox field > template default.
    - text-box-adapter: deriving a slice from a slide with hookBox.text_transform set
      produces style_overrides_patch.hook_text_transform === that value.
  </behavior>
  <action>
    1. src/lib/types/slide.ts: add `text_transform?: 'uppercase' | 'none'` to the
       `TextBox` interface (near font_family/font_size, ~line 137) with a doc
       comment: "User override for hook casing. Wins over template.hookStyle.
       Falls back to the template's hookStyle when undefined (legacy byte-identity)."
       Add `hook_text_transform?: 'uppercase' | 'none'` to `SlideStyleOverrides`
       (near hook_font_family, ~line 201) with a comment mirroring the
       hook_font_family precedent (additive, dual-write target).
    2. src/lib/editor/text-box-adapter.ts: in the hook-box derivation block
       (lines 224-226, alongside `patch.hook_font_family` / `patch.hook_font_size`),
       add `if (hookBox.text_transform !== undefined) patch.hook_text_transform =
       hookBox.text_transform`. Also add the reverse mapping in the
       overrides→TextBox direction (lines 100-101 area):
       `...(overrides?.hook_text_transform !== undefined ? { text_transform:
       overrides.hook_text_transform } : {})` so a hydrated slide round-trips.
    3. src/lib/render/resolve-overlay.ts: add and export
       `resolveHookTypography(overrides: SlideStyleOverrides | undefined,
       hookTextBox: TextBox | undefined, template: SlideTemplate):
       { textTransform: 'uppercase' | 'none'; fontFamily: string;
       fontStyle: 'normal' | 'italic' }`. Implement the precedence in the
       <behavior> block. Pure function — no DOM/Node deps (the module is .ts and
       tier-neutral; keep it that way). Import `TextBox` from `@/lib/types/slide`
       and `SlideTemplate` from `./templates` (already imported). Do NOT touch
       fontSize here — hook size already resolves correctly via
       `overrides.hook_font_size ?? ...` in all three paths and changing it risks
       the hook-fit clamp interaction; this helper owns casing + family + style only.
    4. Create the test file covering every case in <behavior>. The legacy
       byte-identity case (no overrides → template values verbatim) is the
       load-bearing assertion for TPLREND-05.
  </action>
  <verify>
    <automated>npx vitest run src/lib/render/__tests__/resolve-hook-typography.test.ts</automated>
  </verify>
  <done>resolveHookTypography exported from resolve-overlay.ts; text_transform on TextBox + hook_text_transform on SlideStyleOverrides; dual-write maps both directions; all behavior-block test cases pass; tsc baseline (19 pre-existing errors) unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Route all three render paths + the inspector through resolveHookTypography</name>
  <files>src/components/slides/slide-preview.tsx, src/lib/render/render-slide-satori.tsx, src/lib/render/render-slide.ts, src/components/editor/text-rail/ActiveTextBoxCard.tsx</files>
  <behavior>
    - slide-preview.tsx: hook style's `textTransform`, `fontFamily`, and italic
      `fontStyle` now come from resolveHookTypography(overrides, hookTextBox, template).
      A slide with no overrides renders byte-identically (same textTransform/font as today).
    - render-slide-satori.tsx: hookStyle.fontFamily now honors
      overrides.hook_font_family (closes the parity gap at line 290); textTransform
      comes from resolveHookTypography. No-override slide → byte-identical SVG.
    - render-slide.ts: hook font-family + text-transform come from
      resolveHookTypography. No-override slide → byte-identical HTML string.
    - Editor + Satori export now produce the same casing AND font family for a
      slide whose hook TextBox has a font/casing override (TPLREND-05).
    - ActiveTextBoxCard: a new "Uppercase" toggle in the Style row (next to
      Bold/Italic) for the hook role; OFF writes text_transform 'none', ON writes
      'uppercase'; the displayed pressed-state reflects the resolved value
      (override ?? template.hookStyle === 'uppercase').
  </behavior>
  <action>
    1. src/components/slides/slide-preview.tsx: import `resolveHookTypography` from
       `@/lib/render/resolve-overlay`. Call it once near the existing hook style
       construction (~line 719/884). Replace `hookFontFamily` (line 719) with the
       helper's `fontFamily`; replace the `textTransform` (line 888) and the
       template-driven `fontStyle` (line 887) with the helper's `textTransform` /
       `fontStyle`. Keep the existing `overrides.hook_font_size`-based
       `hookFontSize` logic untouched (do NOT move size into the helper).
       Note in a comment: "quick-260515-nhf — hook casing/font/style now resolved
       via the shared resolveHookTypography helper so editor + Satori + HTML agree
       (TPLREND-05) and user TextBox overrides win over template hookStyle."
    2. src/lib/render/render-slide-satori.tsx: import `resolveHookTypography`. Call
       it near the `hookStyle` object (line 268). Replace `hookStyle.fontFamily`
       (line 290) with the helper's `fontFamily` — THIS is the export-parity bug
       fix. Replace the `if (template.hookStyle === 'uppercase')` /
       `if (template.hookStyle === 'italic')` blocks (lines 293-298) with
       `hookStyle.textTransform = typography.textTransform` (only set when
       'uppercase' to avoid emitting `textTransform: 'none'` where today emits
       nothing — preserve byte-identity) and `if (typography.fontStyle === 'italic')
       hookStyle.fontStyle = 'italic'`.
    3. src/lib/render/render-slide.ts: import `resolveHookTypography`. At the hook
       div construction (~line 282-286), source `font-family` and `text-transform`
       from the helper. The hook currently inherits root `template.fontFamily`;
       emit an explicit `font-family: '<helper.fontFamily base>', sans-serif;` on
       the hook div. Ensure `getAllFontLinks` still emits a <link> for the
       override font — if the override font is not already covered by
       `getAllFontLinks(slide, template.fontFamily)`, extend that call or add the
       hook font to the link set so the exported HTML actually loads the glyphs.
       Keep `text-transform: none` omitted when the resolved value is 'none' (emit
       nothing) to preserve byte-identity for legacy slides.
    4. src/components/editor/text-rail/ActiveTextBoxCard.tsx: in the Style row
       (lines 298-302 area, alongside Bold/Italic), add an "Uppercase" toggle
       button shown for `textBox.role === 'hook'`. Pressed state =
       `(textBox.text_transform ?? (template.hookStyle === 'uppercase' ?
       'uppercase' : 'none')) === 'uppercase'`. onClick toggles between
       `onUpdate({ text_transform: 'uppercase' })` and
       `onUpdate({ text_transform: 'none' })`. Reuse the existing Bold/Italic
       button styling + FOCUS_RING; add `data-testid="active-text-box-uppercase"`
       and an `aria-pressed` attribute.
    5. Update any existing snapshot tests for slide-preview / render-slide-satori /
       render-slide that change. Legacy no-override snapshots MUST stay identical —
       if a no-override snapshot changes, the helper precedence is wrong; fix the
       helper, do not bless the snapshot.
  </action>
  <verify>
    <automated>npx vitest run src/lib/render/__tests__ src/components/slides/__tests__/slide-preview.test.tsx src/components/editor/text-rail 2>&1 | tail -20</automated>
  </verify>
  <done>All three render paths consume resolveHookTypography; Satori export honors overrides.hook_font_family; ActiveTextBoxCard has a working hook Uppercase toggle; legacy no-override snapshots byte-identical; editor + Satori agree on hook casing/font for overridden slides; tsc baseline (19 pre-existing errors) unchanged; lint gates pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| persisted slide JSON → renderer | A hand-edited / AI-emitted `style_overrides.hook_text_transform` or `text_box.text_transform` value crosses into the render path |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nhf-01 | Tampering | resolveHookTypography | mitigate | `text_transform` typed as the closed union `'uppercase' \| 'none'`; the helper treats any non-`'uppercase'`/non-`'none'` value as fall-through to the template default (no `eval`, no dynamic CSS) — a malformed payload degrades to legacy behavior, never injects arbitrary CSS |
| T-nhf-02 | Denial of Service | render paths | accept | text_transform is a CSS keyword, not a numeric/size field — no layout-overflow or hook-fit interaction; no clamp needed (size resolution is deliberately left out of this helper) |
</threat_model>

<verification>
- `resolveHookTypography` legacy case (no overrides) returns exactly today's
  template-derived values — the TPLREND-05 byte-identity guard.
- A hook TextBox with `text_transform: 'none'` on a `highlight-bar` slide renders
  mixed-case on the editor canvas AND in the Satori PNG export.
- A hook TextBox with a non-template `font_family` renders that font in BOTH the
  editor canvas and the Satori export (the previously-divergent paths now agree).
- Legacy slides with no `text_transform` / `hook_font_family` override produce
  byte-identical snapshots across all three render paths.
- `npx tsc --noEmit` shows no new errors beyond the 19-error baseline.
</verification>

<success_criteria>
- The user can toggle a hook text box out of ALL CAPS from the inspector and the
  canvas + export both honor it.
- Explicit user TextBox font family is honored by the Satori PNG export (export no
  longer reverts to the template font).
- Template `hookStyle: 'uppercase'` / font family remain the fallback for any slide
  with no user override — legacy slides render byte-identically to today.
- Editor preview, Satori export, and HTML render all resolve hook casing + font
  through the single shared `resolveHookTypography` helper (TPLREND-05 preserved).
</success_criteria>

<output>
After completion, create `.planning/quick/260515-nhf-investigate-and-fix-text-box-1-forced-al/260515-nhf-SUMMARY.md`
</output>
