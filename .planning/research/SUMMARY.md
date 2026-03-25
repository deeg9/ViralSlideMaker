# Project Research Summary

**Project:** TikTok Slideshow Creator — v1.1 Monetization & AI Images
**Domain:** AI-powered social media carousel SaaS with subscription billing
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

This is a v1.1 milestone for an existing, working carousel creator. The product already has an editor, Pexels image search, brand kit, AI slide content generation (Gemini 2.5 Flash), and auth. The v1.1 goal is to monetize it: add Stripe subscriptions (Free/Pro), a credit ledger, Google Imagen AI image generation as the premium feature, and social media caption generation as a free value-add. All four capabilities are well-documented, well-understood domains with established patterns in the Next.js 15 / Supabase ecosystem.

The recommended approach is to build in strict dependency order: database schema first (the credit ledger is a prerequisite for everything else), then Stripe billing infrastructure, then Imagen image generation gated behind credits, and caption generation last (it is nearly independent and the simplest feature). Only two new npm packages are needed: `stripe` and `@stripe/stripe-js`. Everything else — Imagen, caption generation, the credit database — uses packages already installed. The unit economics are strong: Imagen 4 Fast at $0.02/image on a ~$12-15/month Pro tier yields ~80% gross margin even at full credit utilization.

The most dangerous pitfalls are all in the Stripe + Supabase integration layer, not in the AI features. Credit race conditions (double-spend via concurrent requests), duplicate webhook processing, and RLS blocking webhook writes are the top three failure modes. All three require design-time decisions and cannot be retrofitted cleanly. The Imagen integration has its own hazard: safety filter false positives that silently consume user credits if the deduction-before-API-call pattern is not handled with a proper refund path. Get the database schema and atomic credit RPC correct before writing any billing or generation code.

## Key Findings

### Recommended Stack

The existing stack (Next.js 15, React 19, Supabase, `@google/genai`, Pexels, dnd-kit, Tailwind 4, shadcn/ui) is unchanged. Only two new npm packages are needed. See [STACK.md](STACK.md) for full details including cost model and alternatives considered.

**Core technologies (new additions only):**
- `stripe@^20.4.1` — server-side Stripe SDK; checkout sessions, Customer Portal, webhook verification; TypeScript-first, Next.js 15 Server Actions compatible
- `@stripe/stripe-js@^8.11.0` — client-side Stripe.js loader (~3KB); required for Checkout redirect; no React provider or Elements wrapper needed
- Imagen 4 Fast (`imagen-4.0-fast-generate-001`) — AI image generation at $0.02/image with native 9:16 aspect ratio support; uses already-installed `@google/genai` SDK; zero new dependencies
- Supabase Postgres (new credit tables) — three new tables (`subscriptions`, `credit_transactions`, `stripe_events`) with RLS; no new packages; uses existing `@supabase/supabase-js`
- Gemini 2.5 Flash (captions) — already installed; caption generation is text-only at ~$0.001/request; no new integration required

### Expected Features

See [FEATURES.md](FEATURES.md) for full feature analysis, competitor breakdown (PostNitro, Canva), and pricing model recommendation.

**Must have (table stakes for v1.1 launch):**
- Stripe subscription integration (Free/Pro) — the revenue foundation; required before any premium feature gating
- Credit system with monthly allowance and balance display — gates Imagen usage and shows users where they stand
- Google Imagen AI background generation in editor — the core premium value proposition
- Webhook handlers for full subscription lifecycle (checkout, renewal, cancellation, failed payment) — the only safe way to sync subscription state
- Stripe Customer Portal link — self-service plan management with zero custom UI
- Free tier usage limits with contextual upgrade prompts — creates the conversion funnel
- Multi-platform social media captions (TikTok, Instagram, LinkedIn) — low cost, high perceived value; uses existing Gemini

**Should have (add after v1.1 validation):**
- Credit pack top-up purchases — when users report hitting plan limits
- Usage history / credit ledger page — reduces "where did my credits go" support tickets
- Prompt preview before Imagen generation — reduces wasted-credit complaints

**Defer (v2+):**
- Auto-posting to TikTok/Instagram — complex OAuth, platform API volatility; explicitly deferred in PROJECT.md
- Annual billing — adds proration/refund complexity; validate monthly pricing first
- Imagen inpainting/outpainting — significant UX scope; generate-only is sufficient for v1.1
- Team/agency shared credit pools — different product category

### Architecture Approach

