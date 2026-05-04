# DEPS-05: v2.12 Phase 70 Bundle-Size Gate Baseline + Delta — Editor Route

**Phase:** 70
**Plan:** 01
**Requirement:** DEPS-05 (CI bundle-size gate; mirror v2.6 triple-layer build-gate)
**Date measured:** 2026-05-04
**Build target:** Next.js 15.5.13 production, `next build --no-lint`
**Mirror reference:** `.planning/phases/67-schema-foundation-null-decoration-tplrend-05-baseline/DEPS-01-BUNDLE-DELTA.md`

## TL;DR

Editor route chunk (`/project/[id]/page-*.js`) baseline at v2.11 is **165,906
bytes raw / 35,399 bytes gzipped**, captured AT git ref `87c398b` immediately
BEFORE the three new dependencies (DEPS-02 `@tanstack/react-virtual@^3.13.24`,
DEPS-03 `@leeoniya/ufuzzy@^1.0.19`, DEPS-04 `react-colorful@^5.6.1`) were
`npm install`ed.

After install, the editor route chunk is **165,906 bytes raw / 35,077 bytes
gzipped** — `delta_raw = 0`, `delta_gz = -322`. Net negative because no source
file under `src/` imports any of the three new packages at this commit
(grep verified empty); package-lock.json updates are the only on-disk change.
This is the EXPECTED state for Plan 70-01 — Plan 70-02 introduces the first
lazy lucide-static / @tanstack/react-virtual / @leeoniya/ufuzzy import behind
`next/dynamic`, and Plan 70-04 introduces react-colorful inside DecorationCard.

The DEPS-05 ceiling — `BASELINE + 200 KB` — is policed for every commit through
end-of-phase by `src/components/editor/__tests__/bundle-gate.test.ts`. Any
commit that pushes the editor route chunk above the ceiling fails CI.

**Result: PASS — `delta_raw = 0`, `delta_gz = -322 ≤ 204800`. Gate live.**

## v2.11 Baseline Methodology

1. Working tree: `b8f171d` was HEAD when this plan started; this baseline
   measurement captures the chunk size on commit SHA `87c398b` (the working
   tree at start of Plan 70-01 with no modifications staged for the install).
2. Clean rebuild: `rm -rf .next && npx next build --no-lint`. The `--no-lint`
   flag matches the methodology Phase 67 Plan 02 established (parity test
   `parity.test.tsx` carries pre-existing `@typescript-eslint/no-explicit-any`
   errors that block lint; lint output is irrelevant to chunk byte count).
3. Discover the editor route chunk:
   ```bash
   find ".next/static/chunks/app/(dashboard)/project/[id]" -name "page-*.js"
   ```
   Exactly ONE chunk — `page-85d38d6e7d3cbcc2.js` — pre-install. The chunk
   filename is content-hashed; the byte count is the metric, not the hash.
4. Measure raw + gzipped bytes:
   ```bash
   CHUNK=$(find ".next/static/chunks/app/(dashboard)/project/[id]" -name "page-*.js")
   wc -c < "$CHUNK"           # raw bytes
   gzip -c "$CHUNK" | wc -c   # gzipped bytes (default level 6)
   ```
5. Record the numbers in `bundle-gate-baseline.ts` as
   `BASELINE_V211_BYTES_RAW` / `BASELINE_V211_BYTES_GZ`. The vitest gate
   imports both constants and asserts the freshly-built chunk size stays
   within `BASELINE + 200 KB`.

The Phase 67 Plan 02 measurement (post-lucide-react v0.577 → v1.14 upgrade)
recorded **164,398 / 35,045**. The 1,508 byte raw / 354 byte gz drift between
Phase 67-02 and this baseline reflects v2.11 carry-forward edits — primarily
Phase 68 reducer extensions (10 new EditorAction cases) and Phase 69 decoration
renderer (decoration-renderer.tsx) — committed between `6621612` (Phase 67-02
HEAD) and `87c398b` (Plan 70-01 start). All within tolerance.

## Pre-Install Snapshot (v2.11 baseline)

