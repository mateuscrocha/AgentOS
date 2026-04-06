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

  IF NULLIF(BTRIM(COALESCE(_stripe_customer_id, '')), '') IS NOT NULL
     OR NULLIF(BTRIM(COALESCE(_stripe_subscription_id, '')), '') IS NOT NULL THEN
    RETURN 'customer';
  END IF;

  IF _billing_status = 'canceled' THEN
    RETURN 'inactive';
  END IF;

  RETURN 'prospect';
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
  next_stage public.crm_opportunity_stage;
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

  next_status := public.crm_account_status_from_organization(
    org_row.status,
    org_row.billing_status,
    org_row.relationship_type,
    org_row.stripe_customer_id,
    org_row.stripe_subscription_id
  );
  next_stage := CASE
    WHEN next_status = 'customer' THEN 'customer'
    WHEN next_status = 'inactive' THEN 'lost'
    ELSE 'meeting'
  END;
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
      stage,
      relationship_type,
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
      next_stage,
      org_row.relationship_type,
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
    stage = next_stage,
    relationship_type = org_row.relationship_type,
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

CREATE OR REPLACE FUNCTION public.crm_enforce_org_backed_account_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  org_row public.organizations%ROWTYPE;
  next_status public.crm_account_status;
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

  next_status := public.crm_account_status_from_organization(
    org_row.status,
    org_row.billing_status,
    org_row.relationship_type,
    org_row.stripe_customer_id,
    org_row.stripe_subscription_id
  );

  NEW.name := org_row.name;
  NEW.email := COALESCE(NULLIF(btrim(org_row.contact_email), ''), NEW.email);
  NEW.phone := COALESCE(NULLIF(btrim(org_row.contact_phone), ''), NEW.phone);
  NEW.source := COALESCE(NULLIF(NEW.source, ''), 'Painel Bóris');
  NEW.status := next_status;
  NEW.stage := CASE
    WHEN next_status = 'customer' THEN 'customer'
    WHEN next_status = 'inactive' THEN 'lost'
    ELSE 'meeting'
  END;
  NEW.relationship_type := org_row.relationship_type;
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

SELECT public.crm_sync_account_from_organization(id)
FROM public.organizations;
