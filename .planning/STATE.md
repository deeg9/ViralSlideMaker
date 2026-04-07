---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Text Effects
status: Defining requirements
stopped_at: null
last_updated: "2026-04-07"
last_activity: 2026-04-07
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-07)

**Core value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.
**Current focus:** Milestone v2.1 — Text Effects

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-07 — Milestone v2.1 started

## Performance Metrics

**Velocity (from v1.0 + v1.1):**

- Total plans completed: 16
- Average duration: ~6 min
- Total execution time: ~1.5 hours

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.3]: Whole-box bold/italic only (no inline rich text) -- Satori cannot render inline spans reliably
- [v1.3]: Google Fonts curated list (30-50 fonts), not full 1,500+ catalog
- [v1.3]: react-rnd replaces react-draggable for combined drag+resize with scale prop
- [v1.3]: Fix pre-existing Satori font bug before any new feature work
- [Phase 10]: Georgia templates fall back to Inter for Satori PNG rendering (system font not on Google Fonts)
- [Phase 10]: Font buffers cached in-memory via Map to avoid re-fetching per render request
- [Phase 11]: Bold toggle sets font-weight 700; hook default stays 900 (template extra bold)
- [Phase 11]: Italic toggle sets font-style italic; undefined reverts to template default
- [Phase 12]: Font catalog uses exact Google Fonts variant data to load only available weight/style combos
- [Phase 12]: Display fonts map to sans-serif fallback, handwriting to cursive for CSS generic family
- [Phase 12]: Native select with optgroup for font picker -- simpler and more accessible than custom dropdown
- [Phase 12]: resolveSlideStyles used as single source of truth in both preview and export renderers
- [Phase 13]: Replaced react-draggable with react-rnd for combined drag+resize text boxes
- [Phase 14-alignment-snap-guides]: 10 ref pixel snap threshold for alignment guides (~5 screen px at typical scale)
- [v2.1]: Text effects stay on Satori pipeline -- shadow/outline faked with duplicate elements, highlight with inline backgrounds
- [v2.1]: Per-element independence for all effects (hook, body, each custom text box)
- [v2.1]: Gradient text, neon glow, blur effects deferred -- require Playwright rendering switch

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-existing]: render/route.ts passes no `fonts` option to ImageResponse -- all exports render in Noto Sans regardless of template. Must fix in Phase 10.
- [Phase 12]: Satori requires separate TTF files per font weight/style variant -- no faux bold/italic synthesis.
- Vercel plan timeout: confirm deployment tier before production (Hobby = 10s, Pro = 60s)

## Session Continuity

Last activity: 2026-04-07
Stopped at: Milestone v2.1 started, defining requirements
Resume file: None
