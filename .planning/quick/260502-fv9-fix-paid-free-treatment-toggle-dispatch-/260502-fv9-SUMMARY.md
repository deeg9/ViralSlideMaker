---
quick_id: 260502-fv9
date: 2026-05-02
status: complete
description: Hybrid local-state sync for handleSlideTreatmentChange — optimistic dispatch flips button state instantly, server-confirmed dispatch swaps the treated background_url
commits:
  - 7921f1f fix(quick-260502-fv9/t1): hybrid local-state sync for handleSlideTreatmentChange
  - de4ce2f test(quick-260502-fv9/t2): regression test for treatment dispatch sync
files_changed:
  - src/components/editor/slide-editor.tsx
  - src/components/editor/__tests__/slide-editor.treatment-sync.test.tsx
---

# 260502-fv9 — Photo treatment toggle live-update fix

## Symptom (verified live via Playwright before fix)

Click any photo-treatment button (B&W, Cream, Cobalt, grain levels, Off) → spinner runs → spinner clears → **nothing visibly changes** in the editor. Active button stays on the previous selection. Background image stays as the previous (untreated or different-treatment) URL. Hard refresh shows the new state — confirming the server action persisted but client React state never synced.

Sister bug to quick-260502-fai (watermark toggle); same shape, same root cause.

## Root cause

`handleSlideTreatmentChange` in `src/components/editor/slide-editor.tsx:92-99` only called `updateSlideTreatment(...)` server-side. The editor's `useReducer` state stayed unchanged because `revalidatePath` on the server doesn't propagate into client `useReducer` state.

## Fix — Strategy (C) Hybrid

Two dispatches per click:

1. **Optimistic** (before the server call): flip `style_overrides.treatment_applied` and `style_overrides.grain_intensity` from the spec immediately. Button states (radio `aria-checked`) update synchronously, so the user sees their click "register" instantly.
2. **Server-confirmed** (after `updateSlideTreatment` resolves): merge `background_url`, `original_source_url`, and `style_overrides.derived_palette` from the returned slide. The treated image is server-computed (Sharp/Imagen pipeline + Supabase upload), so the client can't synthesize it locally — it has to come from the response.

Why hybrid vs pure optimistic: the watermark fix (sister 260502-fai) was pure optimistic because the patch fully described the new state. Treatment differs because the server computes a NEW URL for the treated image; the client only knows what *kind* was requested, not where the treated PNG will live.

**Rollback policy on server failure:** none. A soft inconsistency (button reads Cream but image still original) is less jarring than a button silently un-flipping. `console.warn` matches existing logging style.

## Verification

| Check | Result |
|-------|--------|
| `npm run lint` (slide-editor.tsx + new test) | clean (1 pre-existing unused-var warning, not from this diff) |
| `npx vitest run slide-editor.treatment-sync.test.tsx` | 3/3 pass |
| `npx vitest run slide-editor.watermark-sync.test.tsx` | 3/3 pass (regression-free vs sister fix) |
| `npx vitest run slide-editor.shortcuts.test.tsx` | 5/5 pass |
| `npx vitest run watermark-controls.test.tsx` | 12/12 pass |
| Static check: 2 UPDATE_SLIDE in `handleSlideTreatmentChange` | confirmed (optimistic + server-confirmed) |

**Live Playwright verification (free-tier session, dev server hot-reloaded the diff):**

1. Slide on Cream + Off grain → click Cobalt → button state flips to Cobalt **instantly**, no refresh. After ~10s server work, background swaps to the new cobalt-treated URL (`slide-backgrounds-treated/.../treated/<new-hash>`).
2. Click Off (Duotone row) → Off active instantly, after server return background reverts to original pexels URL.
3. Click Medium (Grain row) → grain button flips to Medium instantly. Duotone state unaffected.
4. All transitions occurred without a page refresh — symptom resolved end-to-end.

## Notes / artefacts

- `currentSlide = slides[selectedIndex]` was already hoisted to line 91 by the sister fix (260502-fai). This fix reuses it.
- The stale follow-up comment from the sister fix (`quick-260502-fai: NOTE — handleSlideTreatmentChange ... fix in a separate quick if/when surfaced`) was replaced with `// quick-260502-fv9: hybrid local-state sync — see handler below.`
- The watermark handlers and the `updateSlideTreatment` server action are byte-identical before/after.

## Out of scope

None remaining for the local-state-sync pattern in this file. The two server-action handlers that had the bug (watermark + treatment) are both fixed. Other slide-level updates already go through `dispatch` correctly (verified during the sister fix).
