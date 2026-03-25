# Feature Research

**Domain:** AI carousel creator SaaS -- v1.1 monetization, AI image generation, credit system, captions
**Researched:** 2026-03-24
**Confidence:** MEDIUM-HIGH

## Feature Landscape

This research focuses exclusively on the v1.1 milestone features: Google Imagen integration, Stripe subscriptions with credits, and social media caption generation. Existing v1.0 features (editor, templates, Pexels, brand kit, rendering, auth) are already built and working.

### Table Stakes (Users Expect These)

Features users assume exist once you introduce paid tiers. Missing these = broken monetization or confused users.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Free tier with usage limits | Every SaaS creator tool (PostNitro, Canva) offers a free plan. No free tier = no funnel. | LOW | Limit by project count or AI generations per month. No watermarks (per PROJECT.md). |
| Stripe Checkout for subscriptions | Standard payment flow. Users expect redirect-to-Stripe or embedded checkout, not custom payment forms. | MEDIUM | Use Stripe Checkout (hosted) -- simplest path, handles tax and card management automatically. |
| Subscription management (upgrade/downgrade/cancel) | Users expect to manage their plan without contacting support. | LOW | Stripe Customer Portal handles this entirely. Just link from existing settings page. |
| Credit balance display | When credits exist, users must see remaining balance at all times. | LOW | Show in top navbar. Update after each generation. |
| Credit deduction on AI actions | Credits must be deducted atomically when AI image generation runs. | MEDIUM | Database transaction: check balance -> deduct -> call API. Never call API first (race condition). |
| AI-generated image as slide background | The core premium feature. User gets AI background image for a slide. | MEDIUM | Imagen 4 Fast at $0.02/image. Returns 1024x1024 -- needs resize/crop to 1080x1920 (9:16). Integrate into existing slide editor. |
| Clear upgrade prompts at limits | When free users hit limits, show what they get by upgrading. Not just "limit reached." | LOW | Modal with plan comparison. Contextual -- trigger during the blocked action. |
| Webhook-driven subscription sync | Stripe webhooks must update DB subscription status. Cannot rely on polling. | MEDIUM | Handle: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed. |
| Social media captions for posts | Every competitor (PostNitro, Canva, Hootsuite) generates captions alongside content. | LOW | Use existing Gemini 2.5 Flash. Platform-specific output for TikTok, Instagram, LinkedIn. |
| Usage history / credit ledger | Users need to see what consumed their credits. Transparency builds trust. | MEDIUM | Credit transaction log: date, action, credits used, balance. Reduces support burden. |

### Differentiators (Competitive Advantage)

Features that set the product apart from PostNitro, Canva, and generic carousel tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Context-aware AI backgrounds | Auto-generate Imagen prompts from slide content (hook_text + body_text), not manual prompts. | LOW | Pipe slide data into Gemini to craft an Imagen prompt. Competitors require manual prompting. Genuine time-saver. |
| One-click "upgrade slide" button | Free users see Pexels backgrounds; single button swaps any slide to AI-generated background. Low-friction upsell. | LOW | Shows Imagen value directly in the editor. Better conversion than abstract "upgrade plan" page. |
| Multi-platform caption variants | Generate TikTok, Instagram, AND LinkedIn captions simultaneously with platform-specific tone and hashtags. | LOW | Most tools generate one caption. Three platform variants from one carousel saves real time for cross-posting creators. |
| Carousel-aware captions | Captions reference actual slide content (hooks, key points, CTA) rather than generic topic text. | LOW | Feed full CarouselSchema slide_data into caption prompt. Competitors generate from topic only. |
| Credit pack top-ups | Beyond monthly credits, let users buy extra without changing plans. | MEDIUM | Stripe one-time payment -> credit grant. Addresses usage spikes. Hybrid model is industry best practice for AI tools. |
| Prompt preview before generation | Show auto-generated Imagen prompt, let users tweak before spending a credit. | LOW | Reduces wasted credits. Builds trust. Differentiates from black-box competitors. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Credit rollover across months | Feels fair to users | Complicates billing logic, creates balance sheet liability, users hoard and churn anyway. | Credits expire at billing cycle reset. Generous monthly allowance instead. |
| Multiple AI image providers | "More options = better" | Each provider has different APIs, pricing, quality, content policies. Multiplies maintenance burden. | Imagen 4 only. One provider, well-integrated. Switch entirely later if needed. |
| Auto-posting to TikTok/Instagram | Saves upload step | Complex OAuth, frequent platform API changes, TikTok API is restrictive, moderation risk. Massive scope. | Copy-to-clipboard captions + download images. Per PROJECT.md, defer to v2+. |
| Free AI image generations (ongoing) | Lower barrier | Imagen costs real money ($0.02+/generation). Free AI images = cost exposure with no revenue. Pexels is already free for everyone. | Free tier = Pexels only. Offer 2-3 trial Imagen generations on signup, not ongoing. |
| Real-time credit balance via WebSocket | Instant updates | Over-engineered. Credits change on explicit user actions (generate), not ambient events. | Refetch balance after each API call. Simple GET request. |
| Granular per-feature credit costs | Different costs for different AI actions | Confuses users. "How much does X cost?" should have one answer. | Flat: 1 credit = 1 AI image. Captions are nearly free (Gemini text) -- bundle unlimited with Pro. |
| Annual billing at launch | Standard SaaS practice | Adds credit granting complexity (monthly vs annual), refund edge cases, proration math. Not needed at current scale. | Monthly only. Add annual after validating pricing and understanding churn. |
| Imagen image editing (inpainting/outpainting) | Advanced users want it | Significant UX complexity. Editor already has Pexels swap + upload. Editing AI images is a rabbit hole. | Generate-only for v1.1. Full image editing is a v2+ consideration. |

