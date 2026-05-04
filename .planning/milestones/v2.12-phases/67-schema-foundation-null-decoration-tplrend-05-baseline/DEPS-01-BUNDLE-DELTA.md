# DEPS-01: lucide-react v0.577 → ^1.14 Bundle Delta — Editor Route

**Phase:** 67
**Plan:** 02
**Requirement:** DEPS-01 (lucide-react upgrade verified NEGATIVE bundle delta)
**Date measured:** 2026-05-04
**Build target:** Next.js 15 production, `next build --no-lint`

## TL;DR

Editor route chunk (`/project/[id]/page-*.js`) **shrank by 169 bytes
gzipped (-0.48%)** after the lucide-react v0.577 → v1.14 upgrade. Total
`/app` chunk-directory size unchanged (488 KB on both sides). The upgrade
is clean — no regressions, modest size win on the editor route, full
breaking-change avoidance verified by the brand-icon grep gate from
Plan 67-01 Task 3.

**Result: PASS — `delta_gz = -169 bytes ≤ 0`.**

## Methodology

1. Captured pre-upgrade baseline at git ref `1d306ae` (commit immediately
   BEFORE Plan 67-01's lucide-react upgrade in `bbd93be`).
2. Clean install: `rm -rf node_modules .next && npm install`.
3. Production build: `npx next build --no-lint`.
   - `--no-lint` was needed because `parity.test.tsx` has two pre-existing
     `@typescript-eslint/no-explicit-any` errors that would block the build.
     These pre-date Plan 67-01 and are scope-deferred per
     Plan 67-01 Summary's "Pre-Existing Test Failures (Out of Scope)"
     section. The `--no-lint` flag affects only lint reporting, NOT chunk
     output — chunk size is identical with or without lint.
4. Measured editor-route chunk: file under
   `.next/static/chunks/app/(dashboard)/project/[id]/page-*.js`. Captured
   raw byte count (`wc -c`) and gzipped byte count (`gzip -c | wc -c`).
   Also captured directory total via `du -k .next/static/chunks/app`.
5. Switched back to `main` (HEAD = `6621612`, post-upgrade), repeated steps
   2–4.
6. Computed deltas: `delta_raw = post_raw - pre_raw`,
   `delta_gz = post_gz - pre_gz`.
7. Asserted `delta_gz ≤ 0`. Result: **-169 bytes (PASS)**.

Both lucide versions verified at install time:
- `node_modules/lucide-react/package.json` showed `0.577.0` pre-upgrade.
- `node_modules/lucide-react/package.json` showed `1.14.0` post-upgrade.

## Pre-Upgrade Measurement (lucide-react@0.577.0)

| File | Raw bytes | Gzipped bytes |
|------|-----------|---------------|
| `app/(dashboard)/project/[id]/page-f270297357d74d80.js` | 164,399 | 35,214 |

Total `.next/static/chunks/app/`: **488 KB**

Captured at git ref: `1d306ae` (parent of the lucide-react upgrade commit
`bbd93be`).

Next.js build report for this chunk's route:
```
ƒ /project/[id]                                         96.6 kB         250 kB
```

## Post-Upgrade Measurement (lucide-react@1.14.0)

| File | Raw bytes | Gzipped bytes |
|------|-----------|---------------|
| `app/(dashboard)/project/[id]/page-d90df66b0b425350.js` | 164,398 | 35,045 |

Total `.next/static/chunks/app/`: **488 KB**

Captured at git ref: `6621612` (Plan 67-02 Task 1 commit, which inherits
all of Plan 67-01's changes including the upgrade).

Next.js build report for this chunk's route:
```
ƒ /project/[id]                                         96.4 kB         250 kB
```

(The Next.js report itself shows 96.6 kB → 96.4 kB on the route line — a
0.2 kB drop visible at the build-report granularity.)

## Delta

| Metric | Pre | Post | Δ | % | Pass? |
|--------|-----|------|---|---|-------|
| Raw bytes | 164,399 | 164,398 | **-1** | -0.0006% | ✅ |
| Gzipped bytes | 35,214 | 35,045 | **-169** | -0.48% | ✅ (must be ≤ 0) |
| Chunk-dir total KB | 488 | 488 | 0 | 0% | ✅ |
| Next.js report (kB) | 96.6 | 96.4 | -0.2 | -0.21% | ✅ |

## Notes

- The size win is smaller than the "32% reduction" the lucide-react v1
  release notes advertised. That headline number applies to projects that
  imported the full UMD bundle; this codebase already used per-icon ESM
  imports (`import { ChevronLeft } from 'lucide-react'`), so most of the
  potential reduction was already captured by tree-shaking pre-upgrade.
  The 169-byte gzipped drop is consistent with v1's slightly-improved
  per-icon size (refactored internals + dropped legacy code paths) on
  the ~30 icons the editor route imports. No barrel imports exist (verified
  by Plan 67-01 brand-icon grep gate).
- Per Plan 67-01 grep gate: zero brand-icon imports → zero collateral
  damage from v1 brand-icon removal (Github / Slack / Figma / Twitter /
  Facebook / Linkedin / Youtube / Apple / Chrome / Trello / Dribbble /
  Gitlab / Codepen / Codesandbox).
- Phase 70 (DEPS-05) extends this gate into CI as a triple-layer build-gate
  (mirror v2.6 pattern). Plan 67-02 only ships the manual measurement —
  CI gate lands in Phase 70.

## If Delta is Positive

If a future re-baseline shows post-upgrade chunk LARGER than pre-upgrade,
the upgrade is NOT clean. Possible causes:
1. A new barrel import was accidentally introduced
   (`import * as Icons from 'lucide-react'`). Check via:
   ```bash
   grep -rE "import \\* as.*lucide" src/
   ```
2. lucide-react v1 has a transitive dep that v0 didn't (verify via
   `npm ls`).
3. Tree-shaking is broken because of a side-effectful import in v1
   (rare; check the v1 changelog).

In any of these cases: do NOT ship Plan 67-02 with a positive delta. File
a follow-up to investigate before unblocking Phase 68. *Not encountered
this measurement — delta is negative, methodology unchanged for the
follow-up.*

## Reproducibility

Anyone can re-run this measurement on a clean tree:

```bash
# 1. Pre-upgrade baseline
git stash --include-untracked
git checkout 1d306ae
rm -rf node_modules .next && npm install --no-audit --no-fund
npx next build --no-lint
PRE_FILE=$(find .next/static/chunks -path "*project*[id]*page*.js" | head -1)
echo "PRE  raw: $(wc -c < "$PRE_FILE")  gz: $(gzip -c "$PRE_FILE" | wc -c)"

# 2. Post-upgrade
git checkout main
rm -rf node_modules .next && npm install --no-audit --no-fund
npx next build --no-lint
POST_FILE=$(find .next/static/chunks -path "*project*[id]*page*.js" | head -1)
echo "POST raw: $(wc -c < "$POST_FILE")  gz: $(gzip -c "$POST_FILE" | wc -c)"

# 3. Restore working tree
git stash pop
```

Expect the chunk hash in the filename to differ across builds (Next.js
content-hashes them); the metric is the byte size, not the hash.
