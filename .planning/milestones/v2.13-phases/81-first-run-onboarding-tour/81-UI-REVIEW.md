---
phase: 81-first-run-onboarding-tour
audit_type: retroactive-6-pillar-visual
mode: code-review (no Playwright runtime available)
ui_spec_present: false
reviewed_at: 2026-05-15
post_state: after 81-REVIEW-FIX.md iteration 1
overall_score: 19/24
status: SHIP-READY (advisory polish backlog)
---

# Phase 81: First-Run Onboarding Tour — UI Review

**Audit baseline:** No `81-UI-SPEC.md` exists for this phase. Audit was conducted against the standard 6-pillar visual standards plus the design-contract notes in `81-CONTEXT.md` `<specifics>` (locked slide copy, checklist titles, brand-aligned palette).

**Source files reviewed:**
- `src/components/onboarding/onboarding-provider.tsx`
- `src/components/onboarding/onboarding-steps.ts`
- `src/components/onboarding/first-run-welcome-dialog.tsx`
- `src/components/onboarding/interactive-onboarding-checklist.tsx`
- `src/components/ui/dialog.tsx`
- Spotlight targets (selector contract only):
  - `src/components/dashboard/reference-image-uploader.tsx:289`
  - `src/components/slides/generation-form.tsx:258, 682`
  - `src/components/editor/visibility-dropdown.tsx:63`

## Scorecard

| Pillar             | Score | Verdict                                                    |
|--------------------|-------|------------------------------------------------------------|
| Copywriting        | 4/4   | TikTok-Slideshow-specific copy locked exactly to SPEC R3.   |
| Visuals            | 3/4   | Placeholder SVGs distinct and on-brand; minor SVG roughness.|
| Color              | 3/4   | Brand-aligned hexes used, but raw hex instead of `bg-primary` tokens. |
| Typography         | 3/4   | Clear hierarchy; system-font fallback only, no `font-sans`. |
| Spacing            | 4/4   | Consistent 4/8/16/24 rhythm. Bottom-right card well-placed.|
| Experience Design  | 2/4   | Two real issues: Skip semantics conflate "X" with "skip", and a11y gaps in tooltip flash. |
| **Overall**        |**19/24** | **Ship-ready; polish backlog tracked below.**           |

---

## 1. Copywriting — 4/4

**Strengths:**
- All 4 slide titles match SPEC R3 / CONTEXT `<specifics>` exactly:
  - "Welcome to TikTok Slideshow Creator" / "Bring your own references" / "Tell us your topic" / "Publish to share"
- Slide bodies are concrete and product-specific ("Type a topic, get a ready-to-post carousel in seconds.", "we'll mimic their visual style.").
- NO trace of the generic "Welcome to your new workspace" placeholder from the original supplied component.
- Checklist titles match SPEC exactly: "Upload a reference image" / "Type your topic" / "Generate your carousel" / "Publish to share".
- Microcopy is consistent across surfaces ("Skip tour", "Take me there", "Tap to see how").
- The em-dash usage in "public by default — share the link or fork ours." matches project copy voice.

**Findings:** None of consequence.

## 2. Visuals — 3/4

**Strengths:**
- Each of the 4 placeholder SVGs is visually distinct and metaphor-aligned: stacked carousel cards (welcome), 3 reference thumbnails + upload arrow (references), textarea with cursor (topic), carousel + share + checkmark (publish).
- The SVGs include `role="img"` and `aria-label` for screen readers — good baseline.
- Stacked-card silhouette on slide 1 reads as "slideshow/carousel" at glance, reinforcing product identity.
- Spotlight ring (`outline: 3px solid #3d0000` + offset + dual box-shadow) reads as intentional focus, not as a styled bug.

