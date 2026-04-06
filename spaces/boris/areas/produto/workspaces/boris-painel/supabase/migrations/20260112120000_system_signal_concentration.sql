CREATE OR REPLACE FUNCTION public.get_system_signal_concentration(
  p_start timestamptz,
  p_end timestamptz,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH filtered AS (
  SELECT m.group_id, m.member_id
  FROM public.messages m
  WHERE m.deleted_at IS NULL
    AND m.created_at >= p_start
    AND m.created_at <= p_end
),
totals AS (
  SELECT
    count(*)::integer AS total_messages,
    count(DISTINCT group_id)::integer AS active_groups
  FROM filtered
),
grouped AS (
  SELECT
    f.group_id,
    count(*)::integer AS messages_count,
    count(DISTINCT f.member_id)::integer AS active_members
  FROM filtered f
  GROUP BY f.group_id
),
top_groups AS (
  SELECT
    g.group_id,
    gr.name AS group_name,
    g.messages_count,
    g.active_members
  FROM grouped g
  JOIN public.groups gr ON gr.id = g.group_id
  WHERE gr.deleted_at IS NULL
  ORDER BY g.messages_count DESC, gr.name ASC
  LIMIT GREATEST(1, COALESCE(NULLIF(p_limit, 0), 5))
),
top_first AS (
  SELECT tg.group_id, tg.group_name, tg.messages_count
  FROM top_groups tg
  ORDER BY tg.messages_count DESC, tg.group_name ASC
  LIMIT 1
)
SELECT CASE
  WHEN (SELECT total_messages FROM totals) = 0 THEN NULL
  ELSE jsonb_build_object(
    'groupId', (SELECT group_id FROM top_first),
    'groupName', (SELECT group_name FROM top_first),
    'share', (
      SELECT round(100.0 * (SELECT messages_count FROM top_first)::numeric / (SELECT total_messages FROM totals)::numeric)::integer
    ),
    'topGroups', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', tg.group_id,
            'name', tg.group_name,
            'count', tg.messages_count,
            'activeMembers', tg.active_members
          )
          ORDER BY tg.messages_count DESC, tg.group_name ASC
        ),
        '[]'::jsonb
      )
      FROM top_groups tg
    ),
    'totalMessages', (SELECT total_messages FROM totals),
    'activeGroups', (SELECT active_groups FROM totals)
  )
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_signal_concentration(timestamptz, timestamptz, integer) TO authenticated;
