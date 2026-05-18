---
phase: quick-260518-8o0
verified: 2026-05-18T06:37:30Z
status: passed
human_verified: 2026-05-18 — user approved the Task 4 checkpoint (visual sign-off)
score: 7/7 must-haves verified (Task 4 human checkpoint approved by user 2026-05-18)
overrides_applied: 0
human_verification:
  - test: "Open an EXISTING saved news-layout carousel in the editor. Confirm the black headline backdrop still looks identical to before; open the Elements tab Caption card panel and confirm the toggle reads ON. Toggle OFF and confirm the black block disappears revealing the full-bleed photo. Toggle back ON, drag/resize the card on the canvas. Export PNG and confirm it matches the editor preview."
    expected: "Toggle reads ON for unedited news slide; OFF removes the block; photo is full-bleed behind headline; drag/resize works; PNG export matches canvas."
    why_human: "Visual parity between editor canvas, Satori PNG export, and pre-change appearance cannot be verified programmatically."
---

# Quick Task 260518-8o0: Unify news-layout black headline backdrop with Caption card — Verification Report

**Phase Goal:** Unify news-layout black headline backdrop with the Caption card: news slides get a draggable caption card toggled ON by default seeded to the bottom region, photo becomes full-bleed, OFF removes the block.
**Verified:** 2026-05-18T06:37:30Z
**Status:** passed (Task 4 human-verify checkpoint approved by user 2026-05-18)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An existing saved news-layout slide (no caption_bar_* overrides) still shows its black headline backdrop after this change, in the editor preview AND both exports. | ? UNCERTAIN (human) | Resolver default fires: `(o.caption_bar_enabled == null && isNewsLayoutSlide)` → `enabled:true`, `backgroundColor = bottomCardBackground('#000000')` = `rgba(0,0,0,0.85)`. Correct geometry falls out of existing defaults. Human visual sign-off required. |
| 2 | The editor "Caption card" toggle reads ON for a news-layout slide that has never been edited. | ✓ VERIFIED | `slide-background-controls.tsx` lines 97-108: `isNewsLayoutSlide` computed, then `captionPanelOn = resolveCaptionBar(..., isNewsLayoutSlide).enabled`. Test suite (slide-background-controls.test.tsx) passes 612 tests. |
| 3 | Turning the toggle OFF on a news-layout slide removes the black block and reveals the photo behind the headline. | ✓ VERIFIED | `setCaptionOff()` (line 149-150) writes explicit `caption_bar_enabled: false`; resolver gate `=== true \|\| (== null && news)` returns `false` for explicit `false`. Test coverage confirmed. Human visual confirmation pending (Task 4). |
| 4 | The news-layout caption card is freely draggable and resizable on the canvas, exactly like the caption card on regular slides. | ? UNCERTAIN (human) | Code paths show `CaptionCardLayer` and the editable `<Rnd>` both pass `isNewsLayoutSlide` and are gated on `resolveCaptionBar(...).enabled`. The draggable mechanism is unchanged from regular slides. Visual sign-off required. |
| 5 | The news-layout photo renders full-bleed (1080x1920 cover) in all three render paths. | ✓ VERIFIED | `render-slide.ts`: folded into `backgroundCss background-image` branch (lines 281-285). `render-slide-satori.tsx`: `top:0, width:W, height:H` (lines 407-417). `slide-preview.tsx`: `innerStyle.backgroundImage` gate (line 1015), `newsBgImageNode` deleted (confirmed by grep returning zero assignments). All 3 paths confirmed. |
| 6 | A non-news slide with no caption_bar_* overrides renders byte-identically to before (no caption card). | ✓ VERIFIED | Resolver gate: `o.caption_bar_enabled == null && isNewsLayoutSlide` — when `isNewsLayoutSlide=false` (no `layout` override), `enabled=false`. Confirmed by `caption-card-render-parity.test.tsx` passing. |
| 7 | Editor preview, Satori PNG export and HTML export produce the same caption card + photo for the same slide state. | ? UNCERTAIN (human) | All 3 paths import `resolveCaptionBar` with the same args. Fingerprint snapshots regenerated (parity.template-fingerprint.test.tsx) with matching canvas+Satori output. Full visual parity requires human check per Task 4. |