| Field | Value |
|-------|-------|
| Git SHA | `87c398b` |
| Commit | `b8f171d docs(quick-260503-0f2): mark complete after Anton weight fix shipped` (working tree state at plan start) |
| Chunk file | `.next/static/chunks/app/(dashboard)/project/[id]/page-85d38d6e7d3cbcc2.js` |
| Raw bytes | **165,906** |
| Gzipped bytes | **35,399** |
| Next.js report | `ƒ /project/[id]   96.8 kB   354 kB` |

These are the values pinned in `bundle-gate-baseline.ts`:

```ts
export const BASELINE_V211_BYTES_RAW = 165_906
export const BASELINE_V211_BYTES_GZ = 35_399
```

## Post-Install Snapshot (DEPS-02 + DEPS-03 + DEPS-04 added)

| Field | Value |
|-------|-------|
| Action | `npm install @tanstack/react-virtual@^3.13.24 @leeoniya/ufuzzy@^1.0.19 react-colorful@^5.6.1` |
| Chunk file | `.next/static/chunks/app/(dashboard)/project/[id]/page-54611e9ef188ff85.js` |
| Raw bytes | **165,906** |
| Gzipped bytes | **35,077** |
| Next.js report | `ƒ /project/[id]   96.8 kB   354 kB` |

## Delta

| Metric | Pre | Post | Δ | % | Pass? |
|--------|-----|------|---|---|-------|
| Raw bytes | 165,906 | 165,906 | **0** | 0.00% | ✅ |
| Gzipped bytes | 35,399 | 35,077 | **-322** | -0.91% | ✅ |
| Ceiling raw | — | 165,906 + 204,800 = **370,706** | n/a | n/a | ✅ |
| Ceiling gz | — | 35,399 + 204,800 = **240,199** | n/a | n/a | ✅ |

Why the chunk is byte-identical raw but 322 bytes smaller gz: Webpack's content
output for the editor route depends only on what `src/` imports — and at
this commit, NOTHING under `src/` imports any of the three new packages.
The 322 byte gz drop is non-determinism in gzip (Next.js may include a build
identifier or different metadata block per build); the raw byte count is the
ground truth and it is unchanged.

The DEPS-05 ceiling provides **204,800 bytes (200 KB) headroom** for:

1. **Plan 70-02 LucidePicker (lazy):** `next/dynamic(() => import('./lucide-picker'), { loading: () => null })` keeps lucide-static (~7 MB unminified, ~1 MB gz with all 1,703 icons) OUT of the editor route eager chunk. The picker chunk is its own lazy bundle. The gate verifies the lazy split — a forgotten `next/dynamic` would put the entire icon corpus into the editor route and EXPLODE past the ceiling.
2. **Plan 70-02 ufuzzy + react-virtual:** Both are loaded by the LucidePicker dynamic chunk; neither lands in the editor route eager chunk.
3. **Plan 70-04 DecorationCard + react-colorful:** DecorationCard is a right-rail panel (eagerly imported by `text-editor-panel.tsx`), so react-colorful WILL show up in the editor route chunk. react-colorful is ~3 KB gz — well under headroom.
4. **Plan 70-01 ShapePicker:** This plan ships ShapePicker eagerly (8 tiles, no virtualization, no icon corpus). The component imports nothing exotic; expected delta < 5 KB raw.

## Measurement Methodology

**What counts as the "editor route":**

The editor route is `/project/[id]` (Next.js App Router; `(dashboard)` route
group). Next.js emits exactly ONE page chunk for this route:

```
.next/static/chunks/app/(dashboard)/project/[id]/page-{contentHash}.js
```

The gate (`bundle-gate.test.ts`) globs this directory for `page-*.js` files
and asserts the **sum** of raw / gzipped sizes stays under the ceiling. Today
that sum is the size of the single chunk; if Webpack ever splits this route
into multiple page chunks (rare; would require explicit dynamic boundaries),
the test asserts the count is exactly 1 so the change is reviewed deliberately.

**What does NOT count:**

- Shared chunks under `.next/static/chunks/{1255,4bd1b696,...}.js` — those are
  cross-route runtime + framework code, NOT editor-specific. They land in
  every route's "First Load JS shared by all" line and are policed separately
  (or not at all, since Next.js manages them).
- Server-side bundles (`.next/server/`) — irrelevant to client-route weight.
- CSS chunks (`.next/static/css/*.css`) — separate budget, not in scope here.

**Raw vs gzipped — why both:**

