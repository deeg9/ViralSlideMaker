# Phase 5: Credit Ledger & Usage Limits - Research

**Researched:** 2026-03-25
**Domain:** Credit system database schema, atomic deductions, usage tracking, free tier gating
**Confidence:** HIGH

## Summary

Phase 5 replaces the current naive project-counting credit system with a proper credit ledger backed by Postgres tables and RPC functions. The existing `check-credits.ts` reads subscription tier from `user_metadata` (client-writable, spoofable) and counts projects as "credits used" -- this cannot support multiple credit types, purchased credit packs, or atomic deductions. The replacement uses three new database tables (`subscriptions`, `credit_transactions`, `stripe_events`), two Postgres RPC functions (`get_credit_balance`, `deduct_credits`), and a rewritten `lib/credits/` module.

This phase has zero external dependencies (no new npm packages, no Stripe integration, no AI services). It is pure database schema + TypeScript service code + UI wiring. The credit balance display goes in the top navbar, and a credit history page shows the transaction log. Free tier limits on project count and AI text generations per month are enforced server-side through the new credit system.

**Primary recommendation:** Build the database schema and atomic RPC functions first, then rewrite `lib/credits/check-credits.ts` to use them, then wire the UI (navbar balance, history page, free tier gates). The RPC atomicity is the single most important design decision -- get it right here and every downstream phase (Stripe, Imagen) inherits correct behavior.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRED-01 | Pro users receive monthly credit allowance at billing cycle start | `subscription_grant` transaction type in `credit_transactions` table; for now, manual/seed grant since Stripe webhooks come in Phase 6 |
| CRED-02 | Credit balance displays in top navbar, updates after each generation | `get_credit_balance` RPC + `CreditDisplay` component in top navbar; refetch via `revalidatePath` after server action |
| CRED-03 | Credits deduct atomically via Postgres RPC before AI operations | `deduct_credits` RPC with `FOR UPDATE` row lock; called from `generateCarousel` server action |
| CRED-05 | User can view credit usage history (transaction log with date, action, amount) | `credit_transactions` table with RLS SELECT policy; new `/settings/credits` page |
| STRIPE-04 | Free tier users have usage limits (project count, AI text generations per month) | Free tier gets limited `subscription_grant` credits; `checkCredits()` gates generation; project count limit enforced at creation time |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No CLAUDE.md exists in the project root. Constraints derived from project conventions observed in codebase:

- **Framework:** Next.js 15 App Router with Turbopack, React 19, TypeScript
- **Database:** Supabase (Postgres) with `@supabase/ssr` for server client creation
- **Styling:** Tailwind 4, shadcn/ui components, project color palette (#3d0000, #fadbdb, #fff0f0, #7d6161, #dbc1bc)
- **Server patterns:** Server Actions for mutations, Server Components for data fetching
- **Testing:** Vitest with jsdom, `@testing-library/react`, tests in `src/__tests__/`
- **Env var naming:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `ANON_KEY`) -- follow existing convention
- **Migrations:** SQL files in `supabase/migrations/` with numeric prefix (002, 003, 004 exist)
- **No service role client exists yet** -- must be created for this phase

## Standard Stack

### Core (No New Packages)

This phase requires zero new npm packages. Everything uses the existing stack:

| Library | Version | Purpose | Already Installed |
|---------|---------|---------|-------------------|
| `@supabase/supabase-js` | ^2.99.3 | Database queries, RPC calls | Yes |
| `@supabase/ssr` | ^0.9.0 | Server-side Supabase client | Yes |
| Next.js | 15.5.13 | Server Actions, Server Components | Yes |
| Vitest | ^4.1.0 | Unit tests for credit logic | Yes |

### New Internal Modules

| Module | Purpose |
|--------|---------|
| `src/lib/supabase/admin.ts` | Service role Supabase client (bypasses RLS for server-side admin ops) |
| `src/lib/credits/check-credits.ts` | Full rewrite -- ledger-based credit checking |
| `src/lib/credits/types.ts` | Credit action types, tier config |
| `src/components/subscription/credit-display.tsx` | Navbar credit balance badge |
| `src/app/(dashboard)/settings/credits/page.tsx` | Credit usage history page |