The architecture is a clean layered extension of the existing Next.js App Router structure. New service modules live in `src/lib/` (imagen, stripe, captions, credits rewrite). Stripe-initiated flows use a single new Route Handler at `/api/webhooks/stripe`. User-initiated flows (checkout, portal) use Server Actions — the standard 2025/2026 Next.js 15 pattern. The subscription tier must live in a Supabase `subscriptions` table written only by the webhook handler using the service role — never in user metadata (which is client-writable and spoofable). See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow diagrams, full file structure, and database schema.

**Major components:**
1. `lib/credits/` (rewrite) — atomic credit ledger via Postgres RPC; replaces naive project-count approach; prerequisite for everything else
2. `lib/stripe/` + webhook route (new) — checkout sessions, Customer Portal, webhook event dispatch, subscription state sync to Supabase
3. `lib/imagen/` + editor integration (new) — Imagen 4 Fast wrapper; uploads to Supabase Storage, updates `slide_data` with public URL; gated by credit deduction
4. `lib/captions/` + caption panel (new) — Gemini 2.5 Flash structured output; stateless, no DB writes, platform-specific output with copy buttons

**Existing code that must change:**
- `lib/credits/check-credits.ts` — full rewrite to credit_transactions ledger (current project-count approach cannot handle Imagen credits or credit packs)
- `app/(dashboard)/settings/subscription/page.tsx` — wire real Stripe Checkout and Portal (currently `window.alert('coming soon')`)
- `components/editor/image-picker-panel.tsx` — add "AI Generate" tab alongside Pexels
- `app/(dashboard)/project/[id]/actions.ts` — add credit deduction and Imagen generation option

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for full details, recovery strategies, integration gotchas, and the "Looks Done But Isn't" checklist.

1. **Credit race conditions (double-spend)** — Use a Postgres RPC with `FOR UPDATE` row lock for atomic check-and-deduct. Never use two separate `SELECT` + `UPDATE` calls from `supabase-js`. Must be designed into the initial schema; cannot be retrofitted.
2. **Stripe webhook duplicate processing** — Add a `stripe_events` table with `event_id` as PRIMARY KEY. Check before processing; return 200 immediately on duplicate. Without this, `invoice.payment_succeeded` can grant double credits.
3. **Webhook signature verification fails on Vercel** — Use `request.text()` (raw body), never `request.json()`, in the webhook route handler. This is the single most-reported Stripe + Next.js issue and fails silently in production.
4. **RLS blocks webhook database writes** — Webhook handlers have no auth session; use the Supabase service role key (not anon key) for all webhook-originated writes. Never prefix with `NEXT_PUBLIC_`.
5. **Safety filter credit loss** — Deduct credit before calling Imagen but insert a refund transaction if the API returns a safety block. Show a specific user-facing message, not a generic error. Do not silently consume credits on filtered prompts.

## Implications for Roadmap

The build order has a hard dependency chain: the credit system enables Stripe, Stripe enables Imagen gating, and Imagen and captions can then be built in parallel. There is no shortcut through this order.

### Phase 1: Database Foundation and Credit Ledger Rewrite

**Rationale:** Every other feature depends on accurate credit tracking and subscription state. The current `check-credits.ts` uses a naive project count that cannot handle Imagen credits, credit packs, or multiple deduction types. Getting the atomic RPC right here prevents race conditions in all downstream features. This phase has zero external dependencies and unblocks everything else.

**Delivers:** New `subscriptions`, `credit_transactions`, and `stripe_events` tables with RLS; `get_credit_balance` and `deduct_credits` Postgres RPCs; rewritten `lib/credits/check-credits.ts`; Supabase Storage bucket for generated images.

**Addresses:** Credit system (table stake), subscription table stake prerequisite

**Avoids:** Credit race conditions (Pitfall 1), RLS blocking writes (Pitfall 4), storing subscription tier in user metadata (Anti-Pattern 1)

**Research flag:** Standard Postgres ledger and Supabase RLS patterns — well-documented. Skip phase research.

### Phase 2: Stripe Billing Infrastructure

**Rationale:** Subscriptions unlock the credit economy. Without a working Free/Pro tier, Imagen cannot be gated and there is no revenue path. This phase wires the existing placeholder subscription page to real Stripe Checkout and Customer Portal. Depends on the `subscriptions` table from Phase 1.

**Delivers:** `lib/stripe/` service module; `/api/webhooks/stripe` Route Handler with full lifecycle handling (checkout, renewal, cancellation, failed payment, plan change); `createCheckoutSession` and `createPortalSession` Server Actions; subscription settings page wired to real Stripe.

**Uses:** `stripe@^20.4.1`, `@stripe/stripe-js@^8.11.0`