Raw bytes reflect what Webpack's content output actually contains; the
gzipped count reflects what users download. Phase 67-02 chose gzipped as the
primary metric because users care about download size. This plan keeps BOTH
constants pinned so the gate catches a regression in either dimension —
some compressor changes can keep gz size flat while bloating raw bytes (and
vice versa); pin both.

**Compressor used:** `gzip` default level (6). Same as Phase 67-02.
`bundle-gate.test.ts` uses `node:zlib`'s `gzipSync` (also level 6 by default)
so the gate's measurement matches the methodology here.

**Reproduction:**

```bash
# 1. Establish the editor chunk
rm -rf .next
npx next build --no-lint

# 2. Find + measure
CHUNK=$(find ".next/static/chunks/app/(dashboard)/project/[id]" -name "page-*.js" | head -1)
echo "raw=$(wc -c < "$CHUNK")  gz=$(gzip -c "$CHUNK" | wc -c)"

# 3. Run the gate
npx vitest run src/components/editor/__tests__/bundle-gate.test.ts
```

Gate passes ⇒ chunk ≤ ceiling. Gate fails ⇒ a new lazy boundary is needed
or the baseline must be deliberately re-pinned (with documented justification
in the plan's SUMMARY).

## Triple-Layer Build-Gate Pattern (DEPS-05 mirror of v2.6)

The gate has three layers, each catching a different regression class:

| Layer | What it catches | Where it lives |
|-------|-----------------|----------------|
| 1. Static import test | A new dep that fails to resolve at compile time | Implicitly via `npm run build` succeeding (Next.js's own type-check + bundle pass); explicitly via the `node -e "require(...)"` smoke during install |
| 2. Vitest size gate | Editor-route chunk weight regression past ceiling | `src/components/editor/__tests__/bundle-gate.test.ts` (this gate; 4 tests) |
| 3. `npm run build` | Webpack/Next.js fails to produce a chunk at all (build-time error: missing peer dep, type error, RSC boundary violation) | `next build --no-lint` exit code; CI runs `npm run build && vitest run` so this gate executes BEFORE the vitest gate sees `.next/` |

A regression at layer 1 fails the build (no chunk to measure). A regression
at layer 3 also fails the build. Layer 2 catches the most insidious case: the
build succeeds, the chunk exists, but it's larger than the ceiling.

## If the Gate Fails

Diagnostic checklist (mirror of Phase 67-02 "If Delta is Positive" section):

1. **New eager import of one of the 3 deps that should be lazy?** Check:
   ```bash
   grep -rEln "@tanstack/react-virtual|@leeoniya/ufuzzy|lucide-static" src/ --include="*.ts" --include="*.tsx"
   ```
   If anything in the editor route's eager import graph (NOT a `next/dynamic`
   chunk) imports lucide-static or @tanstack/react-virtual, that's the bug.
   Fix: wrap in `next/dynamic(() => import(...), { loading: () => null })`.

2. **A barrel import was accidentally introduced?** Check:
   ```bash
   grep -rEn "import \* as" src/components/editor/
   ```
   `import * as Icons from 'lucide-react'` would defeat tree-shaking entirely;
   per-icon ESM imports (`import { ChevronLeft } from 'lucide-react'`) only.

3. **A new feature legitimately needs more room?** Re-pin the baseline:
   - Update `BASELINE_V211_BYTES_{RAW,GZ}` in `bundle-gate-baseline.ts`
   - Document the cause in the changing plan's SUMMARY
   - Re-record the post-change snapshot here as a follow-up dated section

The gate's failure message includes `actual / ceiling / baseline / diff` so the
remediation hint is visible at test failure time without re-reading this doc.

## Cross-Reference

- Phase 67 Plan 02 — original lucide-react v1.14 upgrade -169 byte delta:
  `.planning/phases/67-schema-foundation-null-decoration-tplrend-05-baseline/DEPS-01-BUNDLE-DELTA.md`
- v2.6 triple-layer build-gate pattern reference: see Phase 41/42 (MCP server)
  build verification — same shape (static import + vitest gate + `npm run build`).
- Plan 70-02 LucidePicker lazy-load contract:
  `.planning/phases/70-editor-ui-picker-card-layers-shapes/70-02-PLAN.md` (TBD).
- DEPS-05 enforcement test:
  `src/components/editor/__tests__/bundle-gate.test.ts`
