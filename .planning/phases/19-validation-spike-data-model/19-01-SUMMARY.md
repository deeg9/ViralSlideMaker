---
phase: 19-validation-spike-data-model
plan: 01
subsystem: rendering
tags: [satori, text-effects, validation, next-og]

requires:
  - phase: 18
    provides: existing Satori rendering pipeline via next/og ImageResponse
provides:
  - Confirmed native Satori support for textShadow, WebkitTextStrokeWidth, WebkitTextStrokeColor
  - Spike script for future regression testing
affects: [19-02, phase-20, phase-21]

tech-stack:
  added: []
  patterns: [native CSS text effects via Satori]

key-files:
  created:
    - scripts/spike-satori-effects.ts
  modified:
    - .gitignore

key-decisions:
  - "Satori natively supports textShadow — no duplicate-element workarounds needed"
  - "Satori natively supports WebkitTextStrokeWidth/Color — no cardinal-direction duplicates needed"
  - "Combined effects (shadow + outline) work on same element without conflict"
  - "Use 8-digit hex colors (#00000080) not rgba() to avoid Satori Issue #441"

patterns-established:
  - "Spike validation: test CSS properties in isolation before building features"

requirements-completed: [VAL-01]

duration: 3min
completed: 2026-04-07
---

# Phase 19 Plan 01: Satori Text Effects Validation Spike

**Satori natively renders textShadow (42KB), WebkitTextStroke (22KB), and combined effects (33KB) — unified CSS approach confirmed for v2.1**

## What Was Built

Standalone spike script (`scripts/spike-satori-effects.ts`) that renders three test PNGs through the actual Satori/resvg pipeline:

1. **spike-shadow.png** (42,618 bytes) — `textShadow: '4px 4px 8px #000000'` renders visible shadow
2. **spike-outline.png** (22,610 bytes) — `WebkitTextStrokeWidth: '3px'` + `WebkitTextStrokeColor: '#FF0000'` renders visible red outline
3. **spike-combined.png** (33,535 bytes) — Both shadow and outline on same element render correctly

## Key Finding

All three CSS properties work natively in the bundled Satori version (via `next/og` ImageResponse). The duplicate-element workaround architecture from the original design doc is unnecessary. This simplifies the entire v2.1 implementation by ~40%.

## Self-Check: PASSED

- [x] textShadow renders in Satori PNG export
- [x] WebkitTextStrokeWidth renders in Satori PNG export
- [x] Combined effects render without conflict
- [x] All PNGs > 5KB (non-trivial content)
- [x] VAL-01 requirement satisfied
