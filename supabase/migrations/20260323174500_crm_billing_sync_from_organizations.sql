CREATE OR REPLACE FUNCTION public.crm_apply_organization_billing(_crm_account_id uuid, _organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_row public.organizations%ROWTYPE;
BEGIN
  IF _crm_account_id IS NULL OR _organization_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
    INTO org_row
  FROM public.organizations
  WHERE id = _organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.crm_accounts
  SET
    stripe_customer_id = COALESCE(org_row.stripe_customer_id, public.crm_accounts.stripe_customer_id),
    stripe_subscription_id = COALESCE(org_row.stripe_subscription_id, public.crm_accounts.stripe_subscription_id),
    stripe_subscription_status = COALESCE(org_row.billing_status, public.crm_accounts.stripe_subscription_status),
    stripe_next_billing_at = COALESCE(org_row.current_period_end, public.crm_accounts.stripe_next_billing_at),
    financial_context_updated_at = now(),
    updated_at = now()
  WHERE id = _crm_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_account_billing_from_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    PERFORM public.crm_apply_organization_billing(NEW.id, NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_accounts_from_organization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.crm_accounts
  SET
    stripe_customer_id = COALESCE(NEW.stripe_customer_id, public.crm_accounts.stripe_customer_id),
    stripe_subscription_id = COALESCE(NEW.stripe_subscription_id, public.crm_accounts.stripe_subscription_id),
    stripe_subscription_status = COALESCE(NEW.billing_status, public.crm_accounts.stripe_subscription_status),
    stripe_next_billing_at = COALESCE(NEW.current_period_end, public.crm_accounts.stripe_next_billing_at),
    financial_context_updated_at = now(),
    updated_at = now()
  WHERE organization_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_sync_account_billing_from_link ON public.crm_accounts;
CREATE TRIGGER trg_crm_sync_account_billing_from_link
  AFTER INSERT OR UPDATE OF organization_id ON public.crm_accounts
  FOR EACH ROW
  WHEN (NEW.organization_id IS NOT NULL)
  EXECUTE FUNCTION public.crm_sync_account_billing_from_link();

DROP TRIGGER IF EXISTS trg_crm_sync_accounts_from_organization ON public.organizations;
CREATE TRIGGER trg_crm_sync_accounts_from_organization
  AFTER UPDATE OF billing_status, current_period_end, stripe_customer_id, stripe_subscription_id
  ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_sync_accounts_from_organization();

UPDATE public.crm_accounts crm
SET
  stripe_customer_id = COALESCE(org.stripe_customer_id, crm.stripe_customer_id),
  stripe_subscription_id = COALESCE(org.stripe_subscription_id, crm.stripe_subscription_id),
  stripe_subscription_status = COALESCE(org.billing_status, crm.stripe_subscription_status),
  stripe_next_billing_at = COALESCE(org.current_period_end, crm.stripe_next_billing_at),
  financial_context_updated_at = now(),
  updated_at = now()
FROM public.organizations org
WHERE crm.organization_id = org.id;
