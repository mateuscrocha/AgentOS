-- Index para lookup por subscription_id (webhook/sync)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_stripe_subscription_id_unique
  ON public.organizations (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