## Architecture Patterns

### Recommended Project Structure (Changes Only)

```
src/
  lib/
    supabase/
      admin.ts                    # NEW -- service role client
    credits/
      check-credits.ts            # REWRITE -- ledger-based
      types.ts                    # NEW -- types and tier config
  components/
    subscription/
      credit-display.tsx          # NEW -- navbar badge
  app/
    (dashboard)/
      settings/
        credits/
          page.tsx                # NEW -- usage history
supabase/
  migrations/
    005_credit_system.sql         # NEW -- tables, RPC, RLS, indexes
```

### Pattern 1: Atomic Credit Deduction via Postgres RPC

**What:** A single Postgres function that checks balance and deducts in one atomic operation with a row-level lock to prevent concurrent double-spend.

**When to use:** Every time credits are consumed (carousel generation now, Imagen generation in Phase 7).

**Why critical:** Supabase JS client does not support transactions. Separate SELECT + UPDATE calls create a TOCTOU race condition. The `FOR UPDATE` lock serializes concurrent access.

**Implementation:**

```sql
-- Atomic deduct: returns true if deduction succeeded, false if insufficient
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Calculate balance with row-level lock on all user's transactions
  SELECT COALESCE(SUM(amount), 0) INTO current_balance
  FROM public.credit_transactions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF current_balance >= p_amount THEN
    INSERT INTO public.credit_transactions (user_id, type, amount, description, reference_id)
    VALUES (p_user_id, p_type, -p_amount, p_description, p_reference_id);
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Call from TypeScript:**
```typescript
const { data: success } = await supabaseAdmin.rpc('deduct_credits', {
  p_user_id: userId,
  p_amount: 1,
  p_type: 'carousel_generation',
  p_description: 'Carousel generation',
  p_reference_id: projectId,
})
```

### Pattern 2: Service Role Client for Admin Operations

**What:** A separate Supabase client using the service role key that bypasses RLS. Used for operations where there is no user session (webhook handlers in Phase 6) or where RLS policies would block necessary writes (credit grants).

**When to use:** Credit grants, admin adjustments, and any server-side operation that writes to tables with restrictive RLS.

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

**Important:** The `SUPABASE_SERVICE_ROLE_KEY` env var must NOT have `NEXT_PUBLIC_` prefix. It must never reach the client bundle.

### Pattern 3: Credit Balance via SUM Aggregation

**What:** Credit balance is calculated as `SUM(amount)` over all `credit_transactions` for a user. Positive amounts are grants, negative amounts are deductions.

**Why not a balance column:** A separate `balance` column creates a synchronization problem -- if the column and the transaction log disagree, which is correct? The SUM approach is the single source of truth. At the current scale (< 1k users), this is fast with an index on `(user_id)`.

```sql
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM public.credit_transactions
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

### Pattern 4: Free Tier Limits via Credit Grants

**What:** Instead of hardcoding project count limits, free tier users receive a limited number of credits at account creation. This unifies the gating mechanism -- everything goes through the credit ledger.

- Free tier: 5 credits/month (carousel generations)
- Pro tier: 30+ credits/month (set by Stripe webhook in Phase 6)

For Phase 5, the initial credit grant happens when a `subscriptions` row is created for a new user (seeded on first login or via a database trigger).

### Anti-Patterns to Avoid

