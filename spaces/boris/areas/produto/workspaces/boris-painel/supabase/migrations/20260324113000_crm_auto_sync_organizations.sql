CREATE OR REPLACE FUNCTION public.crm_account_status_from_organization(
  _organization_status text,
  _billing_status text
)
RETURNS public.crm_account_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF _billing_status IN ('active', 'trialing', 'past_due', 'unpaid') THEN
    RETURN 'customer';
  END IF;

  IF _billing_status = 'canceled' OR _organization_status IN ('inactive', 'suspended') THEN
    RETURN 'inactive';
  END IF;

  RETURN 'customer';
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_account_from_organization(_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_row public.organizations%ROWTYPE;
  existing_account_id uuid;
  next_status public.crm_account_status;
  normalized_email text;
  normalized_phone text;
BEGIN
  IF _organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO org_row
  FROM public.organizations
  WHERE id = _organization_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  next_status := public.crm_account_status_from_organization(org_row.status, org_row.billing_status);
  normalized_email := NULLIF(btrim(org_row.contact_email), '');
  normalized_phone := NULLIF(btrim(org_row.contact_phone), '');

  SELECT id
    INTO existing_account_id
  FROM public.crm_accounts
  WHERE organization_id = org_row.id
  LIMIT 1;

  IF existing_account_id IS NULL THEN
    INSERT INTO public.crm_accounts (
      organization_id,
      name,
      phone,
      email,
      source,
      status,
      quick_notes,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_subscription_status,
      stripe_next_billing_at,
      financial_context_updated_at
    )
    VALUES (
      org_row.id,
      org_row.name,
      normalized_phone,
      normalized_email,
      'Painel Bóris',
      next_status,
      CASE
        WHEN NULLIF(btrim(org_row.contact_name), '') IS NOT NULL THEN
          'Cliente sincronizado automaticamente a partir da organização do painel. Contato principal: ' || btrim(org_row.contact_name) || '.'
        ELSE
          'Cliente sincronizado automaticamente a partir da organização do painel.'
      END,
      org_row.stripe_customer_id,
      org_row.stripe_subscription_id,
      org_row.billing_status,
      org_row.current_period_end,
      CASE
        WHEN org_row.stripe_customer_id IS NOT NULL OR org_row.stripe_subscription_id IS NOT NULL OR org_row.billing_status IS NOT NULL
          THEN now()
        ELSE NULL
      END
    )
    RETURNING id INTO existing_account_id;

    RETURN existing_account_id;
  END IF;

  UPDATE public.crm_accounts
  SET
    name = org_row.name,
    phone = COALESCE(normalized_phone, public.crm_accounts.phone),
    email = COALESCE(normalized_email, public.crm_accounts.email),
    source = COALESCE(NULLIF(public.crm_accounts.source, ''), 'Painel Bóris'),
    status = next_status,
    stripe_customer_id = COALESCE(org_row.stripe_customer_id, public.crm_accounts.stripe_customer_id),
    stripe_subscription_id = COALESCE(org_row.stripe_subscription_id, public.crm_accounts.stripe_subscription_id),
    stripe_subscription_status = COALESCE(org_row.billing_status, public.crm_accounts.stripe_subscription_status),
    stripe_next_billing_at = COALESCE(org_row.current_period_end, public.crm_accounts.stripe_next_billing_at),
    financial_context_updated_at = CASE
      WHEN org_row.stripe_customer_id IS NOT NULL OR org_row.stripe_subscription_id IS NOT NULL OR org_row.billing_status IS NOT NULL
        THEN now()
      ELSE public.crm_accounts.financial_context_updated_at
    END,
    updated_at = now()
  WHERE id = existing_account_id;

  RETURN existing_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_account_from_organization_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.crm_sync_account_from_organization(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_account_billing_from_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    PERFORM public.crm_sync_account_from_organization(NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_sync_accounts_from_organization ON public.organizations;
CREATE TRIGGER trg_crm_sync_accounts_from_organization
  AFTER INSERT OR UPDATE OF name, status, contact_name, contact_email, contact_phone, billing_status, current_period_end, stripe_customer_id, stripe_subscription_id
  ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_sync_account_from_organization_trigger();

DROP TRIGGER IF EXISTS trg_crm_sync_account_billing_from_link ON public.crm_accounts;
CREATE TRIGGER trg_crm_sync_account_billing_from_link
  AFTER INSERT OR UPDATE OF organization_id ON public.crm_accounts
  FOR EACH ROW
  WHEN (NEW.organization_id IS NOT NULL)
  EXECUTE FUNCTION public.crm_sync_account_billing_from_link();

SELECT public.crm_sync_account_from_organization(id)
FROM public.organizations;
