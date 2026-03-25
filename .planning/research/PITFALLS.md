# Pitfalls Research

**Domain:** SaaS monetization (Stripe subscriptions + credits) + AI image generation + caption gen for existing Next.js 15 / Supabase app
**Researched:** 2026-03-24
**Confidence:** HIGH (Stripe/Supabase patterns well-documented), MEDIUM (Google image gen ecosystem evolving rapidly)

## Critical Pitfalls

### Pitfall 1: Credit Deduction Race Conditions

**What goes wrong:**
Two concurrent requests (user clicks "generate" twice quickly, or opens two tabs) both read the credit balance as 5, both deduct 1, and write back 4. The user pays for one generation but gets two. At scale this drains the credit economy. The inverse is equally dangerous: a failed generation still deducts credits permanently.

**Why it happens:**
Supabase's JavaScript client (`supabase-js`) does not support transactions. Developers write `SELECT balance` then `UPDATE balance = balance - 1` as two separate calls, creating a classic TOCTOU (time-of-check-time-of-use) race condition.

**How to avoid:**
Use a Postgres RPC function that performs the check-and-deduct atomically. PostgREST automatically wraps RPC calls in a transaction:

```sql
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id uuid, p_amount int)
RETURNS boolean AS $$
DECLARE current_balance int;
BEGIN
  SELECT credits INTO current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;  -- Row-level lock prevents concurrent reads

  IF current_balance >= p_amount THEN
    UPDATE user_credits SET credits = credits - p_amount
    WHERE user_id = p_user_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Call via `supabase.rpc('deduct_credits', { p_user_id, p_amount })`. The `FOR UPDATE` lock serializes concurrent access to the same row.

**Warning signs:**
Credit balances go negative. Users report getting "free" generations. Audit log shows more generations than credits consumed.

**Phase to address:**
Credit system database schema phase. Must be baked into the initial schema, not bolted on later.

---

### Pitfall 2: Stripe Webhook Events Processed Multiple Times

**What goes wrong:**
Stripe retries webhook delivery if your endpoint returns non-2xx or times out (retries continue for up to 3 days). Without idempotency, the same `invoice.payment_succeeded` event grants credits twice, or `customer.subscription.deleted` fires twice and corrupts state.

**Why it happens:**
Developers return 200 only after completing all business logic. If the logic takes too long or partially fails, Stripe retries. The handler processes the event again from scratch.

**How to avoid:**
1. Store processed event IDs in a `stripe_events` table with a UNIQUE constraint on `event_id`.
2. Check if event ID exists before processing. If yes, return 200 immediately.
3. Return 200 to Stripe as fast as possible -- acknowledge receipt, then process.
4. Always use `stripe.webhooks.constructEvent()` for signature verification.

```sql
CREATE TABLE stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Warning signs:**
Users receive double credits after payment. Subscription status flips between active/cancelled. Stripe dashboard shows repeated delivery attempts for the same event.

**Phase to address:**
Stripe integration phase. The events table and idempotency check must be part of the initial webhook handler.

---

### Pitfall 3: Webhook Signature Verification Fails on Vercel / Next.js App Router

**What goes wrong:**
`stripe.webhooks.constructEvent()` throws "No signatures found matching the expected signature for payload." The webhook endpoint silently rejects all events from Stripe. Subscriptions never activate after payment.

**Why it happens:**
Next.js App Router can parse/consume the request body before the handler sees it. Stripe signature verification requires the raw request body bytes. If the body is parsed as JSON first, the signature will not match. This is the single most reported Stripe + Next.js issue.

**How to avoid:**
In your webhook route handler (`app/api/webhooks/stripe/route.ts`), read the raw body:

```typescript
export async function POST(request: Request) {
  const body = await request.text(); // RAW text, not .json()
  const signature = request.headers.get('stripe-signature')!;
  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  // ... handle event
}
```

Do NOT use `request.json()`. Ensure no global middleware intercepts and re-serializes the body on this route.

**Warning signs:**
Stripe dashboard shows all webhook deliveries failing with non-2xx. Users complete checkout but subscription status never updates in the app.

**Phase to address:**
Stripe integration phase. Test webhook delivery end-to-end on a deployed Vercel preview immediately -- do not defer.

---