## Feature Dependencies

```
[Stripe Integration]
    |-- requires --> [Stripe Customer creation + webhook endpoints]
    |-- requires --> [Subscription tiers in DB schema]
    |-- enables --> [Credit System]
                        |-- requires --> [Credit ledger DB tables]
                        |-- enables --> [AI Image Generation (gated)]
                        |                    |-- requires --> [Google Cloud / Vertex AI Imagen setup]
                        |                    |-- requires --> [Image prompt builder via Gemini]
                        |                    |-- integrates with --> [Existing slide editor]
                        |-- enables --> [Credit Pack Purchases]
                                             |-- requires --> [Stripe one-time payment flow]

[Caption Generation]
    |-- requires --> [Existing Gemini 2.5 Flash]
    |-- requires --> [Existing CarouselSchema slide_data]
    |-- independent of --> [Stripe / Credits] (recommended: captions are free/unlimited)
```

### Dependency Notes

- **Credit System requires Stripe Subscriptions:** Credits are granted by subscription tier. Must know plan before granting.
- **AI Image Generation requires Credit System:** Must deduct credits before calling Imagen. Without credits = no cost control.
- **Imagen requires separate Google Cloud setup:** Gemini uses API key; Vertex AI Imagen uses service account + project ID. Different auth model.
- **Caption Generation is nearly independent:** Uses existing Gemini 2.5 Flash. No Stripe dependency if captions are free/unlimited (recommended -- text gen costs ~$0.001).
- **Caption Generation can ship first:** Zero dependency on payments infrastructure. Could be added immediately as free-tier value-add.

## MVP Definition

### Launch With (v1.1)

Minimum to monetize and justify a premium tier.

- [ ] Stripe subscription integration (Free / Pro) -- the revenue foundation
- [ ] Credit system with monthly allowance on Pro -- gates premium features
- [ ] Google Imagen AI background generation in slide editor -- the premium value prop
- [ ] Credit balance display in UI (navbar) -- users must see what they have
- [ ] Stripe Customer Portal for plan management -- self-service, zero custom UI
- [ ] Webhook handlers for subscription lifecycle events -- keeps DB in sync
- [ ] Social media caption generation (TikTok, Instagram, LinkedIn) -- low-cost, high-value
- [ ] Free tier usage limits (e.g., 3 projects, 5 AI text generations/month) -- upgrade pressure
- [ ] Upgrade prompts when limits hit -- contextual, not naggy

### Add After Validation (v1.x)

Add once paying users exist and patterns emerge.

- [ ] Credit pack top-up purchases -- when users request more credits than plan allows
- [ ] Usage history / credit ledger page -- when "where did my credits go" tickets appear
- [ ] Prompt preview/edit before Imagen generation -- after seeing wasted-generation complaints
- [ ] Multiple caption tone options (professional, casual, viral) -- based on feedback

### Future Consideration (v2+)

