---
slug: hide-deprecated-styles-from-picker
date: 2026-05-14
status: in-progress
---

# Hide deprecated visual styles from the Select Visual Style picker

Remove from the picker UI: Highlight Bar, News Drop, Magazine Bold, Documentary, Brutalist Grid.

## Approach
Keep templates in the registry so legacy projects (existing DB rows with these `template_id`s) still render correctly via `getTemplate()`. Only filter them out of the picker.

## Tasks
1. Add `HIDDEN_FROM_PICKER` set + `pickerTemplates` export in `src/lib/render/templates/index.ts`.
2. Update `src/components/slides/template-picker.tsx` to iterate `pickerTemplates` instead of `templates`.
3. Verify: typecheck passes; no other UI surface displays the full registry.
