# v2.12 Shapes & Icons (Decoration Primitives) — PITFALLS

**Domain:** Adding `decorations[]` (kind: 'icon' | 'shape') to a Satori + React-preview hybrid renderer with a strict TPLREND-05 byte-identity invariant, full v2.11 multi-element editor parity (multi-select, marquee, group, align, lock, layers panel, z-order), and Gemini AI per-slide emit.

**Researched:** 2026-05-03
**Overall confidence:** MEDIUM-HIGH (verified GitHub issues for satori #570 / #281 / #573 / #41 / #312 / #186, lucide-icons #1733 / #2366 / #1559, TanStack/virtual #419, react-rnd README + #911; mitigation patterns mirror the v2.11 audit pattern Plan 65-03 — PCL/PTF/PRS — and v2.8 BL-01 dual-write pattern).

**Carry-forward warnings (DO NOT re-research; already-known and solved):**
- TPLREND-05 byte-identity invariant — any divergence between React preview and Satori PNG = bug
- v2.8 BL-01 `applyDualWrite` reducer pattern — every TextBox edit synchronously updates legacy fields
- PITFALL-9.2 `isEditingTarget` firewall (`<input>`/`<textarea>`/contentEditable preserve native key behavior, `keyboard-utils.ts`)
- PARITY-01 chrome-leak gate — editor-only DOM (`*selection*`/`*marquee*`/`*guide*`/`*group-bound*`/`*lock-icon*`) MUST NOT leak into Satori path
- Vercel function timeouts (`maxDuration` ~10–60s; sharp pipeline)
- Right-of-publicity legal risk on AI-stylized faces
- vercel/satori #573 (CSS filters silently break Satori), #325 (filter combos), #393 (drop-shadow), #41 (unsupported CSS thrown), #162/#712 (variable fonts unsupported)
- v2.10 `react-rnd` `onDragStop`/`onResizeStop` only — never per-tick dispatch
- v2.11 `Z_ORDER` action routes per-scope via array splice — NEVER CSS z-index (ZORDER-05)

---

## CATEGORY A — Satori SVG rendering pitfalls (THE BLAST RADIUS)

This category gates whether decorations CAN render at all in PNG export. Verified GitHub issues drive the decision tree.

### A.1 `lucide-react` dropped in as React components silently fails to render in Satori PNG

- **Trigger:** Developer drops `<Heart />` (a `lucide-react` component) into the slide template. React preview shows it; PNG export shows blank.
- **Failure mode:** Silent — Satori does not throw on unsupported SVG attributes; it emits empty output for the icon node. ~3–6 month delay to discovery if not pinned by a parity test.
- **Root cause:** Verified — [vercel/satori#570 "`lucide-react` not rendering"](https://github.com/vercel/satori/issues/570). The original report cites stroke + viewBox + currentColor as failing. Issue claims fix in PR #601 but lucide React components ship arbitrary nesting + dynamic `currentColor` that historically bites again with each lucide release. Companion issue [vercel/satori#281 "React Icons (svg components) not rendering"](https://github.com/vercel/satori/issues/281) pins the same class for `react-icons`.
- **Mitigation:**
  1. **DO NOT pass `lucide-react` React components directly into Satori.** Use the `lucide-static` package (raw SVG strings) OR the `lucide` package's `dynamicIconImports` to fetch SVG markup as a string at build/runtime, then inline as a `<svg>` JSX node with explicit attributes — `viewBox="0 0 24 24"`, `fill="none"`, `stroke="#000"` (NEVER `currentColor`), `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
  2. Mirror the v2.9 `resolve-overlay.ts` pattern: a single `resolveDecorationSvg(decoration)` module consumed by BOTH `slide-preview.tsx` AND `render-slide-satori.tsx` — single source of truth, TPLREND-05 preserved.
  3. Pin a parity test (PTF13 in the existing PARITY-04 24-snapshot suite at `parity.template-fingerprint.test.tsx`): for each of ~10 representative Lucide icons (Heart, Star, Check, Sparkles, Zap, Arrow, Circle, X, Plus, Crown), assert byte-identical PNG between React preview and Satori output.
- **Phase to address:** **Phase A — Schema + renderer foundation (icons-only first vertical slice).** Lock the resolver pattern + parity test BEFORE any UI work.

### A.2 `currentColor` resolution divergence — works in browser, blank in Satori

- **Trigger:** Developer copies an icon SVG verbatim from a designer; it uses `stroke="currentColor"` and inherits color from a parent CSS `color: red`.
- **Failure mode:** React preview correct (browser resolves currentColor); Satori PNG renders the icon black or invisible.
- **Root cause:** Satori's CSS subset is documented limited per [vercel/satori#41](https://github.com/vercel/satori/issues/41); `currentColor` cascade is unreliable across the SVG boundary. Even when partially supported, behavior differs from browser CSS in edge cases.
- **Mitigation:**
  1. The decoration schema MUST store `fillColor: string` and `strokeColor: string` as **explicit hex values** — never `currentColor`, never `inherit`, never CSS variables.
  2. The resolver `resolveDecorationSvg` REPLACES `currentColor` with the explicit hex on every emit. Add a unit test: any SVG string emitted from the resolver must NOT contain the literal `"currentColor"`.
  3. Grep gate (mirror PCL1..PCL10 chrome-leak grep): `rg "currentColor" src/lib/render/` returns zero hits in production code (icon strings are processed BEFORE storage).
- **Phase to address:** **Phase A — Schema design.** Store explicit hex; never inherit.

### A.3 SVG `<path>` with `stroke-dasharray`, `stroke-linecap`, gradient fills, `<filter>` — partial / unsupported

- **Trigger:** Developer adds a "dashed line" shape primitive using `stroke-dasharray="5,5"`. Or a gradient-filled star. Or a Canva-style "soft drop-shadow on shape" via SVG `<filter>`.
- **Failure mode:**
  - `stroke-dasharray` — historically rendered but not officially documented; LOW confidence on long-term support.
  - SVG gradient fills (`<linearGradient>`, `<radialGradient>`) — partial; complex stops sometimes drop. Verified per [vercel/satori#41](https://github.com/vercel/satori/issues/41) "throw error when CSS property not supported" — silently no-ops.
  - SVG `<filter>` (drop-shadow, blur) — broken per the same family of issues as [vercel/satori#573](https://github.com/vercel/satori/issues/573) (CSS filters) and [#393](https://github.com/vercel/satori/issues/393) (drop-shadow). Carry-forward.
- **Mitigation:**
  1. **v2.12 shape primitives are flat-fill only** — `fillColor` (single hex), `strokeColor` (single hex), `strokeWidth` (number). No gradients in v2.12. Defer gradient support to v3.0+.
  2. **Drop-shadow on shapes/icons MUST use CSS `box-shadow` on a wrapping `<div>`, NOT SVG `<filter>`** — same path the v2.1 text-shadow effect already uses (see `render-slide-satori.tsx` text-effects block). The wrapper-div + `box-shadow` is supported per Satori's documented CSS subset.
  3. **`stroke-dasharray` only on shape primitives that explicitly need it (e.g. dashed-line)**; pin one snapshot per dash-style template variant in PTF13. If Satori regresses, fall back to multiple short `<line>` segments.
- **Phase to address:** **Phase A — Schema + renderer foundation** (lock primitive subset). Phase D — Effects (shadow/opacity) to avoid SVG filter trap.

### A.4 SVG `viewBox` + scale — browser respects, Satori sometimes drops aspect

- **Trigger:** Decoration is scaled non-uniformly (1.5× wide, 1.0× tall). Lucide icons default `viewBox="0 0 24 24"` (square).
- **Failure mode:** Browser preserves aspect via `preserveAspectRatio`; Satori may stretch or clip depending on whether width/height are emitted as attributes vs CSS.
- **Mitigation:**
  1. Always emit `<svg width={W} height={H} viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">` with explicit numeric width/height — never percentage, never CSS-only sizing.
  2. For NON-icon shapes (rect, circle, line), use simple geometric primitives (`<rect>`, `<circle>`, `<line>`, `<polygon>`) — these have higher Satori coverage than `<path>` (per [vercel/satori#86 "Support `<svg>` element"](https://github.com/vercel/satori/issues/86) and #186 historical thread).
  3. PTF13 includes one snapshot per non-uniform-scale case (icon at 1.5×1.0, shape at 0.6×0.6).
- **Phase to address:** **Phase A — Schema + renderer foundation.**

### A.5 Lucide icons use `stroke` + path; default icon size 24×24 — strokeWidth visually thinner at small sizes (UX bug, not Satori bug)

- **Trigger:** User scales a Lucide icon from 64px → 16px. Visually the stroke gets very thin because Lucide icons have HARDCODED `stroke-width="2"` and the SVG viewBox is fixed. Same applies in reverse — a 256px Lucide icon has very thick relative-pixel stroke.
- **Failure mode:** Loud (visually wrong); user reports "the icon looks broken at small sizes."
- **Mitigation:**
  1. **Per-decoration `strokeWidth` field, default 2, AI-emit-aware.** Don't auto-scale; expose to user.
  2. **Constrain icon min/max display size: 24px–512px.** Below 24px, strokes are invisible; above 512px, individual stroke pixels become huge. Match the `ROLE_FONT_BOUNDS` clamp pattern from v2.10 `slide-preview.tsx`.
  3. Right-rail `strokeWidth` slider (1–8) — same UX as v2.1 outline thickness slider. Document in tooltip: "Lucide icons render their own stroke; for a thinner look, decrease this. Doesn't affect filled shapes."
  4. SVG `vector-effect="non-scaling-stroke"` is NOT a fix — Satori's support is undocumented (per general SVG community confirmation that browser support of non-scaling-stroke is fragmented; see [stefanjudis non-scaling-stroke note](https://www.stefanjudis.com/today-i-learned/how-to-disable-scaling-for-stroke-width/)).
- **Phase to address:** **Phase D — Right-rail decoration controls.**

---

## CATEGORY B — `lucide-react` bundle size pitfall (the 7+ MB landmine)

### B.1 Naive barrel import bloats the client bundle by 7+ MB

- **Trigger:** Developer writes the picker as `import * as LucideIcons from 'lucide-react'` OR as `function getIcon(name) { return LucideIcons[name] }` — a dynamic-name lookup forces all 1500+ icons into the bundle.
- **Failure mode:** Loud at production-build time (Vercel build size jumps); silent at dev time (Vite/Next.js dev-server lazy-loads). You won't notice until production deploy.
- **Root cause:** Verified — [lucide-icons/lucide#1733 "README should ask to import icons specifically, to avoid very large app bundles"](https://github.com/lucide-icons/lucide/issues/1733). The maintainer-acknowledged bloat: "the entire icon library of 7+ MB to be included in the app bundle." Companion: [#1559 "Import Icon as a separate module"](https://github.com/lucide-icons/lucide/issues/1559) — recommended pattern is per-icon import paths (`lucide-react/icons/heart`).
- **Mitigation (the picker has THREE patterns to choose from — pick ONE per use case):**

  | Pattern | Bundle cost | When to use |
  |---|---|---|
  | **Static per-icon import** (`import Heart from 'lucide-react/icons/heart'`) | Only the icons used; tree-shakable | Templates that use a fixed set (5–10 icons in template fixtures) |
  | **`lucide` `dynamicIconImports`** ([Lucide DynamicIcon docs](https://lucide.dev/guide/react/advanced/dynamic-icon-component)) | Full library lazy-split into per-icon chunks | Picker UI ONLY — load on demand when picker opens |
  | **Static `lucide-static` SVG strings** | Import once, ~700 KB JSON metadata + tree-shakable string fetches | Server-side / Satori PNG path |

  - **Picker UI side:** Use `dynamicIconImports` from `lucide` (NOT `lucide-react` barrel). Code-split per icon; import on demand when the user scrolls. The picker's own bundle stays small; per-icon chunks load lazily.
  - **Renderer side (BOTH preview and Satori):** Use `lucide-static` SVG strings at the resolver layer (per A.1). Server-side path stays string-based.
  - **Selected-icon hot path (icon already chosen and persisted to a project):** Resolve from `lucide-static` SVG strings on render — no React component instantiation needed.

- **Test gate:** Add a CI bundle-size check — `npm run build` then assert `.next/static/chunks/main-*.js` is within e.g. +200 KB of the v2.11 baseline. Fail the build on regression. Mirror the v2.6 triple-layer build-gate pattern (static import + vitest gate + `npm run build`).
- **Phase to address:** **Phase B — Picker UI** (lazy-load architecture must be locked BEFORE any picker code lands).

### B.2 jsdom/vitest cannot import `lucide-react` ESM — test infra bug

- **Trigger:** Developer writes a unit test that mounts a component using `lucide-react`. Vitest fails with "Cannot use import statement outside a module" or "SyntaxError: Unexpected token 'export'."
- **Failure mode:** Loud (test fails); time-eats developer for hours guessing config.
- **Root cause:** Verified — [lucide-icons/lucide#2366 "JEST: => export { dynamicIconImports as default }; SyntaxError: Unexpected token 'export'"](https://github.com/lucide-icons/lucide/issues/2366). lucide ships pure-ESM; jsdom test env in older configs doesn't transform it.
- **Mitigation:**
  1. Add `lucide-react` and `lucide` to `vitest.config.ts` `server.deps.inline` (or `deps.optimizer.web.include`).
  2. For tests that don't need the icon to render visually, mock with `vi.mock('lucide-react', () => new Proxy({}, { get: () => () => null }))` — return null components for any name.
  3. Pin a single `lucide-import.test.ts` smoke test that imports one real icon — fails fast on regression.
- **Phase to address:** **Phase B — Picker UI**, **Phase F — Test gates.**

---

## CATEGORY C — Virtualized picker + jsdom test pitfalls

### C.1 react-window / react-virtuoso / TanStack Virtual all render ZERO items in jsdom

- **Trigger:** Developer writes a picker test that mounts the icon grid and queries for items. Test fails — `screen.getByText('Heart')` returns null, picker appears empty.
- **Failure mode:** Loud (test fails); developer wastes hours debugging visible-row count.
- **Root cause:** Verified — [TanStack/virtual#419 "ResizeObserver is not defined in SSR"](https://github.com/TanStack/virtual/issues/419). Virtualization libraries depend on:
  - `ResizeObserver` (jsdom does not implement — [jsdom/jsdom#3368](https://github.com/jsdom/jsdom/issues/3368))
  - `IntersectionObserver` (jsdom does not implement)
  - `getBoundingClientRect()` returns `{ width: 0, height: 0 }` in jsdom
  - `offsetHeight` / `scrollHeight` return 0
  Without all four, the virtualizer "knows" the container is 0×0 and renders zero rows.
- **Mitigation:**
  1. **Library choice:** Pick `react-virtuoso` over `react-window` and `tanstack-virtual` for v2.12 — Virtuoso provides an official `VirtuosoMockContext` for tests (per [Virtuoso mocking-in-tests docs](https://virtuoso.dev/mocking-in-tests/)). The other two require hand-rolled mocks.
  2. Add `vitest.setup.ts` global mocks for `ResizeObserver` and `IntersectionObserver` (`globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }`). Document with a comment block linking back to TanStack/virtual#419.
  3. For tests of the picker rendering N items, wrap the rendered tree in `<VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 40 }}>` so the virtualizer "sees" enough room to render rows.
- **Phase to address:** **Phase B — Picker UI.**

### C.2 Selecto marquee + virtualized picker — items off-screen are not selectable

- **Trigger:** User opens picker, scrolls midway through 1500 icons, drags a marquee across visible items. The user expects "all items I dragged over." But virtualized rows that scrolled into view DURING the drag may not be in the selecto element registry.
- **Failure mode:** Subtle; manifests as "marquee selection misses some items."
- **Mitigation:** v2.12 picker is a SINGLE-SELECT widget (click an icon → it inserts into the slide). NO multi-select inside the picker itself. The selecto-based marquee only operates on the canvas (decorations + text_boxes + custom_images), where N≤30 and there's no virtualization. Sidesteps the trap entirely.
- **Phase to address:** **Phase B — Picker UI** (locked decision: picker is single-select).

---

## CATEGORY D — Color contrast / a11y pitfalls

### D.1 White icon on white background invisible (no contrast guard)

- **Trigger:** AI emits a `decorations[]` slot with `fillColor: '#FFFFFF'` on a slide whose background is `#F5EFE6` (cream). Or user selects white icon on white — no warning.
- **Failure mode:** Silent (the icon is just invisible). User wonders why the slide looks empty.
- **Mitigation:**
  1. **Right-rail color picker shows a contrast indicator** vs the resolved background (the same `derived_palette` from v2.9 photo-treatment, plus the template's `backgroundColor`). If `contrastRatio < 1.5`, show a yellow warning chip ("low contrast vs background"); if `< 1.2`, red ("invisible"). DO NOT block — user may genuinely want a low-contrast watermark-style overlay.
  2. **AI emit advisory gate** (mirror the v2.9 `hookOpeningTrigram` advisory gate): server-side validator computes contrast for each emitted decoration vs resolved background; if `< 1.5`, log a soft warning. Does NOT fail; advisory only in v2.12 (carry forward to fail-CI in v3.0+ if monoculture observed).
- **WCAG note:** Per [W3C WAI G207](https://www.w3.org/WAI/WCAG21/Techniques/general/G207), purely decorative icons (where `aria-hidden="true"`) are formally EXEMPT from WCAG 1.4.11 non-text contrast requirement. v2.12 decorations should ALL emit `aria-hidden="true"` in the React preview path (Satori path doesn't matter — PNG has no a11y tree). So the contrast indicator is a UX nicety, not a legal compliance requirement.
- **Phase to address:** **Phase D — Right-rail decoration controls** (warning UI), **Phase E — Gemini AI emit** (advisory gate).

### D.2 `aria-hidden` missing on editor decorations — screen reader announces "image" 1500 times when picker opens

- **Trigger:** Picker opens with 1500 lucide icons; each is an `<svg>` without `aria-hidden`; VoiceOver / NVDA announces all of them.
- **Mitigation:** Picker chips are `<button aria-label="Heart icon">` with the inner `<svg aria-hidden="true">`. On-canvas decorations: `<svg aria-hidden="true" focusable="false">`. Document in the right-rail decoration card as a comment.
- **Phase to address:** **Phase B — Picker UI**, **Phase D — Right-rail decoration controls.**

---

## CATEGORY E — AI emit monoculture pitfalls (the "every slide gets a sparkle" trap)

### E.1 Gemini emits the SAME decoration kind on every slide ("everything is a sparkle")

- **Trigger:** AI is told "decorate this slide with relevant icons" — Gemini's training data biases toward `Sparkle`/`Star`/`Zap`/`Crown` for any "viral content" prompt. A 5-slide carousel ends up with 5 sparkles.
- **Failure mode:** Loud at the user level (looks AI-generic); silent at the system level (no error).
- **Industry pattern survey:**
  - **Beautiful.ai:** acknowledged design-repetition concern (per [Beautiful.ai vs Gamma 2026 comparison](https://www.beautiful.ai/compare/gamma-alternative)). Beautiful.ai's mitigation: AI generates the *layout* automatically; icons are user-driven.
  - **Tome:** the entire Slides product was shut down April 2025 (per [SlideGMM 2026 comparison](https://www.slidegmm.ai/en/blog/ai-presentation-tools-comparison-2026)) — likely partly because of generic AI output. Tome's design system frequently re-used the same gradient-blob aesthetic across all decks.
  - **Gamma:** uses an AI-curated "design pack" per project rather than per-slide AI emit — sidesteps per-slide monoculture by amortizing decoration choice at the project level.
- **Mitigation:**
  1. **Mirror the v2.9 `hookOpeningTrigram` advisory gate pattern.** Server-side post-AI validator hashes the icon names emitted across the carousel; if any single icon appears on ≥3 of 5 slides (60%+), log a soft warning. Advisory in v2.12 — wire to live Gemini retry in v3.0+ if monoculture observed in production.
  2. **Per-role decoration affordance** (mirror v2.9 per-role hook guidance): cover-role AI prompt addendum suggests "1 high-impact icon if any"; pivot-role suggests "consider a directional arrow"; close-role suggests "CTA-style icon if any." Doesn't lock; just shapes the distribution.
  3. **`decorations[]` defaults to EMPTY ARRAY in the AI schema.** Gemini must opt-in per slide — the prompt addendum should say "decorations are optional; only emit if the slide visually needs one. Empty is the right default for hook-only slides." Inverts the bias.
- **Test gate:** 20-prompt diversity corpus (mirror v2.9 `diversity-corpus.ts`) with assertion: across the corpus, no single icon name appears on > 30% of generated slides. Advisory only in v2.12 (does NOT fail CI), upgrade to fail-gate in v3.0+.
- **Phase to address:** **Phase E — Gemini AI emit + monoculture gate.**

### E.2 AI hallucinates icon names that aren't in Lucide — silent drop

- **Trigger:** Gemini emits `decoration.iconName: "MagicWand"` (not a real Lucide icon — closest is `Wand2`).
- **Failure mode:** Server-side renderer can't resolve the SVG; emits an empty placeholder OR throws.
- **Mitigation:**
  1. **Closed-enum validation** at the AI ingest boundary — after Zod parse, validate `decoration.iconName` against the canonical Lucide name registry (built from `lucide` package's exported names at build time). Unknown names DROP the decoration silently (mirror the v2.9 `template_id_override` closed-enum pattern); log a warning.
  2. **Gemini prompt addendum:** "Icon names are case-sensitive lucide-react PascalCase identifiers from this allowlist of 100 most-used icons: …" Provide the allowlist inline. Gemini follows allowlists more reliably than open vocabularies.
  3. **AI emit allowlist is a SUBSET of the picker allowlist** — pick ~100 high-quality, semantically diverse icons for the AI; let users pick from all 1500 in the picker. Reduces hallucination rate without limiting power users.
- **Phase to address:** **Phase E — Gemini AI emit.**

---

## CATEGORY F — Schema migration pitfalls (the production-data risk)

### F.1 Eager-on-load migration on 53+ existing projects breaks if `decorations` shape changes mid-milestone

- **Trigger:** Phase A ships `decorations[]` schema. User opens existing project (no `decorations` field). Lazy initializer fires `legacyToDecorations(slide)` → returns `[]`. So far so good. Then Phase D adds `decoration.shadowEffect?: ShadowEffect`. User reopens project, migration re-runs, but now Phase A's eager migration is OUT OF SYNC with Phase D's expected shape — silent drift between in-memory and on-disk schema.
- **Failure mode:** Subtle. Manifests as "saved decoration shadow doesn't reload after refresh."
- **Root cause:** v2.8 MIG-01 deferred backfill — eager migration handles existing rows transparently UNTIL the migration logic itself changes mid-flight. The forward-compat contract was "additive only," but multi-phase additions compound.
- **Mitigation:**
  1. **Treat `decorations[]` as PURELY ADDITIVE for v2.12.** Same as v2.11 `groupId`/`locked`/`hidden` — optional fields default to undefined; reducer never assumes presence. NO Supabase eager backfill needed.
  2. **NO `legacyToDecorations` adapter** — there is no legacy shape to convert from. `decorations` is brand-new; absent = `[]`. Sidesteps v2.8 BL-01 dual-write entirely.
  3. **Schema versioning at the slide level** (NOT global) — add `slide.schemaVersion?: 'v2.12.0'` advisory tag set by the reducer on first edit. Use it ONLY for telemetry / diagnostic, NEVER for branching logic. (If branching logic creeps in, the v2.8 dual-schema trap returns.)
  4. **Defer Supabase backfill to v2.13+** — same deferral-reasoning as v2.8 MIG-01. Lazy is the right default until v3.0+ legacy sunset.
- **Phase to address:** **Phase A — Schema design.** Lock "additive-only, default-empty" contract.

### F.2 Forking RPC drops decorations in the wrong direction

- **Trigger:** v2.4 `fork_published_carousel` RPC strips `brand_kit_id`. v2.11 added a migration `20260502_fork_strip_locked.sql` to also strip `locked`. v2.12 adds `decorations[]`. Question: should fork strip decorations? Does it need to strip per-decoration `locked` flags inside `decorations[]`?
- **Failure mode:** Right-of-publicity adjacent — IF v2.13+ adds custom-SVG upload to decorations, forking someone else's published carousel that contains a user-uploaded SVG (potentially with copyrighted content) would auto-copy that SVG into the forker's project. Same legal class as the v2.9-deferred `stylize-image.ts` face-stylize trap (Reface/Kyland Young 9th Cir.).
- **Mitigation:**
  1. **v2.12 fork PRESERVES `decorations[]`** (icons + shapes only — no user-uploaded SVGs in v2.12). All Lucide icons are CC0 / ISC-licensed (per Lucide's [LICENSE](https://lucide.dev/license)); shapes are pure geometry. Safe to copy.
  2. **v2.12 fork ALSO STRIPS `decoration.locked` and `decoration.hidden`** per-element — mirror v2.11's `fork_strip_locked.sql` migration. Add `20260503_fork_strip_decoration_locked.sql` (or fold into the `decorations[]` migration if the fork RPC is amended in the same SQL file).
  3. **v2.13+ custom-SVG upload (if/when it lands): fork MUST STRIP user-uploaded SVG references**, replace with a "broken" placeholder + user-visible warning. Document in the v2.12 milestone deferral list as ROP-01 (right-of-publicity carry-forward).
- **Phase to address:** **Phase A — Schema design + migration.** Lock fork policy in the migration SQL.

### F.3 `slide_data` JSONB row size — 30 decorations × 12 fields × N slides explodes

- **Trigger:** A "shapes-heavy" template (e.g. brutalist-grid with grid-line decorations) emits 20 decorations per slide × 5 slides = 100 decorations × ~200 bytes each ≈ 20 KB per project. Acceptable. But a power user with 30 decorations per slide × 10 slides ≈ 60 KB.
- **Failure mode:** Postgres JSONB row size soft-limit is 8 KB target / 1 GB hard. 60 KB is fine for storage, BUT it bloats the React reducer state, slows undo-history snapshot copies, and on slow networks adds 100ms+ to project load.
- **Mitigation:**
  1. **Cap N=30 decorations per slide** in the reducer (mirror the v2.11 perf budget at N=30 elements). Match the slide-level guard already in place.
  2. **Cap slide_data JSONB at 256 KB project-wide** — Supabase RLS policy or a server-side validator. Beyond that, refuse save with a clear error.
  3. **`decorations[]` per-item field budget: ≤ 12 fields** (id, kind, iconName | shapeKind, fillColor, strokeColor, strokeWidth, x, y, width, height, rotation, opacity, groupId, locked, hidden, shadowEffect). Don't allow nested `effects[]` arrays in v2.12 — flat shape only.
- **Phase to address:** **Phase A — Schema design.**

---

## CATEGORY G — Reducer dual-routing + symmetry pitfalls

### G.1 Developer adds `decorations[]` to `BULK_TRANSLATE` but forgets `Z_ORDER` (or vice versa) — silent symmetry bug

- **Trigger:** v2.11's reducer pattern routes per-scope: every action that operates on "an addressable element" must handle 4 scopes — `text_boxes`, `custom_images`, `watermark`, `decorations` (new in v2.12). Developer adds `decorations` handling to `Z_ORDER` but forgets `BULK_TRANSLATE`. Multi-select drag of [text + decoration] moves the text but leaves the decoration behind.
- **Failure mode:** Subtle. UI looks 90% correct; one specific multi-select operation silently fails.
- **Root cause:** The 4-scope-routing surface is implicit in the reducer. There's no static check that all relevant actions route to all 4 scopes.
- **Mitigation (mirror Plan 65-03 PCL/PTF/PRS audit pattern):**
  1. **Source-grep audit gate (PRA1..PRA12 — Per-Reducer Action audit, new):** for each of the 12 action types that operate on addressable elements (`SET_LOCKED`, `SET_HIDDEN`, `Z_ORDER`, `BULK_TRANSLATE`, `DUPLICATE_ELEMENTS_AT`, `GROUP`, `UNGROUP`, `DELETE_ELEMENTS`, etc.), assert via grep that each handler body mentions ALL of `text_boxes`, `custom_images`, `watermark`, `decorations`. Fails CI if any one is missing.
  2. **Reducer-level "exhaustive scope" type test:** define `type AddressableScope = 'text_boxes' | 'custom_images' | 'watermark' | 'decorations'`; use a TS exhaustive-switch helper in each handler; if a scope is added later without updating handlers, tsc fails.
  3. **Cross-scope multi-select integration test:** for each action, dispatch with a multi-selection that spans all 4 scopes; assert all 4 element types respond correctly. Mirror PRS1..PRS6 v2.9/v2.10 regression sweep.
- **Phase to address:** **Phase C — Editor parity (multi-select + group + align + lock + z-order extension to decorations).** Lock the audit gate BEFORE wiring decoration handlers.

### G.2 `synthesizeRows` in layers panel forgets to walk `decorations[]`

- **Trigger:** Layers panel is the ONE place where all addressable elements are rendered as a flat list. v2.11's `synthesizeRows` walks `text_boxes ∪ custom_images ∪ watermark`. v2.12 must add `decorations`. Easy to forget — the panel works visually for non-decoration elements, so dev says "ship it."
- **Failure mode:** Loud (decorations don't appear in layers panel) but easy to overlook in a busy dev cycle.
- **Mitigation:**
  1. **Extend `synthesizeRows`** at `src/components/editor/layers-panel/layers-panel.tsx:90-153` — add a `for (const dec of slide.decorations ?? [])` loop after the watermark slot. Mirror the existing `text_boxes` / `custom_images` / `watermark` triplet exactly.
  2. **Update `LayerElementType`** at `src/components/editor/layers-panel/types.ts` to add `'icon' | 'shape'` (or unify under `'decoration'` with a sub-discriminator).
  3. **Update `computeAllLocked` and `computeAllHidden`** helpers (lines 155-183) — same exhaustive walk.
  4. **Test gate (LP-NEW1..LP-NEW6):** mirror existing layers-panel.test.tsx LP1..LP3; one test per element-type combination involving decorations (decoration alone, decoration in group with text, multi-decoration group).
- **Phase to address:** **Phase C — Editor parity (layers panel extension).**

### G.3 `getGroupMembers` doesn't walk decorations — ungroup leaves orphans

- **Trigger:** User groups [text + decoration]; calls Cmd+Shift+G to ungroup. The `getGroupMembers` helper walks `text_boxes ∪ custom_images ∪ watermark` — finds the text, doesn't find the decoration. The ungroup dispatch only fires `groupId = undefined` on the text. Decoration retains the (now orphaned) groupId; on next group, it joins a "phantom" group.
- **Failure mode:** Subtle. Manifests as "I ungrouped but they still move together when I click."
- **Mitigation:** Same as G.2 — extend ALL helpers that walk addressable elements to ALSO walk `decorations[]`. Build an audit list (a `addressable-element-walkers.ts` module that exports a single canonical iterator), refactor every existing walker through it.
- **Phase to address:** **Phase C — Editor parity (group/ungroup extension).**

---

## CATEGORY H — Picker keyboard nav vs editor shortcut conflict

### H.1 Picker is open; user presses Cmd+G — editor groups instead of picker doing whatever

- **Trigger:** Icon picker is a modal/popover. User has selected 2 elements on canvas, opens picker, presses Cmd+G expecting picker behavior — but tinykeys global handler fires GROUP on the canvas selection.
- **Failure mode:** Loud — wrong action runs.
- **Root cause:** v2.11 tinykeys map fires globally; the existing `isEditingTarget` firewall only short-circuits when focus is in `<input>`/`<textarea>`/contentEditable. A picker built with `<div role="grid">` is NOT one of those.
- **Mitigation (mirror `isEditingTarget` firewall — extend it to "modal-open" state):**
  1. **Add a `isPickerOpenRef` (or generalized `isModalOpenRef`)** at `slide-editor.tsx` top-level. Set true when picker mounts, false when it unmounts (lifecycle, NOT React state — `useRef` to avoid re-render cascades).
  2. **Every tinykeys binding's first line gains a second short-circuit:** `if (isEditingTarget(e.target) || isPickerOpenRef.current) return;`. The 33 inline firewalls cataloged in Phase 66 SWEEP-1..4 all need updating.
  3. **Picker has its OWN keyboard map** scoped via tinykeys' `target` option (passed to the picker container ref), so arrow keys / Enter / Esc bind only when picker has focus.
  4. **Test gate (SWEEP-PICK-1..6):** for each editor shortcut (Cmd+G, Cmd+Shift+G, Cmd+], Cmd+[, arrow nudge, Cmd+D, Cmd+1/2/3, Delete), mount picker → fire shortcut → assert editor reducer action did NOT dispatch.
- **Phase to address:** **Phase B — Picker UI** (lock `isPickerOpenRef` API). **Phase F — Test gates** (regression suite).

### H.2 Picker open + Esc — closes picker AND ALSO exits group on canvas (double dispatch)

- **Trigger:** User in a group (Cmd+G earlier) opens picker, presses Esc. Expectation: picker closes only. Reality: tinykeys' Escape handler ALSO fires (group exit + selection clear).
- **Mitigation:** Picker's own Esc binding calls `e.stopPropagation()` and the picker's `onClose`. Use the same `target` option as H.1. Plus, the global `isPickerOpenRef.current` short-circuit means tinykeys' Escape no-ops anyway.
- **Phase to address:** **Phase B — Picker UI.**

---

## CATEGORY I — react-rnd integration with non-rectangular shapes

### I.1 Lines / triangles / stars don't have square aspect — react-rnd handles invert / collapse

- **Trigger:** Shape primitive is a horizontal `<line>` (height = 0 in design intent). User grabs the bottom-right corner handle to resize. react-rnd's bounding box is `width × height`, but the visual geometry is a 1-D line. Visually nothing happens, OR the line "thickens" weirdly.
- **Failure mode:** Loud (visually wrong).
- **Mitigation:**
  1. **All shape primitives have a NON-ZERO bounding box.** Lines have a `strokeWidth` (default 4); the line's bounding box is `width × max(strokeWidth, 4)`. The user resizes the bounding box, not the geometric line.
  2. **Shape-aware default aspect ratios:**
     - Square: 1:1, react-rnd `lockAspectRatio` (Shift to free)
     - Circle/ellipse: 1:1 default, free with Shift
     - Triangle: 1:1 default, free with Shift
     - Line: ratio free (it's intentionally 1-D-feeling)
     - Star: 1:1 (locked-by-default; user can break with Shift)
   3. **Right-rail "Lock aspect ratio" toggle** — same UX as v2.10 ASPECT-01 deferred item; finally lands here. Mirrors react-rnd's `lockAspectRatio` prop ([react-rnd README](https://github.com/bokuweb/react-rnd)).
- **Phase to address:** **Phase A — Schema design** (per-shapeKind aspect default), **Phase D — Right-rail decoration controls** (lock-aspect toggle).

### I.2 Rotation handles deferred (carry-forward from v2.10 ROTATE-01) — but shapes BEG for rotation

- **Trigger:** Power user wants to rotate an arrow shape 45°. v2.11 has no rotation. v2.12 wants to ship rotation for shapes/icons so arrows can point anywhere — but rotation has cascading impact on AABB selection bounds, snap edges, smart-guides, layers panel measurement, BULK_TRANSLATE coordinate math.
- **Failure mode:** If rotation lands without rigor, every alignment / smart-guide / multi-drag math breaks (per v2.11 PITFALL 4.5). If rotation does NOT land, "shapes" feels half-baked.
- **Mitigation:**
  1. **v2.12 stores `rotation: number` in `decorations[]` schema** (default 0 — additive, optional, no breaking change). Renderer applies CSS `transform: rotate()` in the React preview path AND in Satori (Satori supports CSS `transform`).
  2. **v2.12 does NOT ship interactive rotation handles.** rotation is settable from a numeric input in the right-rail card OR via Gemini AI emit. Drag-to-rotate is deferred to v3.0+ (matches the v2.10 ROTATE-01 deferral discipline; no rotation-aware AABB math required).
  3. **Selection bounds for rotated decorations USE THE PRE-ROTATION AABB.** Document explicitly in code comment + tooltip ("rotation does not affect selection or alignment in v2.12"). Avoids the rotation-aware AABB math trap.
  4. **TPLREND-05 parity test:** PTF14 — render a 45°-rotated arrow shape; assert React preview and Satori output byte-identical.
- **Phase to address:** **Phase A — Schema design** (rotation field, no UI). **Phase D — Right-rail** (numeric rotation input, no drag handle). Defer drag-rotation to v3.0+.

---

## CATEGORY J — Performance pitfalls at scale

### J.1 N=20 decorations + 10 text_boxes + 5 images — pointer-move budget breach

- **Trigger:** v2.11 PERF budget is < 2ms per pointer-move at N=30 elements (`use-alignment-guides.ts` Phase 63 perf gate). v2.12 adds N=20 more decorations → N=55 total addressable elements per slide.
- **Failure mode:** Slow drag (visible jitter at 60fps) once over N≈40.
- **Mitigation:**
  1. **Cap decorations at N=20 per slide** (PERF-DECOR-01). Combined with v2.11's text-box / image caps, total cap = ~30. Stays under the perf budget.
  2. **`runSnapForDrag` already uses sorted-edge-array binary-search** (Phase 63 Plan 03) — N=55 should still be sub-2ms. Verify with a perf integration test (mirror PERF-05 at slide-preview level).
  3. **`synthesizeRows` is `useMemo`-cached** — only re-runs when slide ref changes. Layers panel render cost is amortized.
  4. **For decoration-heavy templates (brutalist-grid with grid lines), consider PRE-COMPUTING the decoration list at template-load time** — store as an immutable reference; skip walking on every render.
- **Phase to address:** **Phase C — Editor parity.** **Phase F — Test gates** (PERF-DECOR-01 integration test).

### J.2 Lucide-static SVG-string parsing on every render — CPU spike on slide-switch

- **Trigger:** Resolver `resolveDecorationSvg(decoration)` parses the raw lucide-static SVG string on every render. With 30 decorations × multiple slides + undo-history snapshots, you get hundreds of parses per second during heavy editing.
- **Failure mode:** Subtle. CPU profile shows time in DOM-string parsing.
- **Mitigation:**
  1. **Module-level LRU cache** keyed on `(iconName, fillColor, strokeColor, strokeWidth)` — same pattern as v2.9 `match_photo_cache` SHA-256 keying.
  2. **Cache hit-rate test:** integration test asserts that re-rendering a slide N times produces only K cache lookups, not K×N parses.
- **Phase to address:** **Phase A — Renderer foundation.**

---

## Technical Debt Patterns

| Shortcut | Immediate benefit | Long-term cost | When acceptable |
|---|---|---|---|
| Use `lucide-react` barrel directly because tree-shaking "should work" | -2 hrs setup | 7+ MB bundle bloat in production; user load time +1s | NEVER. Always use per-icon imports OR `lucide-static`. |
| Skip the resolver; pass `lucide-react` components straight to Satori | -1 hr | Silent PNG render failure; ~3-month delay to user-discovery | NEVER. Pin PTF13 parity test before shipping. |
| Use SVG `<filter>` for shape drop-shadow | -30 min vs box-shadow wrapper | Silent Satori render failure (per #573 family) | NEVER. Use CSS box-shadow on wrapping div. |
| Make `decorations` a single `decorations` field (NOT `decorations[]`) — single icon per slide v1, array later | -2 hrs of array-handling code | Schema break in v2.13 when users want 2+ decorations per slide | NEVER. Pluralize from day one — v2.11 watermark is the single-element case (1 array of length 1); decorations are inherently many. |
| Eager-backfill all 53+ projects with `decorations: []` in a Supabase migration | -30 min lazy-init cost | Migration risk; v2.8 MIG-01 deferral lesson re-learned | NEVER for v2.12. Lazy default-empty is correct. Backfill only when v3.0+ legacy sunset arrives. |
| Hand-roll a tree-walk in each layers-panel helper (4 helpers × 4 scopes) | -1 hr abstraction | G.2 / G.3 family of symmetry bugs | NEVER. Single canonical iterator (`addressable-element-walkers.ts`); refactor existing v2.11 helpers through it as part of v2.12. |
| Ship picker without `aria-hidden="true"` on the SVG; "fix later" | -10 min | Screen reader users hear "image image image" 1500 times; bug report incoming | NEVER. Ship a11y day one — it's a 1-line attribute. |
| Use `currentColor` to "save schema bytes" — let CSS cascade resolve it | -4 bytes per decoration | A.2 silent Satori failure | NEVER. Store explicit hex; the bytes don't matter. |
| Skip the `is{Picker,Modal}OpenRef` firewall; "no one will hit this" | -30 min | H.1 user reports "Cmd+G groups when picker is open"; data corruption from off-screen actions | NEVER. The 33-firewall pattern is already in place; one more line per binding is cheap. |

---

## Integration Gotchas

| Integration | Common mistake | Correct approach |
|---|---|---|
| `lucide-react` ↔ Satori PNG | Pass React components directly | Use `lucide-static` SVG strings via shared resolver `resolveDecorationSvg` consumed by both renderers |
| `lucide-react` ↔ vitest | Default ESM transform skips `lucide-react` | Add to `server.deps.inline`; mock with `vi.mock` proxy returning null components for non-visual tests |
| Virtualized picker ↔ jsdom | Render zero items because container = 0×0 | Use `react-virtuoso` + its `VirtuosoMockContext`; mock global `ResizeObserver` + `IntersectionObserver` in `vitest.setup.ts` |
| selecto marquee ↔ virtualized picker | Picker rows scroll into view mid-drag → not in selecto registry | v2.12 picker is single-select only; marquee operates only on canvas (N≤30, no virtualization) |
| Gemini AI emit ↔ Lucide icon names | Open vocabulary → hallucinated names | Closed enum allowlist of ~100 high-quality icons; Zod parse validates; unknowns drop silently with a warning |
| `decorations[]` ↔ existing reducer actions | Forget to route per-scope in 1 of 12 actions | PRA1..PRA12 source-grep audit gate; exhaustive `AddressableScope` type-switch |
| `decorations[]` ↔ layers panel `synthesizeRows` | Forget to walk decorations slot | Single canonical walker module; LP-NEW1..LP-NEW6 test gate |
| `decorations[]` ↔ fork RPC | Strip wrong fields, leak right-of-publicity adjacency | v2.12 preserves all (icons + shapes are CC0/geometric); strip `decoration.locked` + `.hidden` per-element via SQL migration; v2.13+ MUST strip user-uploaded SVGs |
| Picker keyboard nav ↔ tinykeys global map | Picker open + Cmd+G fires editor's group action | `isPickerOpenRef` firewall; extend the 33 firewalls in SWEEP-1..4 to add a second short-circuit |
| Shape drop-shadow ↔ Satori | Use SVG `<filter>` | Use CSS `box-shadow` on a wrapping `<div>` (same pattern as v2.1 text-shadow) |
| Decoration rotation ↔ alignment math | Rotation breaks AABB / snap / multi-drag | v2.12 uses pre-rotation AABB; rotation is visual-only (CSS transform), no interactive rotation handles |

---

## Performance Traps

| Trap | Symptoms | Prevention | When it breaks |
|---|---|---|---|
| Naive `lucide-react` barrel import in client bundle | Production bundle +7 MB, p95 page-load +1s | Per-icon `lucide-react/icons/X` static imports + `lucide` `dynamicIconImports` for picker | At deploy; silent in dev |
| SVG-string parsing on every render | CPU spike during heavy editing; undo replay slow | Module-level LRU cache keyed on (iconName, color, stroke, width) | At N≥10 decorations × multi-slide editing |
| N>30 elements pointer-move > 2ms | Drag jitter at 60fps | Cap N=20 decorations per slide; binary-search edge index already in place | At decoration-heavy templates if cap is missed |
| Eager-on-load migration over 50+ projects | Slow first-load (+50ms p95) | Lazy default-empty (decorations is brand-new — no legacy to migrate from) | At v2.13+ if eager backfill is added prematurely |
| `synthesizeRows` re-runs on every keystroke | Layers panel re-renders during text edit | `useMemo` keyed on slide reference; reducer always returns new array refs (immutable pattern) | Only if memo deps are misspecified |
| Bundle-size regression undetected until prod deploy | Vercel build size jumps unnoticed | CI gate: `npm run build` then assert chunk size ≤ baseline + 200 KB; mirror v2.6 triple-layer build-gate | At first regression after merge |

---

## Pitfalls cross-referenced to phase

| Pitfall | Phase A: Schema + renderer | Phase B: Picker UI | Phase C: Editor parity | Phase D: Right-rail | Phase E: AI emit | Phase F: Test gates |
|---|---|---|---|---|---|---|
| A.1 lucide-react silent fail | ★ resolver + PTF13 | | | | | ★ PTF13 in PARITY-04 |
| A.2 currentColor divergence | ★ explicit hex | | | | | ★ grep gate |
| A.3 SVG filter / gradient unsupported | ★ flat-fill primitives only | | | ★ box-shadow wrapper | | ★ PTF13 |
| A.4 viewBox / scale | ★ explicit width/height | | | | | ★ PTF13 |
| A.5 strokeWidth UX | | | | ★ slider 1–8 | | |
| B.1 7+ MB bundle | | ★ 3-pattern lazy | | | | ★ build-gate |
| B.2 lucide-react in vitest | | ★ deps.inline | | | | ★ smoke test |
| C.1 jsdom virtualization | | ★ react-virtuoso + mocks | | | | ★ vitest.setup.ts mocks |
| C.2 selecto + virtualized | | ★ single-select picker | | | | |
| D.1 white-on-white invisible | | | | ★ contrast indicator | ★ advisory gate | |
| D.2 aria-hidden missing | | ★ a11y attrs | | ★ a11y attrs | | |
| E.1 monoculture | | | | | ★ advisory gate + diversity corpus | ★ corpus assertion |
| E.2 hallucinated icon names | | | | | ★ closed-enum allowlist | |
| F.1 eager-vs-lazy migration | ★ additive default-empty | | | | | |
| F.2 fork RPC policy | ★ migration SQL | | | | | |
| F.3 JSONB row size cap | ★ N=30 cap | | | | | |
| G.1 reducer symmetry | | | ★ AddressableScope type | | | ★ PRA1..PRA12 grep |
| G.2 layers-panel synthesizeRows | | | ★ extend walker | | | ★ LP-NEW1..LP-NEW6 |
| G.3 getGroupMembers | | | ★ canonical walker module | | | ★ group integration |
| H.1 picker vs Cmd+G | | ★ isPickerOpenRef | | | | ★ SWEEP-PICK-1..6 |
| H.2 picker Esc double-dispatch | | ★ stopPropagation + ref | | | | |
| I.1 non-rect shapes + react-rnd | ★ aspect defaults | | | ★ lock-aspect toggle | | |
| I.2 rotation deferred | ★ rotation field, no UI | | | ★ numeric input only | | ★ PTF14 |
| J.1 N=55 perf budget | | | | | | ★ PERF-DECOR-01 |
| J.2 SVG parse cache | ★ LRU resolver | | | | | ★ cache-hit test |

---

## Sources

**Verified (HIGH confidence — cited in Satori / Lucide / TanStack issue trackers, official docs):**
- [vercel/satori#570 — `lucide-react` not rendering](https://github.com/vercel/satori/issues/570) → A.1
- [vercel/satori#281 — React Icons (svg components) not rendering](https://github.com/vercel/satori/issues/281) → A.1
- [vercel/satori#573 — `filter: "blur(...)"` doesn't work with Satori + resvg-js](https://github.com/vercel/satori/issues/573) → carry-forward; A.3
- [vercel/satori#393 — drop-shadow filter](https://github.com/vercel/satori/issues/393) (cited in MILESTONES.md v2.10 carry-forward) → A.3
- [vercel/satori#41 — Throw an error when CSS property or Tailwind API is not supported](https://github.com/vercel/satori/issues/41) → A.2 / A.3
- [vercel/satori#86 — Support `<svg>` element](https://github.com/vercel/satori/issues/86) → A.4
- [vercel/satori#186 — Support `<text>` in `<svg>`](https://github.com/vercel/satori/issues/186) → A.4
- [vercel/satori#312 — Image not loaded inside SVG](https://github.com/vercel/satori/issues/312) → A.4 (PR #472 fixed)
- [lucide-icons/lucide#1733 — README should ask to import icons specifically, to avoid very large app bundles](https://github.com/lucide-icons/lucide/issues/1733) → B.1 (7+ MB confirmed)
- [lucide-icons/lucide#1559 — Import Icon as a separate module](https://github.com/lucide-icons/lucide/issues/1559) → B.1
- [lucide-icons/lucide#2366 — JEST: SyntaxError: Unexpected token 'export'](https://github.com/lucide-icons/lucide/issues/2366) → B.2
- [Lucide DynamicIcon — Advanced React docs](https://lucide.dev/guide/react/advanced/dynamic-icon-component) → B.1 (recommends NOT using unless picker)
- [TanStack/virtual#419 — ResizeObserver is not defined in SSR](https://github.com/TanStack/virtual/issues/419) → C.1
- [jsdom/jsdom#3368 — Implement ResizeObserver](https://github.com/jsdom/jsdom/issues/3368) → C.1
- [React Virtuoso Mocking-in-tests docs](https://virtuoso.dev/mocking-in-tests/) → C.1 (`VirtuosoMockContext`)
- [W3C WAI G207 — Ensuring 3:1 contrast for icons](https://www.w3.org/WAI/WCAG21/Techniques/general/G207) → D.1
- [W3C WAI 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html) → D.1 (decorative-icon exemption)
- [bokuweb/react-rnd README](https://github.com/bokuweb/react-rnd) → I.1 (`lockAspectRatio` API)

**MEDIUM confidence (industry surveys + secondary sources):**
- [Beautiful.ai vs Gamma 2026 comparison](https://www.beautiful.ai/compare/gamma-alternative) → E.1
- [SlideGMM 2026 AI presentation tools comparison](https://www.slidegmm.ai/en/blog/ai-presentation-tools-comparison-2026) → E.1 (Tome shutdown April 2025)
- [stefanjudis non-scaling-stroke note](https://www.stefanjudis.com/today-i-learned/how-to-disable-scaling-for-stroke-width/) → A.5
- [Lucide tree-shaking with Vite — David Casanellas](https://javascript.plainenglish.io/tree-shaking-lucide-react-icons-with-vite-and-vitest-57bf4cfe6032) → B.1

**LOW confidence (training data + general patterns):**
- Symmetry-bug class is a general v2.11 lesson — extrapolated from synthesizeRows + reducer-action experience; no single canonical source.
- The "every slide gets a sparkle" specific failure mode for AI presentation tools is widely-discussed-but-not-formally-cited; mitigation pattern mirrors the v2.9 hookOpeningTrigram advisory gate.

**Codebase references (HIGH confidence — verified in repo):**
- v2.11 PARITY-04 audit pattern: `src/lib/render/__tests__/parity.template-fingerprint.test.tsx` → PTF13/PTF14 extension target
- v2.11 layers panel `synthesizeRows`: `src/components/editor/layers-panel/layers-panel.tsx:90-153` → G.2 extension target
- v2.11 `Z_ORDER` reducer routing: `src/lib/editor/editor-reducer.ts:952-972`, `src/lib/editor/transforms/z-order.ts` → G.1 extension target
- v2.11 `isEditingTarget` firewall: `src/components/editor/slide-editor.tsx:31, 422+` (33 inline firewalls per Phase 66 SWEEP-1..4) → H.1 extension target
- v2.8 `applyDualWrite` pattern: `src/lib/editor/editor-reducer.ts:7-21` → F.1 anti-pattern reference (DON'T re-introduce dual-shape)
- v2.4 fork RPC: existing `fork_published_carousel` SQL function + v2.11 migration `20260502_fork_strip_locked.sql` → F.2 mirror target
- v2.6 triple-layer build-gate: `package.json` build script + import-gate test → B.1 mirror target
- v2.9 advisory diversity corpus: `src/lib/ai/__tests__/diversity-corpus.ts` → E.1 / E.2 mirror target
