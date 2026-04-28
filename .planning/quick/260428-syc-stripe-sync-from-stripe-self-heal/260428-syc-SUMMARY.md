---
name: 260428-syc summary
description: Sync from Stripe self-heal + subscription page restructure (Manage button moves into current-plan card)
type: project
status: complete
---

# Quick Task 260428-syc — SUMMARY

## What shipped

`/settings/subscription` now self-heals when a Stripe webhook is missed.
A new "Sync from Stripe" button calls a server action that pulls the
user's active subscription from Stripe and writes the same
`subscriptions` + `credit_transactions` rows the
`checkout.session.completed` webhook would have. Idempotent — a second
click never double-grants because the credit insert is keyed on
`subscription.latest_invoice`.

Also restructured the page: the bottom "Manage Subscription" card is
gone, the Manage button now lives inside the user's current-plan card,
and inert labels on other plan cards read "{name} Plan" instead of the
old "Manage via Portal".

## Files

- **Modified** `src/lib/stripe/sync-subscription.ts` — exported
  `syncSubscriptionFromStripe(userId, admin)`. Calls
  `stripe.subscriptions.list({ customer, status: 'active', limit: 1 })`,
  resolves tier via existing `tierFromPriceId`, upserts the
  `subscriptions` row (matches the shape `handleCheckoutCompleted`
  writes), and inserts a `subscription_grant` credit transaction only
  if no row already exists with `reference_id = subscription.latest_invoice`.
- **Modified** `src/app/(dashboard)/settings/subscription/actions.ts` —
  added `syncSubscriptionAction()`. Reuses
  `getAuthenticatedUser` + `createAdminClient` + `getAppUrl` already in
  the file. Redirects to `?synced=<tier>(&credits=true)` on completion.
- **Modified** `src/app/(dashboard)/settings/subscription/page.tsx`:
  - CTA logic per plan card now: current + Stripe customer → **Manage
    Subscription** button (calls `createPortalSession`); current + no
    customer → inert "Current Plan" badge (free user fallback);
    not-current/not-upgrade → inert "${plan.name} Plan" label.
  - Bottom Manage Subscription card removed. Replaced with a slimmer
    Sync card (only rendered when `hasStripeCustomer === true`).
  - New `?synced=<tier>` banner near the existing success / canceled
    banners.
  - Drops `ManageSubscriptionButton` import.

## Behavior

| User action | Behind the scenes |
|---|---|
| Buys Pro, webhook misses | Stripe-side sub exists; local row stays Free |
| Clicks Sync from Stripe | `syncSubscriptionAction` → `syncSubscriptionFromStripe` → upsert + credit grant |
| Refreshes page | `subscriptions.tier = 'pro'`, balance jumps by `TIER_CREDITS.pro` (200) |
| Clicks Sync again | Tier upsert is no-op; credit insert skipped (latest_invoice already has a grant) |
| Free user with no Stripe customer | Sync card hidden entirely |

## Verification

- `npx tsc --noEmit | grep -E "subscription\|sync-subscription"` → clean
- Diego ran the full path live: started `stripe listen`, replaced
  `STRIPE_WEBHOOK_SECRET` in `.env.local`, restarted `next dev`,
  refreshed the page, clicked Sync, saw "Current Plan: Pro" and
  204 credits.

## Notes

`src/app/(dashboard)/settings/subscription/manage-subscription-button.tsx`
is unreferenced after this change but left on disk — same pattern as
`publish-modal.tsx` after quick-260428-vdd. Cleanup can fold into a
later sweep.

The original `?success=true` banner ("Subscription activated! Your
credits will appear shortly") is left intact — useful as a
confirmation right after Stripe Checkout completes, even though it's
purely cosmetic.
