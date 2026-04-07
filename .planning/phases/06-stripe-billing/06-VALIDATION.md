---
phase: 6
slug: stripe-billing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 6 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing project setup) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Checkout flow | STRIPE-01 | External service | Click subscribe button, verify redirect to Stripe, complete test card payment |
| Webhook processing | STRIPE-02 | Requires Stripe CLI | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Customer Portal | STRIPE-03 | External service | Click manage subscription, verify Stripe portal opens |
| Upgrade prompts | STRIPE-05 | UI flow check | Hit usage limits as free user, verify prompt appears |
| Credit pack purchase | CRED-04 | External service + DB check | Buy credit pack, verify credits added to balance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Wave 0 covers all MISSING references
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
