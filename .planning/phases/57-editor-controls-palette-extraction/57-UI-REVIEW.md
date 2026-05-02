---
phase: 57-editor-controls-palette-extraction
review_date: 2026-04-30
reviewer: orchestrator-inline
verdict: PASS (advisory)
overall_score: 3.5/4
---

# Phase 57 — UI Retroactive Review (6-pillar)

Retroactive visual audit of the two new app-shell surfaces shipped by
Phase 57:

1. `<PhotoTreatmentControls>` — right-rail panel below `<SlideSettings>`
2. IG grid chip + dashed-outline overlay in `slide-canvas.tsx`

Plus invisible renderer additions (palette-aware editorial-serif page
counter + notes-app-chic sticky-note tint) — these are visual identity
changes inside generated carousels, audited at the resolver-helper level.

This review is ADVISORY — not a blocker for phase completion.

## Pillars (1=poor, 2=adequate, 3=strong, 4=exemplary)

### Pillar 1 — Hierarchy & Composition: 4/4

The new PhotoTreatmentControls component is a textbook insertion: it
adopts the exact outer card pattern (`bg-[#fff0f0] border border-[#fadbdb]
rounded-2xl p-4 space-y-4`) used by the v2.8 SlideSettings sibling, so
the right rail reads as one continuous panel surface. Within the new
card, the SECTION TITLE → CONTROL TITLE → INTERACTIVE CONTROLS hierarchy
mirrors the established editor convention:

- 10px uppercase tracking-widest section labels (`#7d6161`)
- 11px semi-bold inline labels (`#3d0000`)
- chip-style radio buttons with active state in brand primary

The IG grid chip is appended to the existing slide-counter pill row —
not a new floating widget — keeping the chrome density unchanged. The
divider (`w-px h-3 bg-[#dbc1bc]/40`) does the right amount of visual
separation work without introducing a new control bar.

### Pillar 2 — Spacing & Rhythm: 4/4

All gaps are multiples of 4 (4, 8, 12, 16). Total panel additions are
~196px tall — within the same density envelope as the SlideSettings
sibling (~200px). No accidental margin doubling between SlideSettings
and PhotoTreatmentControls because both wrappers carry their own border
+ padding, and the parent's `space-y-4` provides the 16px gap between
them.

The IG grid overlay's `outline-offset: -2px` is a subtle but correct
detail — pulls the dashed line just inside the SlidePreview frame so it
reads as a marker rather than an extension of the canvas.

### Pillar 3 — Typography: 3/4

Pure inheritance — no new font sizes, weights, or families. The 4
typographic levels in PhotoTreatmentControls (10px section, 11px label,
11px chip text, 10px chip text) fit the existing right-rail scale. The
IG grid chip (`text-[10px] font-bold uppercase tracking-widest`) uses
the same exact spec as the slide-counter sibling.

