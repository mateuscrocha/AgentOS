DO $$
BEGIN
  IF to_regclass('public.org_collaborator_overrides') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.vw_collaborator_overrides_norm
      WITH (security_invoker = true)
      AS
      SELECT
        organization_id,
        collaborator_key AS collaborator_ref,
        CASE WHEN status = 'external' THEN 'external' ELSE 'active' END AS classification
      FROM public.org_collaborator_overrides
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.vw_collaborator_overrides_norm
      WITH (security_invoker = true)
      AS
      SELECT
        organization_id,
        COALESCE(phone_e164, provider_member_id) AS collaborator_ref,
        COALESCE(classification, 'active') AS classification
      FROM public.collaborator_overrides
      WHERE deleted_at IS NULL
    $sql$;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.vw_org_collaborators
WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    g.organization_id,
    COALESCE(m.phone_e164, m.provider_member_id) AS collaborator_ref,
    MAX(m.phone_e164) AS phone_e164,
    MAX(m.provider_member_id) AS provider_member_id,
    COALESCE(
      MAX(NULLIF(m.display_name, '')),
      MAX(NULLIF(m.name, '')),
      MAX(m.phone_e164),
      MAX(m.provider_member_id)
    ) AS display_name,
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
LEFT JOIN public.vw_collaborator_overrides_norm o
  ON o.organization_id = b.organization_id
  AND o.collaborator_ref = b.collaborator_ref;

NOTIFY pgrst, 'reload schema';