- **Reading tier from `user_metadata`:** The current code at `check-credits.ts:22` reads `user?.user_metadata?.subscription_tier`. This is client-writable via `supabase.auth.updateUser()`. Replace with a `subscriptions` table query.
- **Counting projects as credit usage:** The current code counts non-draft projects created this month. This cannot handle multiple credit action types or purchased credit packs.
- **Client-side-only credit checks:** Always enforce server-side in the server action before performing the gated operation.
- **Using anon key for credit writes:** Credit transactions must use the service role client or SECURITY DEFINER RPCs to ensure writes succeed regardless of RLS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic deduction | SELECT then UPDATE in JS | Postgres RPC with FOR UPDATE | Race conditions are invisible until production load |
| Monthly reset tracking | JavaScript date comparisons | `credit_transactions` with `subscription_grant` type tied to billing period | Calendar-based resets drift; webhook-based grants (Phase 6) are authoritative |
| Credit balance cache | Redis or in-memory cache | Direct `get_credit_balance` RPC (indexed, sub-ms) | Premature optimization at current scale; cache invalidation bugs are worse than a fast query |
| Transaction ID generation | Custom sequential IDs | Postgres `gen_random_uuid()` | UUIDs are the project-wide standard |

## Common Pitfalls

### Pitfall 1: Race Condition on Concurrent Deductions (Double-Spend)

**What goes wrong:** User clicks "Generate" twice quickly, or opens two tabs. Both requests read balance as 5, both deduct 1, user gets two generations but only pays once.
**Why it happens:** Supabase JS client has no transaction support. Two separate SELECT + INSERT calls create a TOCTOU gap.
**How to avoid:** The `deduct_credits` RPC with `FOR UPDATE` lock serializes concurrent access. The function checks balance and inserts deduction in a single transaction.
**Warning signs:** Credit balances going negative. More generations than credits consumed in the audit log.

### Pitfall 2: Middleware Blocks Webhook Routes (Phase 6 Prep)

**What goes wrong:** The current middleware at `src/middleware.ts` redirects all unauthenticated requests to `/login`. When Phase 6 adds a Stripe webhook at `/api/webhooks/stripe`, the POST from Stripe will be redirected to the login page and silently fail.
**Why it happens:** The middleware exclusion list does not include `/api/webhooks`.
**How to avoid:** Add `!request.nextUrl.pathname.startsWith('/api/webhooks')` to the middleware exclusion list in this phase, even though the webhook handler comes in Phase 6. This prevents a subtle bug later.
**Warning signs:** Stripe webhook deliveries all return 307 redirects instead of 200.

### Pitfall 3: RLS Blocks Service Role Operations

**What goes wrong:** Credit grant operations fail silently because RLS policies require `auth.uid() = user_id` and server actions creating admin-level credit entries have no matching auth context.
**Why it happens:** Developer uses the regular `createClient()` (anon key) instead of the service role client for admin operations.
**How to avoid:** Use `SECURITY DEFINER` on both RPC functions (`get_credit_balance` and `deduct_credits`). For direct table operations, use the admin client with service role key.

### Pitfall 4: Existing Tests Break After Rewrite

**What goes wrong:** The existing 12 tests in `src/__tests__/credits/check-credits.test.ts` mock the old project-counting approach. After the rewrite, they will all fail.
**Why it happens:** The tests mock `supabase.from('projects').select()` chains -- the new implementation uses `supabase.rpc()`.
**How to avoid:** Rewrite the tests alongside the implementation. The new tests should mock `supabase.rpc('get_credit_balance')` and `supabase.rpc('deduct_credits')`. Keep the same behavioral assertions (free user gets 5, pro gets 30, etc.).

### Pitfall 5: Hardcoded "Pro Member" in Navbar

**What goes wrong:** The top navbar at `src/components/layout/top-navbar.tsx:95` hardcodes `<p>Pro Member</p>`. After adding real subscription tiers, free users still see "Pro Member."
**How to avoid:** Replace with a dynamic label from the `subscriptions` table or the credit check result.

## Code Examples

### New Migration: Credit System Tables

