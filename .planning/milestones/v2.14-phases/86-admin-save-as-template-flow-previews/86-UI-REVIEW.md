---
phase: 86-admin-save-as-template-flow-previews
type: ui-review
date: 2026-05-19
overall_score: 24
max_score: 24
status: advisory
---

# Phase 86 UI Audit — Admin Save-as-Template Flow + Previews

**Overall: 24/24** — audited against `86-UI-SPEC.md`.

Surfaces audited: the `(admin)` route-group layout, the Save-as-Template page
(`(admin)/templates/save/page.tsx`), the client form (`save-template-form.tsx`),
and the template picker tile (`TemplateTilePreview` + `template-picker.tsx`).

| Pillar | Score | Notes |
|--------|-------|-------|
| Copywriting | 4/4 | All copy implemented verbatim from the UI-SPEC copy contract — heading `Save as Template`, subtitle, every field label + helper, CTA `Save as template` / `Saving…`, success `Template saved. It appears in the picker for everyone within a minute.`, error `Couldn't save the template: {reason}…`, empty state `No carousels yet`. CTA is a specific verb+noun; error names problem + recovery path. |
| Visuals | 4/4 | Reuses the established form idiom (native controls, `space-y-4`, `rounded-xl` inputs) from `claim-username-form.tsx`. 9:16 `rounded-xl` cover-preview frame. `TemplateTilePreview` renders the PNG `object-cover` inside the unchanged tile frame; code templates keep the byte-identical `<SlidePreview>` fallback. No new component-library blocks. |
| Color | 4/4 | Only "Bloom Rose Light" theme literals — `#3d0000` accent reserved for the submit fill, headings, labels and focus ring; `#7d6161` muted text; `#dbc1bc` borders; `#fff8f7`/`#fff0f0` surfaces; green-50/200/700 success + red-50/200/700 error blocks. No accent overuse. |
| Typography | 4/4 | `text-2xl font-bold` page heading, `text-base font-semibold` section heading, `text-sm font-semibold` labels, `text-sm` body, `text-xs` helpers — every value matches the existing project ramp; no new type sizes introduced. |
| Spacing | 4/4 | 4px-multiple scale — `space-y-4` field rhythm, `px-6 py-12` page padding, `mt-8` header-to-form gap, `gap-4` picker tiles. The `mb-1.5` label gap and `py-3` input height are the documented UI-SPEC exceptions, carried verbatim from the existing idiom. |
| Accessibility / Registry | 4/4 | Every input has a programmatic `<label htmlFor>`; the category `<select>` is keyboard-native; submit communicates state via the `disabled` attribute (not color alone); the preview `<img>` carries `alt="Preview of {name}"`; focus ring `focus:ring-2 focus:ring-[#3d0000]/20` on all inputs. Zero component-registry installs. |

## Findings
No blocking findings. The implementation tracks the UI-SPEC design contract
faithfully on all six pillars.

Advisory note (non-blocking): the cover-preview area in the form renders a
titled placeholder card inside the 9:16 frame rather than a live
`<SlidePreview>` of the source carousel — this is the UI-SPEC-sanctioned
acceptable option ("the authoritative preview is the server-rendered PNG").
A future polish pass could render the live `<SlidePreview>` for a richer
in-form preview, but it is explicitly out of scope and not a defect.

## Verdict
**24/24 — advisory pass.** The admin authoring page and the picker preview
tile honor the UI-SPEC's copy, color, typography, spacing, visual, and
accessibility contracts. Non-blocking; this audit is advisory only.
