-- Quick 260510 follow-on: extend credit_transactions.type CHECK constraint
-- to include the v2.13 charge types Plan 73-03 introduced. Without this,
-- chargeExtractionCredit() inserts fail with constraint violation; the
-- deduct_credits RPC swallows the exception and returns false, which the
-- orchestrator mis-surfaces as `insufficient_credits` to the user (live
-- smoke 2026-05-10: header showed 1 credit, page said "Out of credits").
--
-- Existing allowed types (preserved): subscription_grant, carousel_generation,
-- imagen_generation, credit_pack_purchase, refund, admin_adjustment.
-- New types added: gemini_vision_extract_style (Phase 73 EXTRACTION_CHARGE_TYPE).

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'subscription_grant',
    'carousel_generation',
    'imagen_generation',
    'credit_pack_purchase',
    'refund',
    'admin_adjustment',
    'gemini_vision_extract_style'
  ]));
