# Milestones

## v2.14 Save as Template (Shipped: 2026-05-19)

**Phases completed:** 4 phases (83-86), 12 plans

**Key accomplishments:**

- Phase 83 — DB-Backed Template Storage + Registry Merge: additive, reversible `public.templates` migration (text-PK, flat-style + nullable `layout_recipe`/`preview`, `created_by` FK, public-read RLS deny-by-default writes) applied live to the shared Supabase project; async hybrid registry (`resolveTemplate` / `getPickerTemplates` / `isKnownTemplateId`, ~60s TTL cache, code-wins collision rule, fetcher test seam) merging the 13 code templates with DB rows — `index.ts` byte-identical, no fixture regen; DB-template render parity across canvas/Satori/HTML + sync-vs-async byte-identity guard. 4 reqs (TSTORE-01..04), 3 plans, +18 tests.
- Phase 84 — LayoutRecipe Model + Extraction: typed role-keyed `LayoutRecipe` contract (cover/body/cta archetypes, 7 `as const` closed-enum tuples, `schema_version: 1`, `layout_mode` reuses the 8-value `SlideArchetype` enum, scales to 1–10 slides); `parseLayoutRecipeSafe` two-phase zod firewall mirroring `parseStyleSpecSafe` (closed-enum silent-drop, numeric range-clamp, unknown-key stripping — prompt-injection defense); pure deterministic `extractLayoutRecipe` (no Gemini, no new AI tier) turning a source carousel's `slide_data` into a validated recipe + flat style, with an Oracle-pattern reproduction proof. 2 reqs (RECIPE-01/02), 3 plans, +41 tests.
- Phase 85 — Recipe-Driven Generation (highest blast radius): pure `applyLayoutRecipe` projection module mapping recipe fields into `SlideStyleOverrides` (caption-card geometry 1:1, hook position/font-size bands → numeric, role-by-position) + recipe semantic-hint block in `buildSystemPrompt`; `resolveLayoutRecipe` + recipe-apply wired into BOTH `generateCarousel` paths (API service + dashboard server action) before save; SC3 byte-identical no-recipe back-compat + SC4 public-by-default (`autoPublishOnGenerate`) hard gates verified. 1 req (RECGEN-01), 3 plans, +24 tests.
- Phase 86 — Admin Save-as-Template Flow + Previews: single reusable server-side admin gate (`src/lib/auth/admin.ts` — `isAdminUser` / `requireAdmin`, fail-safe-closed on unset `ADMIN_USER_IDS`); `renderCoverPreviewPng` reusable Satori single-slide pipeline + `template-previews` storage bucket migration; `POST /api/admin/templates` Save-as-Template endpoint (admin-gated, extracts recipe + flat style, renders + uploads cover preview, mints a `templates` row) + `(admin)` route group + authoring page; template picker renders DB-template cover-snapshot preview PNGs via `TemplateTilePreview`. ADMIN-01 dual gate (page + endpoint). 2 reqs (ADMIN-01/02), 3 plans, +24 tests, UI review 24/24.

**Stats:** ~107 phase tests added, 53 commits, 282 files changed (+12,185 / −656), single-day execution (2026-05-18); full suite 3238 passing / 41 failing (baseline-matched — the 41 pre-date the milestone)
**Status:** tech_debt (audit doc: `.planning/milestones/v2.14-MILESTONE-AUDIT.md` — 9/9 reqs satisfied, 4/4 phases passed, 5/5 integration, 3/3 flows; all 4 phase REVIEWs clean; not `passed` only due to non-critical debt below)
**Built on:** v2.13 template system + `style-spec-projector` + existing archetype machinery (`slideArchetype`, `caption-bar-bottom`, Phase 80 archetype classification)
**Constraints held:** closed-enum invariant, TPLREND-05 render parity, byte-identity back-compat for 13 code templates + ~82 existing carousels, additive/reversible migrations, no new Gemini tier, real server-enforced admin auth, public-by-default
**Nyquist:** all 4 phases have `*-VALIDATION.md`, nyquist_compliant (backfilled before milestone close)
**Known deferred / tech debt:** (1) operational user-setup — set `ADMIN_USER_IDS` env var + apply `20260519_phase86_template_previews_bucket.sql` to the shared Supabase project; admin surface is fail-safe-closed until both are done; (2) 6 pre-existing fixture failures (`legacy-templates-byte-identical` / `-regression` / `new-templates-parity`) from quick task `260518-jhg` adding the 13th code template — NOT a v2.14 regression, needs fixture regen; (3) two Info-level Phase 86 REVIEW notes (best-effort orphan-preview cleanup, picker-list-sourcing follow-up). End-user/community templates, edit/delete of a saved template, and migrating code templates into the DB are explicitly deferred to a future milestone.

---

## v2.12 Shapes & Icons (Decoration Primitives) (Shipped: 2026-05-04)

**Phases completed:** 6 phases (67-72), 19 plans

**Key accomplishments:**

