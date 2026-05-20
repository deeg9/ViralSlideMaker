---
spec_id: breaking-news-as-kicker
status: scoped
created: 2026-05-19
estimated_effort: ~1 day (single phase or gsd-quick --validate)
target_milestone: TBD (next milestone)
predecessor_work:
  - Phase 82 (accessory_label kicker system)
  - quick-260519-bkn (the hard-coded chrome being replaced)
  - quick-260519-pbg (TR3NDING pill — visual precedent)
---

# Spec: Convert the BREAKING NEWS badge into an editable kicker

## Motivation

The "— BREAKING NEWS —" badge above the caption card on news-oracle cover slides is currently hard-coded **template chrome**: a fixed string, fixed geometry, `pointerEvents: 'none'`, painted three times across three render paths. It is invisible to the Layers panel and cannot be edited, hidden, or moved.

This conflicts with the Phase 82 `accessory_label` system — which already does exactly this job for the TR3NDING pill — but with **editable text** stored on the slide, **drag-and-drop position**, **Layers panel chip**, and **uniform render path** (the standard text-box pipeline).

The fix: delete `src/lib/render/breaking-news-badge.ts` and the three chrome branches, then re-implement the badge as an `accessory_label` text box with a new `'ruled'` highlight variant that paints the flanking horizontal rules.

## Locked decisions (from /gsd-quick --discuss equivalent)

| # | Decision | Implication |
|---|----------|-------------|
| D1 | **Adapter fallback** for migration. Unset `accessory_label` on a news-oracle cover slide injects `'BREAKING NEWS'` at TextBox-build time. Explicit empty string = user disabled. | No DB migration. Mirrors the existing caption-card "absent != false" semantics ([[feedback_public_by_default]]). |
| D2 | **`'ruled'` style is user-toggleable** on any accessory_label. Joins the `TextHighlightEffect.style` enum alongside `'tight'` and `'full'`. | Adds one variant to the existing highlight system; TR3NDING and future kickers can opt in. |
| D3 | **Gemini learns the kicker** for news-oracle covers. The news category prompt is extended so generation emits a contextual kicker (`'ALERT'`, `'EXCLUSIVE'`, `'DEVELOPING'`, etc.) for cover slides. Fallback to `'BREAKING NEWS'` if Gemini omits. | One-line prompt addition in `src/lib/ai/categories/news.ts`. |
| D4 | **Pixel-for-pixel parity** on news-oracle cover. The `'ruled'` style on news-oracle cover positions identically to today's badge (96px rules, 16px gap, 28px font, 28px above caption-card). Other templates' `'ruled'` kickers use TextBox default positioning. | Adapter has a small position-preset for the news-oracle case. |

## Scope

### In scope

1. **Type system** — add `'ruled'` to `TextHighlightEffect.style` (`src/lib/types/slide.ts:107`); update the Zod schema in `src/lib/ai/schemas.ts` (if highlight style is validated there); update `src/lib/render/resolve-styles.ts`.
2. **Three render paths render `'ruled'` consistently:**
   - `src/components/slides/slide-preview.tsx` — canvas
   - `src/lib/render/render-slide-satori.tsx` — Satori PNG export
   - `src/lib/render/render-slide.ts` — HTML export
   Each path inspects `effects.highlight.style === 'ruled'` and paints flanking rules (no background pill) in the text-box's row.
3. **Adapter migration** — `src/lib/editor/text-box-adapter.ts:legacyToTextBoxes`:
   - If `slide.accessory_label === undefined` AND `template.id === 'news-oracle'` AND `slide.role === 'cover'`:
     - Inject a TextBox with `text: 'BREAKING NEWS'`, `effects.highlight: { enabled: true, style: 'ruled', color: template.textColor, padding: 16 }`, position preset matching today's badge geometry.
   - If `accessory_label === ''` → no kicker (user disabled).
   - If `accessory_label === 'CUSTOM'` → custom text, default `style: 'ruled'` on news-oracle cover, `'tight'` elsewhere (matches current TR3NDING default).
4. **Delete the chrome:**
   - Remove `BreakingNewsBadgeLayer` and its imports from `slide-preview.tsx` (~75 lines).
   - Remove the badge branch in `render-slide-satori.tsx` (~15 lines).
   - Remove `breakingNewsHtml` in `render-slide.ts` (~15 lines).
   - Delete `src/lib/render/breaking-news-badge.ts` entirely.
   - Delete `src/lib/render/__tests__/breaking-news-badge.test.ts`.
5. **AI generation** — extend `src/lib/ai/categories/news.ts` prompt so Gemini emits a contextual kicker for news-oracle cover slides (D3).
6. **Tests:**
   - Adapter: news-oracle cover with unset `accessory_label` → TextBox with `text: 'BREAKING NEWS'`, `style: 'ruled'`.
   - Adapter: news-oracle cover with `accessory_label: ''` → no kicker TextBox.
   - Adapter: news-oracle cover with `accessory_label: 'EXCLUSIVE'` → TextBox with `text: 'EXCLUSIVE'`, `style: 'ruled'`.
   - Adapter: other template + cover → no auto-injection (no `accessory_label` = no kicker, existing behavior).
   - Render parity: 3-surface snapshot test for `style: 'ruled'` on a fixture slide.
   - Generation: news-oracle cover gets a kicker text in Gemini's output (assert via prompt-injection test).
