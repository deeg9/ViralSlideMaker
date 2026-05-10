---
phase: 73-cost-preprocessing-rails-foundation
plan: 01
subsystem: preprocessing
tags:
  - preprocessing
  - sharp
  - vision-rails
  - aspect-normalize
  - cost-rails
dependency-graph:
  requires:
    - src/lib/photo-treatment/sharp-config.ts (D-04 sharp wrapper)
  provides:
    - "@/lib/preprocessing/style-reference-prep:prepareForVision"
    - "@/lib/preprocessing/style-reference-prep:PreparedReference"
    - "@/lib/preprocessing/style-reference-prep:MAX_DIMENSION"
    - "@/lib/preprocessing/style-reference-prep:JPEG_QUALITY"
  affects:
    - Phase 75 extract-style-spec.ts (consumer; not yet implemented)
    - Phase 73 Plan 02 style_spec_cache (sha256 from this primitive is the cache key)
tech-stack:
  added: []
  patterns:
    - "Deterministic image preprocessing via sharp pipeline (rotate → resize fit:'inside' → jpeg quality:85 mozjpeg)"
    - "SHA-256 of OUTPUT bytes as cache key (mirrors v2.9 treat.ts cache-key pattern shape)"
    - "TDD RED → GREEN gate with 13 passing assertions + 1 documented it.todo"
key-files:
  created:
    - src/lib/preprocessing/style-reference-prep.ts (79 lines)
    - src/lib/preprocessing/__tests__/style-reference-prep.test.ts (174 lines)
    - src/lib/preprocessing/__tests__/style-reference-prep-aspect.test.ts (79 lines)
    - src/lib/preprocessing/__tests__/fixtures/README.md (13 lines)
  modified: []
decisions:
  - "Used sharp() resize with fit:'inside' + withoutEnlargement:true (PARITY-04 invariant; locked, do not change)"
  - "Applied .rotate() (EXIF auto-orient) BEFORE .resize() so output dims reflect post-rotation reality (defends iPhone HEIC EXIF rotation)"
  - "sha256 computed over JPEG output bytes (not raw input) per CONTEXT.md COST-03 cache key spec"
  - "MAX_DIMENSION=1024 and JPEG_QUALITY=85 exported as module constants (not env vars) — locked per CONTEXT.md, refactor only if Phase 75 telemetry demands"
  - "HEIC test self-files as it.todo if libvips encode fails at beforeAll, instead of silent skip — preserves visibility for Phase 75 readiness gate"
metrics:
  duration: "~10min"
  completed: "2026-05-10"
  tasks_completed: "2/2"
  tests_passing: "13"
  tests_todo: "1 (HEIC encode)"
---

# Phase 73 Plan 01: Cost & Preprocessing Rails Foundation — `prepareForVision` Primitive Summary

Deterministic image preprocessing primitive that locks COST-01 (≤1024² downscale), COST-02 (JPEG@85 wire format), and PARITY-04 (9:16 aspect-normalize regression suite) before Phase 75's vision-call code ships.

## Files Created

| File | Lines | Purpose |
| ---- | ----- | ------- |
| `src/lib/preprocessing/style-reference-prep.ts` | 79 | Pure preprocessing primitive: `prepareForVision(buffer): Promise<PreparedReference>` |
| `src/lib/preprocessing/__tests__/style-reference-prep.test.ts` | 174 | COST-01 + COST-02 + determinism contract suite |
| `src/lib/preprocessing/__tests__/style-reference-prep-aspect.test.ts` | 79 | PARITY-04 9:16 aspect-normalize regression (1:1, 16:9, 4:3, 9:16 cases) |
| `src/lib/preprocessing/__tests__/fixtures/README.md` | 13 | Note: fixtures constructed in-memory via `sharp.create()`; HEIC fallback policy |

## Test Results

```
npx vitest run src/lib/preprocessing/__tests__/style-reference-prep.test.ts \
                src/lib/preprocessing/__tests__/style-reference-prep-aspect.test.ts

 Test Files  2 passed (2)
      Tests  13 passed | 1 todo (14)
   Duration  973ms
```

**13 GREEN assertions:**
- COST-01: 4096×4096 → 1024×1024 ✓
- COST-01: 800×800 → preserved (`withoutEnlargement: true`) ✓
- COST-01: 2048×3640 fits inside 1024² with aspect preserved ✓
- COST-02: PNG → `image/jpeg` (verified SOI marker `0xFF 0xD8`) ✓
- COST-02: WebP → `image/jpeg` ✓
- COST-02: `JPEG_QUALITY === 85` constant export ✓
- Determinism: byte-identical output on 2 calls + identical sha256 ✓
- Determinism: sha256 matches `createHash('sha256').update(out.bytes).digest('hex')` ✓
- Determinism: red square vs blue square → different sha256 ✓
- PARITY-04 Test 1 (1:1 1080×1080): square preserved, ≤1024 each ✓
- PARITY-04 Test 2 (16:9 1920×1080): width=1024, height≈576, aspect within 0.5% ✓
- PARITY-04 Test 3 (4:3 1500×2000): height=1024, width≈768, aspect within 0.5% ✓
- PARITY-04 Test 4 (9:16 1080×1920): height=1024, width≈576, aspect preserved ✓

