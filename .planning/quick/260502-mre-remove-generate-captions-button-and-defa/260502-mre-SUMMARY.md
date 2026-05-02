---
phase: quick-260502-mre
plan: 01
subsystem: editor + carousel-generation
tags: [editor, captions, publish, default-public, ux]
one_liner: "Removed the Generate Captions entry point from the slide editor and made generateCarousel auto-publish to Explore so freshly generated carousels default to Public."

dependency_graph:
  requires:
    - publishProjectToExplore (existing, src/app/(dashboard)/project/[id]/publish-actions.ts)
    - generateCarousel (existing, src/app/(dashboard)/project/[id]/actions.ts)
  provides:
    - "Editor surface free of the Generate Captions button (caption code remains, just unreachable from the editor)"
    - "Carousels generated via generateCarousel land in published_carousels by default"
  affects:
    - "Editor visibility dropdown — now reflects actual Public state immediately after generation (closes the 'Public (Default)' label drift)"
    - "Explore listings — newly generated carousels appear without an explicit publish click"

tech_stack:
  added: []
  patterns:
    - "Isolated try/catch around best-effort side-effect — auto-publish failure logs but does not flip generation_status to 'error'"

key_files:
  created: []
  modified:
    - "src/components/editor/slide-editor.tsx (-18 lines: import, state hook, button, render block)"
    - "src/app/(dashboard)/project/[id]/actions.ts (+22 lines: import + try/catch auto-publish block)"

decisions:
  - "Used publishProjectToExplore (user-auth path) instead of publishProjectAdmin (admin/RLS-bypass) — generateCarousel runs as the user; same code path the user would hit clicking Publish"
  - "Auto-publish wrapped in own try/catch — slide_data is already persisted before the call, so a publish failure must not flip generation_status to 'error'"
  - "Did not remove the unused vi.mock('@/components/captions/caption-panel', …) calls in the three slide-editor test files (treatment-sync, shortcuts, watermark-sync) — vitest does not fail on unused vi.mock and the plan explicitly scoped them out"
  - "Did not delete src/lib/captions/ or caption-panel.tsx or caption-actions.ts — feature stays in the codebase, only the editor entry point is removed"
  - "Did not add a new revalidatePath call — publishProjectToExplore already calls it internally; left existing /project/[id] + /dashboard revalidatePath calls in place"

metrics:
  duration: "~3 min"
  completed: "2026-05-02"
  tasks: 3
  files_changed: 2
---

# Quick 260502-mre: Remove Generate Captions Button + Default to Public Summary

## What shipped

Two small UX corrections delivered in a single quick task:

1. **Generate Captions entry point removed** from the slide editor sidebar. The button + `showCaptions` state + `CaptionPanel` import + conditional render block are gone. The captions feature itself (`src/lib/captions/`, `caption-panel.tsx`, `caption-actions.ts`) stays in the codebase — only the editor entry point was removed.

2. **`generateCarousel` auto-publishes** to Explore immediately after persisting `slide_data`. Closes the visible drift between the editor visibility dropdown's "Public (Default)" label and the previous Private-by-default data path.

## Tasks completed

| # | Name                                              | Commit  | Files                                             |
|---|---------------------------------------------------|---------|---------------------------------------------------|
| 1 | Remove Generate Captions entry point              | b8a9855 | src/components/editor/slide-editor.tsx            |
| 2 | Auto-publish newly generated carousels            | 92af6a7 | src/app/(dashboard)/project/[id]/actions.ts       |
| 3 | Build + test gate (verification only)             | —       | none                                              |

## Verification

- `grep -nE "showCaptions\|setShowCaptions\|CaptionPanel\|Generate Captions" src/components/editor/slide-editor.tsx` → 0 matches
- `grep -n "publishProjectToExplore" src/app/(dashboard)/project/[id]/actions.ts` → import on line 18 + call site on line 321
- `grep -n "publishFormData.set('title'" src/app/(dashboard)/project/[id]/actions.ts` → line 318
- `npm run build` → exits 0 (`✓ Compiled successfully in 4.5s`)
- `npx vitest run src/components/editor/__tests__` → **5 files, 28 tests, all green**
- `npx tsc --noEmit -p tsconfig.json` → 16 pre-existing baseline errors (all in unrelated `__tests__` files for stripe/auth/api-keys/projects mocks). Zero errors in `slide-editor.tsx`, `actions.ts`, `publish-actions.ts`, or any caption file.

