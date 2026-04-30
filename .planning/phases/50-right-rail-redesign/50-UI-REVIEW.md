---
phase: 50-right-rail-redesign
review_type: ui-audit
audited: 2026-04-30
auditor: gsd-ui-review (code-only, no dev server detected)
baseline: 50-CONTEXT.md design contract (D-01..D-21) + brand tokens (#3d0000, #fadbdb, #fff0f0, #7d6161, #ffffff)
status: passed
score_total: 25
score_max: 30
---

# Phase 50 — Right-Rail Redesign UI Review

**Audited files:**
- `src/components/editor/text-rail/LayerStrip.tsx` (95 lines)
- `src/components/editor/text-rail/EffectRow.tsx` (58 lines)
- `src/components/editor/text-rail/AccentWordsDisclosure.tsx` (92 lines)
- `src/components/editor/text-rail/ActiveTextBoxCard.tsx` (572 lines)
- `src/components/editor/text-rail/SlideSettings.tsx` (146 lines)
- `src/components/editor/text-editor-panel.tsx` (299 lines)

**Screenshots:** Not captured — no dev server detected on ports 3000, 5173, or 8080. Audit performed against source.

---

## Pillar Scores

| # | Pillar                | Score | Headline finding                                                                  |
|---|-----------------------|-------|-----------------------------------------------------------------------------------|
| 1 | Visual hierarchy      | 5/5   | White card on cream panel + 2px primary border framing nails D-03 user complaint. |
| 2 | Information density   | 4/5   | Sections always-visible per D-04, but textarea + 7 stacked rows is tall.          |
| 3 | Affordance clarity    | 4/5   | Active chip filled vs pink fill is clear; effect Switch unmistakable.             |
| 4 | Consistency           | 5/5   | Every label uses the locked `text-[10px] font-bold uppercase tracking-widest`.    |
| 5 | Accessibility         | 3/5   | Two real defects: missing focus ring on chips/swatches; weak switch off-state contrast. |
| 6 | Responsiveness        | 4/5   | LayerStrip overflow-x-auto handles 6+ chips; narrow widths untested but plausible. |

**Total: 25 / 30 — `passed` (≥ 24 threshold)**

---

## Pillar 1 — Visual hierarchy (5/5)

The headline of D-03 was the user's quote: *"make the text box or the text editing darker than the rest of the page so people know that they can type there. It's easy to mess."* Implementation lands this directly:

- `ActiveTextBoxCard.tsx:151` — `bg-white border-2 border-[#3d0000]/20 focus-within:border-[#3d0000] rounded-2xl p-5` on cream `#fff0f0` panel (`text-editor-panel.tsx:90`). The 2px primary-at-20%-opacity border darkens to full primary on focus-within, giving the editable surface unmistakable presence.
- `SlideSettings.tsx:37` uses `bg-[#fff0f0] border border-[#fadbdb]` — deliberately weaker (1px border, panel-color background) so the slide settings recede behind the active card. This is the correct hierarchy per D-07.
- The "Effects" subhead uses `pt-2 border-t border-[#fadbdb]` (`ActiveTextBoxCard.tsx:321`) — quiet horizontal rule, not a heavy section break. Matches Figma/Canva inspector visual rhythm.
- LayerStrip active chip uses solid `bg-[#3d0000] text-white` while inactive uses `bg-[#fadbdb] text-[#3d0000]` (`LayerStrip.tsx:73-74`). High-contrast active state — chip selection is the most important affordance and gets the strongest visual treatment.

No findings.

## Pillar 2 — Information density (4/5)

D-04 demanded always-visible sections (no nested accordions) with disclosure ONLY for AccentWords. Implementation honors this:

- The card stacks (textarea → font picker → bold/italic → AccentWordsDisclosure → size → color → align → Effects subhead → 3× EffectRow) all in flat `space-y-4`. No accordions per D-16.
- AccentWordsDisclosure (`AccentWordsDisclosure.tsx`) is the only collapsible. Caret rotates `-rotate-90 → rotate-0` and the count badge ("N highlighted") only appears when `accentCount > 0` (line 51) — quiet by default, informative when used.
- EffectRow content reveals inline beneath the toggle in a `pl-4 border-l-2 border-[#fadbdb]` indented panel (`EffectRow.tsx:49`) — the relationship between toggle and controls is visually unambiguous without an accordion chrome.

**WARNING — vertical length:** when the body text box is selected and all three effects are toggled on, the card contains: role label + 4-row textarea + font picker + style row + AccentWordsDisclosure (potentially with chip wall expanded) + size slider + color swatches + align row + Effects subhead + 3 expanded EffectRows (each ~3-4 control rows). On a 1080-tall viewport with the bottom toolbar pinned, the user will scroll the right rail. This is consistent with Figma/CapCut and not a defect, but worth noting that "always-visible sections" trades brevity for predictability — the design accepts that trade-off knowingly.

**WARNING — defaults seed `enabled: true`:** `DEFAULT_SHADOW`, `DEFAULT_OUTLINE`, `DEFAULT_HIGHLIGHT` all have `enabled: true` (`ActiveTextBoxCard.tsx:28, 33, 38`). The toggle-off path then sets `{enabled: false}`, but a fresh effect with no prior state would render the controls as if seeded "on" if any code path calls `setShadow(...)` without explicit `enabled` first. The current `onToggle={(on) => setShadow({ enabled: on })}` flow is correct, but the `enabled: true` defaults are a small footgun for future maintainers — consider `enabled: false` defaults or naming them `INITIAL_*` rather than `DEFAULT_*`.

## Pillar 3 — Affordance clarity (4/5)

- LayerStrip chips visually telegraph state: filled primary = active, pink fill = inactive, dashed-outline white = "Add". Three distinct visual states map to three distinct affordances. Strong.
- "+ Add Text Box" uses `border-2 border-dashed border-[#3d0000]/30` (`LayerStrip.tsx:87`) — dashed border is the canonical "add slot" pattern (matches Figma "Add page", Canva "Add element"). Clear.
- EffectRow uses the shadcn Switch primitive (`@radix-ui/react-switch`) — recognizable as a switch, not ambiguous like a checkbox or button.
- Color swatches show selection via `ring-2 ring-[#3d0000] ring-offset-1` (`ActiveTextBoxCard.tsx:266`) — visible, but the ring is the same color as the surrounding active-card border. On a swatch that happens to be `#3d0000` itself, the ring is invisible. Minor edge case.

**WARNING — palette swatch is icon-only without an aria-label:** the custom-color `<label>` at `ActiveTextBoxCard.tsx:275-283` (and twice more for shadow/outline/highlight) has only a `palette` icon. The `<input type="color" className="sr-only">` inside has no label association. Screen-reader users will hear nothing or the bare "color" type. Add `aria-label="Pick custom color"` on the label or a wrapping button.

**WARNING — text segments cleared silently on textarea edit:** `ActiveTextBoxCard.tsx:172` calls `onUpdate({ text: e.target.value, segments: undefined })` — every keystroke wipes segment accents. This matches legacy behavior (acknowledged in the comment), but there's no visual signal. A user who has set up "3 highlighted" and then edits one letter will silently lose all accents. Consider a toast or inline notice ("Edits cleared word highlights") on the next phase.

## Pillar 4 — Consistency (5/5)

Every section label across all 6 audited files uses the exact same class string: `text-[10px] font-bold uppercase tracking-widest text-[#7d6161]`. Verified by grep — 24 occurrences, zero deviations. D-15 fully respected.

Spacing scale is tight too:
- Card-internal sections: `space-y-4` (matches D-16)
- EffectRow controls: `space-y-3`
- Inline tighter rhythms: `space-y-2`, `space-y-1`
No arbitrary `space-y-[Npx]` or one-off pixel values found in the new components.

Color tokens — every brand color in classNames is one of the locked five (`#3d0000`, `#fadbdb`, `#fff0f0`, `#7d6161`, `#ffffff`). The only "new" hex literals are:
- `#dbc1bc` (4 sites) — pre-existing token from legacy panel for hairline borders. Not new.
- `#000000`, `#00000099`, `#00000088` — effect default fills (shadow/outline/highlight base colors), not UI chrome. Acceptable per the contract that limits brand chrome only.
- `#000` in AccentWordsDisclosure swatch (line 79) — used as text color on the user-chosen accent fill. Functional, not chrome.

## Pillar 5 — Accessibility (3/5)

This pillar carries the audit's only **BLOCKER**-class finding plus several WARNINGs. The score reflects keyboard and contrast gaps, not screen-reader gaps (which are mostly handled).

**Strengths**
- LayerStrip declares `role="tablist"` + per-chip `role="tab"` + `aria-selected={active}` (`LayerStrip.tsx:56, 65-66`). Correctly maps to ARIA Authoring Practices for tab-like layer pickers.
- EffectRow Switch carries `aria-label={"Toggle " + label.toLowerCase()}` (`EffectRow.tsx:42`).
- The Switch primitive itself ships `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (`switch.tsx:14`) — keyboard focus on toggles is fine.
- Decorative icons all have `aria-hidden`.

**BLOCKER — no visible focus ring on LayerStrip chips, swatches, or align/style buttons.** Tab-keyed users cannot tell which chip is keyboard-focused. The existing classes (`LayerStrip.tsx:71`, `ActiveTextBoxCard.tsx:196, 210, 265, 306`) include `transition-colors`/`transition-all` but no `focus-visible:` rule. With `focus:ring-0` on the textarea (`ActiveTextBoxCard.tsx:174`) and no explicit ring elsewhere, browser-default focus rings are also lost on the rounded `rounded-full`/`rounded-lg` shapes (the default ring outline doesn't follow the radius cleanly on Webkit). Add `focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 focus-visible:outline-none` to: layer chips, "Add Text Box" chip, every color swatch button, bold/italic buttons, align buttons, S/M/L size buttons, tight/full style buttons, and accent-word chips.

**WARNING — Switch off-state contrast.** The off state is `bg-[#dbc1bc]` (`switch.tsx:14`) on the white card. Computed contrast ratio of `#dbc1bc` on `#ffffff` is roughly 1.7:1 — well below WCAG 1.4.11 (3:1 for non-text UI components). The thumb (white on `#dbc1bc`) is also low-contrast. Either darken the off-track to `#7d6161` or add a 1px primary-at-30% border in the off state.

**WARNING — accent word chip text on accent fill unverified.** `AccentWordsDisclosure.tsx:79` sets `color: seg.accent ? '#000' : '#7d6161'`. On the default v2.6 accent of `#3d0000` and similar dark accents, black text fails contrast. On a yellow/lime accent it's fine. Since `accentColor` flows from `template.accentColor`, recommend a `getReadableTextColor(accentColor)` helper or a 1.5px outline.

**WARNING — color swatches lack aria-label.** Every swatch button uses `title={color}` (`ActiveTextBoxCard.tsx:272, 406, 462, 521`) but no `aria-label`. `title` is unreliable for screen readers and invisible on touch. Add `aria-label={"Set color to " + color}` or `aria-label={"Black"} / "White"` etc.

**WARNING — text-[9px] is below recommended minimum.** The accent count badge (`AccentWordsDisclosure.tsx:54`) and overlay helper text (`SlideSettings.tsx:111`) use 9px. WCAG doesn't mandate a minimum but most accessibility guidelines (Apple HIG, Material) target ≥ 11px for chrome and ≥ 13px for body. Bump to `text-[10px]` to match the rest of the panel; visually unchanged at 1× DPR but readable on browsers with min-font-size enforcement.

## Pillar 6 — Responsiveness (4/5)

- LayerStrip wraps chips in `overflow-x-auto pb-1` (`LayerStrip.tsx:54`) — horizontal scroll for 6+ chips works as a fallback. Good baseline behavior; matches D-02.
- Cards use `rounded-2xl p-5` (active) and `rounded-2xl p-4` (slide settings) — fluid widths with intrinsic padding.
- The textarea is `w-full` and `resize-none` (`ActiveTextBoxCard.tsx:174`) — adapts to rail width. `rows={3 or 4}` keeps a sensible minimum height regardless of viewport.
- COLOR_SWATCHES is 4 items + 1 picker = 5 total at `gap-3` `w-6` — about 152px minimum width per row. Right rail in slide-editor.tsx is wider than that, so wrapping is unlikely until under ~200px rail width.

**WARNING — LayerStrip horizontal scroll has no scroll affordance.** With `overflow-x-auto`, the user sees no indicator that there's more content right of the visible chips. Modern browsers hide the scrollbar by default. Consider a fade-mask gradient on the right edge (matches Figma layer strip) or add a tiny "›" indicator when scrolling is possible. Phase 50 ships are fine; flag for v2.9 polish.

**WARNING — narrow-width breakage untested.** No CSS or component-level testing for rail widths < ~280px. The bold/italic + 3 align buttons + S/M/L size buttons in EffectRow each measure roughly 36–48px wide and are arranged in a single `flex gap-2` row. Below ~260px, the align row will cramp. The slide-editor right rail is fixed-ish, so this is plausibly never triggered in practice — but worth a short visual sanity-check at 280px before milestone close.

## Top 3 Priority Fixes

1. **Add visible focus rings to all interactive surfaces in the card and LayerStrip.** Keyboard users cannot navigate the panel safely today. One-line add per element: `focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 focus-visible:outline-none`. ~12 sites; takes 10 minutes.
2. **Strengthen Switch off-state contrast.** Change `data-[state=unchecked]:bg-[#dbc1bc]` to `data-[state=unchecked]:bg-[#7d6161]` (or add a ring). Single-file edit in `src/components/ui/switch.tsx:14`. Brings the toggle to WCAG 1.4.11 AA.
3. **Compute accent-word chip text color from contrast.** `AccentWordsDisclosure.tsx:79` hardcodes `#000` text on `accentColor` fill — fails for dark accents. Add `lib/color/readable-text-color.ts` returning `#000` or `#fff` based on relative luminance, then `color: seg.accent ? readableTextColor(accentColor) : '#7d6161'`.

## Files Audited

```
src/components/editor/text-rail/LayerStrip.tsx
src/components/editor/text-rail/EffectRow.tsx
src/components/editor/text-rail/AccentWordsDisclosure.tsx
src/components/editor/text-rail/ActiveTextBoxCard.tsx
src/components/editor/text-rail/SlideSettings.tsx
src/components/editor/text-rail/color-swatches.ts (referenced)
src/components/editor/text-editor-panel.tsx
src/components/ui/switch.tsx (referenced)
src/components/editor/text-editor-panel-legacy.tsx (rollback verified, not deeply audited)
```

---

*Advisory only — phase proceeds regardless of score. The 5/5 result on Visual hierarchy and Consistency means the design contract's brand identity is fully respected; the 3/5 on Accessibility is the one area where a follow-up sub-task before v2.8 lock is warranted.*
