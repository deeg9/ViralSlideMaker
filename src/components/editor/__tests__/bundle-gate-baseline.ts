/**
 * DEPS-05 (Phase 70 Plan 01): bundle-size gate baseline constants.
 *
 * Single source of truth for the editor route page chunk size ceiling enforced
 * by `bundle-gate.test.ts`. Mirrors the v2.6 triple-layer build-gate pattern
 * (static import + vitest size gate + `npm run build`).
 *
 * The v2.11 baseline below was captured immediately BEFORE `npm install` of the
 * three new dependencies (DEPS-02 @tanstack/react-virtual, DEPS-03
 * @leeoniya/ufuzzy, DEPS-04 react-colorful). The numbers are reproduced in
 * `.planning/phases/70-editor-ui-picker-card-layers-shapes/70-01-DEPS-05-BUNDLE-DELTA.md`
 * with the full measurement methodology.
 *
 * Reproduction:
 *   rm -rf .next && npx next build --no-lint
 *   CHUNK=$(find ".next/static/chunks/app/(dashboard)/project/[id]" -name "page-*.js")
 *   echo "raw=$(wc -c < "$CHUNK")  gz=$(gzip -c "$CHUNK" | wc -c)"
 *
 * Phase 67 Plan 02 captured the lucide-react v1 upgrade at -169 bytes gz; this
 * plan locks the v2.11 baseline AFTER that upgrade (+ subsequent v2.11 carry-
 * forward). Drift across the phase is policed by the 200 KB ceiling below; any
 * commit that pushes the chunk above CEILING_BYTES_RAW (or _GZ) fails the gate.
 *
 * NEVER edit these constants without:
 *   1. updating 70-01-DEPS-05-BUNDLE-DELTA.md with a fresh pre/post snapshot
 *   2. recording the cause of the size delta in the SUMMARY of the changing plan
 *   3. cross-referencing the commit SHA that produced the new baseline
 */

// v2.11 baseline — measured at git ref 87c398ba on a clean
// `next build --no-lint` from a fresh `rm -rf .next`.
export const BASELINE_V211_BYTES_RAW = 165_906
export const BASELINE_V211_BYTES_GZ = 35_399

// 200 KB headroom (decimal kilobytes, 200 * 1024 bytes) — covers the picker
// (Plan 70-02), DecorationCard (70-04), shape-picker (this plan), and any
// incidental editor-route weight added before end-of-phase. Plan 70-02's
// next/dynamic lazy-load contract for LucidePicker keeps lucide-static and
// the 1,703-icon corpus OUT of the editor route eager chunk — DEPS-05 is the
// regression net that catches a forgotten dynamic import.
const HEADROOM_BYTES = 200 * 1024 // 204,800

export const CEILING_BYTES_RAW = BASELINE_V211_BYTES_RAW + HEADROOM_BYTES
export const CEILING_BYTES_GZ = BASELINE_V211_BYTES_GZ + HEADROOM_BYTES
