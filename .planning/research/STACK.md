# Stack Research: v1.1 Monetization & AI Images

**Domain:** SaaS monetization (payments, credits, AI image generation)
**Researched:** 2026-03-24
**Confidence:** HIGH

> **Scope:** This document covers ONLY the new stack additions for v1.1.
> The existing stack (Next.js 15, React 19, Supabase, Gemini 2.5 Flash, Pexels, node-html-to-image, dnd-kit, Tailwind 4, shadcn/ui) is validated and unchanged.

## Recommended Stack Additions

### AI Image Generation -- Imagen 4 Fast

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Imagen 4 Fast (`imagen-4.0-fast-generate-001`) | Current | AI-generated slide backgrounds | $0.02/image, supports 9:16 natively, uses existing `@google/genai` SDK -- zero new dependencies. Fast variant is purpose-built for content previews and social media imagery. |

**No new packages needed.** The existing `@google/genai` (^1.46.0) SDK already supports `ai.models.generateImages()` for Imagen. This is the same SDK used for Gemini 2.5 Flash text generation.

**Why Imagen 4 Fast over other options:**
- Imagen 4 Standard ($0.04/image) -- 2x cost for quality improvement not needed at social-media resolution
- Imagen 4 Ultra ($0.06/image) -- overkill for 1080x1920 slide backgrounds
- Gemini 3.1 Flash native image gen ($0.039/image) -- more expensive than Imagen 4 Fast, optimized for text+image mixed output not pure image gen
- DALL-E 3 ($0.04-0.08/image) -- different ecosystem, higher cost, requires separate SDK
- Stable Diffusion (self-hosted) -- GPU infrastructure overhead, opposite of the "keep it simple" approach

**Key API details:**
```typescript
// Uses the SAME GoogleGenAI instance already in the codebase
const response = await ai.models.generateImages({
  model: 'imagen-4.0-fast-generate-001',
  prompt: 'descriptive prompt here',
  config: {
    numberOfImages: 1,
    aspectRatio: '9:16',  // Native support -- critical for carousel slides
  },
});
// Returns base64 image bytes in response.generatedImages[0].image.imageBytes
```

**Constraints to know:**
- Max 480 tokens per prompt
- 1-4 images per request (use 1 for cost control)
- 1K resolution (1024px longest side) by default -- sufficient for 1080x1920 slides
- SynthID watermark embedded automatically (invisible, no visual impact)
- `personGeneration` defaults to `allow_adult` -- good default for social content
- Aspect ratio `9:16` is explicitly supported -- perfect match for TikTok/IG carousel slides

### Payments & Subscriptions -- Stripe

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `stripe` (Node.js SDK) | ^20.4.1 | Server-side Stripe API (checkout, subscriptions, webhooks) | Industry standard, TypeScript-first, works with Next.js Server Actions. Handles subscriptions, one-time payments (credit packs), and customer portal. |
| `@stripe/stripe-js` | ^8.11.0 | Client-side Stripe.js loader | Required for Stripe Checkout redirect. Lightweight loader (~3KB), not a full client SDK. |

**Integration pattern -- Server Actions first, Route Handler for webhooks only:**

Server Actions replace API routes for checkout session creation (modern Next.js 15 pattern):
```typescript
'use server'
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createCheckoutSession(priceId: string, userId: string) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', // or 'payment' for credit packs
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    metadata: { userId },
  })
  return session.url
}
```

Webhooks still need a Route Handler (Stripe needs a stable POST URL):
```
src/app/api/webhooks/stripe/route.ts
```

**Stripe Customer Portal:** Use Stripe's hosted portal for plan changes, cancellations, payment method updates. No custom UI needed. Create a portal session server-side, redirect the user.

### Credit System -- Database Only (No New Packages)

Credit tracking lives entirely in Supabase (Postgres) with RLS policies. No new packages needed.

