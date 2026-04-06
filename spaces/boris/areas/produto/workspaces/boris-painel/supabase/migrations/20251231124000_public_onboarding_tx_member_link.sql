CREATE OR REPLACE FUNCTION public.public_onboarding_provision_tx_v2(
  p_user_id uuid,
  p_lead_name text,
  p_lead_email text,
  p_lead_phone text,
  p_organization_name text,
  p_group_name text,
  p_group_invite_link text,
  p_group_whatsapp_provider_id text,
  p_participants jsonb
)
RETURNS TABLE (organization_id uuid, group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_group_id uuid;
  v_lead_phone_e164 text;
  v_existing_primary_contact_id uuid;
  v_member_id uuid;
  v_participant jsonb;
  v_participant_digits text;
  v_participant_phone_e164 text;
BEGIN
  -- Onboarding público: o usuário pode ou não ser membro do grupo. Só vinculamos como membro se o telefone já existir na tabela de membros do grupo. Caso contrário, ele é apenas o contato responsável da organização.

  v_lead_phone_e164 := NULL;
  IF p_lead_phone IS NOT NULL AND btrim(p_lead_phone) <> '' THEN
    IF left(btrim(p_lead_phone), 1) = '+' THEN
      v_lead_phone_e164 := regexp_replace(btrim(p_lead_phone), '\s+', '', 'g');
    ELSE
      v_lead_phone_e164 := regexp_replace(p_lead_phone, '\D', '', 'g');
      IF v_lead_phone_e164 IS NOT NULL AND v_lead_phone_e164 <> '' THEN
        IF left(v_lead_phone_e164, 2) = '55' AND length(v_lead_phone_e164) >= 10 THEN
          v_lead_phone_e164 := '+' || v_lead_phone_e164;
        ELSE
          v_lead_phone_e164 := '+55' || v_lead_phone_e164;
        END IF;
      ELSE
        v_lead_phone_e164 := NULL;
      END IF;
    END IF;
  END IF;

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
    v_lead_phone_e164
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
  VALUES (p_user_id, p_lead_name, v_lead_phone_e164, 'active')
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      phone_e164 = EXCLUDED.phone_e164,
      status = EXCLUDED.status,
      updated_at = now();

  IF jsonb_typeof(p_participants) = 'array' THEN
    FOR v_participant IN
      SELECT value FROM jsonb_array_elements(p_participants) AS t(value)
    LOOP
      v_participant_digits := regexp_replace(COALESCE(v_participant->>'phone', ''), '\D', '', 'g');
      IF v_participant_digits IS NULL OR v_participant_digits = '' THEN
        CONTINUE;
      END IF;
      v_participant_phone_e164 := '+' || v_participant_digits;

      INSERT INTO public.members (
        group_id,
        name,
        phone_e164,
        is_admin,
        is_super_admin,
        whatsapp_provider_id,
        provider,
        first_seen_at,
        joined_at,
        status
      ) VALUES (
        v_group_id,
        COALESCE(NULLIF(v_participant->>'name', ''), v_participant_phone_e164),
        v_participant_phone_e164,
        COALESCE((v_participant->>'is_admin')::boolean, false),
        COALESCE((v_participant->>'is_super_admin')::boolean, false),
        COALESCE(NULLIF(v_participant->>'whatsapp_provider_id', ''), v_participant_digits),
        'whatsapp',
        now(),
        now(),
        'active'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_contacts'
  ) THEN
    SELECT id
      INTO v_existing_primary_contact_id
    FROM public.organization_contacts
    WHERE organization_id = v_org_id
      AND is_primary IS TRUE
    LIMIT 1;

    IF v_existing_primary_contact_id IS NOT NULL THEN
      UPDATE public.organization_contacts
      SET user_id = p_user_id,
          name = p_lead_name,
          email = p_lead_email,
          phone = v_lead_phone_e164,
          role_title = COALESCE(role_title, 'responsável principal'),
          contact_role = COALESCE(contact_role, 'responsavel_principal'),
          is_primary = TRUE,
          updated_at = now()
      WHERE id = v_existing_primary_contact_id;
    ELSE
      INSERT INTO public.organization_contacts (
        organization_id,
        user_id,
        name,
        email,
        phone,
        role_title,
        contact_role,
        is_primary,
        updated_at
      ) VALUES (
        v_org_id,
        p_user_id,
        p_lead_name,
        p_lead_email,
        v_lead_phone_e164,
        'responsável principal',
        'responsavel_principal',
        TRUE,
        now()
      );
    END IF;
  END IF;

  IF v_lead_phone_e164 IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'members'
        AND column_name = 'user_id'
    ) THEN
    SELECT id
      INTO v_member_id
    FROM public.members
    WHERE group_id = v_group_id
      AND phone_e164 = v_lead_phone_e164
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_member_id IS NOT NULL THEN
      UPDATE public.members
      SET user_id = p_user_id,
          updated_at = now()
      WHERE id = v_member_id;
    END IF;
  END IF;

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