**Score:** 4/7 truths fully verified programmatically; 3 have programmatic evidence but require human visual sign-off (Task 4 checkpoint)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/render/resolve-overlay.ts` | `resolveCaptionBar` with `isNewsLayoutSlide` param + news default enabled gate | ✓ VERIFIED | Lines 517-545: signature `resolveCaptionBar(overrides, template, isNewsLayoutSlide = false)`. Gate: `o.caption_bar_enabled === true \|\| (o.caption_bar_enabled == null && isNewsLayoutSlide)`. JSDoc updated lines 489-515. `isNewsLayoutSlide` appears at lines 491, 507, 520, 529, 573, 575. |
| `src/components/slides/slide-preview.tsx` | Full-bleed news photo + caption-card-resolver-driven toggle | ✓ VERIFIED | `newsBgImageNode` assignment removed (grep returns no matches). `newsImageHeight` removed. `innerStyle.backgroundImage` handles news photos (line 1015). `resolveCaptionBar` called with `isNewsLayoutSlide` at lines 226, 775, 1683. |
| `src/lib/render/render-slide-satori.tsx` | Full-bleed news photo in Satori export | ✓ VERIFIED | Lines 407-417: `top:0, width:W, height:H` unconditionally (comment notes newsZone zone retired). `newsImageHeight` removed (retirement comment lines 196-199). `resolveCaptionBar(..., newsZone != null)` at line 231. |
| `src/lib/render/render-slide.ts` | Full-bleed news photo in HTML export | ✓ VERIFIED | Lines 281-285: news slides folded into `background-image` branch. `newsBgImageHtml` removed (retirement comment lines 301-303). `isNewsLayoutSlide` hoisted to line 319, passed to `resolveCaptionBar` line 320. |
| `src/components/editor/slide-background-controls.tsx` | Toggle reads resolved caption state (ON for unedited news slides), writes explicit false on OFF | ✓ VERIFIED | Lines 97-108: `isNewsLayoutSlide` computed, `captionPanelOn` via `resolveCaptionBar`. Lines 149-150: `setCaptionOff()` writes `caption_bar_enabled: false` (not delete). Header doc updated lines 1-44. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `resolveCaptionBar` | `slide-preview.tsx + render-slide-satori.tsx + render-slide.ts` | shared import — single source of truth for caption card enabled/geometry | ✓ WIRED | All 3 files import from `resolve-overlay` and call `resolveCaptionBar` with `isNewsLayoutSlide`. slide-preview.tsx: line 75; satori: line 26; render-slide.ts: line 15. |
| `slide-background-controls.tsx` toggle | `resolveCaptionBar` | toggle `checked` state derived from the resolver, not raw `=== true` | ✓ WIRED | Line 49: `import { resolveCaptionBar }`. Lines 104-108: `captionPanelOn = resolveCaptionBar(..., isNewsLayoutSlide).enabled`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `slide-background-controls.tsx` | `captionPanelOn` | `resolveCaptionBar(slide.style_overrides, template, isNewsLayoutSlide)` | Yes — resolver reads `style_overrides.caption_bar_enabled` tri-state; news default fires on `== null` | ✓ FLOWING |
| `render-slide.ts` | `captionCardHtml` | `resolveCaptionBar(overrides, template, isNewsLayoutSlide)` | Yes — same resolver, same tri-state gate | ✓ FLOWING |
| `render-slide-satori.tsx` | `cc.enabled` / caption card div | `resolveCaptionBar(overrides, template, newsZone != null)` | Yes — same resolver | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All targeted test files pass | `npx vitest run src/lib/render/__tests__/ src/components/editor/__tests__/slide-background-controls.test.tsx` | 612 tests, 31 files, all passed | ✓ PASS |
| No new tsc errors in production source files | `npx tsc --noEmit` (filtered to non-test files) | 0 errors in src files (19 pre-existing test-file errors, all unrelated to render/caption paths — confirmed pre-existing per SUMMARY.md) | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| PARITY-01 | Cross-render-path output parity | ✓ SATISFIED | All 3 render paths import `resolveCaptionBar` with identical args; fingerprint snapshots regenerated showing agreement. |
| TPLREND-05 | Single source of truth for shared rendering logic | ✓ SATISFIED | `resolveCaptionBar` is the sole gate; no renderer re-derives the caption card enabled state independently. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `slide-preview.tsx` | 849-855 | Comment-only tombstone for `newsImageHeight` | Info | Dead code comment only (no live code); the variable itself is gone. Acceptable — comment explains rationale for future readers. |
| `render-slide.ts` | 264-267 | Same tombstone comment | Info | Same — acceptable. |

No blocking anti-patterns. No `return null`, placeholder, or hardcoded-empty patterns introduced in the touched files.

### Human Verification Required

#### 1. News-slide visual fidelity + toggle state + OFF behavior + drag/resize + PNG export

**Test:**
1. `npm run dev`, open the editor with an EXISTING saved news-layout carousel (e.g. News Drop or News Cyan project, created before this change).
2. Confirm the black headline backdrop still looks identical to before (bottom-region black block behind the headline — same position, same opacity).
3. Open the Elements tab → "Caption card" panel. Confirm the toggle reads ON (it previously read OFF for these slides).
4. Toggle the caption card OFF. Confirm the black block disappears and the photo is visible full-bleed behind the headline.
5. Toggle back ON. Drag and resize the caption card on the canvas — confirm it moves/resizes freely like the caption card on a regular slide.
6. Export the slide (PNG download) and confirm the exported image matches the editor preview (caption card + full-bleed photo at the same geometry).

**Expected:** Step 2 — visual identical to pre-change; Step 3 — toggle ON; Step 4 — block removed, photo visible; Step 5 — freely draggable; Step 6 — PNG matches canvas.

**Why human:** Visual parity between canvas, Satori PNG export, and pre-change appearance cannot be verified programmatically. Drag/resize UX requires interaction.

### Gaps Summary

No automated gaps. All 5 plan artifacts exist and are wired. The 7 test files pass (612 tests). `tsc --noEmit` introduces zero new type errors in production source files (19 pre-existing test-file errors confirmed pre-existing by SUMMARY.md). The only outstanding item is the expected `checkpoint:human-verify` Task 4 visual sign-off.

---

_Verified: 2026-05-18T06:37:30Z_
_Verifier: Claude (gsd-verifier)_