**Findings:**
- **V-01 (low):** The slide-2 upload arrow is small (25px tall) and rendered against a busy three-thumbnail background. At 240px-tall viewbox it competes with thumbnails rather than dominating. Suggest enlarging arrow and/or adding a subtle disc behind it.
- **V-02 (low):** The text label at `y="222"` overlapping the bottom of every slide ("Welcome", "Upload references", etc.) duplicates the active title shown immediately below the SVG. Two near-identical labels stacked vertically reads as redundant. Suggest removing the in-SVG text label or moving it to a corner watermark.
- **V-03 (low):** Slide 1's z-stacked rectangles use `opacity="0.7"` / `0.92` blends that produce subtle muddy intersections in deep red. Consider explicit fill colors per layer rather than opacity blends.

## 3. Color — 3/4

**Strengths:**
- Palette is fully on-brand. Verified against `src/app/globals.css`:
  - `--primary: #3d0000` (deep red) → used as primary action color
  - `--muted: #fff0f0` → used as soft background hover
  - `--accent: #fadbdb` → used as progress-bar track / borders
  - Secondary text `#7d6161` and divider `#dbc1bc` are consistent with project palette
- NO generic neutral blues, no Tailwind-default `blue-500`, no off-brand greys. The component template's original neutral chrome has been fully replaced with the TikTok-Slideshow brand palette.
- The placeholder-SVG palettes are on-brand (4 variants all rooted in `#3d0000` / `#fff0f0` / `#fadbdb`), NOT generic neutral blues from the original supplied component.
- Spotlight outline (`#3d0000`) and box-shadow tint (`rgba(61,0,0,0.25)`) carry the brand color into the coachmark overlay.

**Findings:**
- **C-01 (medium):** The components use raw hex literals (`bg-[#3d0000]`, `text-[#3d0000]`, `ring-[#dbc1bc]/40`) ~40 times rather than the semantic Tailwind tokens (`bg-primary`, `text-primary-foreground`, `bg-muted`, `bg-accent`) that the design system already defines. Consequences: (a) breaks the dark-mode token swap defined in `globals.css` (second `:root` block defines `--primary: #ffb4a8` for dark mode) — the tour will keep `#3d0000` even in dark mode and become unreadable on a dark background; (b) future palette tweaks require editing two layers instead of one.
- **C-02 (low):** The two ad-hoc dividers `border-[#fadbdb]/40` could be `border-border` or `border-accent/40`. Same root cause as C-01.

## 4. Typography — 3/4

**Strengths:**
- Clear hierarchy across surfaces: slide title `text-2xl font-semibold`, body `text-[15px] leading-relaxed`, checklist title `text-sm font-semibold`, checklist meta `text-[11px]`, coachmark step-counter `text-[10px] uppercase tracking-widest font-bold`.
- `leading-tight` on slide title and `leading-relaxed` on body give a deliberate optical rhythm.
- Uppercase + wide-tracking on "STEP N OF 4" reads as a tasteful eyebrow, not shouty.

**Findings:**
- **T-01 (low):** Arbitrary pixel values `text-[15px]`, `text-[11px]`, `text-[10px]` bypass the Tailwind type scale. `text-sm` (14px) and `text-xs` (12px) would cover all three cases and keep the project on a single type ramp.
- **T-02 (low):** The placeholder SVG uses `fontFamily="ui-sans-serif, system-ui, sans-serif"` inline. Project should standardize on Tailwind's `font-sans` family (matches the rest of the app's chrome). Cosmetic only.
- **T-03 (low):** Slide-1 sr-only `DialogTitle` is "Welcome to TikTok Slideshow Creator" regardless of which slide is active. Screen-reader users hear the welcome title even when slide 4 is showing. Consider making the sr-only title track `currentSlide` for AT users.

## 5. Spacing — 4/4

**Strengths:**
- 24px page margins (`px-6`), 16px content gaps, 8/12px chip gaps. Internally consistent across both surfaces.
- Bottom-right card `fixed bottom-6 right-6 w-[320px]` clears the viewport edge by exactly the dashboard's existing safe-area gutter.
- Modal width `max-w-md` keeps the carousel narrow enough for portrait viewports.
- Spotlight ring offset (`top - 6, width + 12`) gives a 6px halo around any target — small enough not to overlap neighbors.
- Tooltip placement is constrained to a 16px viewport margin with a top→bottom→right→left preference, then clamped — robust against narrow viewports.

