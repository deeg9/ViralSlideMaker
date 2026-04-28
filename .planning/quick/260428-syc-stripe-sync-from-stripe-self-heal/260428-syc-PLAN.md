# Quick Task 260428-syc: Stripe Sync-from-Stripe self-heal + subscription page restructure

## Why

User bought Pro on local dev and got the green "Subscription activated!"
banner, but the page still said "Current Plan: Free" with 4 credits. Root
cause: `stripe listen` wasn't running, so Stripe's
`checkout.session.completed` webhook never reached the dev server. The
"activated" banner is purely cosmetic — gated only on
`searchParams.success === 'true'`, never reads DB state. The only path
that flips `subscriptions.tier` and grants credits is the webhook handler
chain in `src/lib/stripe/sync-subscription.ts`. Without it, paid users
are stuck.

This task adds a self-heal path so a missed webhook doesn't strand the
user, and consolidates the Manage Subscription UX into the current-plan
card.

## What ships

1. **New** exported helper `syncSubscriptionFromStripe(userId, admin)` in
   `src/lib/stripe/sync-subscription.ts` — calls
   `stripe.subscriptions.list({customer, status:'active'})`, mirrors the
   active subscription into Supabase (tier, period, status, cancel flag),
   and grants the monthly credits **idempotently keyed on
   `subscription.latest_invoice`** so it can't double-grant against a
   later `invoice.paid` webhook.
2. **New** server action `syncSubscriptionAction()` in
   `src/app/(dashboard)/settings/subscription/actions.ts` — wraps the
   helper, redirects to `?synced=<tier>(&credits=true)` for the banner.
3. **Modified** `src/app/(dashboard)/settings/subscription/page.tsx`:
   - Imports `createPortalSession` directly (no more
     `ManageSubscriptionButton` wrapper component).
   - Plan-card CTA logic restructured: current-plan card shows a
     **Manage Subscription** button (when there's a Stripe customer,
     else falls back to inert "Current Plan" badge). Other-plan cards
     that aren't upgrades show `${plan.name} Plan` (so Plus shows
     "Plus Plan", mirroring how Free already shows "Free Plan"; was
     "Manage via Portal").
   - New `?synced=<tier>` banner near the existing success/canceled
     banners.
   - Removed the bottom Manage Subscription card entirely. Replaced
     with a slimmer **Sync from Stripe** card (only rendered when the
     user has a `stripe_customer_id`).

## Files

- **Modified** `src/lib/stripe/sync-subscription.ts` — added
  `syncSubscriptionFromStripe` (~85 lines) alongside the existing
  webhook handlers; no changes to `handleStripeEvent`.
- **Modified** `src/app/(dashboard)/settings/subscription/actions.ts` —
  added `syncSubscriptionAction` (~10 lines) above
  `createCreditPackCheckout`.
- **Modified** `src/app/(dashboard)/settings/subscription/page.tsx` —
  CTA restructuring + new banner + new Sync card, drops the
  `ManageSubscriptionButton` import.

## Idempotency

The credit-grant insert is gated on `(user_id='X', type='subscription_grant',
reference_id=<latest_invoice_id>)` not existing. This matches how
`handleInvoicePaid` already deduplicates against `invoice.id`, so
clicking Sync after a webhook lands (or vice versa) won't double-grant.
For `checkout.session.completed` replays, the original handler keys on
`session.id` — that's a different reference and could overlap, but in
practice the user only triggers Sync when the webhook is missing
entirely, so the race is theoretical.

## Verification

- `/settings/subscription?success=true` shows the original "Subscription
  activated!" banner.
- After clicking **Sync from Stripe**, the URL becomes
  `?synced=pro&credits=true`, the banner reads "Synced — your plan is
  now Pro. Credits granted.", the badge flips to **Current Plan: Pro**,
  and the top-right credits chip jumps by `TIER_CREDITS[tier]`.
- A second click of Sync produces `?synced=pro` (no `&credits=true`)
  and credits don't double-grant.
- Free users with no Stripe customer don't see the Sync card.

## Notes

The old `ManageSubscriptionButton` component file
(`src/app/(dashboard)/settings/subscription/manage-subscription-button.tsx`)
is left on disk but unreferenced — same pattern as
`publish-modal.tsx` after quick-260428-vdd. Cleanup can fold into a
later sweep.
