CREATE OR REPLACE FUNCTION public.crm_account_status_from_organization(
  _organization_status text,
  _billing_status text,
  _relationship_type text DEFAULT 'paying_customer',
  _stripe_customer_id text DEFAULT NULL,
  _stripe_subscription_id text DEFAULT NULL
)
RETURNS public.crm_account_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF _organization_status IN ('inactive', 'suspended') THEN
    RETURN 'inactive';
  END IF;

  IF _billing_status = 'canceled' THEN
    RETURN 'inactive';
  END IF;

  IF _relationship_type = 'paying_customer' THEN
    RETURN 'customer';
  END IF;

  IF NULLIF(BTRIM(COALESCE(_stripe_customer_id, '')), '') IS NOT NULL
     OR NULLIF(BTRIM(COALESCE(_stripe_subscription_id, '')), '') IS NOT NULL THEN
    RETURN 'customer';
  END IF;

  RETURN 'prospect';
END;
$$;

SELECT public.crm_sync_account_from_organization(id)
FROM public.organizations;