7. **Pixel-parity check** — add an explicit assertion that the `'ruled'` kicker on news-oracle cover lands at the same Y% as the deleted chrome did (use `breakingNewsBadgeTopPct(38)` reference values before deletion).

### Out of scope

- Right-rail UI for toggling `'ruled'` style. The text-effects panel already exposes the highlight style picker — extending it with a third option (`tight | full | ruled`) is a one-line dropdown addition. Counted in the estimate but listed separately so the work isn't surprising.
- Backfilling `accessory_label = 'BREAKING NEWS'` into existing slides at the DB level. The adapter fallback handles this at read time (D1).
- Changing the BREAKING NEWS-as-data behavior on **non-cover** news-oracle slides — it stays absent (today no badge renders there either).
- New shape primitive ("rule" as an editable element). The flanking rules remain tied to the text via the `'ruled'` highlight style.

## Files modified (~10)

```
src/lib/types/slide.ts                                            (type enum + 1 line)
src/lib/ai/schemas.ts                                             (Zod enum, if present)
src/lib/render/resolve-styles.ts                                  (enum + ~3 lines)
src/components/slides/slide-preview.tsx                           (–75 chrome / +20 ruled)
src/lib/render/render-slide-satori.tsx                            (–15 chrome / +20 ruled)
src/lib/render/render-slide.ts                                    (–15 chrome / +20 ruled)
src/lib/editor/text-box-adapter.ts                                (+30 fallback + preset)
src/lib/ai/categories/news.ts                                     (+3 prompt lines)
src/components/editor/text-rail/text-effects-panel.tsx            (+1 option, if applicable)
src/lib/render/breaking-news-badge.ts                             (DELETE)
src/lib/render/__tests__/breaking-news-badge.test.ts              (DELETE)
src/lib/editor/__tests__/text-box-adapter.test.ts                 (+~80 lines, 4 cases)
src/lib/render/__tests__/ruled-highlight-parity.test.ts           (NEW file, snapshot ×3 surfaces)
```

Net: roughly **–120 / +160** lines + 2 deletions.

## Risks

- **R1: Render parity drift.** The TextBox path has different positioning math than the chrome layer. Mitigation: the adapter writes an explicit position preset (custom anchor with the exact Y% the chrome used). Snapshot test catches drift.
- **R2: Existing news-oracle slides in production.** Cover slides created before this change have no `accessory_label`. Adapter fallback (D1) means they still render the badge — but anyone who explicitly set `accessory_label: ''` (which is rare in current data) would have intended an empty kicker. **Pre-check the production data:** query Supabase for distinct values of `slide.accessory_label` on news-oracle cover slides before shipping. If empty strings exist, talk to those users / decide whether to treat `''` as "disabled" or "fall back".
- **R3: Gemini compliance.** The prompt addition for news-oracle covers may not always be honored (Gemini's generation is probabilistic). The fallback covers the "no kicker emitted" case but does NOT cover the "weird kicker emitted" case. Add a generation-time post-validator: if accessory_label on a news-oracle cover is `>3 words` or `>24 chars`, replace with `'BREAKING NEWS'`.
- **R4: AI recipe extract.** `src/lib/ai/layout-recipe-extract.ts:230-235` already extracts the `accessory_label` slot — verify the news-oracle cover always reports `enabled: true` after this change, otherwise saved templates may drop the kicker on re-apply.

## Verification gates

- All existing tests pass (especially `src/lib/render/__tests__/breaking-news-badge.test.ts` should be DELETED, not edited, since the chrome it tests is gone).
- New tests cover the 7 cases in **Scope §6**.
- 3-surface byte-identity snapshot for the `'ruled'` kicker on a news-oracle cover fixture.
- Manual smoke: open a news-oracle cover slide in the editor — kicker appears in Layers panel as a chip; click the chip → text input opens; edit text → updates canvas + the rules flank correctly; drag chip → position persists; delete chip / clear text → kicker disappears; re-publish → PNG export shows the new text.
- `git diff --name-only HEAD~N..HEAD` matches the file list in **§ Files modified**.

## Execution mode

This is **bigger than a vanilla gsd-quick** (touches type system + 3 renderers + generation prompt) but **smaller than a milestone phase**. Two viable routes:

- **`/gsd-quick --validate "..."`** — uses this spec as the brief, gets plan-check + verification. ~1 day.
- **`/gsd-plan-phase`** — formal phase in the next milestone. Adds discuss-phase / research-phase ceremony; this spec covers most of it. ~1-1.5 days.

Recommendation: `gsd-quick --validate` since the discuss decisions are locked above. Promote to a phase only if it grows beyond this scope during planning.

## Open questions for the user (none currently — all D1-D4 locked)
