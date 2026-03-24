CREATE OR REPLACE FUNCTION public.crm_enforce_org_backed_account_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  org_row public.organizations%ROWTYPE;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO org_row
  FROM public.organizations
  WHERE id = NEW.organization_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.name := org_row.name;
  NEW.email := COALESCE(NULLIF(btrim(org_row.contact_email), ''), NEW.email);
  NEW.phone := COALESCE(NULLIF(btrim(org_row.contact_phone), ''), NEW.phone);
  NEW.source := COALESCE(NULLIF(NEW.source, ''), 'Painel Bóris');
  NEW.status := public.crm_account_status_from_organization(org_row.status, org_row.billing_status);
  NEW.stripe_customer_id := COALESCE(org_row.stripe_customer_id, NEW.stripe_customer_id);
  NEW.stripe_subscription_id := COALESCE(org_row.stripe_subscription_id, NEW.stripe_subscription_id);
  NEW.stripe_subscription_status := COALESCE(org_row.billing_status, NEW.stripe_subscription_status);
  NEW.stripe_next_billing_at := COALESCE(org_row.current_period_end, NEW.stripe_next_billing_at);

  IF org_row.stripe_customer_id IS NOT NULL OR org_row.stripe_subscription_id IS NOT NULL OR org_row.billing_status IS NOT NULL THEN
    NEW.financial_context_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_enforce_org_backed_account_fields ON public.crm_accounts;
CREATE TRIGGER trg_crm_enforce_org_backed_account_fields
  BEFORE INSERT OR UPDATE ON public.crm_accounts
  FOR EACH ROW
  WHEN (NEW.organization_id IS NOT NULL)
  EXECUTE FUNCTION public.crm_enforce_org_backed_account_fields();