### Pitfall 4: Supabase RLS Blocks Webhook-Originated Database Writes

**What goes wrong:**
Stripe webhooks hit the Next.js API route, which tries to update the user's subscription status or credit balance in Supabase. But the request has no authenticated user session -- it is server-to-server. If RLS policies require `auth.uid() = user_id`, the write silently fails or returns zero rows affected. No error is thrown.

**Why it happens:**
Developers set up RLS policies during the auth phase that restrict all writes to the authenticated user. Webhook handlers run without a Supabase auth context. The developer tests with the service role key locally but uses the anon key in production by mistake, or forgets to configure the service role key on Vercel.

**How to avoid:**
1. Use the Supabase **service role key** (not the anon key) for all webhook-originated database operations. This bypasses RLS.
2. Create a dedicated Supabase client for server-side admin operations: `createClient(url, SERVICE_ROLE_KEY)`.
3. NEVER expose the service role key to the client. Keep it in server-side environment variables only (`SUPABASE_SERVICE_ROLE_KEY`, no `NEXT_PUBLIC_` prefix).
4. Alternatively, use `SECURITY DEFINER` Postgres functions called via RPC that bypass RLS by design.

**Warning signs:**
Webhook handler returns 200 but database is not updated. Users pay but subscription status stays "free." Supabase logs show zero rows affected on UPDATE.

**Phase to address:**
Stripe integration phase. Establish the admin Supabase client pattern before writing any webhook handlers.

---

### Pitfall 5: Safety Filters Block Legitimate Image Prompts, User Gets Charged

**What goes wrong:**
Google's image generation models have aggressive content safety filters that reject prompts containing certain keywords or contexts even when the intent is benign. A user's credit gets deducted, but the API returns a filtered/blocked response instead of an image. The user sees a vague error and loses a credit.

**Why it happens:**
Developers deduct credits before calling the image generation API, or do not handle the "blocked by safety filter" response distinctly from other errors. Google's filters are documented as overly restrictive -- developers on Google forums report false positives on mundane prompts.

**How to avoid:**
1. Deduct credits AFTER successful image generation, not before. Use a "pending" state: reserve the credit, call the API, confirm or release based on result.
2. Or use the atomic RPC approach: deduct, call API, refund on failure, all tracked in a `generation_log` table.
3. Parse the API response for safety filter blocks specifically and show the user a clear message: "Your prompt was filtered by our image provider. Try different wording. No credits were charged."
4. Adjust `safetySetting` threshold if your use case allows it (Google provides "Block most", "Block some", "Block few" options).

**Warning signs:**
User complaints about "wasted credits." High rate of failed generations. Support tickets about vague error messages.

**Phase to address:**
AI image generation phase. The credit-deduction-on-failure path must be designed alongside the generation flow.

---

### Pitfall 6: Wrong Image Generation Model Choice -- Cost Confusion

**What goes wrong:**
The project spec says "Google Imagen" but the image generation landscape has shifted significantly as of early 2026. There are now multiple options through the same `@google/genai` SDK the project already uses: Imagen 3 Fast ($0.02/image), Imagen 4 (newest), Gemini 2.5 Flash Image / "Nano Banana" (~$0.039/image but 500 free images/day), and Gemini 3.x image models. Picking the wrong model means overpaying, hitting unexpected rate limits, or choosing a model that gets deprecated.

**Why it happens:**
Google's image generation ecosystem evolved rapidly in late 2025/early 2026. Documentation references multiple models. Developers pick one from a tutorial without comparing cost-per-image at their expected volume.

**How to avoid:**
Since the project already uses `@google/genai` SDK:
- For **cheapest per-image at scale**: Imagen 3 Fast at $0.02/image via `ai.models.generateImages()`.
- For **cheapest during development/low volume**: Gemini 2.5 Flash Image has 500 free images/day.
- For **highest quality**: Imagen 3 Standard at $0.04/image or Imagen 4.
- Avoid Vertex AI setup complexity -- the Gemini Developer API (same API key already in use) supports Imagen directly.
- Pin the model version string. Google deprecated and removed Imagen 1/2 entirely in September 2025.
- Abstract the model choice behind a service function so you can switch models without touching business logic.

