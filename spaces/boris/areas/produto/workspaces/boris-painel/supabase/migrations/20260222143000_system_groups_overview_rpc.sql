CREATE OR REPLACE FUNCTION public.get_system_groups_overview()
RETURNS TABLE (
  total integer,
  active integer,
  inactive integer,
  avg_members integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH groups_base AS (
    SELECT g.id, g.status
    FROM public.groups g
    WHERE COALESCE(g.is_archived, false) = false
  ),
  members_stats AS (
    SELECT
      ROUND(COALESCE(AVG(COALESCE(v.members_count, 0)), 0))::integer AS avg_members
    FROM public.v_group_overview v
    WHERE COALESCE(v.is_archived, false) = false
  )
  SELECT
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE gb.status = 'active')::integer AS active,
    COUNT(*) FILTER (WHERE gb.status = 'inactive')::integer AS inactive,
    COALESCE(ms.avg_members, 0)::integer AS avg_members
  FROM groups_base gb
  CROSS JOIN members_stats ms;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_groups_overview() TO authenticated;
