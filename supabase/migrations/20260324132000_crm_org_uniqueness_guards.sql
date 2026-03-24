CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_customer_id_unique
  ON public.organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_accounts_organization_id_unique
  ON public.crm_accounts (organization_id)
  WHERE organization_id IS NOT NULL;