**Warning signs:**
Unexpected Google Cloud bills. Model returning 404 errors after a deprecation deadline. Rate limit (429) errors in production.

**Phase to address:**
AI image generation phase. Decide on the specific model, pricing tier, and document the decision before writing integration code.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store subscription status only in Stripe, query on every page load | No DB sync needed | Slow page loads (200-500ms per Stripe API call), Stripe rate limits, no offline access to status | Never for a real product |
| Client-side credit balance checks only | Quick to implement | Trivially bypassable, race conditions | Never -- always enforce server-side |
| Hardcoded pricing/tier logic in frontend | Fast iteration | Every price change requires deploy, out of sync with Stripe | MVP only -- migrate to Stripe metadata + DB within 2 weeks |
| Single monolithic webhook handler function | Fewer files | Unmaintainable 500-line function, hard to debug specific event types | Never -- use event-type dispatch from day one |
| Skip the generation audit log | Faster initial build | Cannot debug credit disputes, cannot track costs, no usage analytics | Never -- log every generation attempt with status |
| Storing generated images as base64 in the database | Works immediately | DB bloat, slow queries, expensive storage | Never -- use Supabase Storage from the start |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe Checkout | Creating checkout session without `customer` param, so returning users get duplicate Stripe customers | Always look up or create a Stripe customer tied to the Supabase user ID first. Store `stripe_customer_id` in a `profiles` or `subscriptions` table. |
| Stripe Checkout | Using `payment` mode for recurring subscriptions | Use `mode: 'subscription'` for plans, `mode: 'payment'` for one-time credit pack purchases |
| Stripe Webhooks | Testing with Stripe CLI locally but never testing on deployed Vercel preview | Different webhook signing secret per environment. Register a separate webhook endpoint for preview deployments. |
| Stripe Customer Portal | Not configuring the portal in Stripe Dashboard before linking to it | Portal must be configured (allowed actions, branding) in Stripe Dashboard > Settings > Customer Portal before `createBillingPortalSession` will work |
| Google Imagen | Using deprecated `@google/generative-ai` package | Project already uses `@google/genai` (correct). Use `ai.models.generateImages()` for Imagen, `ai.models.generateContent()` for text. |
| Supabase + Stripe | Storing Stripe webhook secret in `.env.local` but forgetting to set it in Vercel env vars | Maintain an env var checklist: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Gemini API | Using the same API key without understanding separate rate limits for text vs images | Image generation has separate IPM (images per minute) quotas from text RPM quotas. Monitor both independently. |
| Stripe + Supabase | Creating the subscription record in DB on checkout.session.completed but not handling renewal/cancellation | Must also handle: `invoice.payment_succeeded` (renewal + credit reset), `invoice.payment_failed` (grace period), `customer.subscription.updated` (plan change), `customer.subscription.deleted` (cancellation) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Checking subscription status via Stripe API on every page load | Slow page transitions (200-500ms added) | Cache subscription status in Supabase `subscriptions` table, update only via webhooks | Immediately noticeable with >5 pages/session |
| Synchronous image generation in API route | Request times out (Vercel hobby: 10s limit, pro: 60s) | Return immediately with a generation ID, poll or use Supabase Realtime for completion | Imagen takes 3-15s per image; will timeout on Vercel hobby plan |
| No caching of generated images | Same image regenerated if user revisits project | Store generated images in Supabase Storage, reference by URL in project data | When users have >10 projects or revisit frequently |
| RLS policies with joins on every credit check | Slow credit balance lookups on every generation | Keep credit balance in a simple indexed column on the user's row, update atomically via RPC | Noticeable at >100 concurrent users |
| Loading full subscription object from Stripe to check tier | Unnecessary API call overhead + Stripe rate limits | Store `plan_id` and `status` locally, trust webhook updates | From day one -- unnecessary network call |
| Caption generation on every view instead of on-demand | Wastes Gemini API tokens, slow page load | Generate captions once when user clicks "Generate Captions", cache result with the project | Immediately -- each caption gen costs tokens |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Stripe secret key or Supabase service role key in client bundle | Full access to Stripe account or ability to bypass all RLS | Only use `NEXT_PUBLIC_` prefix for the Stripe publishable key and Supabase anon key. Audit imports in client components. |
| Not verifying Stripe webhook signatures | Anyone can POST fake events to grant themselves unlimited credits or Pro status | Always use `stripe.webhooks.constructEvent()` with the webhook signing secret |
| Credit balance checked client-side only before generation | Users bypass by calling the generation API directly | Server-side credit check + deduction in the same atomic RPC call |
| Using anon key for admin operations in API routes | RLS prevents webhook updates, or worse, devs loosen RLS to "fix" it (exposing all user data) | Separate admin client with service role key for server-to-server operations only |
| Storing generated images without user scoping in Storage | Users could enumerate and access other users' AI-generated images | Supabase Storage policies + user-scoped paths (`/{user_id}/generations/{image_id}.png`) |
| No rate limiting on the generation endpoint | A single user (or attacker) could drain your entire Imagen/Gemini API budget in minutes | Per-user rate limiting (e.g., max 10 generations/minute) enforced server-side, independent of credits |
| Stripe checkout session created without binding to authenticated user | Someone could complete checkout and credits go to wrong account or nowhere | Verify `auth.uid()` in the server action that creates the checkout session, pass Supabase user ID as `client_reference_id` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state during image generation (3-15 seconds) | User thinks app is broken, clicks generate again (potential double charge) | Show skeleton/shimmer with estimated time, disable the generate button immediately |
| Vague error on safety filter block | User thinks the app is broken, loses trust | Specific message: "This prompt was filtered by our image provider. Try rephrasing. No credits were charged." |
| No confirmation before credit-consuming actions | Accidental generations waste limited credits | "This will use 1 credit (3 remaining). Generate?" confirmation dialog |
| Subscription status stale after upgrade | User pays for Pro but still sees Free tier limits until page refresh | Use Supabase Realtime subscription on the `subscriptions` table, or `revalidatePath` after checkout redirect |
| Credit balance not visible during creation flow | User does not know how many credits remain | Always show credit balance in the editor header during generation workflows |
| No way to see generation history | User cannot find a previously generated image, cannot dispute credit charges | Generation log with thumbnails, accessible from dashboard |
| Caption output not copy-friendly | User has to manually select and copy text, loses formatting | One-click copy button per caption, preserve line breaks and hashtags |
| Plan comparison unclear before checkout | User does not understand what Pro gives them | Clear feature comparison table on pricing page with explicit limits per tier |