**1 documented `it.todo`:**
- HEIC input → JPEG output (`mimeType === 'image/jpeg'`): `heif({ compression: 'hevc' })` encode path is unavailable in the local libvips build that `sharp ^0.33.5` is compiled against. Filed as `it.todo` with the captured encode error in the test description (NOT silent skip). The HEIC DECODE path Phase 75 actually depends on must be re-verified in CI before Phase 75 ships — gating note recorded in the test description and fixtures README.

## `fit: 'inside'` Invariant Confirmation

Verification grep returns ZERO matches for forbidden modes:

```
grep -rnE "fit: 'cover'|fit: 'fill'" src/lib/preprocessing/
# (no output — invariant holds)
```

Sharp pipeline (single-line, do not reorder):

```typescript
sharp(input)
  .rotate()
  .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
  .toBuffer({ resolveWithObject: true })
```

Sharp wrapper invariant (D-04):

```
grep -rnE "from 'sharp'" src/lib/preprocessing/
# (no output — module imports sharp via @/lib/photo-treatment/sharp-config wrapper)
```

## Phase 75 Will Consume

| Symbol | Contract |
| ------ | -------- |
| `prepareForVision(buffer: Buffer): Promise<PreparedReference>` | Call once per uploaded reference Buffer before the Gemini Vision call. Pure CPU+memory; no I/O. |
| `prepared.bytes` | `inlineData.data` source after `.toString('base64')`. The only image bytes that ever reach Gemini. |
| `prepared.sha256` | Phase 73 Plan 02 `style_spec_cache` PRIMARY KEY lookup. Phase 75 wires the cache call. |
| `prepared.mimeType` | Always literal `'image/jpeg'` — Gemini `inlineData.mimeType` source. |
| `prepared.width`, `prepared.height` | Telemetry shape only; NOT in cache key. |
| `MAX_DIMENSION = 1024`, `JPEG_QUALITY = 85` | Exported constants; reuse in Phase 75 telemetry / bill-alarm if needed. |
| `PreparedReference` type | Re-export at consumer site for Server Action signatures. |

Phase 75 does **NOT** re-implement preprocessing or hashing. Phase 75 calls this primitive, full stop. If Phase 75 needs a different preprocessing shape, change it here and re-run `style-reference-prep.test.ts` — do not fork.

## Deviations from CONTEXT.md

**None.** All locked decisions honored:

- MAX_DIMENSION = 1024 ✓ (matches COST-01 spec)
- JPEG_QUALITY = 85 ✓ (matches COST-02 spec)
- sharp imported via the D-04 wrapper, not bare ✓
- sha256 computed over preprocessed (output) bytes, not raw input ✓ (CONTEXT.md COST-03 cache key)
- `fit: 'inside'` (not `'cover'` / `'fill'`) ✓ (PARITY-04 invariant)
- `.rotate()` (EXIF auto-orient) applied before resize ✓ (defends iPhone HEIC)
- No vision-call code, no Gemini wiring, no I/O ✓ (per Phase 73 hard constraint — vision lands in Phase 75 only)

## Commits

| Task | Type | Hash | Description |
| ---- | ---- | ---- | ----------- |
| 1 | RED  | `774ed01` | `test(73-01): add failing tests for prepareForVision (RED)` |
| 2 | GREEN | `5fd0a3b` | `feat(73-01): implement prepareForVision (GREEN)` |

REFACTOR step skipped — implementation is already minimal (single sharp pipeline + sha256 hash + return literal). No cleanup needed.

## Self-Check: PASSED

- File `src/lib/preprocessing/style-reference-prep.ts` exists ✓
- File `src/lib/preprocessing/__tests__/style-reference-prep.test.ts` exists ✓
- File `src/lib/preprocessing/__tests__/style-reference-prep-aspect.test.ts` exists ✓
- File `src/lib/preprocessing/__tests__/fixtures/README.md` exists ✓
- Commit `774ed01` exists in `git log` ✓
- Commit `5fd0a3b` exists in `git log` ✓
- 13 tests GREEN, 1 documented `it.todo` (HEIC) ✓
- Zero typecheck errors in `src/lib/preprocessing/` scope ✓
- `grep -rnE "from 'sharp'" src/lib/preprocessing/` returns zero matches ✓
- `grep -rnE "fit: 'cover'|fit: 'fill'" src/lib/preprocessing/` returns zero matches ✓
- Header comment in `style-reference-prep.ts` references Phase 73, Phase 75, and COST-03 by name ✓

## TDD Gate Compliance

- RED gate: commit `774ed01` (`test(73-01)`) ✓
- GREEN gate: commit `5fd0a3b` (`feat(73-01)`) ✓
- Sequence: RED before GREEN ✓
- REFACTOR: not needed (minimal implementation; no cleanup possible without losing meaning)
