CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_organization_contact_unique
  ON public.crm_contacts (organization_contact_id)
  WHERE organization_contact_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.crm_contact_first_name(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_name text;
BEGIN
  normalized_name := NULLIF(btrim(_name), '');
  IF normalized_name IS NULL THEN
    RETURN 'Contato principal';
  END IF;

  IF lower(normalized_name) = 'contato principal' THEN
    RETURN 'Contato principal';
  END IF;

  RETURN split_part(normalized_name, ' ', 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_contact_last_name(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_name text;
  first_name text;
  remainder text;
BEGIN
  normalized_name := NULLIF(btrim(_name), '');
  IF normalized_name IS NULL THEN
    RETURN NULL;
  END IF;

  IF lower(normalized_name) = 'contato principal' THEN
    RETURN NULL;
  END IF;

  first_name := split_part(normalized_name, ' ', 1);
  remainder := NULLIF(btrim(substr(normalized_name, char_length(first_name) + 1)), '');
  RETURN remainder;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_upsert_contact_from_organization_contact(_organization_contact_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_contact_row public.organization_contacts%ROWTYPE;
  crm_account_id uuid;
  existing_contact_id uuid;
  normalized_email text;
  normalized_phone text;
BEGIN
  IF _organization_contact_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO org_contact_row
  FROM public.organization_contacts
  WHERE id = _organization_contact_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  crm_account_id := public.crm_sync_account_from_organization(org_contact_row.organization_id);

  IF crm_account_id IS NULL THEN
    SELECT id
      INTO crm_account_id
    FROM public.crm_accounts
    WHERE organization_id = org_contact_row.organization_id
    LIMIT 1;
  END IF;

  IF crm_account_id IS NULL THEN
    RETURN NULL;
  END IF;

  normalized_email := NULLIF(lower(btrim(org_contact_row.email)), '');
  normalized_phone := NULLIF(regexp_replace(COALESCE(org_contact_row.phone, ''), '\D', '', 'g'), '');

  SELECT id
    INTO existing_contact_id
  FROM public.crm_contacts
  WHERE organization_contact_id = org_contact_row.id
  LIMIT 1;

  IF existing_contact_id IS NULL THEN
    SELECT id
      INTO existing_contact_id
    FROM public.crm_contacts
    WHERE account_id = crm_account_id
      AND organization_contact_id IS NULL
      AND (
        (org_contact_row.is_primary IS TRUE AND is_primary IS TRUE)
        OR (
          normalized_email IS NOT NULL
          AND lower(COALESCE(email, '')) = normalized_email
        )
        OR (
          normalized_phone IS NOT NULL
          AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = normalized_phone
        )
        OR (
          lower(trim(concat_ws(' ', first_name, last_name))) = lower(btrim(org_contact_row.name))
        )
      )
    ORDER BY is_primary DESC, updated_at DESC
    LIMIT 1;
  END IF;

  IF org_contact_row.is_primary IS TRUE THEN
    UPDATE public.crm_contacts
    SET
      is_primary = FALSE,
      updated_at = now()
    WHERE account_id = crm_account_id
      AND is_primary IS TRUE
      AND id <> COALESCE(existing_contact_id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  IF existing_contact_id IS NULL THEN
    INSERT INTO public.crm_contacts (
      account_id,
      organization_contact_id,
      first_name,
      last_name,
      email,
      phone,
      title,
      is_primary
    )
    VALUES (
      crm_account_id,
      org_contact_row.id,
      public.crm_contact_first_name(org_contact_row.name),
      public.crm_contact_last_name(org_contact_row.name),
      NULLIF(btrim(org_contact_row.email), ''),
      NULLIF(btrim(org_contact_row.phone), ''),
      NULLIF(btrim(org_contact_row.role_title), ''),
      org_contact_row.is_primary
    )
    RETURNING id INTO existing_contact_id;

    RETURN existing_contact_id;
  END IF;

  UPDATE public.crm_contacts
  SET
    account_id = crm_account_id,
    organization_contact_id = org_contact_row.id,
    first_name = public.crm_contact_first_name(org_contact_row.name),
    last_name = public.crm_contact_last_name(org_contact_row.name),
    email = NULLIF(btrim(org_contact_row.email), ''),
    phone = NULLIF(btrim(org_contact_row.phone), ''),
    title = COALESCE(NULLIF(btrim(org_contact_row.role_title), ''), public.crm_contacts.title),
    is_primary = org_contact_row.is_primary,
    updated_at = now()
  WHERE id = existing_contact_id;

  RETURN existing_contact_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_primary_contact_fallback_from_organization(_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_row public.organizations%ROWTYPE;
  crm_account_id uuid;
  existing_contact_id uuid;
  fallback_name text;
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

  IF EXISTS (
    SELECT 1
    FROM public.organization_contacts
    WHERE organization_id = _organization_id
  ) THEN
    RETURN NULL;
  END IF;

  IF NULLIF(btrim(org_row.contact_name), '') IS NULL
    AND NULLIF(btrim(org_row.contact_email), '') IS NULL
    AND NULLIF(btrim(org_row.contact_phone), '') IS NULL THEN
    RETURN NULL;
  END IF;

  crm_account_id := public.crm_sync_account_from_organization(_organization_id);

  IF crm_account_id IS NULL THEN
    SELECT id
      INTO crm_account_id
    FROM public.crm_accounts
    WHERE organization_id = _organization_id
    LIMIT 1;
  END IF;

  IF crm_account_id IS NULL THEN
    RETURN NULL;
  END IF;

  fallback_name := COALESCE(NULLIF(btrim(org_row.contact_name), ''), 'Contato principal');

  SELECT id
    INTO existing_contact_id
  FROM public.crm_contacts
  WHERE account_id = crm_account_id
    AND organization_contact_id IS NULL
    AND (
      is_primary IS TRUE
      OR (
        NULLIF(btrim(org_row.contact_email), '') IS NOT NULL
        AND lower(COALESCE(email, '')) = lower(NULLIF(btrim(org_row.contact_email), ''))
      )
      OR (
        NULLIF(btrim(org_row.contact_phone), '') IS NOT NULL
        AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = regexp_replace(NULLIF(btrim(org_row.contact_phone), ''), '\D', '', 'g')
      )
      OR lower(trim(concat_ws(' ', first_name, last_name))) = lower(fallback_name)
    )
  ORDER BY is_primary DESC, updated_at DESC
  LIMIT 1;

  UPDATE public.crm_contacts
  SET
    is_primary = FALSE,
    updated_at = now()
  WHERE account_id = crm_account_id
    AND is_primary IS TRUE
    AND id <> COALESCE(existing_contact_id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF existing_contact_id IS NULL THEN
    INSERT INTO public.crm_contacts (
      account_id,
      organization_contact_id,
      first_name,
      last_name,
      email,
      phone,
      title,
      is_primary
    )
    VALUES (
      crm_account_id,
      NULL,
      public.crm_contact_first_name(fallback_name),
      public.crm_contact_last_name(fallback_name),
      NULLIF(btrim(org_row.contact_email), ''),
      NULLIF(btrim(org_row.contact_phone), ''),
      'Contato principal',
      TRUE
    )
    RETURNING id INTO existing_contact_id;

    RETURN existing_contact_id;
  END IF;

  UPDATE public.crm_contacts
  SET
    first_name = public.crm_contact_first_name(fallback_name),
    last_name = public.crm_contact_last_name(fallback_name),
    email = NULLIF(btrim(org_row.contact_email), ''),
    phone = NULLIF(btrim(org_row.contact_phone), ''),
    title = COALESCE(NULLIF(public.crm_contacts.title, ''), 'Contato principal'),
    is_primary = TRUE,
    updated_at = now()
  WHERE id = existing_contact_id;

  RETURN existing_contact_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_contacts_from_organization(_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_contact_id uuid;
BEGIN
  IF _organization_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.crm_sync_account_from_organization(_organization_id);

  FOR org_contact_id IN
    SELECT id
    FROM public.organization_contacts
    WHERE organization_id = _organization_id
    ORDER BY is_primary DESC, updated_at DESC, created_at DESC
  LOOP
    PERFORM public.crm_upsert_contact_from_organization_contact(org_contact_id);
  END LOOP;

  PERFORM public.crm_sync_primary_contact_fallback_from_organization(_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_contacts_from_organization_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.crm_sync_contacts_from_organization(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_contacts_from_organization_contacts_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.crm_contacts
    WHERE organization_contact_id = OLD.id;

    PERFORM public.crm_sync_contacts_from_organization(OLD.organization_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
    DELETE FROM public.crm_contacts
    WHERE organization_contact_id = OLD.id;

    PERFORM public.crm_sync_contacts_from_organization(OLD.organization_id);
  END IF;

  PERFORM public.crm_sync_contacts_from_organization(NEW.organization_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_sync_contacts_from_organization ON public.organizations;
CREATE TRIGGER trg_crm_sync_contacts_from_organization
  AFTER INSERT OR UPDATE OF name, contact_name, contact_email, contact_phone
  ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_sync_contacts_from_organization_trigger();

DROP TRIGGER IF EXISTS trg_crm_sync_contacts_from_organization_contacts ON public.organization_contacts;
CREATE TRIGGER trg_crm_sync_contacts_from_organization_contacts
  AFTER INSERT OR UPDATE OR DELETE
  ON public.organization_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_sync_contacts_from_organization_contacts_trigger();

SELECT public.crm_sync_contacts_from_organization(id)
FROM public.organizations;