## "Looks Done But Isn't" Checklist

- [ ] **Stripe Subscriptions:** Often missing subscription *update* and *cancellation* webhook handling -- verify `customer.subscription.updated` and `customer.subscription.deleted` are handled, not just `checkout.session.completed`
- [ ] **Stripe Subscriptions:** Often missing failed payment renewal handling -- verify `invoice.payment_failed` triggers a grace period or downgrade, not silent continuation of Pro access
- [ ] **Credit System:** Often missing credit refund path -- verify that failed/filtered image generations return credits to the user
- [ ] **Credit System:** Often missing monthly credit reset -- verify credits reset on subscription renewal (triggered by `invoice.payment_succeeded` webhook), not on a calendar cron
- [ ] **Credit System:** Often missing credit pack + subscription interaction -- verify purchased credit packs do NOT reset when monthly subscription renews (only base allowance resets)
- [ ] **Customer Portal:** Often missing portal configuration -- verify Stripe Customer Portal is configured in Dashboard with cancellation, plan-change, and payment method update flows
- [ ] **Image Generation:** Often missing timeout handling -- verify that if Imagen takes >10s, the Vercel function does not silently timeout (use async pattern or Vercel Pro plan)
- [ ] **Image Generation:** Often missing image persistence -- verify generated images are saved to Supabase Storage, not just returned as base64 and lost on page navigation
- [ ] **Caption Generation:** Often missing platform-specific formatting -- verify captions include hashtags, appropriate line breaks, and respect character limits for TikTok vs Instagram
- [ ] **Environment Variables:** Often missing in deployment -- verify ALL keys are set in Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `GOOGLE_API_KEY` (or `GEMINI_API_KEY`)
- [ ] **Free Tier Limits:** Often missing enforcement -- verify free users cannot generate AI images at all (or have a small trial allowance) without the credit check being trivially bypassable

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Credit race conditions (double-spend) | LOW | Add the atomic RPC function, audit generation log vs credit ledger, manually refund affected users |
| Duplicate webhook processing | MEDIUM | Add events table + idempotency check, replay recent events from Stripe dashboard, reconcile subscription/credit states |
| Webhook signature verification broken in production | LOW | Fix raw body reading in route handler, re-test with Stripe CLI, replay failed events from Stripe dashboard |
| Wrong Imagen model chosen (overpaying) | LOW | Change model string in one place (if abstracted correctly), no data migration needed |
| Safety filter credits lost without refund | MEDIUM | Add refund-on-filter logic, audit generation log for filtered results, issue manual credit adjustments |
| RLS blocking webhook writes | LOW | Switch to service role client in webhook handler, replay failed webhooks from Stripe |
| Vercel function timeout on image generation | MEDIUM | Restructure to async pattern (return job ID, poll for result) -- requires both API and UI changes |
| Subscription status not updating in UI | LOW | Add Supabase Realtime listener or revalidation on checkout return, one-time fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Credit race conditions | Database schema / credit system | Concurrent test: two simultaneous deductions on balance of 1 -- only one succeeds |
| Duplicate webhook processing | Stripe webhook integration | Send same test event twice via Stripe CLI -- verify only one DB mutation |
| Webhook signature failure | Stripe webhook integration | Deploy to Vercel preview, trigger test checkout, verify webhook received and processed |
| RLS blocking webhooks | Stripe webhook integration | Webhook handler updates a real row, check Supabase logs for RLS denials |
| Model choice / billing surprise | AI image generation planning (before coding) | Document model, price-per-image, rate limits in decision log |
| Safety filter credit loss | AI image generation + credit system | Test with prompts known to trigger filters, verify zero credit deduction |
| Vercel function timeout | AI image generation | Test with slowest model option on Vercel deployment, verify completion |
| Stale subscription status | Frontend after Stripe integration | Complete test checkout, verify UI updates without manual page refresh |
| Monthly credit reset | Credit system + webhook handling | Simulate `invoice.payment_succeeded` renewal event, verify credits reset to plan allowance |
| Credit pack vs subscription credits | Credit system schema design | Purchase a credit pack, then trigger subscription renewal -- verify pack credits survive |