**Implements:** Stripe Webhook as Single Source of Truth pattern; Server Action for checkout / Route Handler for webhook pattern

**Avoids:** Duplicate webhook processing (Pitfall 2), webhook signature failure (Pitfall 3), trusting checkout success URL for fulfillment (Anti-Pattern 2), duplicate Stripe customers on returning users

**Research flag:** Full subscription lifecycle has many edge cases. Use PITFALLS.md "Looks Done But Isn't" checklist as a completion gate. Must be tested on a deployed Vercel preview (not localhost only) before Phase 3 begins.

### Phase 3: Imagen AI Image Generation

**Rationale:** This is the premium feature that justifies the Pro subscription. It depends on the credit ledger (Phase 1) for pre-deduction and the subscription tier (Phase 2) for gating. Imagen uses the already-installed `@google/genai` SDK — no new dependencies beyond what Phase 2 brought in.

**Delivers:** `lib/imagen/generate-image.ts` wrapper; "AI Generate" tab in editor image picker; credit deduction with refund-on-failure flow; generated images stored in Supabase Storage (not as base64 in JSONB); `image_source` field added to Slide type.

**Uses:** Imagen 4 Fast at $0.02/image; existing `@google/genai` SDK; existing Supabase Storage

**Avoids:** Calling API without pre-deduction (Anti-Pattern 3), storing images as base64 in JSONB (Anti-Pattern 4), safety filter credit loss (Pitfall 5), Vercel function timeout

**Research flag:** Two items need pre-build validation. First: confirm whether `imagen-4.0-fast-generate-001` uses the Gemini Developer API key or requires separate Google Cloud service account auth — STACK.md and PITFALLS.md have a minor contradiction here. Second: confirm the Vercel plan's function timeout limit (Hobby = 10s, Pro = 60s); Imagen takes 3-15s and will timeout on Hobby without an async polling pattern.

### Phase 4: Social Media Caption Generation

**Rationale:** Lowest dependency of the four features. Uses only existing Gemini 2.5 Flash with a new prompt schema. Can be built immediately after Phase 1 (or in parallel with Phase 3 if bandwidth allows). Ships as free and unlimited for all tiers — cost is negligible (~$0.001/request) and it increases perceived value without adding billing complexity.

**Delivers:** `lib/captions/generate-captions.ts` with structured JSON output; `components/captions/caption-panel.tsx` with per-platform copy buttons; TikTok, Instagram, and LinkedIn caption variants generated from actual slide content (hooks, key points, CTA) — not just the topic.

**Uses:** Existing `@google/genai` SDK, existing `GEMINI_API_KEY`, existing `CarouselSchema` slide data

**Avoids:** Caption generation on page load (generate on demand only), missing platform-specific formatting (hashtags, line breaks, character limits per platform)

**Research flag:** Standard Gemini structured output pattern — identical to existing slide generation. Skip phase research.

### Phase Ordering Rationale

- Phase 1 and Phase 2 are strictly ordered: the `subscriptions` table written by Phase 2's webhooks must exist before Phase 3 can read subscription tier for gating.
- Phase 3 requires both Phase 1 (credit deduction RPC) and Phase 2 (subscription tier to gate the feature as Pro-only) to be fully complete and tested.
- Phase 4 can begin after Phase 1 completes (credit system exists to confirm captions are free) and can run concurrently with Phase 3 if bandwidth allows.
- This ordering mirrors the explicit build order in ARCHITECTURE.md and is reinforced by the dependency graph in FEATURES.md.

### Research Flags

Phases needing deeper research or validation before/during planning:

- **Phase 2 (Stripe):** Full lifecycle has known edge cases (failed renewal grace period, credit pack credits surviving monthly reset, plan change mid-cycle). Use the PITFALLS.md "Looks Done But Isn't" checklist as a required completion gate before advancing to Phase 3.
- **Phase 3 (Imagen — auth model):** Confirm whether Imagen 4 Fast via `ai.models.generateImages()` accepts the existing `GEMINI_API_KEY` or requires a separate Google Cloud service account. This is a blocker for Phase 3 setup.
- **Phase 3 (Imagen — Vercel timeout):** Confirm deployment plan tier before building. If on Hobby (10s timeout), Phase 3 requires an async pattern (return job ID, poll for completion) instead of synchronous generation — a meaningful architecture difference.

Phases with standard patterns where additional research is not needed:

