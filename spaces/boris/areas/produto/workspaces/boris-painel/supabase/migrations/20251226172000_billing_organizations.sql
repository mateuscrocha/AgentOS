-- Billing columns for organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_plan TEXT,
  ADD COLUMN IF NOT EXISTS billing_status TEXT CHECK (billing_status IN ('inactive','trialing','active','past_due','canceled')),
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
