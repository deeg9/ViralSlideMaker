---
quick_task: extract-style-live-debug
created: 2026-05-11
completed: 2026-05-11
status: complete
verdict: extract-pipeline-working-end-to-end
---

# Quick: Extract-style live debug — STATUS: WORKING END-TO-END

## Root cause
Gemini's `responseSchema` rejected the request with `400 INVALID_ARGUMENT` — message verbatim:

> "The specified schema produces a constraint that has too much branching for serving. Typical causes of this error are objects with lots of optional properties, enums with too many values, or any_of a large number of alternative types."

The StyleSpec responseSchema declared `preferredLucide.items.enum = [...LUCIDE_DECORATION_ALLOWLIST]` (100 strings). Gemini's structured-output constraint solver caps the branching factor; 100 enum values blew through it before the request even left the API. The Phase 75 orchestrator caught the throw, returned `extraction_failed`, and the UI surfaced the generic "We couldn't extract a style" panel — but the actual `detail` field was hidden, so the failure looked opaque.

This bug was invisible to unit tests because every test mocked the Gemini SDK; the schema was never sent to a real API.

## Two fixes
1. **`src/lib/ai/extract-style-spec.ts`**: removed the `enum` constraint from `preferredLucide.items` in the responseSchema. Phase B's `parseStyleSpecSafe` (Phase 74-01) already silently-drops unknown values via `createSilentDropCounter`, so the closed-enum invariant is still enforced server-side; we only lose Gemini's structured-output suggestion, which it couldn't honor at this enum size anyway. The prompt already references the allowlist as guidance.
2. **`src/components/style-from-reference/error-router.tsx`**: surfaced `state.error.detail` in the extraction-failed panel under a `font-mono` block (testid `error-extraction-detail`). Permanent UX improvement — future opaque failures self-diagnose.

## Live verification (Playwright MCP)
1. Navigate `/style-from-reference/new` — page loads, no console errors
2. Upload `real-carousel.png` (Meta/Ray-Ban TikTok slide screenshot, 1.6MB)
3. Click "Extract style" — wait ~10s for Gemini round-trip
4. Spec-preview panel renders with:
   - **Palette**: `#473F3D`, `#4F7014`, `#95D60C` (node-vibrant extracted from the photo bytes — DETERMINISTIC per Phase 75 D-07)
   - **Palette mode**: Photo
   - **Typography**: Hook Sans-Serif, Body Sans-Serif
   - **Layout**: Schematic SVG sketch rendered
   - **Voice note**: *"A grim and alarming tone, highlighting a serious privacy breach and its consequences. It feels very factual and direct, like a news report."* — accurate characterization
5. Refusal pre-pass flag visible: "This reference contains a logo + face — generated output will be inspired by the style, not the brand identity." ✓
6. Per-aspect toggles all checked, "Generating will use 1 credit" displayed, 2 retries left

Screenshot: `.playwright-mcp/extract-style-working.png`

## Pipeline integrity confirmed end-to-end
Phase 73 (sharp preprocess + cache lookup + rate-cap + charge) → Phase 74 (StyleSpec Zod) → Phase 75 (refusal pre-pass + Gemini Vision + node-vibrant palette in parallel; Phase B coerce + silent-drop) → Phase 76 (spec-preview UI renders all sections). Live data flowed through every layer correctly.

## Known follow-ons (out of scope for this quick task)
1. **Generate button is disabled** after spec renders — separate bug; possibly user-tier related or a reducer guard. Not investigated; the EXTRACT path was what the user asked to fix.
2. **Thumbnail 404** (still — page-relative resolve of Storage path) — flagged in quick 260510.
3. **Misleading `insufficient_credits`** when deduct_credits throws — flagged in quick 260510 Fix 6.
4. **Other enums in responseSchema** might hit the same branching limit if they grow. Currently SHAPE_KINDS, PALETTE_MODES, FONT_CATEGORIES, TEXT_POSITIONS, LAYOUT_DENSITIES, TREATMENT_KINDS, DECORATION_DENSITIES, RHYTHM_CADENCES are all small (≤ 10 values each), so they're under the limit; if any grows beyond ~30, apply the same pattern.

## Files modified
- `src/lib/ai/extract-style-spec.ts` (responseSchema: drop preferredLucide enum constraint)
- `src/components/style-from-reference/error-router.tsx` (surface error.detail)