- Phase 67 — Schema Foundation: `decorations?: Decoration[]` discriminated-union schema + Zod validator + lucide-react v1.14 upgrade (−169 bytes gz) + PTF16 idempotent-absence baseline (73 tests / 48 snapshots across 12 templates) locked before any feature work. 8 reqs, 2 plans, 93 tests.
- Phase 68 — Reducer Extensions: `decorations` as 4th `AddressableScope`; 3 new + 10 extended multi-select reducer cases; canonical `addressable-element-walkers.ts`; PRA1..PRA13 CI-enforced source-grep symmetry gate; PRS7..PRS14 cross-scope isolation suite. 16 reqs, 3 plans, 187 tests.
- Phase 69 — Renderers + Parity Proof: Shared `decoration-renderer.tsx` consumed by BOTH renderers (TPLREND-05 invariant); 118-icon registry + LRU cache (currentColor → hex); 8 shape SVG assets in `public/shapes/`; PTF13/14/18 byte-identity fingerprints (10 icons + 16 shapes + non-uniform scale); PCL12/13 grep gates. 12 reqs, 3 plans, ~157 tests.
- Phase 70 — Editor UI: Lucide modal picker (1,703-icon virtualized grid, ufuzzy 250ms debounce, WAI-ARIA nav); `isPickerOpenRef` at 33 tinykeys firewalls; 8-shape ShapePicker popover; DecorationCard right-rail (fill/stroke/size/position/shadow/opacity); R/C/L insert + I/S picker shortcuts; layers panel chips with miniature glyph. 31 reqs, 5 plans, ~200 tests.
- Phase 71 — AI Emit + Fork RPC + Audit: Gemini emits decorations[] with 100-icon allowlist + named color tokens + semantic anchors (server-side resolved); advisory monoculture gate (≥60% warns, never fails CI); fork RPC strips `locked` on decorations; PTF17 AI-emit parity; V2.12-SHIP-GATES.md (52 gates / 347 tests). 7 reqs, 3 plans, ~62 tests.
- Phase 72 — Rotation Handles + AABB: 16px circular rotation handle + `BULK_ROTATE` reducer (single pushHistory per gesture) + `computeRotatedAABB` (cos/sin) + rotation-aware bounds in selection-bounds / alignment / smart guides / marquee; DecorationCard numeric input; PTF15 45°-rotated arrow byte-identity. Closes ROTATE-01..04 + v2.10 ASPECT-01 deferred. 7 reqs, 3 plans, ~84 tests.

**Stats:** ~875 tests added, ~82 commits, bundle within DEPS-05 ceiling (editor route ≤ baseline + 200 KB), tsc baseline 17 preserved
**Status:** passed (audit doc: `.planning/v2.12-MILESTONE-AUDIT.md` — 52 gates / 347 tests GREEN across 24 files)
**Built on:** v2.11 Full Editor Parity (multi-select / align / group / lock / layers / z-order / alt-drag duplicate / smart guides)
**Awaiting user:** 6 manual QA smoke tests (Lucide picker scroll perf; Gemini 5-slide round-trip; fork with locked decorations; v2.11 project byte-identity check; rotation handle drag + Shift-snap; rotated PNG export)

---

## v2.11 Full Editor Parity (Shipped: 2026-05-03)

**Phases completed:** 7 phases, 23 plans, 49 tasks

**Key accomplishments:**