- **Phase 1 (Database):** Postgres ledger + RLS + RPC patterns are canonical Supabase. Well-documented with official examples.
- **Phase 4 (Captions):** Gemini structured output is already in use in this codebase for slide generation. Caption generation follows the identical pattern with a different schema.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Imagen 4 Fast, Stripe packages verified against official docs and npm. All model names and prices confirmed from Google's GA announcement. Zero ambiguity on what to install. One minor uncertainty: auth model for Imagen via Gemini Developer API vs Vertex AI. |
| Features | MEDIUM-HIGH | Feature list derived from competitor analysis (PostNitro, Canva) and SaaS billing conventions. Pricing model ($12-15/month Pro, 50-100 credits) is a research recommendation; exact numbers require market validation post-launch. |
| Architecture | HIGH | Patterns sourced from Vercel's official Next.js subscription starter, Supabase's official Stripe webhook guide, and Next.js 15 App Router docs. Data flow diagrams and file structure are concrete and implementation-ready. |
| Pitfalls | HIGH | Stripe webhook pitfalls (signature, RLS, idempotency) are the most-reported issues in the Next.js + Supabase community with clear, established fixes. Imagen safety filter behavior documented on Google's own developer forums. |

**Overall confidence:** HIGH

### Gaps to Address

- **Imagen auth model:** STACK.md states the existing `GEMINI_API_KEY` works for Imagen; PITFALLS.md mentions potential need for a separate Google Cloud service account. Verify which auth path applies to `imagen-4.0-fast-generate-001` via the Gemini Developer API before starting Phase 3. If Vertex AI auth is required, add Google Cloud project setup to Phase 3.
- **Vercel plan / function timeout:** Confirm the deployment plan before building Phase 3. Imagen takes 3-15 seconds. Vercel Hobby plan enforces a 10-second function timeout; Vercel Pro raises it to 60 seconds. If on Hobby, an async pattern (return job ID, poll for result) is required and changes the Phase 3 architecture meaningfully.
- **Credit pricing and tier limits:** The research recommends ~$12-15/month Pro with 50-100 Imagen credits, but the exact numbers need a product decision before building Stripe price IDs and plan config. Changing price IDs post-launch requires migrating existing subscribers.
- **Free trial Imagen credits:** Research recommends 2-3 trial Imagen generations on signup (not ongoing free Imagen). Whether this goes into Phase 1 credit grant logic or Phase 3 generation gate is a product decision needed before implementation.

## Sources

### Primary (HIGH confidence)
- [Google Imagen API docs](https://ai.google.dev/gemini-api/docs/imagen) — model names, API params, aspect ratios, JS code examples
- [Imagen 4 GA announcement](https://developers.googleblog.com/announcing-imagen-4-fast-and-imagen-4-family-generally-available-in-the-gemini-api/) — pricing, model variants, fast vs standard vs ultra
- [@google/genai npm v1.46.0](https://www.npmjs.com/package/@google/genai) — SDK version and `generateImages()` method availability
- [stripe npm v20.4.1](https://www.npmjs.com/package/stripe) — package version
- [@stripe/stripe-js npm v8.11.0](https://www.npmjs.com/package/@stripe/stripe-js) — package version
- [Supabase: Handling Stripe Webhooks](https://supabase.com/docs/guides/functions/examples/stripe-webhooks) — webhook + RLS + service role patterns
- [Vercel Next.js subscription payments starter](https://vercel.com/templates/next.js/subscription-starter) — reference implementation
- [Stripe: Receive events in your webhook endpoint](https://docs.stripe.com/webhooks) — idempotency and signature verification

### Secondary (MEDIUM confidence)
- [Stripe + Next.js 15 complete guide 2025](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) — Server Actions pattern for checkout
- [Stripe subscription lifecycle in Next.js 2026](https://dev.to/thekarlesi/stripe-subscription-lifecycle-in-nextjs-the-complete-developer-guide-2026-4l9d) — webhook and Customer Portal patterns
- [Stripe + Next.js 15 + Supabase guide](https://dev.to/flnzba/33-stripe-integration-guide-for-nextjs-15-with-supabase-13b5) — Supabase-specific integration
- [PostNitro pricing plans](https://postnitro.ai/plans) — competitor pricing reference
- [AI carousel generator tools 2025](https://www.aicarousels.com/blog/best-ai-carousel-generator) — competitor feature landscape
- [Stripe webhook idempotency best practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) — idempotency patterns

### Tertiary (LOW confidence)
- [AI image pricing comparison 2026](https://intuitionlabs.ai/articles/ai-image-generation-pricing-google-openai) — cross-provider cost analysis (third-party, not Google official)
- [Imagen 3 safety filter sensitivity](https://discuss.google.dev/t/imagen-3-filter-sensitivity/173697) — Google Developer Forums, anecdotal reports; may differ for Imagen 4

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