**Schema design:**
```sql
-- Subscription tracking (synced from Stripe webhooks)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'canceled' | 'past_due'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit balance (fast reads for generation gate)
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  monthly_allowance INTEGER NOT NULL DEFAULT 3,  -- free: 3, pro: 100
  last_refill_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credit transaction log (audit trail)
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount INTEGER NOT NULL,  -- positive = add, negative = consume
  type TEXT NOT NULL,  -- 'monthly_refill' | 'pack_purchase' | 'imagen_generation' | 'caption_generation'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Why a ledger pattern:** Single `balance` column for fast reads (check before generation), plus `credit_transactions` for audit trail and debugging. The balance column is the source of truth for gating; the transaction log is for analytics and disputes.

**Credit refill strategy:** Stripe `invoice.paid` webhook triggers monthly refill. When the webhook fires for a subscription renewal, reset `balance` to `monthly_allowance` and log a `monthly_refill` transaction. No cron job needed.

### AI Caption Generation -- No New Packages

Uses existing Gemini 2.5 Flash via `@google/genai`. Captions are text generation -- the same capability already powering slide content in `src/lib/ai/generate-slides.ts`.

**Cost:** ~$0.001 per caption. Negligible.

**Implementation:** Add a new function alongside `generateSlideContent()` in `src/lib/ai/` that takes carousel slide content as input and returns platform-specific captions (TikTok, Instagram). Use structured output (JSON schema) same as existing slide generation.

## Installation

```bash
# New dependencies -- ONLY 2 packages
npm install stripe @stripe/stripe-js

# That's it.
# @google/genai already installed for Imagen access.
# Gemini 2.5 Flash already configured for caption generation.
# Supabase already installed for credit tables.
# Zod already installed for webhook validation.
```

## Environment Variables (New)

```env
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...   # Monthly Pro subscription
STRIPE_CREDIT_PACK_PRICE_ID=price_...   # One-time credit pack purchase
```

No new env vars needed for Imagen -- it uses the existing `GEMINI_API_KEY`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Imagen 4 Fast ($0.02/img) | Imagen 4 Standard ($0.04/img) | If users complain about image quality -- upgrade path is a single string change |
| Imagen 4 Fast ($0.02/img) | Gemini 3.1 Flash native image gen ($0.039/img) | If you need text rendered inside images or image editing capabilities |
| Stripe Checkout (hosted) | Stripe Elements (embedded) | If you need a fully custom payment form -- adds `@stripe/react-stripe-js` |
| Stripe Checkout (hosted) | Lemon Squeezy | If you want merchant-of-record to handle tax compliance. Tradeoff: less control, smaller ecosystem |
| Simple balance + transaction log | Full double-entry ledger | If you need accounting-grade audit trails. Overkill for a creator tool. |
| Webhook-triggered credit refills | Supabase Edge Function cron | If webhook reliability is a concern. Cron can run daily and check/refill expired periods. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@stripe/react-stripe-js` | Unnecessary for Checkout-based flow. Adds React provider, Elements wrapper, hooks -- all unneeded when Stripe hosts the payment page. | `@stripe/stripe-js` for redirect to Stripe Checkout |
| Separate OpenAI SDK for DALL-E | Different ecosystem, higher cost ($0.04-0.08/img), second API key to manage | Imagen via existing `@google/genai` SDK |
| Custom payment form UI | PCI compliance burden, lower conversion than Stripe Checkout | Stripe Checkout hosted page |
| Redis for credit balance caching | Premature optimization. Postgres single-row primary-key lookup is <5ms on Supabase. | Direct Supabase query with RLS |
| Paddle / PayPal | Paddle has poor DX; PayPal adds complexity. Neither provides value over Stripe here. | Stripe only |
| `next-stripe` or wrapper libraries | Thin wrappers that go stale and obscure the API. Stripe's own SDK is excellent. | `stripe` package directly |
| Prisma for credit queries | Already using Supabase client SDK. Adding Prisma for 3 tables is over-engineering. | `supabase.from('credits').select(...)` |
| External cron service for credit refills | Extra infrastructure. Stripe webhooks already fire on subscription renewal. | `invoice.paid` webhook handler |

