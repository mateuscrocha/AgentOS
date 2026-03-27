ALTER TABLE public.crm_accounts
  ADD COLUMN IF NOT EXISTS stripe_monthly_amount_cents integer NULL;

UPDATE public.crm_accounts
SET stripe_monthly_amount_cents = COALESCE(stripe_monthly_amount_cents, stripe_last_invoice_amount_cents)
WHERE stripe_monthly_amount_cents IS NULL
  AND stripe_last_invoice_amount_cents IS NOT NULL;