## Implementation notes

### Task 1 — slide-editor.tsx (-18 lines)

Four exact deletions, top-down:

1. `import { CaptionPanel } from '@/components/captions/caption-panel'` (1 line)
2. `const [showCaptions, setShowCaptions] = useState(false)` (1 line)
3. The `<button onClick={() => setShowCaptions(!showCaptions)} …>Generate Captions</button>` element (7 lines, in the editor sidebar)
4. The `{showCaptions && <CaptionPanel … />}` conditional render block (8 lines, just before the closing `</div>` of the editor)

### Task 2 — actions.ts (+22 lines)

Added one import:
```ts
import { publishProjectToExplore } from '@/app/(dashboard)/project/[id]/publish-actions'
```

Inserted between `await supabase.from('projects').update({…})` and `revalidatePath(...)`:
```ts
// QUICK-260502-MRE-02: auto-publish so newly generated carousels default to Public.
// Wrapped in its own try/catch — slide_data is already persisted above, so a publish
// failure here must NOT mark the entire generation as failed. The user can publish
// manually from the editor if this best-effort step fails.
try {
  const publishFormData = new FormData()
  publishFormData.set('title', carousel.title)
  publishFormData.set('description', '')
  publishFormData.set('tags', '')
  const publishResult = await publishProjectToExplore(projectId, publishFormData)
  if (!publishResult.success) {
    console.error(
      '[generateCarousel] auto-publish failed (non-fatal):',
      publishResult.error,
    )
  }
} catch (publishErr) {
  console.error('[generateCarousel] auto-publish threw (non-fatal):', publishErr)
}
```

The outer try/catch at the bottom of `generateCarousel` (which flips `generation_status: 'error'`) is intentionally NOT wrapping the auto-publish call — by the time we reach it, `slide_data` is already saved, so a publish failure must not mark generation itself as failed.

## Deviations from Plan

**Plan-vs-actual line numbers diverged.** The PLAN frontmatter cited line 14 for the `CaptionPanel` import, line 82 for `useState(false)`, lines 950-956 for the button, and lines 968-975 for the conditional render. Actual locations in the live file were lines 13, 78, 704-710, and 722-729 respectively (the editor file is 733 lines, not 975). Edits were performed by content-match (not line-match) so the divergence was a non-issue.

No other deviations. Both Rule 1/2/3 auto-fixes triggered zero times — the plan's specified content matched the live file exactly once we matched by string instead of by line number.

## Authentication gates

None.

## Known Stubs

None. The Generate Captions entry point removal is complete (button + state + import + render all gone); auto-publish wires through to the production publish path with real `carousel.title`.

## Threat Flags

None. The auto-publish call uses the existing `publishProjectToExplore` server action which is already user-auth gated, performs ownership validation against `projects.user_id`, sanitizes tags via the existing offensive/format filters, and runs through the existing `publish_carousel` RPC. No new network surface, no new schema, no new trust boundary — just an extra invocation of an existing user-authenticated path.

## Out-of-scope items (deferred)

None observed. Three slide-editor test files (`slide-editor.treatment-sync.test.tsx`, `slide-editor.shortcuts.test.tsx`, `slide-editor.watermark-sync.test.tsx`) each retain a now-unused `vi.mock('@/components/captions/caption-panel', …)` call. The plan explicitly scoped these out: vitest does not fail on unused vi.mock and they cause no runtime impact. They can be cleaned up in a future janitor pass if/when the captions feature is fully removed from the codebase.

## Self-Check: PASSED

- [x] FOUND: src/components/editor/slide-editor.tsx (modified, -18 lines)
- [x] FOUND: src/app/(dashboard)/project/[id]/actions.ts (modified, +22 lines)
- [x] FOUND: commit b8a9855 (Task 1) in git log
- [x] FOUND: commit 92af6a7 (Task 2) in git log
- [x] FOUND: 0 matches for `showCaptions|setShowCaptions|CaptionPanel|Generate Captions` in slide-editor.tsx
- [x] FOUND: `publishProjectToExplore` import + call site in actions.ts
- [x] FOUND: `npm run build` exit 0
- [x] FOUND: `npx vitest run src/components/editor/__tests__` 28/28 pass
