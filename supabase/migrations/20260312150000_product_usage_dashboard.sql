ALTER TABLE public.user_activity_log
  DROP CONSTRAINT IF EXISTS user_activity_log_page_check;

ALTER TABLE public.user_activity_log
  ADD CONSTRAINT user_activity_log_page_check
    CHECK (
      page IS NULL OR page IN (
        'dashboard',
        'grupos',
        'configuracoes',
        'usuarios',
        'relatorios',
        'resumos',
        'alertas',
        'insights',
        'onboarding'
      )
    );

CREATE OR REPLACE FUNCTION public.system_activity_kpis(
  _start timestamptz,
  _end timestamptz,
  _today_start timestamptz DEFAULT date_trunc('day', now())
)
RETURNS TABLE(
  organizations_total bigint,
  organizations_with_activity bigint,
  admins_active bigint,
  logins bigint,
  page_views bigint,
  never_logged_in_users bigint,
  admins_active_today bigint,
  admins_active_7d bigint,
  users_inactive_30d bigint,
  orgs_at_risk bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH orgs AS (
    SELECT o.id
    FROM public.organizations o
    WHERE o.deleted_at IS NULL
  ),
  relevant_users AS (
    SELECT DISTINCT au.id AS user_id, au.last_sign_in_at
    FROM auth.users au
    JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE au.deleted_at IS NULL
  ),
  user_facts AS (
    SELECT
      ru.user_id,
      COALESCE(uaf.first_login_at, ru.last_sign_in_at) AS first_login_at,
      COALESCE(uaf.last_login_at, ru.last_sign_in_at) AS last_login_at,
      COALESCE(uaf.last_seen_at, uaf.last_login_at, ru.last_sign_in_at) AS last_seen_at
    FROM relevant_users ru
    LEFT JOIN public.user_access_facts uaf ON uaf.user_id = ru.user_id
  ),
  current_logs AS (
    SELECT *
    FROM public.user_activity_log l
    WHERE l.role = 'org_admin'
      AND l.created_at >= _start
      AND l.created_at <= _end
  ),
  org_admin_membership AS (
    SELECT DISTINCT ur.organization_id AS org_id, ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'ORG_ADMIN'
      AND ur.organization_id IS NOT NULL
  ),
  org_last_signal AS (
    SELECT
      o.id AS org_id,
      MAX(uf.last_login_at) AS last_login_at,
      GREATEST(
        COALESCE(MAX(uf.last_seen_at), '-infinity'::timestamptz),
        COALESCE(MAX(al.created_at), '-infinity'::timestamptz)
      ) AS last_signal_at
    FROM orgs o
    LEFT JOIN org_admin_membership oam ON oam.org_id = o.id
    LEFT JOIN user_facts uf ON uf.user_id = oam.user_id
    LEFT JOIN public.user_activity_log al ON al.org_id = o.id AND al.role = 'org_admin'
    GROUP BY o.id
  ),
  classified_orgs AS (
    SELECT
      ols.org_id,
      CASE
        WHEN ols.last_login_at IS NULL THEN 'abandonada'
        WHEN ols.last_signal_at >= (_end - interval '3 days') THEN 'engajada'
        WHEN ols.last_login_at >= (_end - interval '7 days') THEN 'ativa'
        WHEN ols.last_login_at >= (_end - interval '30 days') THEN 'morna'
        ELSE 'em_risco'
      END AS status
    FROM org_last_signal ols
  )
  SELECT
    (SELECT COUNT(*) FROM orgs) AS organizations_total,
    (SELECT COUNT(DISTINCT org_id) FROM current_logs) AS organizations_with_activity,
    (SELECT COUNT(DISTINCT user_id) FROM current_logs) AS admins_active,
    (SELECT COUNT(*) FROM current_logs WHERE event_type = 'login') AS logins,
    (SELECT COUNT(*) FROM current_logs WHERE event_type = 'page_view') AS page_views,
    (SELECT COUNT(*) FROM user_facts WHERE last_login_at IS NULL) AS never_logged_in_users,
    (
      SELECT COUNT(DISTINCT user_id)
      FROM public.user_activity_log l
      WHERE l.role = 'org_admin'
        AND l.created_at >= _today_start
        AND l.created_at <= _end
    ) AS admins_active_today,
    (
      SELECT COUNT(DISTINCT user_id)
      FROM public.user_activity_log l
      WHERE l.role = 'org_admin'
        AND l.created_at >= (_end - interval '7 days')
        AND l.created_at <= _end
    ) AS admins_active_7d,
    (
      SELECT COUNT(*)
      FROM user_facts uf
      WHERE uf.last_login_at IS NOT NULL
        AND (
          uf.last_seen_at IS NULL
          OR uf.last_seen_at < (_end - interval '30 days')
        )
    ) AS users_inactive_30d,
    (
      SELECT COUNT(*)
      FROM classified_orgs co
      WHERE co.status IN ('em_risco', 'abandonada')
    ) AS orgs_at_risk;
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_activity_kpis(timestamptz, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_activity_orgs_intelligence(
  _start timestamptz,
  _end timestamptz,
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _days_since_login_min int DEFAULT NULL,
  _days_since_login_max int DEFAULT NULL,
  _days_since_activity_min int DEFAULT NULL,
  _days_since_activity_max int DEFAULT NULL,
  _score_min int DEFAULT NULL,
  _score_max int DEFAULT NULL,
  _order_by text DEFAULT 'usage_score',
  _order_dir text DEFAULT 'desc',
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  org_id uuid,
  org_name text,
  status text,
  status_reason text,
  last_login_at timestamptz,
  last_activity_at timestamptz,
  admins_active int,
  active_days int,
  logins int,
  page_views int,
  actions_count int,
  usage_score int,
  days_since_login int,
  days_since_activity int,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH org_admin_membership AS (
    SELECT DISTINCT ur.organization_id AS org_id, ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'ORG_ADMIN'
      AND ur.organization_id IS NOT NULL
  ),
  user_logins AS (
    SELECT
      au.id AS user_id,
      COALESCE(uaf.last_login_at, au.last_sign_in_at) AS last_login_at,
      COALESCE(uaf.last_seen_at, uaf.last_login_at, au.last_sign_in_at) AS last_seen_at
    FROM auth.users au
    LEFT JOIN public.user_access_facts uaf ON uaf.user_id = au.id
    WHERE au.deleted_at IS NULL
  ),
  current_logs AS (
    SELECT *
    FROM public.user_activity_log l
    WHERE l.role = 'org_admin'
      AND l.created_at >= _start
      AND l.created_at <= _end
  ),
  org_metrics AS (
    SELECT
      l.org_id,
      COUNT(*) FILTER (WHERE l.event_type = 'login')::int AS logins,
      COUNT(*) FILTER (WHERE l.event_type = 'page_view')::int AS page_views,
      COUNT(DISTINCT l.user_id)::int AS admins_active,
      COUNT(DISTINCT (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date)::int AS active_days,
      MAX(l.created_at) AS last_activity_in_period
    FROM current_logs l
    WHERE l.org_id IS NOT NULL
    GROUP BY l.org_id
  ),
  action_metrics AS (
    SELECT
      ur.organization_id AS org_id,
      COUNT(*)::int AS actions_count
    FROM public.events e
    JOIN public.user_roles ur
      ON ur.user_id = e.user_id
     AND ur.role = 'ORG_ADMIN'
     AND ur.organization_id IS NOT NULL
    WHERE e.created_at >= _start
      AND e.created_at <= _end
    GROUP BY ur.organization_id
  ),
  org_last_signal AS (
    SELECT
      o.id AS org_id,
      MAX(ul.last_login_at) AS last_login_at,
      GREATEST(
        COALESCE(MAX(ul.last_seen_at), '-infinity'::timestamptz),
        COALESCE(MAX(al.created_at), '-infinity'::timestamptz)
      ) AS last_activity_at
    FROM public.organizations o
    LEFT JOIN org_admin_membership oam ON oam.org_id = o.id
    LEFT JOIN user_logins ul ON ul.user_id = oam.user_id
    LEFT JOIN public.user_activity_log al ON al.org_id = o.id AND al.role = 'org_admin'
    WHERE o.deleted_at IS NULL
    GROUP BY o.id
  ),
  base AS (
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      ols.last_login_at,
      NULLIF(ols.last_activity_at, '-infinity'::timestamptz) AS last_activity_at,
      COALESCE(om.admins_active, 0) AS admins_active,
      COALESCE(om.active_days, 0) AS active_days,
      COALESCE(om.logins, 0) AS logins,
      COALESCE(om.page_views, 0) AS page_views,
      COALESCE(am.actions_count, 0) AS actions_count,
      CASE
        WHEN ols.last_login_at IS NULL THEN 'abandonada'
        WHEN NULLIF(ols.last_activity_at, '-infinity'::timestamptz) IS NOT NULL
          AND NULLIF(ols.last_activity_at, '-infinity'::timestamptz) >= (_end - interval '3 days') THEN 'engajada'
        WHEN ols.last_login_at >= (_end - interval '7 days') THEN 'ativa'
        WHEN ols.last_login_at >= (_end - interval '30 days') THEN 'morna'
        ELSE 'em_risco'
      END AS status,
      CASE
        WHEN ols.last_login_at IS NULL THEN 'Nenhum admin da organização registrou login.'
        WHEN NULLIF(ols.last_activity_at, '-infinity'::timestamptz) IS NOT NULL
          AND NULLIF(ols.last_activity_at, '-infinity'::timestamptz) >= (_end - interval '3 days') THEN 'Houve login ou atividade nos últimos 3 dias.'
        WHEN ols.last_login_at >= (_end - interval '7 days') THEN 'O último login ocorreu dentro de 7 dias.'
        WHEN ols.last_login_at >= (_end - interval '30 days') THEN 'O último login ocorreu dentro de 30 dias.'
        ELSE 'Sem login recente há mais de 30 dias.'
      END AS status_reason,
      CASE
        WHEN ols.last_login_at IS NULL THEN NULL
        ELSE GREATEST(0, floor(extract(epoch FROM (_end - ols.last_login_at)) / 86400))::int
      END AS days_since_login,
      CASE
        WHEN NULLIF(ols.last_activity_at, '-infinity'::timestamptz) IS NULL THEN NULL
        ELSE GREATEST(0, floor(extract(epoch FROM (_end - NULLIF(ols.last_activity_at, '-infinity'::timestamptz))) / 86400))::int
      END AS days_since_activity,
      LEAST(
        100,
        ROUND(
          LEAST(COALESCE(om.logins, 0), 15) * 2.5 +
          LEAST(COALESCE(om.page_views, 0), 40) * 1.1 +
          LEAST(COALESCE(om.active_days, 0), 15) * 3.2 +
          LEAST(COALESCE(am.actions_count, 0), 10) * 3.8
        )
      )::int AS usage_score
    FROM public.organizations o
    LEFT JOIN org_last_signal ols ON ols.org_id = o.id
    LEFT JOIN org_metrics om ON om.org_id = o.id
    LEFT JOIN action_metrics am ON am.org_id = o.id
    WHERE o.deleted_at IS NULL
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE (
      _search IS NULL
      OR btrim(_search) = ''
      OR lower(b.org_name) LIKE ('%' || lower(btrim(_search)) || '%')
      OR b.org_id::text LIKE ('%' || btrim(_search) || '%')
    )
    AND (
      _status IS NULL
      OR btrim(_status) = ''
      OR b.status = _status
    )
    AND (
      _days_since_login_min IS NULL
      OR COALESCE(b.days_since_login, 100000) >= _days_since_login_min
    )
    AND (
      _days_since_login_max IS NULL
      OR COALESCE(b.days_since_login, 100000) <= _days_since_login_max
    )
    AND (
      _days_since_activity_min IS NULL
      OR COALESCE(b.days_since_activity, 100000) >= _days_since_activity_min
    )
    AND (
      _days_since_activity_max IS NULL
      OR COALESCE(b.days_since_activity, 100000) <= _days_since_activity_max
    )
    AND (
      _score_min IS NULL
      OR b.usage_score >= _score_min
    )
    AND (
      _score_max IS NULL
      OR b.usage_score <= _score_max
    )
  )
  SELECT
    f.org_id,
    f.org_name,
    f.status,
    f.status_reason,
    f.last_login_at,
    f.last_activity_at,
    f.admins_active,
    f.active_days,
    f.logins,
    f.page_views,
    f.actions_count,
    f.usage_score,
    f.days_since_login,
    f.days_since_activity,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY
    CASE WHEN _order_by = 'org_name' AND _order_dir = 'asc' THEN f.org_name END ASC,
    CASE WHEN _order_by = 'org_name' AND _order_dir = 'desc' THEN f.org_name END DESC,
    CASE WHEN _order_by = 'status' AND _order_dir = 'asc' THEN f.status END ASC,
    CASE WHEN _order_by = 'status' AND _order_dir = 'desc' THEN f.status END DESC,
    CASE WHEN _order_by = 'last_login_at' AND _order_dir = 'asc' THEN f.last_login_at END ASC NULLS LAST,
    CASE WHEN _order_by = 'last_login_at' AND _order_dir = 'desc' THEN f.last_login_at END DESC NULLS LAST,
    CASE WHEN _order_by = 'last_activity_at' AND _order_dir = 'asc' THEN f.last_activity_at END ASC NULLS LAST,
    CASE WHEN _order_by = 'last_activity_at' AND _order_dir = 'desc' THEN f.last_activity_at END DESC NULLS LAST,
    CASE WHEN _order_by = 'usage_score' AND _order_dir = 'asc' THEN f.usage_score END ASC,
    CASE WHEN _order_by = 'usage_score' AND _order_dir = 'desc' THEN f.usage_score END DESC,
    CASE WHEN _order_by = 'logins' AND _order_dir = 'asc' THEN f.logins END ASC,
    CASE WHEN _order_by = 'logins' AND _order_dir = 'desc' THEN f.logins END DESC,
    f.org_name ASC
  LIMIT GREATEST(1, LEAST(200, COALESCE(_limit, 20)))
  OFFSET GREATEST(0, COALESCE(_offset, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_activity_orgs_intelligence(timestamptz, timestamptz, text, text, int, int, int, int, int, int, text, text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_activity_daily_metrics(
  _start timestamptz,
  _end timestamptz
)
RETURNS TABLE(
  day date,
  admins_active bigint,
  logins bigint,
  page_views bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
    COUNT(DISTINCT l.user_id) AS admins_active,
    COUNT(*) FILTER (WHERE l.event_type = 'login') AS logins,
    COUNT(*) FILTER (WHERE l.event_type = 'page_view') AS page_views
  FROM public.user_activity_log l
  WHERE l.role = 'org_admin'
    AND l.created_at >= _start
    AND l.created_at <= _end
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_activity_daily_metrics(timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_activity_daily_org_status(
  _start timestamptz,
  _end timestamptz
)
RETURNS TABLE(
  day date,
  orgs_active bigint,
  orgs_inactive bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH total_orgs AS (
    SELECT COUNT(*)::bigint AS total
    FROM public.organizations o
    WHERE o.deleted_at IS NULL
  )
  SELECT
    daily.day,
    daily.orgs_active,
    GREATEST(0, (SELECT total FROM total_orgs) - daily.orgs_active) AS orgs_inactive
  FROM (
    SELECT
      (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
      COUNT(DISTINCT l.org_id) AS orgs_active
    FROM public.user_activity_log l
    WHERE l.role = 'org_admin'
      AND l.org_id IS NOT NULL
      AND l.created_at >= _start
      AND l.created_at <= _end
    GROUP BY 1
  ) daily
  ORDER BY daily.day;
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_activity_daily_org_status(timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_activity_recent_timeline(
  _start timestamptz,
  _end timestamptz,
  _limit int DEFAULT 20
)
RETURNS TABLE(
  created_at timestamptz,
  actor_name text,
  org_name text,
  event_kind text,
  event_label text,
  route text,
  page text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH usage_events AS (
    SELECT
      l.created_at,
      COALESCE(NULLIF(p.name, ''), 'Usuário') AS actor_name,
      o.name AS org_name,
      l.event_type AS event_kind,
      CASE
        WHEN l.event_type = 'login' THEN 'fez login'
        WHEN l.event_type = 'page_view' AND l.page = 'dashboard' THEN 'abriu dashboard geral'
        WHEN l.event_type = 'page_view' AND l.page = 'resumos' THEN 'acessou resumos'
        WHEN l.event_type = 'page_view' AND l.page = 'alertas' THEN 'acessou alertas'
        WHEN l.event_type = 'page_view' AND l.page = 'insights' THEN 'acessou insights'
        WHEN l.event_type = 'page_view' THEN 'abriu uma página'
        ELSE l.event_type
      END AS event_label,
      l.route,
      l.page
    FROM public.user_activity_log l
    LEFT JOIN public.profiles p ON p.id = l.user_id
    LEFT JOIN public.organizations o ON o.id = l.org_id
    WHERE l.created_at >= _start
      AND l.created_at <= _end
  ),
  audit_events AS (
    SELECT
      e.created_at,
      COALESCE(NULLIF(p.name, ''), 'Usuário') AS actor_name,
      COALESCE(org.name, org_from_group.name) AS org_name,
      e.event_type AS event_kind,
      CASE
        WHEN e.event_type = 'ORG_UPDATED' THEN 'alterou configurações da organização'
        WHEN e.event_type = 'GROUP_UPDATED' THEN 'alterou configurações do grupo'
        WHEN e.event_type = 'ORG_ADMIN_ASSIGNED' THEN 'atribuiu um admin à organização'
        WHEN e.event_type = 'GROUP_MANAGER_ADDED' THEN 'adicionou um gestor ao grupo'
        WHEN e.event_type = 'GROUP_MEMBER_ADDED' THEN 'adicionou um participante ao grupo'
        WHEN e.event_type = 'ORG_ACCESS_GRANTED' THEN 'acessou a organização'
        WHEN e.event_type = 'ORG_CREATED' THEN 'criou uma organização'
        WHEN e.event_type = 'GROUP_CREATED' THEN 'criou um grupo'
        ELSE replace(lower(e.event_type), '_', ' ')
      END AS event_label,
      e.metadata->>'path' AS route,
      CASE
        WHEN coalesce(e.metadata->>'path', '') ilike '%/groups%' THEN 'grupos'
        WHEN coalesce(e.metadata->>'path', '') ilike '%/settings%' THEN 'configuracoes'
        ELSE 'configuracoes'
      END AS page
    FROM public.events e
    LEFT JOIN public.profiles p ON p.id = e.user_id
    LEFT JOIN public.organizations org
      ON e.entity_type = 'organization'
     AND org.id = e.entity_id
    LEFT JOIN public.groups g
      ON e.entity_type = 'group'
     AND g.id = e.entity_id
    LEFT JOIN public.organizations org_from_group ON org_from_group.id = g.organization_id
    WHERE e.created_at >= _start
      AND e.created_at <= _end
      AND e.event_type IN (
        'ORG_UPDATED',
        'GROUP_UPDATED',
        'ORG_ADMIN_ASSIGNED',
        'GROUP_MANAGER_ADDED',
        'GROUP_MEMBER_ADDED',
        'ORG_ACCESS_GRANTED',
        'ORG_CREATED',
        'GROUP_CREATED'
      )
  )
  SELECT *
  FROM (
    SELECT * FROM usage_events
    UNION ALL
    SELECT * FROM audit_events
  ) combined
  ORDER BY combined.created_at DESC
  LIMIT GREATEST(1, LEAST(100, COALESCE(_limit, 20)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_activity_recent_timeline(timestamptz, timestamptz, int) TO authenticated;
