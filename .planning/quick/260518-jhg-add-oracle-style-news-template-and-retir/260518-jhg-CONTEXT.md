# Quick Task 260518-jhg: Add Oracle-style news template, retire news-cyan - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Task Boundary

The user has a polished real carousel — project "Oracle Layoff Analysis"
(`96c69e63-c0c0-467f-befd-a552ae2e299e`, 5 slides) — and wants its look to
become a picker template that replaces the current "News Cyan" picker slot,
ahead of a marketing launch.

This quick task ships the **template + style + picker preview + retire
news-cyan** ONLY. The deeper "make newly generated carousels auto-shape like
Oracle" work (AI generation pipeline) is explicitly DEFERRED to a separate
roadmap phase — out of scope here.
</domain>

<decisions>
## Implementation Decisions

### Scope (user-chosen, after being shown the split)
- Ship a NEW template that captures the Oracle carousel's **style DNA** as a
  flat `SlideTemplate` config + a picker `sample` that renders like the Oracle
  cover slide.
- The per-slide caption-card geometry / hook positions / generation recipe is
  NOT in scope — it is being queued as a roadmap phase. Do NOT touch the AI
  generation pipeline (`prompts.ts`, `style-spec-projector.ts`,
  `validate-slides.ts`, slide-emit) in this quick task.

### news-cyan handling (user-chosen: non-destructive)
- ADD the new template; do NOT mutate `news-cyan.ts`.
- Add `news-cyan` to `HIDDEN_FROM_PICKER` in `src/lib/render/templates/index.ts`
  so the 3 existing news-cyan carousels keep rendering byte-identically
  (v2.13 render-parity invariant) while news-cyan leaves the picker.
- The new template takes the picker slot news-cyan vacates.

### Category coverage (hard constraint — discovered)
- `keeper-curation.test.ts` asserts every content category's `templateIds`
  resolves only to picker-VISIBLE templates. The News category currently lists
  `news-cyan`. Hiding news-cyan WITHOUT repointing the News category to the new
  template will fail that test and leave a category resolving to a hidden
  template. The News category (`src/lib/ai/categories/news.ts`) MUST be
  repointed to the new template id.

### Claude's Discretion
- Exact template `id` and display `name` for the new template.
- Exact numeric style values (hook font size, overlay opacity) — derive a
  sensible single value from the Oracle per-slide data below.
- Whether the new id joins the `NEWS_TEMPLATES` set / AI news-template branch
  (it should be treated as a news template for generation, mirroring news-cyan)
  — wire the registration plumbing (NOT the generation recipe).
- `thumbnail` field handling — the picker renders a live tile from `sample`;
  set a sensible `thumbnail` path (a real PNG asset can be a follow-up).
</decisions>

<specifics>
## Specific Ideas — the Oracle carousel's actual look (DB-extracted 2026-05-18)

Project-level `template_id = news-cyan`, but every slide carries
`template_id_override = 'news-drop'` — so it actually renders on **news-drop**
(Anton, black bg) with heavy per-slide `style_overrides`.

**Style DNA to capture in the new template:**
- Font: `'Anton', sans-serif`, `hookFontWeight: 400` (Anton single-weight).
- Background: near-black (`#0a0a0a`/`#000000`).
- Dark photo overlay for headline legibility over full-bleed news photos
  (news-cyan uses `overlayColor #0a0a0a`, `overlayOpacity 0.45` — good model).
- `hookStyle: 'uppercase'`, `textPosition: 'bottom'`.
- `textAlign: 'center'` — Oracle hooks are centered (news-cyan/news-drop are
  left-aligned; this is the main visual differentiator).
- Accent: cyan — `#24ddeb` (cover) / `#00E5FF` (rest). Pill-style highlights
  (`highlightStyle: 'pill'`) on accent keywords.
- Cover hook text color is a cream `#fadbdb` (per-slide override; reflect it in
  the picker `sample` if feasible, template `textColor` stays white).
- Hook font sizes in the project run 120-140px (news-cyan is 124, news-drop
  110) — pick one representative value (~130px).
- News full-bleed layout; caption card already defaults ON for news-layout
  slides via quick-260518-8o0's `isNewsLayoutSlide` resolver path.

**Picker `sample`** should mirror the Oracle cover slide:
- hook_text: `ORACLE CUTS 30,000 JOBS IN MASSIVE SHAKEUP`
- hook_segments: ORACLE / CUTS / 30,000 / JOBS / IN / **MASSIVE**(accent) /
  **SHAKEUP**(accent)
- layout: `cover`
</specifics>

<canonical_refs>
## Canonical References

- `src/lib/render/templates/index.ts` — `SlideTemplate` interface,
  `templates[]` array, `HIDDEN_FROM_PICKER`, `pickerTemplates`,
  `validateTemplateRegistry`, `TEMPLATE_IDS`.
- `src/lib/render/templates/news-cyan.ts`, `news-drop.ts` — closest analogs.
- `src/lib/render/templates/__tests__/keeper-curation.test.ts` — category /
  picker coverage invariant.
- `src/lib/ai/categories/news.ts` — News category `templateIds`.
- `82-KEEPER-SIGNOFF.md` — the user-approved keeper cull list (news-cyan was a
  keeper; this task changes that — note it).
- Render-parity fixtures: `src/lib/render/__tests__/__fixtures__/parity-fingerprint-fixtures.ts`
  and the parity tests — a NEW template needs ADDITIVE fingerprints; existing
  templates stay byte-identical.
</canonical_refs>
