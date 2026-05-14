---
slug: remove-page-counter-overlay
quick_id: 260514-kv9
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Remove page-counter overlay — Summary

Per-slide "2/5"-style chip in the top-right corner of every slide is gone. Editor chrome "Slide N / total" pill (above the canvas, quick-260514-ku2) is the single source.

## Changes

- **`src/components/slides/slide-preview.tsx`** + **`src/lib/render/render-slide-satori.tsx`**: short-circuited `page-counter` overlays at the top of the `template.overlays.map(...)` body. Dropped the now-unreachable `augmentEditorialSerifPageCounterStyle` call (helper module + unit tests remain).

- **Test files** updated to assert absence instead of existence:
  - `src/__tests__/components/slide-preview-overlays.test.tsx` — collapsed 4 "renders page-counter …" cases into one "page-counter overlay is suppressed even when declared in the template" test.
  - `src/__tests__/components/premium-templates-preview.test.tsx` — 3 magazine-bold / tr3nding-news / documentary counter tests rewritten to `screen.queryByTestId('overlay-top-right')).toBeNull()`.
  - `src/__tests__/render/render-slide-satori.test.tsx` — 2 tests (overlay rendering + missing-ctx fallback) rewritten to assert the counter node is `undefined` in the walked tree.
  - `src/__tests__/render/premium-templates.test.tsx` — 3 `expect(counter).toBeDefined()` → `toBeUndefined()` (magazine-bold, tr3nding-news, documentary).

- **Snapshots regenerated** via `npx vitest run -u`. 453 snapshots updated; 2 obsolete (counter-only) snapshots removed.

## Verification

- `npx tsc --noEmit` on touched files: clean.
- Affected test suites: real-source failures down from 5+ before the work to 0 new failures. Remaining 16-file failure list across the broader codebase is all pre-existing (phase-70-final-regression-sweep, Stripe, AI prompts, rate-limit, projects-crud, responsive — none related to overlays).

## Smoke

Open any template-based slide → the "1/5", "2/5", etc. chip that used to sit in the top-right corner is gone. The "Slide N / total" reference still lives above the canvas (quick-260514-ku2). Export PNG / publish hero render: no counter on the rendered output either (Satori path patched in parity).

Commit pending.

## Notes

- Template registry entries (`{ type: 'page-counter' }` declarations) preserved as no-op data. Reverting is a one-edit revert in slide-preview.tsx + render-slide-satori.tsx.
- The `augmentEditorialSerifPageCounterStyle` helper is now dead code in production but its tests still pass (helper is pure). Left in place — cleanup is a future tech-debt sweep, not urgent.
