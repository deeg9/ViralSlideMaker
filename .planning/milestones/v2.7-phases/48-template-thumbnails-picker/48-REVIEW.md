---
phase: 48
status: issues_found
depth: standard
reviewed_at: 2026-04-29T21:45:00Z
files_reviewed: 5
files_reviewed_list:
  - scripts/generate-template-thumbnails.ts
  - src/lib/render/sample-slide.ts
  - src/components/slides/template-picker.tsx
  - src/lib/render/render-slide-satori.tsx
  - package.json
findings:
  critical: 0
  high: 1
  medium: 1
  low: 2
---

# Phase 48: Code Review Report

**Reviewed:** 2026-04-29T21:45:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 48 extracts `makeSampleSlide` into a shared module, adds an offline thumbnail
generator script, and applies a Satori `display:flex` fix for multi-segment text divs.
The overall structure is sound and the error handling posture for the script is correct
(fail loud, exit 1). Two issues of note: a latent Satori crash vector remains in
`custom_texts` rendering (same class of bug as the already-fixed hook/body divs), and
the picker test hardcodes the template count as a bare integer rather than deriving it,
meaning the assertion between `previews.length` and `templates.length` can drift
silently when a template is added. One dead-code conditional and one path traversal
observation (low risk given static template IDs) round out the findings.

---

## High Issues

### HR-01: custom_texts divs missing display:flex — same Satori crash vector as hook/body

**File:** `src/lib/render/render-slide-satori.tsx:408-428`

**Issue:** The `display:flex` + `flexWrap:wrap` fix applied to `hookStyle` (line 195) and
`bodyStyle` (line 223) was not applied to the `custom_texts` div (line 408). The
`CustomText` interface includes an optional `segments?: TextSegment[]` field, and
`renderSegmentChildren` is called with `ct.segments` at line 426. When any `ct.segments`
array has more than one entry, Satori will throw the same
`Children with multiple elements must use display:flex` error that prompted the
hook/body fix. Custom text boxes with segmented content (e.g., accent-colored words
added via the editor) will silently crash `/api/render`.

**Fix:** Add `display: 'flex'` and `flexWrap: 'wrap'` to the custom_texts div style,
matching the pattern already established for hook/body:

```tsx
// src/lib/render/render-slide-satori.tsx, inside the custom_texts .map()
<div
  key={ct.id}
  style={{
    position: 'absolute',
    left: pxX(ct.x),
    top: pxY(ct.y),
    width: pxX(ct.width),
    display: 'flex',        // add
    flexWrap: 'wrap',       // add
    textAlign: ct.text_align ?? 'left',
    fontSize: ct.font_size ?? 48,
    fontWeight: ct.font_weight ?? 400,
    fontStyle: ct.font_style ?? 'normal',
    lineHeight: 1.3,
    color: ctBaseColor,
    fontFamily: ct.font_family ?? template.fontFamily,
    ...ctEffects,
    ...(ctHighlight ?? {}),
  }}
>
```

---

## Medium Issues

### MR-01: Picker test hardcodes count as bare integer — drifts silently from templates.length

**File:** `src/__tests__/components/template-picker.test.tsx:31,59`

**Issue:** The first test asserts `expect(previews.length).toBe(8)` and separately
`expect(templates.length).toBe(8)` as a comment-noted "schema invariant." These are two
independent hardcoded values. When a 9th template is added, `templates.length` becomes 9
and the registry invariant assertion fails loudly — but `previews.length.toBe(8)` will
*also* fail, which is the correct signal. However the second test asserts
`expect(previews.length).toBe(9)` (brand-kit configured case), which is `templates.length + 1`
but stated as a magic number. If a template is added, this assertion fails with a
confusing count mismatch rather than a semantically clear message. The fix is to derive
counts from `templates.length` so the assertion intent is self-documenting.

**Fix:**

```tsx
// Test 1 — replace hardcoded 8 with derived count
expect(previews.length).toBe(templates.length)
// Keep the schema invariant as a separate explicit assertion:
// expect(templates.length).toBe(8) — this remains a pinned guard, document it clearly

// Test 2 — derive from templates.length
expect(previews.length).toBe(templates.length + 1) // +1 for the brand-kit tile
```

---

## Low Issues

### LR-01: Dead conditional in template name class — both branches identical

**File:** `src/components/slides/template-picker.tsx:128-129`

**Issue:** The ternary for the template name `<span>` className resolves to the same
value regardless of `isSelected`:

```tsx
className={`block text-sm font-semibold ${isSelected ? 'text-[#3d0000]' : 'text-[#3d0000]'}`}
```

Both branches emit `text-[#3d0000]`. This is dead code that adds noise and could mask a
future intent to visually differentiate the selected tile's name (e.g., `font-bold` when
selected, matching the label below it).

**Fix:** Simplify to a static class, or add the intended differentiation:

```tsx
// Option A — collapse to static (current visual behavior preserved):
className="block text-sm font-semibold text-[#3d0000]"

// Option B — add visual selected indicator to match the label below:
className={`block text-sm font-semibold text-[#3d0000] ${isSelected ? 'font-bold' : ''}`}
```

### LR-02: template.id used in file path with no sanitization in thumbnail script

**File:** `scripts/generate-template-thumbnails.ts:39`

**Issue:** `join(OUT_DIR, \`${template.id}.png\`)` uses `template.id` as a path
component without asserting it contains only safe characters. Currently all 8 registered
IDs are lowercase ASCII with hyphens (`bold-yellow`, `tr3nding-news`, etc.), so there is
no active risk. The `validateTemplateRegistry` call that runs at module load does not
validate the `id` field format — only overlay configuration. If a future template is
registered with an id like `../../etc/passwd` or `../public/something`, the script would
write outside `public/templates/`.

This is an offline dev script (not a request handler), so exploitability is negligible.
It is noted because the fix is one line and makes the intent explicit.

**Fix:** Add a guard assertion before the loop, or sanitize per iteration:

```ts
// At the top of main(), after mkdirSync:
for (const template of templates) {
  if (!/^[a-z0-9-]+$/.test(template.id)) {
    throw new Error(`[thumbs] Unsafe template id '${template.id}' — must match [a-z0-9-]+`)
  }
  // ... rest of loop
}
```

---

## Notes

**Error handling (script):** The `main().catch(err => { console.error(err); process.exit(1) })` wrapper is correct. All failure modes (bad template, font load failure, Satori crash, disk write failure) propagate through the `async` chain and abort with exit code 1. The sequential `for...of` loop means a failure on template N prevents N+1 through 8 from running, which is the correct loud-failure posture for a build script.

**display:flex fix side effects (single-segment rendering):** The fix is safe for the single-text-content case. `renderSegments` returns the raw `text` string when `segments` is empty or absent (line 134 of `resolve-overlay.ts`). A single string child does not trigger the Satori multi-children constraint, and `flexWrap: 'wrap'` on a single-child flex container has no visual effect. Snapshot tests confirm the single-segment output is unchanged.

**Path traversal (template.id):** Risk is theoretical given static compile-time IDs. Flagged as Low, not Medium, because the script is not reachable from any HTTP surface.

**Memory / ImageResponse cleanup:** `ImageResponse` extends `Response`; calling `.arrayBuffer()` consumes the body and the underlying resvg-wasm buffer is GC-eligible after the `Buffer.from(...)` copy. The sequential loop processes one template at a time so peak memory is bounded to one render at a time. No explicit cleanup is needed or available on the `ImageResponse` API.

---

_Reviewed: 2026-04-29T21:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