- [ ] Annual billing -- after monthly pricing validates and churn patterns emerge
- [ ] Team/agency plans with shared pools -- different product category
- [ ] Auto-posting to social platforms -- per PROJECT.md, defer
- [ ] Imagen editing (inpainting) -- significant UX scope

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Stripe subscriptions (Free/Pro) | HIGH | MEDIUM | P1 |
| Credit system + balance display | HIGH | MEDIUM | P1 |
| Imagen AI background generation | HIGH | MEDIUM | P1 |
| Webhook subscription sync | HIGH | MEDIUM | P1 |
| Stripe Customer Portal link | HIGH | LOW | P1 |
| Free tier usage limits | HIGH | LOW | P1 |
| Social media captions (multi-platform) | MEDIUM | LOW | P1 |
| Upgrade prompts at limits | MEDIUM | LOW | P1 |
| Credit pack top-ups | MEDIUM | MEDIUM | P2 |
| Usage history page | MEDIUM | LOW | P2 |
| Prompt preview before generation | LOW | LOW | P2 |
| Caption tone variants | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add when usage data supports
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | PostNitro | Canva | Our Approach |
|---------|-----------|-------|--------------|
| AI image backgrounds | Up to 100/month on $40 plan | Via Magic Media (separate tool) | Imagen 4 Fast in editor, context-aware auto-prompts from slide content |
| Pricing | Free / $10 / $20 / $40/mo | Free / $13/mo Pro | Free / Pro ~$12-15/mo. Simple 2-tier. |
| Credit system | Opaque limits, upgrade nags after few uses | Token-based for AI features | Transparent balance, visible ledger, clear per-action cost |
| Caption generation | Basic, topic-only | AI caption generator (separate) | Integrated -- captions reference actual slide hooks/CTAs |
| Platform focus | Instagram, LinkedIn, Twitter | All formats | TikTok + Instagram primary, LinkedIn bonus |
| Free tier limits | Poorly communicated | Generous with AI caps | Clear: X projects, Y AI gens/month. Pexels always free. |
| Plan management | Standard | Canva account settings | Stripe Customer Portal -- proven, zero custom UI |

## Pricing Model Recommendation

Based on competitor analysis and cost structure:

**Cost per AI image:** $0.02 (Imagen 4 Fast) + ~$0.001 (Gemini prompt building) = ~$0.021

**Pro tier:** ~$12-15/month with 50-100 AI image credits
- At 100 credits used: $2.10 cost, ~$10-13 margin per user
- Healthy margin even at full utilization

**Credit pack:** ~$5 for 25 credits ($0.20/credit to user, $0.021 cost = ~90% margin)

**Captions:** ~$0.001 per caption via Gemini 2.5 Flash. Negligible cost. Bundle unlimited with Pro.

## Database Schema Implications

Current schema has only `projects` table. v1.1 needs new tables:

- **subscriptions** -- user_id, stripe_customer_id, stripe_subscription_id, plan_tier, status, current_period_start, current_period_end
- **credits** -- user_id, balance, monthly_allowance, last_reset_at
- **credit_transactions** -- id, user_id, amount, type (grant/deduct/purchase), description, created_at
- **stripe_customer_id** mapping -- either new table or column on user profiles

## Sources

- [Imagen 4 pricing and API access](https://magichour.ai/blog/imagen-4-pricing-and-api) -- model tiers and per-image costs
- [AI image pricing comparison](https://intuitionlabs.ai/articles/ai-image-generation-pricing-google-openai) -- Imagen vs alternatives
- [Vertex AI Imagen API reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api) -- official Google docs
- [Stripe SaaS subscription docs](https://docs.stripe.com/get-started/use-cases/saas-subscriptions) -- official patterns
- [Stripe SaaS credits billing integration](https://colorwhistle.com/stripe-saas-credits-billing/) -- credit system architecture
- [Credit system in subscription model](https://flexprice.io/blog/how-to-implement-credit-system-in-subscription-model) -- ledger design
- [Next.js Stripe credit system](https://medium.com/@jsteinb/nextjs-using-stripe-to-build-a-credit-system-for-your-saas-app-3562e1608c25) -- implementation guide
- [Vercel Next.js subscription payments template](https://github.com/vercel/nextjs-subscription-payments) -- reference implementation
- [PostNitro pricing plans](https://postnitro.ai/plans) -- competitor pricing
- [PostNitro features review](https://coldiq.com/tools/postnitro) -- competitor feature analysis
- [AI carousel generator tools 2025](https://www.aicarousels.com/blog/best-ai-carousel-generator) -- competitor landscape
- [Best AI social media caption generators 2026](https://www.freelancecreatorai.com/2026/01/best-ai-tools-for-social-media-captions.html) -- caption tool landscape

---
*Feature research for: TikTok carousel creator SaaS -- v1.1 monetization and AI features*
*Researched: 2026-03-24*
