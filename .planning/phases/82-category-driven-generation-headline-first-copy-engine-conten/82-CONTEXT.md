# Phase 82: Category-driven generation — headline-first copy engine + content-category picker + template curation - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Carousel generation is steered by a user-selected content category (distinct from the visual template). News and Facts & Info ship complete headline-first copy modules; the category system is extensible for Health/Wellness, Beauty, etc. The Gemini output schema makes `body_text` optional (headline-only slides first-class) and adds an optional per-slide accessory label. The template gallery is curated down to ~4-6 polished keepers via hide-not-delete. Scope is the generation pipeline + the category picker in the existing creation form + the template gallery — the editor is not modified.

See `82-SPEC.md` for the 10 locked requirements, boundaries, and acceptance criteria. This CONTEXT.md captures the HOW.

</domain>

<decisions>
## Implementation Decisions

### Category Data Model & Wiring
- `category` is a TypeScript string-literal union backed by a category **registry module**, mirroring the existing `src/lib/render/templates/index.ts` registry pattern.
- Category logic lives in a new `src/lib/ai/categories/` directory — one module per category (prompt text + allowed template list), plus a registry that aggregates them. Adding Health/Wellness or Beauty later = drop in a new module.
- `category` is **persisted on the project row** (alongside `templateId`) so Regenerate and Remix reuse the same category.
- Each category module declares an **ordered `templateIds` list**; the first entry is the category's default template; the template picker shows that subset when the category is selected.

### Headline-First Copy & Schema
- `body_text` becomes optional: removed from the Gemini `responseSchema.required` array; `.optional()` in Zod `SlideContentSchema`. The property is **kept** (not replaced) for back-compat with the ~50 saved projects and pre-Phase-82 carousels.
- The News and Facts & Info prompt modules **explicitly instruct headline-only** output — omit body text; a body is permitted only on a rare genuine support slide.
- Keyword accenting **reuses the existing `hook_segments` + `TextSegment.accent`** mechanism (already wired to `template.accentColor` for two-color news headlines) — no new highlight field.
- `validateAndRepair` is updated so orphan-detection, length-cap, and body-related checks skip gracefully when `body_text` is absent. (Technical cleanup — Claude's discretion on exact form.)

### Accessory Label
- New optional `accessory_label` string field per slide in the Gemini `responseSchema` + Zod schema (flat string — smallest schema surface).
- The legacy→`text_boxes` adapter maps `accessory_label` to a `text_boxes` entry: small, top-anchored, `role: 'custom'`.
- Styled small, uppercase, template accent color, top position — matching the reference kicker labels ("NEWS", "PALAN-TIES", "VIDEO: ICE").
- Prompt guidance keeps it **optional and sparing** — at most roughly every 2nd–3rd slide, never mandatory. The headline stays the dominant element.

### Template Curation
- Hide-not-delete is implemented via a `listed` (or `hidden`) boolean flag on `SlideTemplate`. `TemplatePicker` filters on it; the template registry and `getTemplate()` still resolve all templates, so saved projects referencing a culled template render unchanged (v2.13 byte-identity parity preserved).
- The executor presents the proposed ~4-6 keeper list (with per-template reasoning and category coverage) via a user question **before** committing the curation change — satisfies SPEC R9.
- "Polish the keepers" concentrates on the **News template**, refining it toward the reference screenshots (full-bleed image, dark gradient, kicker-label support). Other keepers get a light touch only.
- `premium-tier.ts` / `PREMIUM_TEMPLATE_IDS` is left untouched unless a premium template is among the culled set — Claude's discretion on the marker if so.

### Claude's Discretion
- Exact form of the `validateAndRepair` updates for absent body text.
- `premium-tier.ts` marker handling if a premium template is culled.
- Naming of the `listed`/`hidden` flag and the `accessory_label` field.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/render/templates/index.ts` — 12-template registry with `SlideTemplate` interface and `getTemplate(id)` fallback; the pattern to mirror for the category registry.
- `src/lib/ai/prompts.ts` — `buildSystemPrompt(templateId)`; `NEWS_TEMPLATES` set already branches a news addendum; slop-guardrails imported.
- `src/lib/ai/generate-slides.ts` — `responseSchema` (Gemini), `callGemini`, the validate/retry-once flow, decoration ingest, `legacyToTextBoxes` population.
- `src/lib/ai/schemas.ts` — Zod `TextSegmentSchema` / `SlideContentSchema` / `CarouselSchema`.
- `src/lib/ai/validate-slides.ts` — `validateAndRepair`, `isPremiumTemplate`.
- `src/lib/editor/text-box-adapter.ts` — `legacyToTextBoxes` maps legacy fields into `text_boxes`.
- `src/lib/types/slide.ts` — `Slide`, `TextBox`, `TextSegment`, `TextBoxPosition`.
- `src/components/slides/generation-form.tsx` — the creation form; `templateId` state defaults to `highlight-bar`; `TemplatePicker` rendered under "Select Visual Style".
- `src/components/slides/template-picker.tsx` — the visual-style picker to filter by category / `listed` flag.
- `src/lib/render/templates/premium-tier.ts` — `PREMIUM_TEMPLATE_IDS` leaf module.

### Established Patterns
- Registry modules with a typed interface + array export + id-keyed lookup (`templates/index.ts`).
- Gemini output is double-validated: Google `responseSchema` then Zod `CarouselSchema.parse`, with a retry-once gate on premium/typo warnings.
- Two-color headlines via `hook_segments` + `TextSegment.accent` → `template.accentColor`.
- Generation must route newly created carousels through the `autoPublishOnGenerate` helper (public-by-default — regressed 6× historically).

### Integration Points
- `generation-form.tsx` → `generateCarousel` server action → `generate-slides.ts` → `buildSystemPrompt` — `category` threads through this chain.
- The project row schema (Supabase) — new persisted `category` column.
- `TemplatePicker` — filtered by the selected category's `templateIds` and the `listed` flag.

</code_context>

<specifics>
## Specific Ideas

- Reference screenshots on `~/Desktop`: `Screenshot 2026-05-17 at 11.14.48 AM.png` (ugly fallback), `Screenshot 2026-05-15 at 5.13.25 / 5.13.49 / 5.14.10 PM.png` (target news-headline style), `Screenshot 2026-05-17 at 11.26.26 AM.png` (current creation flow).
- Target news look: full-bleed photojournalism image, dark gradient, one big bold headline with 1-3 accent-highlighted keywords, a small category kicker label.
- News categories ship first because that is the reported pain point; Facts & Info ships alongside; Health/Wellness and Beauty are framework-only this phase.

</specifics>

<canonical_refs>
## Canonical References

- `82-SPEC.md` — locked requirements, boundaries, acceptance criteria (the WHAT).
- v2.13 render-parity byte-identity invariant — preserved by hide-not-delete.

</canonical_refs>

<deferred>
## Deferred Ideas

- Health & Wellness, Beauty (and any further) category copy modules — framework only this phase; full copy systems are a later phase.
- Editor changes for category-aware editing or dedicated accessory-label controls — out of scope; the generic `text_box` editor already suffices.
- A redesign of the "What shall we create?" page layout — only a category control is inserted.
- Net-new templates designed from scratch — keepers are polished, not rebuilt.

</deferred>
