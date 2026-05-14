---
slug: hide-deprecated-styles-from-picker
date: 2026-05-14
status: complete
---

# Hide deprecated styles from Select Visual Style picker

Removed from the picker UI: **Highlight Bar, News Drop, Magazine Bold, Documentary, Brutalist Grid**.

## What changed

- `src/lib/render/templates/index.ts` — added `HIDDEN_FROM_PICKER` set and `pickerTemplates` filtered export. Full registry + `getTemplate()` fallback unchanged.
- `src/components/slides/template-picker.tsx` — iterates `pickerTemplates` instead of full `templates`.
- `src/__tests__/components/template-picker.test.tsx` — updated assertions to track `pickerTemplates.length` and dropped brutalist-grid from the Phase 56 visible-tiles check; swapped `magazine-bold` → `bold-yellow` for the "Selected" tile test.

## Behavior

Legacy projects with `template_id` = highlight-bar / news-drop / magazine-bold / documentary / brutalist-grid still render correctly — they're in the registry, just not promoted in the picker.

## Out of scope (flagged for separate decision)

Two other surfaces still expose all 13 templates:
- `src/app/api/v1/templates/route.ts` — public REST endpoint.
- `src/lib/mcp/tools.ts` `list_templates` tool — MCP server.

If you want these hidden from API consumers too, swap their imports from `templates` → `pickerTemplates` (same one-line change).
