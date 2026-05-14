# Phase 80 — Reference Verification Checklist

**Phase:** 80-composition-aware-style-extraction-replace-flat-stylespec-ta
**Verification method:** BOTH automated AND manual per 80-CONTEXT.md §Verification,
Fixtures, and Migration Mechanics.

- **Automated:** `src/lib/ai/__tests__/composition-aware-extraction.integration.test.ts`
  (env-var gated, live-Gemini) loads each fixture, calls `extractStyleSpec`,
  asserts `result.spec.slideArchetype` matches the expected value.
- **Manual:** the per-reference checklists below capture side-by-side visual
  comparison (text container present/absent, photo composition match, highlight
  rhythm, no spurious icons, palette/font match).

**Pass threshold:** 3 of 5 references must pass overall, AND both MUST-PASS
references (`meta-workers.png`, `chip-sales.png`) MUST classify correctly. The
remaining three are pass-or-flag (failure captured here for follow-up, but does
NOT block phase completion).

Actual archetype values are filled with `__TODO__` until the integration test
runs against the placed fixture images.

---

## Per-Reference Checklist

### 1. `meta-workers.png` — **MUST-PASS**

- **Expected archetype:** `caption-bar-bottom`
- **Actual archetype (from extractor):** `__TODO__`
- **Expected slot params:** `caption.background=solid`, `caption.heightFraction=0.40`
- **Actual slot params:** `__TODO__`

Pass/fail checks (7 total — MUST-PASS reference, exceeds the 4-minimum bar):

- [ ] Archetype matches expected (`caption-bar-bottom`)
- [ ] Template routed to `magazine-bold` via projector `template_id_override`
- [ ] Text container present at bottom of frame (caption bar visible in rendered output)
- [ ] No spurious icons emitted (decoration default fix: empty `preferredLucide` → 0 icons)
- [ ] Highlight rhythm matches reference (≥ 3 highlighted text segments visible)
- [ ] Palette dominant color matches reference (extracted `palette.primary` vs reference's
      perceived dominant)
- [ ] Font category matches reference (`typography.hookFontCategory` consistent with
      reference's display-condensed face)

### 2. `chip-sales.png` — **MUST-PASS**

- **Expected archetype:** `full-bleed-text-overlay`
- **Actual archetype (from extractor):** `__TODO__`
- **Expected slot params:** (none)
- **Actual slot params:** `__TODO__`

Pass/fail checks (5 total — MUST-PASS reference, exceeds the 4-minimum bar):

- [ ] Archetype matches expected (`full-bleed-text-overlay`)
- [ ] Template routed to `news-drop` via projector `template_id_override`
- [ ] No caption-bar visible in rendered output (single full-bleed photo + floating text)
- [ ] No spurious icons emitted
- [ ] Palette dominant color matches reference (extracted `palette.primary` vs reference's
      perceived dominant)

### 3. `editorial-magazine.png` — pass-or-flag

- **Expected archetype:** `editorial-serif`
- **Actual archetype (from extractor):** `__TODO__`
- **Expected slot params:** (none)
- **Actual slot params:** `__TODO__`

Pass/fail checks (4 items — meets the 4-minimum bar):

- [ ] Archetype matches expected (`editorial-serif`)
- [ ] Template routed to `editorial-serif` (1:1 mapping)
- [ ] Font category matches reference (`typography.hookFontCategory === 'serif'`)
- [ ] Palette mode plausible (`palette.mode === 'solid'` against cream paper background)

### 4. `notes-app-pink.png` — pass-or-flag

- **Expected archetype:** `notes-sticker`
- **Actual archetype (from extractor):** `__TODO__`
- **Expected slot params:** (none)
- **Actual slot params:** `__TODO__`

Pass/fail checks (4 items — meets the 4-minimum bar):

- [ ] Archetype matches expected (`notes-sticker`)
- [ ] Template routed to `notes-app-chic` (1:1 mapping)
- [ ] Font category matches handwriting/notes aesthetic
- [ ] Palette dominant pink/cream (consistent with iOS Notes sticker references)

### 5. `collage-2up-bw.png` — pass-or-flag

- **Expected archetype:** `photo-collage-2up`
- **Actual archetype (from extractor):** `__TODO__`
- **Expected slot params:** `split.direction=horizontal`, `split.ratio=50-50`
- **Actual slot params:** `__TODO__`

Pass/fail checks (4 items — meets the 4-minimum bar):

- [ ] Archetype matches expected (`photo-collage-2up`)
- [ ] Template routed to `news-drop` (collage 2up uses news-drop + `custom_images.length === 2`)
- [ ] Slot params `split.direction === 'horizontal'` and `split.ratio === '50-50'`
- [ ] `imagery.treatmentPreset === 'bw'` (B&W treatment classified correctly)

---

## Final Phase-Level Invariants

- [ ] **PARITY-05 grep gate:** `bash scripts/grep-gates/closed-enum-styleSpec.sh` exits 0.
- [ ] **Two-phase firewall (source-grep):**
      `npx vitest run src/lib/ai/__tests__/extract-style-spec.test.ts -t "source-grep firewall"`
      exits 0.
- [ ] **Prompt-token-budget gate:**
      `node scripts/grep-gates/prompt-token-budget.cjs` exits 0.
- [ ] **Cache migration applied:**
      `SELECT COUNT(*) FROM style_spec_cache WHERE (style_spec->>'schema_version')::int IS DISTINCT FROM 2`
      returns 0.
- [ ] **All 8 archetypes unit-test covered in**
      `src/lib/ai/__tests__/style-spec-projector.archetype.test.ts`.
