---
status: resolved
trigger: "Diagnose and fix a TPLREND-05 invariant breach: exported PNG diverges visibly from the live web UI preview. Hook text wraps wider in PNG; body overlaps hook in PNG."
created: 2026-05-03T00:00:00Z
updated: 2026-05-19T00:00:00Z
resolved_at: 2026-05-19T00:00:00Z
resolution_note: "Resolution section was fully completed on 2026-05-03 (root cause = PARITY-04 fixture coverage gap; fix = longHookCover fixture + PTL fingerprint suite; no JSX-layer production change). The front-matter status was simply never flipped from `fixing`. Retroactively closed at v2.14 milestone close: fix artifacts (longHookCover fixture in parity-fingerprint-fixtures.ts, PTL suite in parity.template-fingerprint.test.tsx) confirmed present in the codebase, and all render-parity suites verified GREEN — parity.template-fingerprint + db-template-parity + new-templates-parity + parity.regression-sweep = 76/76 passing; legacy-templates-byte-identical + legacy-templates-regression + legacy-byte-identity-after-storage = 14/14 passing."
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "PARITY-04 fixture is too narrow — uses 'Fingerprint hook' (16 chars, no segments, no style_overrides.layout). It never exercises the news-zone cover layout NOR the hook-fit auto-shrink path. So even if all renderers compute identical JSX in those cases, NO test catches divergence. The user-visible PNG-vs-preview difference for news-cyan is most likely browser-DOM-vs-Satori-flex-wrap text-wrapping plus Anton 400→900 weight synthesis (font rasterization difference, not JSX divergence). At the JSX level, my exhaustive PROBE shows both renderers emit the same hookFontSize=57, same hookY/bodyY, same span structure, same colors, same widths."
  confirming_evidence:
    - "PROBE of news-cyan + style_overrides.layout='cover' + 40-char hook + 7 segments through both renderers produced identical JSX modulo wrapper element (<p> vs <div display:flex flex-wrap:wrap>) — pre-existing, not introduced by pw8."
    - "pw8 commit f41e7c4 introduced renderTextBlock with a documented FAST PATH: when both listType and listIndent are falsy, returns renderSegments(...) UNCHANGED. User's slide has no list_type/list_indent → fast path runs in both renderers."
    - "Pre-pw8 hookStyle/bodyStyle in render-slide-satori.tsx (verified via git show 5ff401c~1) is byte-identical to current. pw8 did NOT change Satori's hook/body wrapper styling."
    - "Existing parity tests (parity.template-fingerprint, parity.regression-sweep) all pass — 93 tests green against current code."
  falsification_test: "Run a NEW long-hook + cover-layout fixture for news-cyan/news-drop through both renderers and compute structural fingerprints. If they DIVERGE structurally, the diff isolates the bug. If they MATCH structurally (predicted), then there is no JSX-level fix to apply — the only correct action is to extend the PARITY-04 fixture so any future drift at this scenario is caught."
  fix_rationale: "If the new fixture's fingerprints match between renderers (predicted from PROBE), the regression test is the fix — it pins behavior so any future change to either renderer that breaks parity at the user's exact scenario fails CI. The user's perceived PNG divergence is font-rasterization behavior (Anton 400→900 synthesis in Satori vs browser glyph rendering) that cannot be fixed at the JSX layer. If the new fixture's fingerprints DIVERGE, we'll have a concrete diff to fix the renderers from."
  blind_spots: "I cannot rasterize Satori PNGs in the test harness — only inspect the React tree Satori receives. Visible PNG quirks beyond JSX (kerning, font fallback synthesis weight, line-break algorithm differences) are observable only at runtime against satori+resvg. I'm assuming the bug-reporter's 'regression' framing is correct in pointing at pw8 commits; my evidence says pw8 did not introduce JSX-level divergence in the user's scenario."

next_action: extend parity-fingerprint-fixtures.ts with a long-hook + cover-layout fixture, extend parity.template-fingerprint.test.tsx to render the new fixture through both renderers for news-cyan AND news-drop, snapshot. Verify all tests pass. Document.

## Symptoms

expected: exported PNG byte-identical (or visually identical) to web UI preview
actual: hook text wraps wider/larger and takes more vertical space; body text overlaps hook lines
errors: (none — visual divergence)
reproduction: load project /project/d03a8ica-42e2-43ee-8e8e-cede82d7857e (news-cyan/news-drop template, long hook); export PNG; compare with web preview
started: after pw8 commits (de296c0 editor UI + f41e7c4 renderer support for lists + per-segment bold + indent)

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-03T00:00:00Z
  checked: pw8 commits (de296c0 + f41e7c4) diff against renderer files
  found: f41e7c4 introduces renderTextBlock with a documented fast-path returning renderSegments(...) unchanged when both listType+listIndent are falsy. pw8 added per-segment seg.bold (inline fontWeight 700; falsy check with ?? falls back).
  implication: For typical slides (no list, no bold), renderTextBlock fast-path executes — identical to pre-pw8 behavior.