```sql
-- supabase/migrations/005_credit_system.sql

-- Subscriptions table (single source of truth for tier)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'plus', 'pro')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Credit transactions (ledger)
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'subscription_grant',
    'carousel_generation',
    'imagen_generation',
    'credit_pack_purchase',
    'refund',
    'admin_adjustment'
  )),
  amount INTEGER NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX credit_transactions_user_id_idx
  ON public.credit_transactions(user_id);
CREATE INDEX credit_transactions_user_created_idx
  ON public.credit_transactions(user_id, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credits"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Stripe events (idempotency -- for Phase 6, created now)
CREATE TABLE public.stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No user-facing policies -- only service role writes/reads

-- RPC: Get credit balance
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM public.credit_transactions
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RPC: Atomic credit deduction
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO current_balance
  FROM public.credit_transactions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF current_balance >= p_amount THEN
    INSERT INTO public.credit_transactions (user_id, type, amount, description, reference_id)
    VALUES (p_user_id, p_type, -p_amount, p_description, p_reference_id);
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
```

### Rewritten check-credits.ts

```typescript
// src/lib/credits/check-credits.ts
import { createClient } from '@/lib/supabase/server'
import type { SubscriptionTier, CreditStatus } from './types'

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .single()
  return (data?.tier as SubscriptionTier) ?? 'free'
}

export async function getCreditBalance(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  return data ?? 0
}

export async function deductCredit(
  userId: string,
  type: string,
  description?: string,
  referenceId?: string,
): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: 1,
    p_type: type,
    p_description: description ?? null,
    p_reference_id: referenceId ?? null,
  })
  return data === true
}

export async function checkCredits(): Promise<CreditStatus> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { allowed: false, tier: 'free', balance: 0 }
  }
  const tier = await getUserTier(user.id)
  const balance = await getCreditBalance(user.id)
  return {
    allowed: balance > 0,
    tier,
    balance,
  }
}
```

### Credit Display Component

```typescript
// src/components/subscription/credit-display.tsx
import { getCreditBalance } from '@/lib/credits/check-credits'
import { createClient } from '@/lib/supabase/server'

export async function CreditDisplay() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const balance = await getCreditBalance(user.id)

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fadbdb]">
      <span className="text-xs font-bold text-[#3d0000]">{balance}</span>
      <span className="text-xs text-[#7d6161]">credits</span>
    </div>
  )
}
```

### Free Tier Project Count Limit

```typescript
// In the project creation server action:
// Free users: max N projects total (separate from credit balance)
const FREE_PROJECT_LIMIT = 10

async function checkProjectLimit(userId: string, tier: SubscriptionTier): Promise<boolean> {
  if (tier !== 'free') return true
  const supabase = await createClient()
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return (count ?? 0) < FREE_PROJECT_LIMIT
}
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 5) | Impact |
|------------------------|------------------------|--------|
| Tier from `user_metadata` | Tier from `subscriptions` table | Cannot be spoofed client-side |
| Credits = project count this month | Credits = SUM of ledger transactions | Supports multiple credit types, packs, refunds |
| No atomic deduction | `deduct_credits` RPC with FOR UPDATE | Prevents double-spend under concurrency |
| No credit history | `credit_transactions` table | Auditable, debuggable, user-visible |
| Hardcoded "Pro Member" in navbar | Dynamic tier + balance display | Accurate for all subscription states |

## Existing Code Impact Analysis

| File | Current State | Required Change | Risk |
|------|--------------|-----------------|------|
| `src/lib/credits/check-credits.ts` | Counts projects, reads user_metadata | Full rewrite to ledger-based | HIGH -- central dependency |
| `src/app/(dashboard)/project/[id]/actions.ts` | Calls `checkCredits()` but never deducts | Add `deductCredit()` call after generation | MEDIUM |
| `src/app/(dashboard)/dashboard/page.tsx` | Displays `remaining` from project count | Update to use `getCreditBalance()` | LOW |
| `src/components/layout/top-navbar.tsx` | Hardcodes "Pro Member" | Add `CreditDisplay` component, dynamic tier label | LOW |
| `src/app/(dashboard)/settings/subscription/page.tsx` | Shows hardcoded "Current Plan: Pro" | Read from `subscriptions` table | LOW |
| `src/__tests__/credits/check-credits.test.ts` | 12 tests mocking project count | Full rewrite to mock RPC calls | MEDIUM |
| `src/middleware.ts` | No webhook exclusion | Add `/api/webhooks` to exclusion list | LOW -- prep for Phase 6 |
| `.env.local.example` | No service role key | Add `SUPABASE_SERVICE_ROLE_KEY` | LOW |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (Postgres) | Credit tables, RPC | Yes | Existing project | -- |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client | Needs to be added to env | -- | Use SECURITY DEFINER RPCs only (current plan) |

**Missing dependencies with no fallback:** None -- all dependencies are already installed.

**Missing dependencies with fallback:**
- `SUPABASE_SERVICE_ROLE_KEY` -- can be obtained from Supabase dashboard. The SECURITY DEFINER RPCs reduce the immediate need since they bypass RLS by design. However, the admin client will be essential for Phase 6 (webhooks). Add the env var now.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/__tests__/credits/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRED-01 | Pro users receive monthly credit allowance | unit | `npx vitest run src/__tests__/credits/ -t "grant"` | No -- Wave 0 |
| CRED-02 | Credit balance displays and updates after generation | unit | `npx vitest run src/__tests__/credits/ -t "balance"` | No -- Wave 0 |
| CRED-03 | Atomic credit deduction prevents double-spend | unit | `npx vitest run src/__tests__/credits/ -t "deduct"` | No -- Wave 0 |
| CRED-05 | Credit usage history viewable | unit | `npx vitest run src/__tests__/credits/ -t "history"` | No -- Wave 0 |
| STRIPE-04 | Free tier usage limits enforced | unit | `npx vitest run src/__tests__/credits/ -t "free tier"` | Partial -- existing tests cover limit check but mock old approach |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/credits/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/credits/check-credits.test.ts` -- full rewrite to mock RPC-based approach (covers CRED-02, CRED-03, STRIPE-04)
- [ ] `src/__tests__/credits/credit-grants.test.ts` -- tests for subscription grant logic (covers CRED-01)
- [ ] `src/__tests__/credits/credit-history.test.ts` -- tests for transaction history retrieval (covers CRED-05)