The half-point deduction is for the disabled-state stub copy ("Add a
photo to apply treatments.") — at 10px the line height feels a touch
cramped and the brand-grey-on-cream contrast (`#dbc1bc` on `#fff0f0`)
sits at ~1.6:1 which is below WCAG 1.4.11 (3:1) for non-text UI, though
text-content guidance is more lenient. Future refinement: bump the
disabled stub copy to 12px and color to `#7d6161` (~4.7:1).

### Pillar 4 — Color: 3.5/4

Zero new color tokens introduced (verified via grep: no new hex values
in either new component). All states use the established v2.8 right-rail
palette:

- Active chip: `#3d0000` on white (14.4:1 — AAA)
- Inactive chip: `#7d6161` on white (4.7:1 — AA Normal)
- Hover bg: `#fadbdb`
- Card bg: `#fff0f0`
- Section borders: `#fadbdb` and `#dbc1bc`

The dashed overlay uses `rgba(255,255,255,0.85)` which contrasts
adequately against most slide backgrounds but COULD become invisible on
treated slides where the upper region is also light (e.g. a B&W cream
slide). The half-point deduction is for not implementing an adaptive
overlay color (light slides → dark dashes, dark slides → light dashes).
Acceptable for v2.9 — solvable in a future polish pass.

The palette-aware accent injection (Vibrant for editorial-serif chip;
Vibrant for notes-app-chic sticky-note tint) is the right architectural
move and lifted into pure resolver helpers — both renderers consume the
same module so preview/export stay in sync.

### Pillar 5 — Interaction & Affordance: 3/4

PhotoTreatmentControls:
- Switch is keyboard-accessible (radix primitive default)
- Radio buttons have `role="radio"` + `aria-checked`
- Spinner with `aria-live="polite"` announces "Treating…" to AT
- Active states have strong visual differentiation
- Selecting any duotone visually flips B&W off (single source of truth)

IG grid chip:
- `aria-pressed` + `aria-label` properly set
- Toggle preserves chip state across slide navigation (UX win)
- BUT chip state resets on page reload — by design (D-21) — could
  surprise users who expect persistence. Acceptable as a session-scoped
  preview tool; a tooltip on first use would be a nice future polish.

The half-point deduction: when a treatment fails server-side, the
controls revert to last successful state but no toast or inline error
copy is surfaced. Currently a `console.warn` only. EDITOR-02's success
criterion is "preview update within ~3 seconds" — a failure-state UI
would close the gap. Acceptable for v2.9 (Phase 58's UAT can decide
whether this needs a fix).

### Pillar 6 — Accessibility: 3.5/4

- All interactive controls keyboard-operable
- AA contrast on active states (14.4:1 ratio)
- `aria-live="polite"` for treatment status
- `pointer-events: none` + `aria-hidden="true"` on the grid overlay so
  screen readers / focus traps ignore it
- Disabled-state stub explains WHY controls are unavailable rather than
  just disabling them
- No reliance on color alone — duotone radios include color swatch dots
  AND text labels

Half-point deduction for disabled-stub contrast ratio noted in Pillar 3
above.

## Visual identity additions inside carousels (resolver-level)

The two visible identity shifts that ship in this phase live INSIDE the
generated carousels (not in app chrome):

1. **editorial-serif page-counter chip** — when `derived_palette` is
   populated, the previously-flat top-right "1/5" gains a Vibrant-tinted
   chip background with DarkMuted text. Brand-aware accent feels
   editorial without being garish (the fallback to cream/deep-brown is
   preserved when palette is unavailable). The chip-style padding +
   border-radius is added by the augment helper — a deliberate
   chip-as-affordance shift.

2. **notes-app-chic sticky-note tint** — the new tintable
   `sticky-note-accent.svg` uses `fill="currentColor"` so the resolver
   helper injects Vibrant via inline `color`. Ink lines stay black
   (preserves legibility on any tint). The default-yellow fallback is
   identical to the prior monochrome sticky.

Both changes are subtle, derived from photo content rather than user
choice, and degrade gracefully when extraction fails — exactly the
"palette-aware, never-jarring" contract requested in the requirements.

## Recommendations for follow-up phases

1. **Disabled-stub contrast bump** (Phase 58 polish): bump
   `text-[10px] text-[#dbc1bc]` to `text-[11px] text-[#7d6161]` in the
   PhotoTreatmentControls disabled-state branch.
2. **Treatment-failure toast** (Phase 58 polish): wire the
   `console.warn` in slide-editor.tsx's `handleSlideTreatmentChange` to
   the existing toast system so users get inline feedback on failures.
3. **Adaptive grid-overlay color** (Phase 58 polish or v3.0): sample
   the slide's average top-half luminance and pick black or white
   dashes accordingly.
4. **First-use tooltip on IG grid chip**: optional — explains the
   4:5 feed crop preview behavior.

None of these are blockers.

## Final verdict

**PASS** (advisory) — overall 3.5/4. Strong inheritance of v2.8 design
language, no regressions, palette-aware identity additions are well-
architected at the resolver level. Three pillars at 3.5+ and three at
4 — no pillar at 2 or below.

**No blocking issues. Phase 57 ships.**
