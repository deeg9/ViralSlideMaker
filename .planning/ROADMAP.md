# Roadmap — TikTok Slideshow Creator

## Milestones

- ✅ **v2.11 Full Editor Parity** — Phases 60–66 (shipped 2026-05-03) — Multi-select, alignment, group/ungroup, smart guides, lock/hide, z-order, layers panel, power-user differentiators. See [archive](milestones/v2.11-ROADMAP.md).
- ✅ **v2.10 Text Box Resize Handles** — Phase 59 (shipped 2026-05-02). See [archive](milestones/v2.10-ROADMAP.md).
- ✅ **v2.9 Viral Visual Quality** — Phases 54–58 (shipped 2026-05-01). See [archive](milestones/v2.9-ROADMAP.md).
- ✅ **v2.8 Text Editor Right-Rail Redesign** — Phases 49–53 (shipped 2026-04-30).
- ✅ **v2.7 Premium Templates** — Phases 44–48 (shipped 2026-04-29).
- ✅ **v2.6 MCP Server** — Phases 40–43 (shipped 2026-04-28).
- ✅ **v2.5 Public REST API Parity** — Phases 34–39 (shipped 2026-04-28).
- ✅ **v2.4 Explore + Remix** — Phases 26–33 (shipped 2026-04-27).
- ✅ **v2.2 Public REST API** — Phases 20–25 (shipped 2026-04-09). See [archive](milestones/v2.2-ROADMAP.md).
- ✅ **v2.1 Text Effects** — Phases 17–19 (shipped 2026-04-07). See [archive](milestones/v2.1-ROADMAP.md).
- ✅ **v2.0 API & MCP Platform** — Phases 14–16 (shipped 2026-04-07). See [archive](milestones/v2.0-ROADMAP.md).

## Next Milestone

📋 **TBD** — Run `/gsd-new-milestone` to plan next milestone (questioning → research → requirements → roadmap).

Candidates / open ideas (carried-over):
- Manual visual QA on v2.9 templates (NYT/SSENSE / Loewe-Duolingo / AIGA fidelity) — pending validation
- ZIP-download-rate trajectory measured 14+ days post-v2.9-launch — pending baseline
- iPhone Safari touch QA for v2.10 corner resize handles (A11Y-01) — deferred
- v2.11 manual QA: selection ring polish, TYPE BAR layout, click-empty-canvas feel, modifier-state Cmd+Tab, 3-5 sample byte-identity PNG checks
- v2.12 candidates from v2.11 deferred gaps (see `milestones/v2.11-MILESTONE-AUDIT.md`):
  - Watermark freeform position (numeric x/y schema lift)
  - Cmd+D duplicate-of-selection semantic alignment
  - Alt+drag auto-selects duplicates (Figma default)
  - TextBox alignment height (DOM-ref measurement lift)
  - Layers panel drag-to-reorder (re-evaluate react-arborist + StrictMode)
  - Nested groups, cross-slide multi-select, multi-select rotation, right-click menu, copy-style
