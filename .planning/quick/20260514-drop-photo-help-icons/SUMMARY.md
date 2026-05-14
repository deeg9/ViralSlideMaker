---
slug: drop-photo-help-icons
date: 2026-05-14
status: complete
---

# Drop photo + help icons from the top action row

User asked to remove the photo (Add Image) and question mark (Help) icons
from the top action row in the editor's left sidebar.

## What changed

`src/components/editor/slide-editor.tsx` — removed:
- `<button title="Add Image">` (`add_photo_alternate` icon) — the one that
  switched the right panel to the Images tab.
- `<button title="Help">` (`help` icon) — was a static button with no
  handler.

The remaining row is: add slide / duplicate / delete / add text box, then
a `flex-1` spacer (preserved so future right-aligned items still anchor
right).

No test references to the deleted buttons. TypeScript clean.
