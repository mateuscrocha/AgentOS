DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'groups'
      AND column_name = 'whatsapp_provider_id'
  ) THEN
    ALTER TABLE public.groups
      ADD COLUMN whatsapp_provider_id text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_whatsapp_provider_id_unique_active
  ON public.groups (whatsapp_provider_id)
  WHERE whatsapp_provider_id IS NOT NULL
    AND provider = 'whatsapp'
    AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.public_onboarding_provision_tx(
  p_user_id uuid,
  p_lead_name text,
  p_lead_email text,
  p_lead_phone_e164 text,
  p_organization_name text,
  p_group_name text,
  p_group_invite_link text,
  p_group_whatsapp_provider_id text
)
RETURNS TABLE (organization_id uuid, group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_group_id uuid;
BEGIN
  INSERT INTO public.organizations (
    name,
    status,
    owner_user_id,
    contact_name,
    contact_email,
    contact_phone
  ) VALUES (
    p_organization_name,
    'active',
    p_user_id,
    p_lead_name,
    p_lead_email,
    p_lead_phone_e164
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.groups (
    organization_id,
    name,
    provider,
    whatsapp_provider_id,
    invite_link,
    invite_link_status,
    status,
    is_active,
    is_archived
  ) VALUES (
    v_org_id,
    p_group_name,
    'whatsapp',
    p_group_whatsapp_provider_id,
    p_group_invite_link,
    'valid',
    'active',
    true,
    false
  )
  RETURNING id INTO v_group_id;

  INSERT INTO public.profiles (id, name, phone_e164, status)
  VALUES (p_user_id, p_lead_name, p_lead_phone_e164, 'active')
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      phone_e164 = EXCLUDED.phone_e164,
      status = EXCLUDED.status,
      updated_at = now();

  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (p_user_id, 'ORG_ADMIN', v_org_id);

  INSERT INTO public.events (event_type, entity_type, entity_id, user_id, metadata)
  VALUES (
    'ONBOARDING_COMPLETED',
    'organization',
    v_org_id,
    p_user_id,
    jsonb_build_object(
      'organization_name', p_organization_name,
      'group_name', p_group_name,
      'whatsapp_provider_id', p_group_whatsapp_provider_id
    )
  );

  organization_id := v_org_id;
  group_id := v_group_id;
  RETURN NEXT;
END;
$$;
