# Research — Upgrade from Gemini 2.5 Flash to Gemini 3.x

**Date:** 2026-05-15
**Confidence:** HIGH on model existence/pricing/dates; MEDIUM on regression risk

---

## 1. Decision Summary

**NEEDS-CLARIFICATION** — "Gemini 3.1 Flash" (the user's literal request) **does NOT exist** as a Google model. Google's current Flash-tier lineup is:

| Marketing name | Model ID | Status | GA date |
|---|---|---|---|
| Gemini 2.5 Flash | `gemini-2.5-flash` | Stable, deprecated 2026-10-16 | 2025-06-17 |
| Gemini 3 Flash (preview) | `gemini-3-flash-preview` | **Preview only** (Google's recommended 2.5 Flash replacement) | — |
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | **Stable / GA** | 2026-05-07 |
| Gemini 3.1 Flash-Lite Preview | `gemini-3.1-flash-lite-preview` | Preview | — |

There is **no "Gemini 3.1 Flash"** SKU (no standalone Flash in the 3.1 line — just Flash-Lite + Pro). The closest stable replacements are:

- **`gemini-3.1-flash-lite`** — recommended target. Stable, vision, structured output, ~97% schema compliance, 2.5× faster TTFT than 2.5 Flash, **cheaper** ($0.25 in / $1.50 out vs. $0.30 in / $2.50 out). Multiple third-party benchmarks claim it equals or beats 2.5 Flash on multimodal tasks. [VERIFIED: ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite]
- **`gemini-3-flash-preview`** — Google's official "recommended replacement" for 2.5 Flash, but **preview-status** (not GA-safe for production). Higher cost than 2.5 Flash ($0.50 in / $3.00 out). [VERIFIED: ai.google.dev/gemini-api/docs/deprecations]

**Recommendation: GO on `gemini-3.1-flash-lite`** (the GA stable model). Confirm with Diego that "3.1 Flash-Lite" is the intent — it is *cheaper* than 2.5 Flash (honors cost-sensitivity feedback memo), measurably faster, and the SDK already in `package.json` (`@google/genai ^1.46.0`) supports it. Deprecation deadline for 2.5 Flash is **2026-10-16** (5 months away), so the upgrade is *not* urgent, but the cost/speed/quality argument stands on its own.

---

## 2. Model Availability

### `gemini-3.1-flash-lite` (recommended target) [VERIFIED]

| Property | Value |
|---|---|
| Exact model ID | `gemini-3.1-flash-lite` |
| Status | Stable / GA (released 2026-05-07) |
| Inputs | Text, Image, Video, Audio, PDF |
| Output | Text |
| Context window | 1,048,576 input tokens / 65,536 output tokens (vs 2.5 Flash 1,048,576 / 65,536 — **same**) |
| Structured output | Supported (`responseSchema` works; newer `response_json_schema` also documented) |
| Safety settings | `HarmBlockThreshold.BLOCK_ONLY_HIGH` still valid — full enum unchanged [VERIFIED: ai.google.dev/gemini-api/docs/safety-settings] |
| SDK | `@google/genai ^1.46.0` (project's current pin) — supports passing model as string literal even when not in `Model` enum [CITED: github.com/googleapis/js-genai/issues/1396] |

### Gemini 2.5 Flash deprecation [VERIFIED: ai.google.dev/gemini-api/docs/deprecations]

- Shutdown: **2026-10-16** (5 months from today)
- Recommended replacement per Google: `gemini-3-flash-preview` (preview-only — we override to `gemini-3.1-flash-lite` for GA stability + lower cost)

---

## 3. Cost Delta vs 2.5 Flash

Pricing per 1M tokens, standard paid tier [VERIFIED: ai.google.dev/pricing]:

| Model | Input | Output | Δ vs 2.5 Flash |
|---|---|---|---|
| `gemini-2.5-flash` (current) | $0.30 | $2.50 | baseline |
| **`gemini-3.1-flash-lite`** (target) | **$0.25** | **$1.50** | **−17% input / −40% output** |
| `gemini-3-flash-preview` (Google's stated replacement) | $0.50 | $3.00 | +67% input / +20% output |

### Per-extraction-call cost estimate (project's typical use)

v2.13 style extraction uses ~3 images at ~1024×1024 + ~1000 tokens JSON output (per comment in `src/app/api/cron/style-extraction-bill-alarm/route.ts:29`).

Image token approximation: Gemini bills images at ~258 tokens each (1024×1024 inline). Assume ~800 prompt tokens + 3×258 image tokens = ~1574 input tokens; ~1000 output tokens.

| Model | Input cost | Output cost | Total / call |
|---|---|---|---|
| `gemini-2.5-flash` | $0.00047 | $0.00250 | **~$0.0030** |
| `gemini-3.1-flash-lite` | $0.00039 | $0.00150 | **~$0.0019** |
| Savings | — | — | **~37% cheaper** |

At 15 vision calls / user / day cap (COST-04), this is ~$0.029/user/day → $0.018/user/day. Saves $0.011/user/day at the cap. Honors the `feedback_gemini_cost.md` "cheapest viable" directive. [VERIFIED: cost math; pricing inputs from official ai.google.dev/pricing]

---

## 4. Breaking Changes

### Safety filters [VERIFIED]
- `HarmCategory.HARM_CATEGORY_*` enums unchanged.
- `HarmBlockThreshold.BLOCK_ONLY_HIGH` + `BLOCK_LOW_AND_ABOVE` still valid for Gemini 3.x.
- One default change: 3.x models default to `OFF` safety (per Google's safety docs); project explicitly sets thresholds so default behavior change doesn't apply.

### Structured output [MEDIUM confidence — verify in smoke test]
- The new model card prefers `response_json_schema` (full JSON Schema dialect), while 2.5 Flash uses `responseSchema` (`Type.OBJECT` / `Type.STRING` form).
- **Empirical:** 3.1 Flash-Lite still accepts the old `responseSchema` shape per third-party benchmarks (97% structured compliance reported). [CITED: aimlapi.com/blog/gemini-3-1-flash-lite-review-2026]
- **Risk:** No 1st-party Google "migration guide" exists between 2.5 → 3.x — Google's official docs don't document any breaking changes. Project's closed-enum `Schema` from `@google/genai` (used in `extract-style-spec.ts:117`) should keep working. **Action:** smoke-test one live extraction with the new model ID before flipping all 18 call sites.

### Vision / `inlineData` [VERIFIED]
- Same `inlineData: { mimeType, data }` shape. Inputs explicitly include "Image" per 3.1 Flash-Lite model card. JPEG/PNG bytes work identically.

### SDK compatibility [VERIFIED]
- Project uses `@google/genai ^1.46.0`. No upgrade required.
- The `Model` enum in 1.46 may not yet include `gemini-3.1-flash-lite` as a literal [CITED: github.com/googleapis/js-genai/issues/1396 — open as of 2026-03-11 against 1.44], but the enum signature is `Model | (string & {})`, so passing `'gemini-3.1-flash-lite'` as a string literal is type-safe and runtime-correct.

### `gemini-2.5-flash-image-preview` (separate model, used by `stylize-image.ts`)
- One call site uses `gemini-2.5-flash-image-preview` (image generation). Out of scope for this swap — different model family, different upgrade path. Leave alone.

---

## 5. Code-side Surface

**SDK:** `package.json` → `"@google/genai": "^1.46.0"` — no change needed.

**Production call sites (text/vision extraction — IN SCOPE for swap):**

| File | Line | Notes |
|---|---|---|
| `src/lib/ai/extract-style-spec.ts` | 95 | `export const GEMINI_VISION_MODEL = 'gemini-2.5-flash'` — **canonical constant, swap here first** |
| `src/lib/ai/generate-slides.ts` | 192 | Topic-flow carousel generation |
| `src/lib/ai/generate-from-style-spec.ts` | 322 | Copy-Style flow |
| `src/lib/ai/match-photos-to-slides.ts` | 189 | Premium photo matching (vision) |
| `src/lib/captions/generate-captions.ts` | 27 | Caption generation |
| `src/lib/imagen/generate-prompt.ts` | 13, 63 | Imagen prompt rewriter |
| `src/lib/services/ai-regen.ts` | 17 | Slide-level regeneration |
| `src/app/(dashboard)/project/[id]/editor-actions.ts` | 70, 101 | Editor-server actions |
| `src/app/(dashboard)/settings/brand-kit/actions.ts` | 280 | Brand-kit AI helper |

**Database / migration (DATA — must remain readable):**

| File | Line | Notes |
|---|---|---|
| `supabase/migrations/20260510_style_spec_cache.sql` | 22 | Cache column default `'gemini-2.5-flash'` — **don't migrate existing rows** (they'd invalidate). New rows will write new default. |
| `src/lib/cache/style-spec-cache.ts` | 43 | `const DEFAULT_MODEL = 'gemini-2.5-flash'` — swap |

**Tests (mock data):**

| File | Line | Notes |
|---|---|---|
| `src/lib/cache/__tests__/style-spec-cache.test.ts` | 220, 229 | Defaults test — update fixture |
| `src/__tests__/imagen/generate-prompt.test.ts` | 38 | Update fixture |
| `src/__tests__/ai/generate-slides.test.ts` | 317 | Update fixture |

**Comment-only references (not load-bearing):** `src/app/api/cron/style-extraction-bill-alarm/route.ts:29`, doc comment in `style-spec-cache.ts:139`.

**Total: ~13 prod files, ~3 test fixtures, ~1 SQL migration (default-only, no data migration).** Mostly mechanical.

---

## 6. Migration Plan Sketch

**Atomic task 1 — Smoke test (15 min, no commit):**
- Write a throwaway `scripts/smoke-3-1-flash-lite.ts` that calls `ai.models.generateContent({ model: 'gemini-3.1-flash-lite', ... })` with one real reference image + the production `responseSchema` from `extract-style-spec.ts`.
- Assert `parseStyleSpecSafe()` parses the result cleanly (PARITY-03 silent-drop = 0).
- If structured output regression → drop to `response_json_schema` shape or stay on 2.5 Flash.

**Atomic task 2 — Centralize the constant + flip:**
- Promote `GEMINI_VISION_MODEL` from `extract-style-spec.ts` to a module-level export in a new `src/lib/ai/gemini-model.ts` (or extend an existing constants file). Export `GEMINI_TEXT_MODEL = 'gemini-3.1-flash-lite'` and `GEMINI_VISION_MODEL = 'gemini-3.1-flash-lite'`.
- Replace all 9 hard-coded `'gemini-2.5-flash'` string literals in production code with imports of the constant. Leave `gemini-2.5-flash-image-preview` alone (different model family).
- Update `src/lib/cache/style-spec-cache.ts` `DEFAULT_MODEL`.
- Update 3 test fixtures.

**Atomic task 3 — Migration default (no backfill):**
- Add `supabase/migrations/20260515_style_spec_cache_default_3_1_flash_lite.sql`:
  ```sql
  ALTER TABLE style_spec_cache
    ALTER COLUMN model SET DEFAULT 'gemini-3.1-flash-lite';
  ```
- Existing cached rows with `model = 'gemini-2.5-flash'` remain valid (the column is a cache-key partition, not an invariant). New cache writes use the new default. Old entries naturally age out via the 7-day retention cron.

**Verification:** Re-run the smoke (now via prod path), confirm extraction still parses, monitor `style-extraction-bill-alarm` for surprise cost shifts, check `silent-drop counter` stays at 0.

---

## 7. Risks / Rollback

**Trivial rollback:** Since all call sites will reference one shared constant after task 2, rollback = one-line change (`'gemini-3.1-flash-lite'` → `'gemini-2.5-flash'`). No SDK pin to revert, no schema changes to roll back (the migration is `ALTER COLUMN ... SET DEFAULT`, fully reversible).

**Risk: structured output drift.** Although third-party benchmarks report 97% structured compliance, project's closed-enum schema is *unusually* strict (every string field has a closed enum). If 3.1 Flash-Lite degrades on closed-enum compliance, `parseStyleSpecSafe` will trigger silent-drops and PARITY-03 alerts. *Mitigation:* monitor `silent_drops_total` metric for 24h post-deploy; rollback if it spikes.

**Risk: vision-grounding accuracy.** v2.13's Copy Style feature is load-bearing on Gemini correctly extracting `palette / typography / decorations / layout` from reference images. Third-party reports claim 3.1 Flash-Lite matches or beats 2.5 Flash on MMMU Pro (76.8%). *Mitigation:* the smoke test in task 1 should hand-eyeball one extraction's `style_spec` against a reference image before the swap goes prod-wide.

**Risk: `gemini-2.5-flash-image-preview` (Imagen-adjacent) is on a separate deprecation track.** Out of scope for this task — flag for a future quick task.

**Non-risk: deprecation timing.** 2.5 Flash sunset = 2026-10-16, 5 months out. We are *not* up against a wall. The upgrade is justified on cost+speed+quality, not urgency.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Closed-enum `responseSchema` shape (from `@google/genai`'s `Schema` type with `Type.OBJECT` / `Type.STRING`) still works with `gemini-3.1-flash-lite`. Benchmarks support this but Google docs don't explicitly confirm backward-compat. | §4 | Structured output breaks → silent-drop spike → fall back to old model or rewrite as `response_json_schema` |
| A2 | Per-image token cost ~258 in cost estimate. Approximation based on Gemini's documented pricing — exact value not re-verified for 3.1 Flash-Lite. | §3 | Savings estimate off by ±20%, but sign (cheaper) is solid |
| A3 | `silent-drop counter` will detect closed-enum violations from the new model. Counter is implemented at the AI-ingest boundary so this should hold, but the assumption is that violations *manifest* as schema-coerce drops rather than as JSON parse failures or refusals. | §6/§7 | A different error mode bypasses the counter; smoke test in task 1 mitigates |

---

## Sources

**Primary (HIGH confidence):**
- [Gemini 3.1 Flash-Lite model card | ai.google.dev](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) — model ID, GA status, vision, schema, context window
- [Gemini API pricing | ai.google.dev](https://ai.google.dev/pricing) — pricing rows for 2.5 Flash, 3 Flash Preview, 3.1 Flash-Lite
- [Gemini API deprecations | ai.google.dev](https://ai.google.dev/gemini-api/docs/deprecations) — gemini-2.5-flash shutdown 2026-10-16
- [Gemini Safety Settings | ai.google.dev](https://ai.google.dev/gemini-api/docs/safety-settings) — `HarmBlockThreshold` enum unchanged, `BLOCK_ONLY_HIGH` still valid

**Secondary (MEDIUM confidence):**
- [Models index | ai.google.dev](https://ai.google.dev/gemini-api/docs/models) — confirms no "Gemini 3.1 Flash" SKU exists; only Flash-Lite + Flash-preview
- [js-genai issue #1396](https://github.com/googleapis/js-genai/issues/1396) — model enum lag in SDK, string-literal escape hatch
- [aimlapi.com 3.1 Flash-Lite review 2026](https://aimlapi.com/blog/gemini-3-1-flash-lite-review-2026-pricing-benchmarks-features-best-use-cases) — 97% structured compliance, vision benchmarks
- [DeepMind 3.1 Flash-Lite page](https://deepmind.google/models/gemini/flash-lite/) — 2.5× TTFT, 45% output speedup vs 2.5 Flash
- [Forum: impact of 3.1 Flash-Lite GA on 2.5 Flash projects](https://discuss.ai.google.dev/t/impact-of-gemini-3-1-flash-lite-ga-on-existing-gemini-2-5-flash-projects/144678) — open question thread

**Codebase:**
- `package.json` line containing `"@google/genai": "^1.46.0"` (verified by grep)
- `src/lib/ai/extract-style-spec.ts:95` (verified via Read)

---

## Metadata

**Confidence:**
- Model existence + IDs: **HIGH** (multiple primary Google sources confirm)
- Pricing: **HIGH** (ai.google.dev/pricing)
- Deprecation date: **HIGH** (ai.google.dev/deprecations)
- Structured-output backward-compat: **MEDIUM** (no 1st-party migration guide; smoke test required)
- Vision regression risk: **MEDIUM** (benchmarks only — third-party)

**Valid until:** 2026-06-15 (1 month) — model lineup is moving fast in 2026.