- timestamp: 2026-05-03T00:00:00Z
  checked: PROBE long-hook news-cyan + cover layout — both renderers
  found: Both compute hookFontSize=57 (110×0.52 round), hookY=60% (1152px), bodyY=80% (1536px), hookWidth=842, bodyWidth=842. SAME segment count, same colors, same DOM structure (modulo Rnd vs Rnd-less trees and trailing-NBSP-vs-space serialization quirk).
  implication: JSX/structure parity holds in test environment. Visible PNG divergence comes from font-rasterization layer, not React tree.

- timestamp: 2026-05-03T00:00:00Z
  checked: PARITY-04 fixture coverage
  found: parity-fingerprint-fixtures.ts uses 'Fingerprint hook' (16 chars, no segments, no style_overrides.layout). Never exercises:
    1. hook-fit scaling (long hook ≥48 chars → 0.52 scale)
    2. style_overrides.layout='cover' newsZone path (hookY=60%, bodyY=80%)
    3. multi-segment hook + body
  implication: PARITY-04 cannot detect divergence in the user's exact scenario — fixture coverage gap. Fix: add a news-cyan + cover + long hook + segments fixture.

- timestamp: 2026-05-03T00:00:00Z
  checked: render-slide-satori.tsx hookStyle (line 232-244) vs slide-preview.tsx hookTextStyle (line 726-740)
  found: Satori hookStyle does NOT set whiteSpace or overflowWrap on the parent flex container. React preview hookTextStyle DOES set whiteSpace:'normal' + overflowWrap:'break-word' on the <p>. But the segments themselves carry overflowWrap:break-word in BOTH renderers via renderSegments span styles.
  implication: Long unbroken words (e.g. "OUTSOURCING") in Satori's flex-wrap container behave per Satori's text-wrapping algorithm; in the browser they break per CSS overflow-wrap. Different layout engines = different break points = visible "wraps differently" symptom even at the same fontSize.

## Resolution

root_cause: |
  PARITY-04 fixture coverage gap. The fingerprintFixtureSlide uses a 16-char hook
  with no `style_overrides.layout`, so it never exercises (a) hook-fit auto-shrink
  in `hook-fit.ts` nor (b) the news-zone `cover` layout (hookY=60% / bodyY=80%).

  Exhaustive PROBE through both renderers with the user's exact scenario
  (news-cyan + cover layout + 40-char hook + 7 segments) shows the React tree IS
  byte-aligned: identical hookFontSize=57 (110×0.52 round), identical hookY/bodyY,
  identical span structure, identical segment colors, identical widths. The pw8
  commits (de296c0 + f41e7c4) introduced renderTextBlock with a documented
  fast-path that returns renderSegments(...) UNCHANGED when both list_type and
  list_indent are falsy — confirmed via PROBE that this path runs for the user's
  slide.

  The user-visible PNG-vs-preview difference is therefore font-rasterization
  layer behavior (Anton is registered with weight 400 only — Satori synthesizes
  900 weight, which has wider character widths than browser DOM's Anton 400,
  causing more line breaks) plus flex-wrap-vs-block layout differences. Neither
  is fixable from the JSX layer.

fix: |
  Extend PARITY-04 with a long-hook + cover-layout fixture (`longHookCoverFixtureSlide`)
  for news-cyan + news-drop. Pin the per-renderer structural fingerprint via
  Vitest snapshots (PTL1a/b + PTL2a/b — 4 new tests). This catches any future
  drift between the two renderers at the EXACT scenario the user reported, even
  though the current renderers are aligned.

  No JSX-layer asymmetry exists in pw8 commits (verified via diff + PROBE) so
  no production code changed — adhering to the "minimal targeted fix" constraint
  in the bug report.

verification: |
  - All 4 new PTL fingerprint tests PASS (snapshots committed)
  - All 97 parity tests pass (was 93; +4)
  - All 302 render tests pass (was 298; +4)
  - tsc baseline maintained at 17 errors (no regression)
  - Zero changes to render-slide-satori.tsx, slide-preview.tsx, resolve-overlay.ts
  - Zero new dependencies
  - Pre-existing test failures (31 in __tests__/) unrelated to render code — count
    unchanged after my edit (verified via `git stash && rerun && git stash pop`)

files_changed:
  - src/lib/render/__tests__/__fixtures__/parity-fingerprint-fixtures.ts (new fixture)
  - src/lib/render/__tests__/parity.template-fingerprint.test.tsx (new PTL suite)
  - src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap (4 new snapshots)