## Sources

- [Supabase: Handling Stripe Webhooks](https://supabase.com/docs/guides/functions/examples/stripe-webhooks)
- [Supabase: RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase: Row Level Security](https://supabase.com/docs/reference/javascript/v1/rpc)
- [Stripe: Receive events in your webhook endpoint](https://docs.stripe.com/webhooks)
- [Stripe webhook idempotency best practices (Stigg)](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Stripe + Next.js 15 complete guide (Pedro Alonso)](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/)
- [Transactions and RLS in Supabase Edge Functions (Marmelab)](https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html)
- [Data Integrity with Supabase SQL Transactions (DEV Community)](https://dev.to/damasosanoja/data-integrity-first-mastering-transactions-in-supabase-sql-for-reliable-applications-2dbb)
- [Imagen 3 safety filter sensitivity (Google Developer Forums)](https://discuss.google.dev/t/imagen-3-filter-sensitivity/173697)
- [Google: Configure Responsible AI safety settings for Imagen](https://cloud.google.com/vertex-ai/generative-ai/docs/image/configure-responsible-ai-safety-settings)
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini image generation docs (Imagen via Gemini API)](https://ai.google.dev/gemini-api/docs/imagen)
- [@google/genai SDK (npm)](https://www.npmjs.com/package/@google/genai)
- [Stripe integration for Next.js 15 with Supabase (DEV Community)](https://dev.to/flnzba/33-stripe-integration-guide-for-nextjs-15-with-supabase-13b5)
- [Gemini image generation free tier and pricing (2026)](https://www.aifreeapi.com/en/posts/gemini-image-generation-free-api)
- [Vercel + Stripe webhook issues (GitHub)](https://github.com/vercel/nextjs-subscription-payments/issues/240)
- [next-supabase-stripe-starter (GitHub)](https://github.com/KolbySisk/next-supabase-stripe-starter)

---
*Pitfalls research for: TikTok Slideshow Creator v1.1 -- Monetization and AI Images*
*Researched: 2026-03-24*