- Three optional multi-select fields landed on every addressable element:
- Watermark schema lift through the parity gate — adapter, lazy-init mirror, and 5-test PARITY-01 SEED that guarantees byte-identical PNG output across all 53+ existing projects pre/post unification.
- 1. [Rule 1 — Test fixture bug] Test 8 dual-write fixture missing hook/body text_boxes
- 1. [Rule 1 — Test infra bug] tinykeys + jsdom navigator.platform interaction
- 1. [Rule 2 — Missing API] Added `setSelection` to `useSelectionModel`
- Pure rect-normalization + AABB-intersect helpers + render-only MarqueeOverlay component, plus selecto@1.26.3 install — Wave-1 foundation for Plan 61-02 to wire selecto event handlers and the canvas-root onPointerDown swap.
- Wired the marquee selection state machine on slide-preview's canvas root (replaces Plan 60-05's onClick), added KBD-07 Shift-axis-constrain to all 4 element drag handlers via a new pure helper, and extended the PARITY-01 invariant with marquee testid coverage — closes SEL-05 / SEL-06 / KBD-07 and ships SEL-14 end-to-end.
- Pure getGroupMembers helper + GROUP/UNGROUP reducer cases with subset-dissolve cascade + useSelectionModel currentlyInsideGroup/enterGroup/exitGroup extension — all locked decisions from CONTEXT D-01..D-05 pinned by 23 unit tests across 3 files.
- Phase 62 UI surface lands. Wired the dashed/solid group bounding-box ring (editable-only, PARITY-01-gated), the Figma-model "select-any-member-selects-group" click branch on 4 wrappers, the double-click-enters-group handler, and the canvas-empty exitGroup-then-clear branch — pinned by 17 new test cases (6 ring + 8 click + 3 exit) and 2 new parity tests, with tsc baseline 17 errors preserved across all 3 atomic RED+GREEN commit pairs.
- Phase 62 ships end-to-end. Cmd+G / Cmd+Shift+G keyboard bindings dispatch GROUP / UNGROUP through the existing tinykeys map, the Escape handler is now group-aware (first press exits group, second press clears), and onDragStop on any of the 4 element wrappers fans the drag delta out across all group members in a single BULK_TRANSLATE dispatch — pinned by 21 new test cases (8 keyboard + 7 helper + 4 drag + 1 reducer round-trip + 2 parity) with the tsc baseline preserved at 17 errors and the full Phase 62 regression suite (159 tests across 9 files) green.
- One-liner:
- One-liner:
- Sorted-edge-array snap index with O(log N) binary search and asymmetric 5/7-px hysteresis — replaces the legacy O(N×M) double-loop and ships against a stable contract for Plan 63-04 drag wiring.
- Wave-2 integration plan: ships the visible Figma-style smart guides + equal-spacing == indicator by wiring Plan 63-03's pure snap module into all 4 onDragStart/onDrag/onDragStop sites in slide-preview.tsx, mounting a persistent-pool SmartGuideOverlay component inside the scaled canvas, and retiring the legacy useAlignmentGuides hook.
- Final-wave polish + parity gate plan: ships the comprehensive PARITY-03 multi-element fixture suite (8 tests covering every v2.11 editor-only chrome surface), the ALIGN-10 end-to-end integration pin (5 tests via reducer dispatch), the PERF-05 integration-level perf verification (3 tests mirroring slide-preview's runSnapForDrag closure), and the legacy use-alignment-guides.ts @deprecated marker. All 24 Phase 63 reqs are now complete.
- SET_LOCKED reducer + Cmd+Shift+L Figma-style toggle + react-rnd drag/resize prevention + marquee pass-through gate + 12×12 lock-icon overlay across all 4 Rnd wrappers; closes LOCK-01..06 with 19 new tests + tsc baseline preserved at 17.
- SET_HIDDEN reducer mirroring SET_LOCKED + 13 byte-identical hidden-filter sites across both renderers (5 Satori + 8 React preview) + computeSelectionBounds hidden-skip + fork_published_carousel locked-strip migration; closes LOCK-07 + LOCK-08 with 13 new tests + tsc baseline preserved at 17.
- Single Z_ORDER reducer action routes per-scope internally (text_boxes / custom_images / watermark) + 4 tinykeys bindings ($mod+], $mod+[, $mod+Alt+], $mod+Alt+[) all dispatching the single action + Figma multi-selection model with array-bound clamping + adjacent-selected guard + ZORDER-05 invariant pinned by purity grep gate (zero CSS layering references); closes ZORDER-01..07 with 33 new tests + tsc baseline preserved at 17. Phase 64 fully complete.
- Vanilla flat-list LEFT-rail Layers Panel — synthesizeRows + React.memo'd LayerChip + read-only selection sync, mounted under SlideList in slide-editor.tsx; no react-arborist, no virtualization (≤30 elements per slide).
- Filled the 5 placeholder slots from Plan 65-01 (chip-lock-slot / chip-vis-slot / chip-reorder-slot / group-lock-slot / group-vis-slot) with 6 real toggle buttons (4 chip + 2 group); each click dispatches Plan 64-01/02/03 reducer actions through a unified ids[] callback shape; single dispatch per click → single pushHistory entry (KBD-09 / PERF-01 carry-forward); 33/33 layers-panel tests + 86/86 reducer + 45/45 keyboard + 42/42 parity green; tsc baseline preserved.
- Comprehensive TPLREND-05 audit suite — 50 new tests across 4 files: PCL1..PCL10 chrome-leak (runtime + source-grep dual gate), PTF1..PTF12 dual-renderer fingerprint baseline (24 snapshots), PRS1..PRS6 v2.9/v2.10 regression sweep, PERF-04 verification linkage. ZERO production code modified.
- 8 new tinykeys arrow-nudge bindings dispatching BULK_TRANSLATE (1 ref-px / 10 ref-px) + lastMoveDeltaRef tracking the most recent move so Cmd+D positions duplicates at primary + lastDelta (Figma rapid-grid pattern) with a 20 ref-px fallback when no prior move has been recorded.
- Alt+drag now produces deep-copies at the drag-end position via a new DUPLICATE_ELEMENTS_AT reducer action; alignment-toolbar buttons + group-row lock carry shortcut hints in their `title` attributes; v2.11 keyboard contract codified as automated regression tests.

---

## v2.10 Text Box Resize Handles (Shipped: 2026-05-02)

**Phases completed:** 1 phase (59), 4 plans, 13/13 requirements (100% at code level)

**Status:** tech_debt — 13/13 reqs satisfied at code level; 1 deferred verification gate (A11Y-01 iPhone Safari touch QA, skipped per orchestrator since localhost is not iPhone-reachable). Desktop side of A11Y-01 fully verified.

**Stats:**

- 19 commits between `034ad5c` (start v2.10) and `cea2be1` (audit + plan files)
- 28 files changed, +5,830 / −2,754 LOC (planning docs heavy; production diff ~150-200 LOC across 4 files)
- Tests: +50 phase-specific tests, 47/47 in 3 phase test files green
- Timeline: single intensive day (2026-05-02)

**Key accomplishments:**

- **Phase 59 — Corner Resize Handles + Font-Scale:** Canva-style hybrid resize handles on text boxes. Corner-drag (TL/TR/BL/BR) scales `font_size` AND `position.width` by the same ratio (`new_size = clamp(round(old_size × widthRatio), role_min, role_max)`). Side handles preserve v2.8 width-only behavior. Top/bottom handles explicitly disabled. Shift+corner = width-only escape hatch. Past-the-cap = box keeps growing, font caps at 240 (hook) / 120 (body). Single undo entry per gesture (dispatch on `onResizeStop` only). WCAG 2.5.8 AA touch targets (24×24 CSS px hit zones via `inset: -10px` wrapper, visual handle 12×12). Cursors `nwse-resize` (TL/BR) / `nesw-resize` (TR/BL) on hover. Production touch confined to `slide-preview.tsx` (config flip + 3 onResizeStop extensions + module-level helpers `ROLE_FONT_BOUNDS`, `scaleFontSizeOnCorner`, `isCornerDir`), `slide-editor.tsx` (`handleSizeChange` + `handleCustomTextSizeChange` additions, legacy width handlers preserved for back-compat), and `slide-canvas.tsx` (2 forwarding props). All 3 schema/renderer files (`slide.ts`, `editor-reducer.ts`, `text-box-adapter.ts`, `render-slide.ts`, `render-slide-satori.tsx`, `resolve-overlay.ts`, `hook-fit.ts`) byte-identical to base SHA `e12a0fb` — TPLREND-05 invariant preserved end-to-end.

**Decisions honored:**

- Stayed on `react-rnd@10.5.3` — 6-line `enableResizing` flip beats a library swap.
- No schema change. The auto-fit-text design fits short bold hooks; an explicit `height` field would be dead weight given the picked Canva-style UX.
- Past-cap = box keeps growing, font caps. Forgiving > honest.
- Shift+corner shipped as the modifier escape (5-line addition).
- Touch QA deferred per user choice (localhost not iPhone-reachable; desktop side fully verified).

**Built on:** v2.8 Text Editor Right-Rail Redesign (`TextBox[]` schema + `applyDualWrite` reducer + selection wiring) and v2.9 Viral Visual Quality (`resolve-overlay.ts` resolver pattern + `parity.test.tsx` invariant). Both consumed unchanged.

**Research-grounded:** 4 parallel research agents (STACK / FEATURES / ARCHITECTURE / PITFALLS) → synthesized in `.planning/research/SUMMARY.md`. Industry survey of Canva, Figma, CapCut, Keynote, Pages, Adobe Express, VEED, Photoshop. WCAG 2.5.8 AA. react-rnd issues #110 / #766 / #732. Satori issues #325 / #393 / #573.

**Out of scope (carried forward to v2.11+):**

| Item | Reason |
|---|---|
| Top + bottom handles + explicit `height` field (RESIZE-05, HEIGHT-01) | Anti-feature for auto-fit text. |
| Snap-to-alignment-guides during corner-resize (GUIDES-01) | `useAlignmentGuides` runs on `onDrag` only. v2.11 candidate. |
| Rotation handles (ROTATE-01) | Defer to v3.0+ if ever. |
| Aspect-ratio-lock toggle (ASPECT-01) | Shift+corner covers it. |
| First-use onboarding toast (ONBOARD-01) | Pre-PMF; cursor change is enough discoverability. |
| Custom-text dispatch path cleanup (CLEANUP-01) | 5-line refactor, low priority. |

**Awaiting user:** Manual iPhone Safari touch QA — deploy to Vercel preview, run the 9-step touch test from `59-03-PLAN.md` §how-to-verify if mobile usability concerns arise.

**Archive:** `.planning/milestones/v2.10-ROADMAP.md`. Audit: `.planning/v2.10-MILESTONE-AUDIT.md` (status: tech_debt).

---

## v2.9 Viral Visual Quality (Shipped: 2026-05-01)

**Phases completed:** 5 phases (54-58), 11 plans, 53/53 requirements (100%)

**Status:** passed — all 5 phases verified clean; 6/6 cross-phase wires verified; 4/4 E2E flows complete; ship-gate 15/15 items green

**Stats:**

- ~30 commits between `04780ae` (roadmap) and `5c58cfd` (final ship-gate)
- 152 files changed, +21,292 / −316 LOC
- Tests: 561 → 756 passing (+195 net new); 13 pre-existing vitest 4.x typing fails preserved unchanged
- Timeline: single intensive day (2026-05-01)

**Key accomplishments:**

- **Phase 54 — Infrastructure Foundation:** Server-side photo treatment pipeline (`src/lib/photo-treatment/treat.ts` with sharp, 4 presets `bw` / `duotone-cream` / `duotone-cobalt` / `contrast-bump`, idempotent SHA-256 cache key); `slide-backgrounds-treated` public Storage bucket with 7-day `pg_cron` retention; Imagen 4 Fast model upgrade (`imagen-4.0-fast-generate-001`, $0.04 → $0.02/img, 10× faster, better text rendering); AI-slop guardrails (Imagen prompt addendum forbidding gradients/3D/blobs, Pexels query exclusion of "smiling team" stock terms, hook variety addendum forbidding "In a world where" openings); 2 premium templates flipped Inter → Plus Jakarta Sans (`magazine-bold` + `documentary`); `download_zip` event tracking + `v_zip_download_rate` view + baseline captured (53 projects, 0 downloads, 0% — clean baseline since download tracking is brand-new).
- **Phase 55 — Schema + Renderer Extensions:** `SlideTemplate` extended with optional `grainMode`, `vignette`, `photoTreatment`, `paletteMode`, `coverLayout`, `bodyFontFamily` (required on premium templates by validator); `Slide` extended with `original_source_url`, `style_overrides.derived_palette`, `style_overrides.treatment_applied`, `template_id_override`. `renderGrain(intensity)` + `renderVignette(strength)` exported from `resolve-overlay.ts`; both `render-slide-satori.tsx` and `slide-preview.tsx` consume from same module — TPLREND-05 parity invariant preserved. 4 new static-TTF font catalog entries (Archivo Black, Space Grotesk, Manrope, DM Serif Display) via Fontsource. Premium hook fontSize raised to 110-130px range. Legacy 8 templates byte-identical (legacy-byte-identical test 6 cases).
- **Phase 56 — New Templates + Decorative Library:** Three new free-tier templates registered — `editorial-serif` (NYT/SSENSE aesthetic: B&W bleed photo + Playfair Display 130px hook + cream `#F5EFE6` accent + page counter top-right + medium grain), `notes-app-chic` (Loewe/Duolingo aesthetic: paper-texture background + ransom-note hook with per-segment `fontFamily` + tape-strip + sticky-note + halftone-dot + photocopier-grain), `brutalist-grid` (AIGA/Eye on Design aesthetic: hard 8-column grid + type-as-image hero + high-contrast B&W + single accent). 14 decorative SVG/PNG assets in `public/overlays/`. 5 grain PNGs in `public/textures/` (`grain-subtle`, `grain-medium`, `grain-heavy`, `paper-texture`, `xerox-grain`) generated via committed `scripts/build-textures.ts` (`npm run textures`). 8 → 11 templates total. Per-`TextSegment` `fontFamily?: string` field added with Satori font-loader walk.
- **Phase 57 — Editor Controls + Palette Extraction:** `src/components/editor/photo-treatment-controls.tsx` mounted in right rail below `SlideSettings` — per-slide B&W toggle, duotone preset picker (cream / cobalt), grain intensity (off / subtle / medium / heavy), wired to `editor-actions.ts: updateSlideTreatment(slideIndex, spec)` server action. Always re-treats from `slide.original_source_url` (no compounding). `node-vibrant@4.0.4` (server-only, `'use server'` boundary) extracts named-role palette `{ Vibrant, DarkVibrant, LightVibrant, Muted, DarkMuted, LightMuted }` from sharp-resized ≤256×256 thumbnail (Vercel function memory budget). `derived_palette` populated on every generation + editor override; `editorial-serif` + `notes-app-chic` flipped to `paletteMode: 'palette-dominant'` (Vibrant for chip backgrounds, DarkMuted for text on light). Instagram 4:5 (1080×1350) safe-zone overlay rendered in canvas via CSS-only chip toggle. `text-editor-panel-composition.test.tsx` snapshot pins right-rail order.
- **Phase 58 — AI Tightening + Parity QA + match-photos:** Gemini slide-generation schema gains `role: 'cover' | 'reframe' | 'support' | 'pivot' | 'close'` + `template_id_override?: string` (closed enum, registry-validated). Per-role copy guidance (cover = pattern-interrupt hook ≤8 words; reframe = "wait, but" tension; support = concrete evidence; pivot = unexpected angle; close = action / CTA / bookmark prompt). Server-side validator: missing/invalid `role` defaults to legacy flat distribution — never throws. 20-prompt diversity corpus at `src/lib/ai/__tests__/diversity-corpus.ts` + advisory `hookOpeningTrigram` repetition gate (does NOT fail CI in v2.9 — live Gemini wiring deferred to v3.0+). `src/lib/ai/match-photos-to-slides.ts` shipped premium-gated (was parked, shipped per research-synthesis approval) — `MAX_PHOTOS=8` + SHA-256 cache via `match_photo_cache` table + 10s `Promise.race` timeout + index-order fallback + `gemini_vision_match` credit ledger (charge-then-refund-on-failure pattern). Render parity tests: `parity.test.tsx` 10 cases assert resolver-singleton identity for new templates; `no-css-filter.test.ts` extended +16 cases; `zip-metadata.test.ts` 3 cases (PNG byte-clean, no EXIF/XMP/C2PA via `withMetadata({})` strip); `projects-delete.test.ts` 6 cases (cascade-delete extended for `slide-backgrounds-treated` + legacy `slide-backgrounds`). Ship-gate 15 items all green.

**Decisions honored:**

- Photo treatment baked server-side via sharp — CSS filters silently break Satori PNG export (vercel/satori#573); pre-render is the only path.
- Imagen 4 Fast (`imagen-4.0-fast-generate-001`) replaces Imagen 3 ($0.02 vs $0.04/image, 10× faster).
- All 3 new templates free for all users — pre-PMF, top-of-funnel sharing > premium gating.
- `match-photos-to-slides.ts` ships in Phase 58 premium-gated only; cost mitigated by `MAX_PHOTOS=8` + cache + timeout.
- `stylize-image.ts` deferred to v3.0+ — architectural conflict + Vercel timeout breach + right-of-publicity legal risk on faces (Reface/Kyland Young 9th Cir.).
- No Pangram fonts — $120 deferred until paying users exist.
- Diversity gate advisory only (D-14) — does not fail CI.
- TPLREND-05 parity invariant preserved end-to-end across all 11 templates.

**Built on:** v2.7 Premium Templates (`resolve-overlay.ts` resolver pattern + 3 magazine-style premium templates), v2.8 Text Editor Right-Rail Redesign (selection-driven panel + `TextBox[]` schema, both consumed unchanged).

**Research-grounded:** Aesthetics of Photography "Viral Visual Grammar of US Instagram in 2026"; Canva *Imperfect by Design 2026*; It's Nice That graphic trends 2026; Mosseri Jan 2026 "rawness is proof"; verified Satori issues #573 / #162 / #712; Imagen 4 Fast pricing (Google AI docs); right-of-publicity precedent (Reface/Kyland Young, 9th Cir.).

**Out of scope (definitively deferred to v3.0+):**

| Item | Reason |
|---|---|
| `stylize-image.ts` (AI photo restyling) | Architectural conflict with deterministic treatment cache; 80s wall-clock breaches Vercel 60s `maxDuration`; right-of-publicity legal risk on faces |
| Pangram Pangram fonts | $120 deferred until paying users exist |
| Legacy schema sunset (`hook_text` / `body_text` / etc.) | Pre-PMF — tech debt waits until users love the product |
| CANVAS-03 Layers mini-list | v2.8 Layer Strip covers ~90% of cases |
| AIGEN-01 native Gemini `text_boxes[]` prompt | v2.8 Phase 51 light-touch alternative produces equivalent state |
| Render parity grid React-preview half (PARITY-03) | Satori half ships and is source of truth used by `/api/render` |
| Live Gemini wiring for diversity gate | Advisory only in v2.9; wire live if monoculture observed in production |
| Variable fonts | Satori issues #162/#712 unresolved as of 2026-05 |

**Awaiting user:** Manual visual QA — generate carousels through each of 3 new templates and verify visual fidelity matches reference patterns. Non-blocking — automated parity tests cover render-output identity. Re-measure ZIP download rate 14+ days post-launch against baseline.

---

## v2.8 Text Editor Right-Rail Redesign (Shipped: 2026-04-30)

**Phases completed:** 5 phases (49-53), 7 plans, 30/32 requirements (2 deferred to v2.9)

**Status:** passed — all 5 phases verified clean; user pain points all addressed

**Key accomplishments:**

- **Phase 49 — Schema Unification & Migration:** New `TextBox` interface + extended `Slide.text_boxes?: TextBox[]` field; legacy `hook_text` / `body_text` / `hook_segments` / `body_segments` / `custom_texts` retained and `@deprecated` (sunset target v2.9). Pure adapter `text-box-adapter.ts` with `legacyToTextBoxes` / `textBoxesToLegacy` round-trip parity (5 fixture shapes, 20 unit tests). Editor reducer gains `ADD_TEXT_BOX` / `UPDATE_TEXT_BOX` / `REMOVE_TEXT_BOX` actions through `pushHistory()`. Eager migration on slide load via `useReducer` lazy initializer.
- **Phase 50 — Right-Rail Redesign:** Five new components at `src/components/editor/text-rail/` — `LayerStrip` (chip row), `EffectRow` (toggle + inline reveal), `AccentWordsDisclosure` (Collapsible with count badge), `ActiveTextBoxCard` (white-on-cream framing), `SlideSettings`. New `TextEditorPanel` is a 320-line composition shell. Legacy preserved as `text-editor-panel-legacy.tsx` behind `NEXT_PUBLIC_NEW_TEXT_RAIL` env flag. **Critical fix BL-01:** `applyDualWrite` reducer pattern — every TextBox edit synchronously updates legacy fields so live preview reflects changes (otherwise edits would silently revert on save).
- **Phase 51 — AI Prompt Rewrite (light-touch):** Gemini's JSON schema unchanged (AIGEN-01 deferred to v2.9). `legacyToTextBoxes` runs at the AI-ingest boundary in `generate-slides.ts` post-Zod-parse, populating `text_boxes` server-side. v2.7's 19 premium-tier reqs re-verified: zero regression.
- **Phase 52 — Canvas Selection Improvements:** Click hook/body/custom on canvas → updates `selectedTextBoxId` → right rail mirrors instantly. Dashed `#3d0000` selection ring on active text box (CSS `outline` ignored by Satori, so PNG export unaffected). Keyboard shortcuts `Cmd+1/2/3` (switch active), `Cmd+D` (add custom + auto-select), Delete (remove custom only — hook/body protected). All gated to `editable={true}` so Satori export path is untouched.
- **Phase 53 — Migration & QA Polish:** 3 schema-boundary integration tests + `.planning/MIGRATION-NOTES.md` with concrete 10-step v2.9 sunset checklist. MIG-01 (Supabase backfill) deferred — eager migration handles existing rows transparently. MIG-02 (read-path flag) superseded by Phase 50's `applyDualWrite` keeping shapes in sync.
- **Test count:** 423 → 542 (+119 net new across 5 phases). 11 baseline failures unchanged.
- **Code quality:** 1 BLOCKING (BL-01 live preview) + 4 HIGH + 6 MEDIUM all fixed; UI review 25/30 → 27-28/30 after a11y commits.

**Built on:** v2.7 Premium Templates (overlay schema + 3 magazine-style templates) — the new editor consumes the same template + segment + effect shapes unchanged.

**Industry-research-grounded:** patterns sourced from Figma, Canva (post-Glow Up 2025), CapCut, VEED, Adobe Express, Photoshop, NN/g design-tool inspector guidance.

**Out of scope (deferred to v2.9):**
| Item | Reason |
|---|---|
| AIGEN-01 (Gemini emits text_boxes[] natively) | Deferred to avoid v2.7 audit regression risk; light-touch alternative shipped via post-AI conversion |
| CANVAS-03 (Floating Layers mini-list) | Layer Strip from Phase 50 covers ~90% of cases; resurface only on user complaint |
| Sunset of legacy schema fields, `text-editor-panel-legacy.tsx`, `applyDualWrite` reducer, `NEXT_PUBLIC_NEW_TEXT_RAIL` flag, adapter module | Full v2.9 checklist in `.planning/MIGRATION-NOTES.md` |

**Awaiting user:** Manual smoke test recommended (open existing project → click hook → toggle effects → save → reload). Non-blocking — automated tests cover data paths.

---

## v2.6 MCP Server (Shipped: 2026-04-28)

**Phases completed:** 3 phases (40-42), 3 plans, 18/19 requirements (MCP-DIST-06 deferred — npm publish user-gated)

**Status:** tech_debt — code complete; one user-gated deployment step (`npm publish`) awaiting user.

**Key accomplishments:**

- **Phase 40 — MCP Transport & Auth:** `/api/mcp` Streamable HTTP endpoint with `mcp-handler@1.1.0` + `@modelcontextprotocol/sdk@1.29.0`. `vsl_` Bearer auth via `withMcpAuth`, stateless transport for Vercel, Upstash rate limiting (shared `vsl:rl` counter with REST), middleware bypass for `/api/mcp`. Bearer-token verification core extracted to `src/lib/api/auth-core.ts` and shared between REST `withApiAuth` and MCP `verifyToken`. **AuthInfo cross-phase contract** (`extra: { userId, keyId }`) live for Phase 41.
- **Phase 41 — MCP Tool Surface:** 4 outcome-oriented tools (`list_templates`, `create_carousel`, `edit_slide`, `render_carousel`) registered via `server.registerTool` with Zod raw-shape input validation. Tools call services directly (NOT `/api/v1/*`). `create_carousel` mirrors REST credit deduct + refund pattern byte-for-byte. `edit_slide` accepts the same 9-field whitelist as `PATCH /api/v1/projects/{id}/slides/{index}`. Insufficient credits returns in-band `{ isError: true }` content (NOT OAuthError).
- **Phase 42 — Distribution & Documentation:** `viralslidemaker-mcp@0.1.0` npm bridge (zero-build plain JS in `bin/cli.js` wrapping `mcp-remote@0.1.38`). `docs/MCP-GUIDE.md` with copy-paste config snippets for Claude Desktop, Cursor, Windsurf, ChatGPT (with workspace-tier + Developer Mode gate). 4th `GuideCard` added to `/settings/api-keys` automation guide. `npm publish --dry-run --access public` accepted (4 files, 2.0kB tarball, name available on registry).
- **Build-gate regression check (THE point of v2.6):** the v2.3 retirement cause — `mcp-handler` listed in `package.json` but missing from `node_modules` → `/api/mcp` returned 500 — is now blocked by THREE independent layers: (1) static non-type import in `route.ts`, (2) vitest `import-gate.test.ts`, (3) `npm run build` in CI. Triple coverage; cannot recur silently.
- **Tests:** 23/23 MCP tests pass across 9 files, 9/9 REST auth regression tests pass, `npm run build` clean.
- **Code review:** 0 critical findings across all 3 phases. 8 warnings + 14 nits surfaced and addressed (some Phase 41 nits intentionally deferred to v2.7+ as cross-cutting REST refactors).

**Built on:** v2.2 (Bearer auth, rate limiting, service-extraction pattern); v2.5 (carousel/projects/render service signatures stable).

**Closes:** v2.3 MCP Server (retired 2026-04-28 in `quick-260428-rmm`) — root cause now blocked by triple-layer build-gate.

**Out of scope (deferred to v2.7+):** broader MCP tool surface (publish, fork, bookmarks, brand-kit, profile, credits, AI image gen, Pexels search, slide CRUD beyond `edit_slide`), OAuth 2.1, anonymous tools, MCP Resources/Prompts, stateful sessions.

**Awaiting user:** `cd packages/mcp-cli && npm login && npm publish --access public` + Claude Desktop end-to-end smoke test per `docs/MCP-GUIDE.md`.

---

## v2.5 Public REST API Parity (Shipped: 2026-04-28)

**Phases completed:** 6 phases (34–39), 10 plans, 28 requirements

**Key accomplishments:**

- Tier 1 (Phase 34): closed SPEC-01..07. Added `TextSegment`, `TextEffects` (+ shadow/outline/highlight sub-types) schemas. Expanded `Slide`, `StyleOverrides`, `CustomText`, `Project` to match `src/lib/types/slide.ts` and `src/lib/types/project.ts`. Tightened `/carousel` POST 200 response with `required` + descriptions. Zero behavior change.
- Tier 2 (Phases 35–36): `PATCH /projects/{id}` (rename + template), expanded `PATCH /slides/{index}` to 9 fields (was 5), `POST /slides`, `DELETE /slides/{index}` (refuses last-slide delete), `POST /slides/reorder` (full permutation only), `POST/DELETE /projects/{id}/publish`, `GET /me/credits`. New `src/lib/services/publish.ts` for the admin-client publish path.
- Tier 3 (Phases 37–39): `POST /pexels/search`, `POST /slides/{index}/generate-image` (Imagen, 1 credit, refunds on safety filter), `POST /slides/{index}/regenerate-text` (Gemini, free, opt-in persist), `GET /explore` (cursor-paginated 24/page, sort/tag/q), `GET /explore/{slug}`, `POST /explore/{slug}/fork`, `GET/POST /me/bookmarks`, `DELETE /me/bookmarks/{publishedId}`, `GET/PUT /me/brand-kit` + `POST /me/brand-kit/logo-upload-url`, `GET/PATCH /me/profile`. New service modules: `src/lib/services/ai-regen.ts`. New OpenAPI schemas: `BrandKit`, `Profile`, `PublishedCarousel`.
- ~21 new endpoints across the 6 phases, all reusing the existing `withApiAuth` wrapper. No new auth surface; static Bearer tokens cover everything.
- Decisions favored API consistency over dashboard parity where they diverged (e.g. bookmark POST is idempotent on conflict; slide DELETE refuses if it would leave 0 slides; reorder requires full permutation not partial).
- All routes verified to compile and respond 401 to unauthenticated curls; typecheck clean for every touched file.

**Built on:** v2.2 (REST API foundation), v2.3 retired in quick-260428-rmm, v2.4 (Explore + Remix infrastructure).

**Out of scope (deferred to v2.6+):** API-key CRUD via API, Stripe billing endpoints, webhooks for project events, OAuth 2.1, anonymous Explore reads, avatar upload via signed URL, username-claim via API.

---

## v2.5 Public REST API Parity (Planning Snapshot — superseded by Shipped section above)

The original planning scope, kept for historical reference. All requirements below were closed in the shipped milestone.

**Goal:** Bring the public REST API up to full feature parity with the dashboard so a customer with an API key can do everything they can do in the UI — manage projects, slides, custom text/images, AI image generation, Pexels search, publishing, Explore browsing, bookmarks, forking, brand kit, credits.

**Why now:** v2.3 (MCP) was retired in quick-260428-rmm because it never shipped end-to-end (mcp-handler missing from node_modules → /api/mcp returned HTTP 500). The REST API at `/api/v1/*` is the only programmatic surface we ship; right now it covers ~30% of dashboard capabilities. Audit captured 2026-04-28 in this conversation.

### Scope (3 tiers, all in-scope for v2.5)

#### Tier 1 — Spec accuracy (no new endpoints, just docs)

Update `src/lib/api/openapi.ts` to fully document everything the existing 7 routes already accept and return. Surfaced via Scalar at `/docs`.

- [ ] **SPEC-01**: `Slide` schema documents `hook_segments` and `body_segments` (TextSegment[]) used by news-headline two-color rendering
- [ ] **SPEC-02**: `StyleOverrides` schema documents `hook_text_effects`, `body_text_effects` (TextEffects: shadow / outline / highlight), `layout` ('cover' | 'body'), `hide_watermark` boolean
- [ ] **SPEC-03**: `CustomText` schema documents `text_effects` and `segments` fields
- [ ] **SPEC-04**: New `TextSegment` schema (text + accent boolean)
- [ ] **SPEC-05**: New `TextEffects` schema with `TextShadowEffect` / `TextOutlineEffect` / `TextHighlightEffect` sub-schemas matching `src/lib/types/slide.ts`
- [ ] **SPEC-06**: `Project` schema documents `description` and `generation_status` fields
- [ ] **SPEC-07**: `/carousel` POST 200 response schema accurately reflects the actual `{ success, projectId, slideCount }` shape

#### Tier 2 — Close the small/medium-low capability gaps

Each item is a real new endpoint or expanded handler.

- [ ] **API-01**: `PATCH /projects/{id}` — rename project (`title`, `description`, `template_id`)
- [ ] **API-02**: `PATCH /projects/{id}/slides/{index}` accepts `custom_texts`, `custom_images`, `hook_segments`, `body_segments`, `hide_watermark` (today only allows 5 fields)
- [ ] **API-03**: `POST /projects/{id}/slides` — append a new slide (or insert at index)
- [ ] **API-04**: `DELETE /projects/{id}/slides/{index}` — remove a slide
- [ ] **API-05**: `POST /projects/{id}/slides/reorder` — reorder via array of indices
- [ ] **API-06**: `POST /projects/{id}/publish` — publish to Explore (mirrors `publishProjectToExplore` server action: hero render + `publish_carousel` RPC); accepts title, description, tags
- [ ] **API-07**: `DELETE /projects/{id}/publish` — unpublish (calls `unpublish_carousel` RPC)
- [ ] **API-08**: `GET /me/credits` — return tier + balance (reuses `getCreditBalance` + `getUserTier`)

#### Tier 3 — AI / Pexels / Explore / Bookmarks / Brand Kit (full parity)

- [ ] **API-09**: `POST /pexels/search` — proxy `searchPhotos` with `?q=`, `?orientation=`, `?per_page=`
- [ ] **API-10**: `POST /projects/{id}/slides/{index}/generate-image` — Imagen AI background generation (1 credit)
- [ ] **API-11**: `POST /projects/{id}/slides/{index}/regenerate-text` — AI hook/body rewrite (free per current pricing)
- [ ] **API-12**: `GET /explore` — Explore feed with `?sort=trending|new|featured`, `?tag=`, `?q=` (mirrors current /explore page query)
- [ ] **API-13**: `GET /explore/{slug}` — single published carousel detail (mirrors current `/explore/[slug]` server fetch)
- [ ] **API-14**: `POST /explore/{slug}/fork` — fork into a new private project (calls `fork_published_carousel` RPC)
- [ ] **API-15**: `POST /me/bookmarks` — bookmark a published carousel by id
- [ ] **API-16**: `DELETE /me/bookmarks/{publishedId}` — remove bookmark
- [ ] **API-17**: `GET /me/bookmarks` — list my bookmarks
- [ ] **API-18**: `GET /me/brand-kit` — read brand kit
- [ ] **API-19**: `PUT /me/brand-kit` — upsert brand kit (logo URL, colors, fonts; logo upload uses an upload-URL pattern, TBD)
- [ ] **API-20**: `GET /me/profile` — read public profile (display name, bio, avatar URL, socials)
- [ ] **API-21**: `PATCH /me/profile` — update profile fields

### Out of scope for v2.5

| Feature | Reason |
|---|---|
| Stripe checkout / portal / subscription sync | Session-auth surface, not API-key surface; covered by web flow |
| Create/list/revoke API keys via API | Chicken-and-egg; stays in `/settings/api-keys` |
| Webhooks for "project published" / "carousel forked" | Defer to v2.6 if customer demand |
| OAuth 2.1 / per-scope tokens | Static Bearer tokens cover v1 |
| Rate-limit-tier upgrades for paid users | Existing flat 60-rpm enough for now |

### Locked decisions

- All new endpoints follow the existing Bearer-token + rate-limit pattern (`withApiAuth` from `src/lib/api/with-api-auth.ts`).
- Credit-deducting endpoints (carousel generation, AI image gen) deduct via `deductCreditAdmin` and surface `x-credits-remaining` / `x-credits-used` headers per the existing convention.
- Each new endpoint adds a matching OpenAPI path entry in the same commit. No "ship route, document later."
- Tier 1 ships first as a single spec-only PR — no risk, immediate value to /docs.

### Phase suggestion (for /gsd-new-milestone)

- **Phase 34**: Tier 1 — spec accuracy (1 PR, no new behavior)
- **Phase 35**: Tier 2.A — project/slide CRUD + reorder (API-01 through API-05)
- **Phase 36**: Tier 2.B — publish + credits read (API-06, 07, 08)
- **Phase 37**: Tier 3.A — AI + Pexels (API-09, 10, 11)
- **Phase 38**: Tier 3.B — Explore + Bookmarks + Fork (API-12 through API-17)
- **Phase 39**: Tier 3.C — Brand kit + profile (API-18 through API-21)

When ready to execute, run `/gsd-new-milestone v2.5` and feed it this scope.

---

## v2.3 MCP Server (Shipped: 2026-04-09)

**Phases completed:** 3 phases, 3 plans, 6 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] AuthInfo type import path
- Commit:

---

## v2.2 Public REST API (Shipped: 2026-04-09)

**Phases completed:** 4 phases, 8 plans, 9 tasks

**Key accomplishments:**

- 1. [Rule 1 - Bug] timingSafeEqual test approach changed
- RED:
- 1. [Rule 3 - Blocking] Copied auth.ts from phase 22 parallel branch
- 1. [Rule 2 - Missing Auth] Added authentication check to server actions
- Templates listing and projects listing REST endpoints with auth, rate limiting, and OpenAPI-compliant responses.
- 1. [Rule 3 - Blocking] TypeScript error with JSZip buffer type

---

## v2.1 Text Effects (Shipped: 2026-04-07)

**Phases completed:** 3 phases, 5 plans

**Key accomplishments:**

- Text shadow with toggle, color picker, and S/M/L size presets
- Text outline with toggle, color picker, and thickness slider (1-8px)
- Background highlight with toggle, color picker, tight/full-width style, and padding slider
- Per-element independence for all effects (hook, body, each custom text box)
- Native Satori CSS support confirmed (textShadow, WebkitTextStroke) — no workarounds needed
- Effects in all three renderers (preview, Satori PNG, HTML export)
- 845 lines added across 8 source files, zero new dependencies

## v2.0 API & MCP Platform (Shipped: 2026-04-07)

**Phases completed:** 1 phases, 0 plans, 2 tasks

**Key accomplishments:**

- Commit:

---