**Findings:** None of consequence.

## 6. Experience Design — 2/4

**Strengths:**
- `markWelcomeSeen` correctly separates "welcome modal acknowledged" from "tour completed" so a mid-tour reload restores the checklist without re-firing the modal (D-17 satisfied).
- Coachmark backdrop uses `pointer-events: none` per SPEC constraint — the user can still interact with the underlying app, matching acknowledgement-based semantics.
- WR-04 fix correctly wired: pressing Escape during a coachmark dismisses just that spotlight (not the whole tour). The X button on the checklist card and "Skip tour" buttons remain the explicit "I'm done" affordances.
- ResizeObserver + scroll listener + rAF coalescing on `measure()` is a strong choice — the spotlight ring will track its target through lazy content shifts without thrashing.
- CenteredFallbackCoachmark + "Take me there" is the right escape hatch when a target is on another route.

**Findings:**
- **EX-01 (HIGH):** The welcome dialog's `handleOpenChange` treats *every* "open=false" event (X button, backdrop click, Esc) as "Skip" and writes `onboarding_completed_at = now()`. Two consequences worth flagging:
  - **Backdrop / Esc are destructive without warning.** A user accidentally pressing Esc on slide 2 silently commits "I've finished onboarding" — they will never see the tour again. Industry convention for welcome modals: backdrop close = ephemeral dismiss; only an explicit "Skip" button writes the persistent flag. Recommend differentiating: backdrop/Esc closes the dialog for this session only (setting `welcomeSeen=true` locally) and reserves the DB write for the explicit "Skip" text button or "Get Started" completion.
  - **Two buttons labeled "Skip" + an X icon in the corner all do the same thing.** Visual redundancy without semantic differentiation. Either remove the X (a `hideCloseButton` prop already exists on `DialogContent`) or distinguish: X = "close for now", "Skip" link = "don't show me again".