## Stack Patterns

**If credit check needs to be fast (pre-generation gate):**
- Use `SELECT balance FROM credits WHERE user_id = $1` before every Imagen call
- Primary-key lookup -- sub-millisecond on Supabase
- Deduct in a transaction: check balance >= 1, then decrement and log, in one RPC call

**If you later need real-time credit display:**
- Use Supabase Realtime subscription on the `credits` table
- Already available via `@supabase/supabase-js` -- no new packages

**If Imagen quality is insufficient:**
- Swap `imagen-4.0-fast-generate-001` to `imagen-4.0-generate-001` (Standard)
- Single string change, same API, same SDK
- Cost doubles ($0.02 to $0.04/image)

**If you need to test Stripe locally:**
- Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- No additional npm packages needed

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `stripe@^20.4.1` | Node.js 18+ | TypeScript types included, no `@types/stripe` needed |
| `@stripe/stripe-js@^8.11.0` | Any modern browser | Loads Stripe.js from CDN, tiny bundle impact |
| `@google/genai@^1.46.0` | Imagen 4 models | Already installed; `generateImages()` method available |
| Next.js 15.5.13 | `stripe@20.x` | Server Actions for checkout; Route Handler for webhooks |

## Cost Model Per Generation

| Action | Your Cost | Credits Charged | Notes |
|--------|-----------|-----------------|-------|
| AI slide content (Gemini Flash) | ~$0.001 | 0 | Included in all tiers |
| Pexels stock photo | $0.00 | 0 | Free API |
| Imagen slide background (Fast) | $0.02 | 1 credit | Premium feature |
| AI caption generation (Gemini Flash) | ~$0.001 | 1 credit | Or 0 -- design decision |
| Server-side image render | ~$0.00 | 0 | Compute only |

**Margin analysis:** Pro at $9.99/month with 100 Imagen credits: worst-case COGS = 100 x $0.02 = $2.00. That is 80% gross margin. Credit packs at $4.99 for 50 credits ($0.10/credit to user, $0.02 cost) yield 80% margin too. The unit economics work well.

## Sources

- [Google Imagen API docs](https://ai.google.dev/gemini-api/docs/imagen) -- model names, API params, aspect ratios, JS code examples (HIGH confidence)
- [Google Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) -- native Gemini image gen comparison (HIGH confidence)
- [Imagen 4 Fast announcement](https://developers.googleblog.com/announcing-imagen-4-fast-and-imagen-4-family-generally-available-in-the-gemini-api/) -- pricing, model variants (HIGH confidence)
- [AI Image Pricing Comparison 2026](https://intuitionlabs.ai/articles/ai-image-generation-pricing-google-openai) -- cross-provider cost analysis (MEDIUM confidence)
- [Stripe + Next.js 15 guide](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) -- Server Actions pattern (MEDIUM confidence)
- [Stripe subscription lifecycle 2026](https://dev.to/thekarlesi/stripe-subscription-lifecycle-in-nextjs-the-complete-developer-guide-2026-4l9d) -- webhook + customer portal patterns (MEDIUM confidence)
- [Stripe + Next.js 15 + Supabase guide](https://dev.to/flnzba/33-stripe-integration-guide-for-nextjs-15-with-supabase-13b5) -- Supabase-specific integration (MEDIUM confidence)
- [stripe npm](https://www.npmjs.com/package/stripe) -- version 20.4.1 (HIGH confidence)
- [@stripe/stripe-js npm](https://www.npmjs.com/package/@stripe/stripe-js) -- version 8.11.0 (HIGH confidence)

---
*Stack research for: TikTok Slideshow Creator v1.1 -- Monetization & AI Images*
*Researched: 2026-03-24*
