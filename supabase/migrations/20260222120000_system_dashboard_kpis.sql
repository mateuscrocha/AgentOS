CREATE OR REPLACE FUNCTION public.get_system_dashboard_kpis(
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH filtered AS (
  SELECT
    m.group_id,
    m.member_id
  FROM public.messages m
  WHERE m.deleted_at IS NULL
    AND m.created_at >= p_start
    AND m.created_at <= p_end
),
group_orgs AS (
  SELECT DISTINCT
    f.group_id,
    g.organization_id
  FROM filtered f
  JOIN public.groups g ON g.id = f.group_id
  WHERE f.group_id IS NOT NULL
)
SELECT jsonb_build_object(
  'totalMessages', COALESCE((SELECT count(*)::integer FROM filtered), 0),
  'activeGroups', COALESCE((SELECT count(DISTINCT group_id)::integer FROM filtered), 0),
  'activeMembers', COALESCE((SELECT count(DISTINCT member_id)::integer FROM filtered), 0),
  'activeOrganizations', COALESCE((SELECT count(DISTINCT organization_id)::integer FROM group_orgs), 0)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_system_dashboard_kpis(timestamptz, timestamptz) TO authenticated;