- **EX-02 (HIGH):** Coachmark tooltip a11y — `role="dialog"` is set, but:
  - The tooltip is NOT focus-trapped. A keyboard user tabbing while a spotlight is open will tab into the underlying page (because `pointer-events: none` on the backdrop doesn't prevent focus traversal) and lose track of the tour controls.
  - Initial focus is not moved into the tooltip when it mounts. Screen-reader users will not hear the "Step N of 4 — {title}" announcement unless they manually tab to it.
  - `aria-label={step.title}` duplicates the visible `<h3>{step.title}` — `aria-labelledby` pointing at the h3 would be more correct and avoids the duplicate-announcement pattern.
- **EX-03 (medium):** The checklist card has TWO skip affordances (the X icon at top-right and the "Skip tour" link at the footer). Both call `onSkip` and have the same effect. One is sufficient; the footer link is more discoverable and labels the consequence ("Skip tour", not just an icon).
- **EX-04 (medium):** Tooltip flash on mount — the spotlight measures `tooltipRef` in a `useEffect`, so the tooltip renders at `top: -9999, left: -9999` for one frame before getting positioned. The `animate={{ opacity: tooltipPos ? 1 : 0 }}` opacity gate mitigates this but does not eliminate the layout thrash on slow devices. Consider a hidden first paint (`visibility: hidden` until `tooltipPos` resolves) instead of off-screen positioning.
- **EX-05 (medium):** Coachmark "Back" navigation on the first step is suppressed (`isFirst` hides Back), but the welcome modal's Back disappears identically with no animation — slide changes are instant. The carousel has Embla but no slide-transition motion. The supplied design intends a smooth advance. Consider Embla's built-in `containScroll` + a `transition: transform` for a polished feel.
- **EX-06 (low):** The "Take me there" centered-fallback path has no visual indicator that the next click will navigate routes. The button is muted (`text-[#3d0000] hover:underline`) and could read more like a primary CTA when no spotlight is available.
- **EX-07 (low):** All four checklist steps route to `/dashboard` (per `onboarding-steps.ts`) — including `publish-toggle`, whose target lives on `/project/[id]`. That means clicking "Publish to share" from the dashboard will always hit the CenteredFallbackCoachmark — never the spotlight. The fallback's "Take me there" button routes the user back to `/dashboard`, not to a real project. This is a functional gap with a UX symptom: step 4 is visually demoted to a "centered explainer" while steps 1–3 get the polished spotlight. Routing should either deep-link to the user's most recent project or update the step's `route` to `/dashboard` only when no project exists.

---

## Top 3 Highest-Impact Fixes

1. **EX-01** — Differentiate backdrop/Esc from explicit Skip in the welcome modal so accidental dismiss doesn't permanently disable the tour. Currently every close path is destructive without warning.
2. **EX-02** — Add focus trap + initial focus + `aria-labelledby` to the coachmark tooltip. The tour is currently keyboard-hostile and partially invisible to screen readers.
3. **EX-07** — Fix `publish-toggle` step's route so step 4 actually spotlights the publish toggle in a real project editor, rather than always falling back to the centered explainer.

---

## Design-Contract Compliance (from CONTEXT `<specifics>`)

| Contract item                                                            | Status |
|--------------------------------------------------------------------------|--------|
| Slide copy is TikTok-Slideshow-specific (not generic placeholder)        | PASS   |
| Welcome modal uses placeholder SVGs (real screenshots deferred)          | PASS   |
| Checklist titles match the locked 4 strings                              | PASS   |
| Brand-aligned palette (not generic neutral blues)                        | PASS (raw hex, see C-01) |
| Existing shadcn primitives reused (Button, Card, etc.)                   | MIXED — Dialog primitive created, but raw `<button>` tags are used throughout instead of `<Button>` from `@/components/ui/button`. |
| `data-onboarding-id` is the ONLY selector contract                       | PASS — 4 production matches, all `[data-onboarding-id="..."]` queries. |

---

## Accessibility Concerns (summarized)

- **High:** Coachmark tooltip is not focus-trapped (EX-02). Initial focus not moved to the dialog on mount. Keyboard users can tab out of the tour controls into the page underneath.
- **Medium:** Welcome dialog's sr-only title is static across slides (T-03) — screen-reader users hear "Welcome to TikTok Slideshow Creator" even on slide 4.
- **Medium:** Two skip affordances on the checklist card with identical effect (EX-03) creates ambiguous AT announcements.
- **Low:** `aria-label` duplicating visible heading text on the coachmark tooltip (EX-02 sub-point) — prefer `aria-labelledby`.
- **Positive:** Dots indicator has correct `aria-label="Go to slide N of 4"` + `aria-current="true"`. Modal has sr-only DialogTitle + DialogDescription per Radix requirement. X-button on Dialog has explicit `aria-label="Close"`. Escape-to-dismiss-spotlight (WR-04) ships correctly.

---

## Verdict

**Ship.** The tour is structurally sound, on-brand, copy-locked to SPEC, and the data-onboarding-id selector contract is honored exactly. The two HIGH items (EX-01 backdrop semantics, EX-02 tooltip a11y) and the EX-07 publish-toggle routing gap should be filed as polish quick-tasks — none block phase ship, but EX-02 in particular has real accessibility consequences and should be the first follow-up.

**Suggested follow-up quick tasks:**
- `quick-skip-semantics` — split backdrop/Esc from explicit Skip in welcome dialog (EX-01)
- `quick-coachmark-a11y` — focus trap, initial focus, `aria-labelledby` (EX-02)
- `quick-publish-toggle-route` — deep-link publish step to a real project (EX-07)
- `quick-onboarding-tokens` — convert raw hex to `bg-primary` / `text-primary-foreground` for dark-mode parity (C-01)
- `quick-onboarding-screenshots` — already on the roadmap per SPEC out-of-scope; real screenshots replace placeholder SVGs.

---

_Audit: gsd-ui-review_
_Phase: 81-first-run-onboarding-tour_
_Reviewed: 2026-05-15_
_Mode: code-review (Playwright-MCP not available in this session)_