## Open Questions

1. **Initial credit grant for existing users**
   - What we know: New users need a subscription row + initial credit grant on first use
   - What's unclear: Should we backfill existing users with a subscription row and credits via migration, or lazily create on next login?
   - Recommendation: Lazy creation on next login (check if subscription row exists, create if not with free tier + monthly grant). Avoids migration complexity and handles the "first login after upgrade" case.

2. **Free tier text generation limit**
   - What we know: STRIPE-04 requires free tier limits on AI text generations per month
   - What's unclear: Should text generations (carousel creation) cost credits, or should credits be reserved for premium features (Imagen in Phase 7)?
   - Recommendation: Carousel generation costs 1 credit for all tiers. Free tier gets 5 credits/month (matches current behavior). This creates a natural upgrade funnel.

3. **Credit display real-time updates**
   - What we know: CRED-02 says "updates immediately after each AI generation"
   - What's unclear: Whether to use Supabase Realtime subscription or simpler `revalidatePath`
   - Recommendation: Use `revalidatePath` after server action completes. The Out of Scope section explicitly says "Real-time credit balance via WebSocket" is out of scope. Refetch after explicit actions is sufficient.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/lib/credits/check-credits.ts`, `src/app/(dashboard)/project/[id]/actions.ts`, `src/components/layout/top-navbar.tsx`, `src/middleware.ts`
- Project research: `.planning/research/ARCHITECTURE.md` -- database schema, RPC patterns, data flows
- Project research: `.planning/research/PITFALLS.md` -- race conditions, RLS blocking, double-spend prevention
- Project research: `.planning/research/STACK.md` -- credit system design, no new packages needed

### Secondary (MEDIUM confidence)
- Supabase RPC and SECURITY DEFINER documentation patterns
- Postgres FOR UPDATE row locking for concurrent access serialization

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages, all existing
- Architecture: HIGH -- Postgres ledger + RPC is a canonical pattern, well-documented in project research
- Pitfalls: HIGH -- race conditions and RLS issues thoroughly documented in PITFALLS.md; middleware issue confirmed by direct code inspection

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain, no external dependencies changing)
