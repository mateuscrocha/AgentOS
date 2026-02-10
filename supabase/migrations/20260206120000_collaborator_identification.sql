CREATE TABLE IF NOT EXISTS public.collaborator_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_e164 text NULL,
  provider_member_id text NULL,
  classification text NOT NULL DEFAULT 'active' CHECK (classification IN ('active', 'external')),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT collaborator_overrides_identity_chk CHECK (phone_e164 IS NOT NULL OR provider_member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collaborator_overrides_org_phone_unique
  ON public.collaborator_overrides (organization_id, phone_e164)
  WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collaborator_overrides_org_provider_unique
  ON public.collaborator_overrides (organization_id, provider_member_id)
  WHERE provider_member_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_collaborator_overrides_org_active
  ON public.collaborator_overrides (organization_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_collaborator_overrides_updated_at ON public.collaborator_overrides;
CREATE TRIGGER update_collaborator_overrides_updated_at
  BEFORE UPDATE ON public.collaborator_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.collaborator_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view collaborator overrides" ON public.collaborator_overrides;
CREATE POLICY "Users can view collaborator overrides"
  ON public.collaborator_overrides
  FOR SELECT
  TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Org admins can insert collaborator overrides" ON public.collaborator_overrides;
CREATE POLICY "Org admins can insert collaborator overrides"
  ON public.collaborator_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.can_edit_org(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Org admins can update collaborator overrides" ON public.collaborator_overrides;
CREATE POLICY "Org admins can update collaborator overrides"
  ON public.collaborator_overrides
  FOR UPDATE
  TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.can_edit_org(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.can_edit_org(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Org admins can delete collaborator overrides" ON public.collaborator_overrides;
CREATE POLICY "Org admins can delete collaborator overrides"
  ON public.collaborator_overrides
  FOR DELETE
  TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.can_edit_org(auth.uid(), organization_id)
  );

CREATE OR REPLACE VIEW public.vw_org_collaborators
WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    g.organization_id,
    COALESCE(m.phone_e164, m.provider_member_id) AS collaborator_ref,
    MAX(m.phone_e164) AS phone_e164,
    MAX(m.provider_member_id) AS provider_member_id,
    MAX(COALESCE(NULLIF(m.display_name, ''), NULLIF(m.name, ''), m.phone_e164, m.provider_member_id)) AS display_name,
    MAX(m.profile_pic_url) AS profile_pic_url,
    ARRAY_AGG(DISTINCT m.group_id) AS group_ids,
    COUNT(DISTINCT m.group_id)::int AS groups_count
  FROM public.members m
  JOIN public.groups g ON g.id = m.group_id
  WHERE m.deleted_at IS NULL
    AND g.deleted_at IS NULL
    AND g.is_archived IS DISTINCT FROM true
    AND (
      m.is_admin IS TRUE
      OR m.is_super_admin IS TRUE
      OR m.is_owner IS TRUE
    )
    AND COALESCE(m.phone_e164, m.provider_member_id) IS NOT NULL
  GROUP BY g.organization_id, COALESCE(m.phone_e164, m.provider_member_id)
)
SELECT
  b.organization_id,
  b.collaborator_ref,
  b.phone_e164,
  b.provider_member_id,
  b.display_name,
  b.profile_pic_url,
  b.group_ids,
  b.groups_count,
  COALESCE(o.classification, 'active') AS classification
FROM base b
LEFT JOIN public.collaborator_overrides o
  ON o.organization_id = b.organization_id
  AND o.deleted_at IS NULL
  AND COALESCE(o.phone_e164, o.provider_member_id) = b.collaborator_ref;

CREATE OR REPLACE VIEW public.vw_group_collaborators
WITH (security_invoker = true)
AS
SELECT
  m.group_id,
  g.organization_id,
  m.id AS member_id,
  COALESCE(m.phone_e164, m.provider_member_id) AS collaborator_ref,
  m.phone_e164,
  m.provider_member_id,
  COALESCE(NULLIF(m.display_name, ''), NULLIF(m.name, ''), m.phone_e164, m.provider_member_id) AS display_name,
  m.profile_pic_url,
  COALESCE(o.classification, 'active') AS classification,
  m.is_admin,
  m.is_super_admin,
  m.is_owner
FROM public.members m
JOIN public.groups g ON g.id = m.group_id
LEFT JOIN public.collaborator_overrides o
  ON o.organization_id = g.organization_id
  AND o.deleted_at IS NULL
  AND COALESCE(o.phone_e164, o.provider_member_id) = COALESCE(m.phone_e164, m.provider_member_id)
WHERE m.deleted_at IS NULL
  AND g.deleted_at IS NULL
  AND g.is_archived IS DISTINCT FROM true
  AND (
    m.is_admin IS TRUE
    OR m.is_super_admin IS TRUE
    OR m.is_owner IS TRUE
  )
  AND COALESCE(m.phone_e164, m.provider_member_id) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.org_collaborator_kpis(
  _org_id uuid,
  _start timestamptz,
  _end timestamptz
)
RETURNS TABLE(
  collaborator_ref text,
  phone_e164 text,
  provider_member_id text,
  display_name text,
  profile_pic_url text,
  classification text,
  groups_count int,
  groups_active int,
  messages_total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_system_admin(auth.uid()) OR public.has_org_access(auth.uid(), _org_id)) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH collabs AS (
    SELECT *
    FROM public.vw_org_collaborators
    WHERE organization_id = _org_id
  ),
  msg AS (
    SELECT
      COALESCE(mem.phone_e164, mem.provider_member_id) AS collaborator_ref,
      COUNT(*)::bigint AS messages_total,
      COUNT(DISTINCT mem.group_id)::int AS groups_active
    FROM public.messages m
    JOIN public.members mem ON mem.id = m.member_id
    JOIN public.groups g ON g.id = m.group_id
    WHERE g.organization_id = _org_id
      AND m.deleted_at IS NULL
      AND mem.deleted_at IS NULL
      AND g.deleted_at IS NULL
      AND g.is_archived IS DISTINCT FROM true
      AND m.created_at >= _start
      AND m.created_at <= _end
      AND (
        mem.is_admin IS TRUE
        OR mem.is_super_admin IS TRUE
        OR mem.is_owner IS TRUE
      )
      AND COALESCE(mem.phone_e164, mem.provider_member_id) IS NOT NULL
    GROUP BY COALESCE(mem.phone_e164, mem.provider_member_id)
  )
  SELECT
    c.collaborator_ref,
    c.phone_e164,
    c.provider_member_id,
    c.display_name,
    c.profile_pic_url,
    c.classification,
    c.groups_count,
    COALESCE(msg.groups_active, 0) AS groups_active,
    COALESCE(msg.messages_total, 0) AS messages_total
  FROM collabs c
  LEFT JOIN msg ON msg.collaborator_ref = c.collaborator_ref;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_collaborator_group_kpis(
  _org_id uuid,
  _start timestamptz,
  _end timestamptz
)
RETURNS TABLE(
  collaborator_ref text,
  group_id uuid,
  group_name text,
  messages_total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_system_admin(auth.uid()) OR public.has_org_access(auth.uid(), _org_id)) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(mem.phone_e164, mem.provider_member_id) AS collaborator_ref,
    g.id AS group_id,
    g.name AS group_name,
    COUNT(*)::bigint AS messages_total
  FROM public.messages m
  JOIN public.members mem ON mem.id = m.member_id
  JOIN public.groups g ON g.id = m.group_id
  WHERE g.organization_id = _org_id
    AND m.deleted_at IS NULL
    AND mem.deleted_at IS NULL
    AND g.deleted_at IS NULL
    AND g.is_archived IS DISTINCT FROM true
    AND m.created_at >= _start
    AND m.created_at <= _end
    AND (
      mem.is_admin IS TRUE
      OR mem.is_super_admin IS TRUE
      OR mem.is_owner IS TRUE
    )
    AND COALESCE(mem.phone_e164, mem.provider_member_id) IS NOT NULL
  GROUP BY COALESCE(mem.phone_e164, mem.provider_member_id), g.id, g.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_team_collaborator_kpis(
  _org_id uuid,
  _start timestamptz,
  _end timestamptz
)
RETURNS TABLE(
  collaborators_total bigint,
  collaborators_active bigint,
  collaborators_external bigint,
  collaborators_active_in_period bigint,
  messages_from_collaborators bigint,
  messages_total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_system_admin(auth.uid()) OR public.has_org_access(auth.uid(), _org_id)) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH collabs AS (
    SELECT *
    FROM public.vw_org_collaborators
    WHERE organization_id = _org_id
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint AS collaborators_total,
      COUNT(*) FILTER (WHERE classification = 'active')::bigint AS collaborators_active,
      COUNT(*) FILTER (WHERE classification = 'external')::bigint AS collaborators_external
    FROM collabs
  ),
  msg_total AS (
    SELECT COUNT(*)::bigint AS messages_total
    FROM public.messages m
    JOIN public.groups g ON g.id = m.group_id
    WHERE g.organization_id = _org_id
      AND m.deleted_at IS NULL
      AND g.deleted_at IS NULL
      AND g.is_archived IS DISTINCT FROM true
      AND m.created_at >= _start
      AND m.created_at <= _end
  ),
  msg_collabs AS (
    SELECT
      COUNT(*)::bigint AS messages_from_collaborators,
      COUNT(DISTINCT COALESCE(mem.phone_e164, mem.provider_member_id))::bigint AS collaborators_active_in_period
    FROM public.messages m
    JOIN public.members mem ON mem.id = m.member_id
    JOIN public.groups g ON g.id = m.group_id
    JOIN collabs c ON c.collaborator_ref = COALESCE(mem.phone_e164, mem.provider_member_id)
    WHERE g.organization_id = _org_id
      AND m.deleted_at IS NULL
      AND mem.deleted_at IS NULL
      AND g.deleted_at IS NULL
      AND g.is_archived IS DISTINCT FROM true
      AND m.created_at >= _start
      AND m.created_at <= _end
      AND c.classification = 'active'
  )
  SELECT
    totals.collaborators_total,
    totals.collaborators_active,
    totals.collaborators_external,
    COALESCE(msg_collabs.collaborators_active_in_period, 0) AS collaborators_active_in_period,
    COALESCE(msg_collabs.messages_from_collaborators, 0) AS messages_from_collaborators,
    COALESCE(msg_total.messages_total, 0) AS messages_total
  FROM totals
  CROSS JOIN msg_total
  LEFT JOIN msg_collabs ON true;
END;
$$;
