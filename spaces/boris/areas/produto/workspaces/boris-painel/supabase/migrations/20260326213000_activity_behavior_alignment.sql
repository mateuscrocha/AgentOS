ALTER TABLE public.user_activity_log
  DROP CONSTRAINT IF EXISTS user_activity_log_page_check;

ALTER TABLE public.user_activity_log
  ADD CONSTRAINT user_activity_log_page_check
    CHECK (
      page IS NULL OR page IN (
        'dashboard',
        'organizacoes',
        'grupos',
        'membros',
        'mensagens',
        'suporte',
        'eventos',
        'enquetes',
        'crm',
        'configuracoes',
        'usuarios',
        'relatorios',
        'resumos',
        'alertas',
        'insights',
        'onboarding'
      )
    );

CREATE OR REPLACE FUNCTION public.activity_top_pages(
  _start timestamptz,
  _end timestamptz,
  _limit int DEFAULT 10
)
RETURNS TABLE(
  page text,
  page_views bigint,
  admins bigint
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
    l.page,
    COUNT(*) AS page_views,
    COUNT(DISTINCT l.user_id) AS admins
  FROM public.user_activity_log l
  WHERE l.role IN ('system_admin', 'org_admin', 'group_admin', 'viewer')
    AND l.event_type = 'page_view'
    AND l.page IS NOT NULL
    AND l.created_at >= _start
    AND l.created_at <= _end
  GROUP BY l.page
  ORDER BY page_views DESC, admins DESC, l.page ASC
  LIMIT GREATEST(1, LEAST(50, COALESCE(_limit, 10)));
END;
$$;

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
  scoped_users AS (
    SELECT DISTINCT
      ur.user_id,
      COALESCE(ur.organization_id, g.organization_id) AS org_id,
      ur.role
    FROM public.user_roles ur
    LEFT JOIN public.groups g ON g.id = ur.group_id
    WHERE ur.role IN ('ORG_ADMIN', 'GROUP_MANAGER', 'USER')
      AND COALESCE(ur.organization_id, g.organization_id) IS NOT NULL
  ),
  relevant_users AS (
    SELECT DISTINCT au.id AS user_id, au.last_sign_in_at
    FROM auth.users au
    JOIN scoped_users su ON su.user_id = au.id
    WHERE au.deleted_at IS NULL
  ),
  all_users AS (
    SELECT au.id AS user_id, au.last_sign_in_at
    FROM auth.users au
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
  all_user_facts AS (
    SELECT
      au.user_id,
      COALESCE(uaf.first_login_at, au.last_sign_in_at) AS first_login_at,
      COALESCE(uaf.last_login_at, au.last_sign_in_at) AS last_login_at,
      COALESCE(uaf.last_seen_at, uaf.last_login_at, au.last_sign_in_at) AS last_seen_at
    FROM all_users au
    LEFT JOIN public.user_access_facts uaf ON uaf.user_id = au.user_id
  ),
  current_logs AS (
    SELECT *
    FROM public.user_activity_log l
    WHERE l.role IN ('org_admin', 'group_admin', 'viewer')
      AND l.created_at >= _start
      AND l.created_at <= _end
  ),
  current_admin_logs AS (
    SELECT *
    FROM current_logs l
    WHERE l.role IN ('org_admin', 'group_admin')
  ),
  org_membership AS (
    SELECT DISTINCT su.org_id, su.user_id
    FROM scoped_users su
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
    LEFT JOIN org_membership om ON om.org_id = o.id
    LEFT JOIN user_facts uf ON uf.user_id = om.user_id
    LEFT JOIN public.user_activity_log al
      ON al.org_id = o.id
     AND al.role IN ('org_admin', 'group_admin', 'viewer')
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
    (SELECT COUNT(DISTINCT org_id) FROM current_logs WHERE org_id IS NOT NULL) AS organizations_with_activity,
    (SELECT COUNT(DISTINCT user_id) FROM current_admin_logs) AS admins_active,
    (SELECT COUNT(*) FROM current_logs WHERE event_type = 'login') AS logins,
    (SELECT COUNT(*) FROM current_logs WHERE event_type = 'page_view') AS page_views,
    (SELECT COUNT(*) FROM all_user_facts WHERE last_login_at IS NULL) AS never_logged_in_users,
    (
      SELECT COUNT(DISTINCT user_id)
      FROM public.user_activity_log l
      WHERE l.role IN ('org_admin', 'group_admin')
        AND l.created_at >= _today_start
        AND l.created_at <= _end
    ) AS admins_active_today,
    (
      SELECT COUNT(DISTINCT user_id)
      FROM public.user_activity_log l
      WHERE l.role IN ('org_admin', 'group_admin')
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
  WITH scoped_users AS (
    SELECT DISTINCT
      ur.user_id,
      COALESCE(ur.organization_id, g.organization_id) AS org_id,
      ur.role
    FROM public.user_roles ur
    LEFT JOIN public.groups g ON g.id = ur.group_id
    WHERE ur.role IN ('ORG_ADMIN', 'GROUP_MANAGER', 'USER')
      AND COALESCE(ur.organization_id, g.organization_id) IS NOT NULL
  ),
  org_membership AS (
    SELECT DISTINCT su.org_id, su.user_id
    FROM scoped_users su
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
    WHERE l.role IN ('org_admin', 'group_admin', 'viewer')
      AND l.created_at >= _start
      AND l.created_at <= _end
  ),
  org_metrics AS (
    SELECT
      l.org_id,
      COUNT(*) FILTER (WHERE l.event_type = 'login')::int AS logins,
      COUNT(*) FILTER (WHERE l.event_type = 'page_view')::int AS page_views,
      COUNT(DISTINCT l.user_id)::int AS active_users,
      COUNT(DISTINCT l.user_id) FILTER (WHERE l.role IN ('org_admin', 'group_admin'))::int AS admins_active,
      COUNT(DISTINCT (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date)::int AS active_days,
      MAX(l.created_at) AS last_activity_in_period
    FROM current_logs l
    WHERE l.org_id IS NOT NULL
    GROUP BY l.org_id
  ),
  action_events AS (
    SELECT DISTINCT
      e.id AS event_id,
      COALESCE(ur.organization_id, g.organization_id) AS org_id
    FROM public.events e
    JOIN public.user_roles ur
      ON ur.user_id = e.user_id
    LEFT JOIN public.groups g ON g.id = ur.group_id
    WHERE ur.role IN ('ORG_ADMIN', 'GROUP_MANAGER', 'USER')
      AND COALESCE(ur.organization_id, g.organization_id) IS NOT NULL
      AND e.created_at >= _start
      AND e.created_at <= _end
  ),
  action_metrics AS (
    SELECT
      ae.org_id,
      COUNT(*)::int AS actions_count
    FROM action_events ae
    GROUP BY ae.org_id
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
    LEFT JOIN org_membership om ON om.org_id = o.id
    LEFT JOIN user_logins ul ON ul.user_id = om.user_id
    LEFT JOIN public.user_activity_log al
      ON al.org_id = o.id
     AND al.role IN ('org_admin', 'group_admin', 'viewer')
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
        WHEN ols.last_login_at IS NULL THEN 'Nenhum usuario com acesso a organizacao registrou login.'
        WHEN NULLIF(ols.last_activity_at, '-infinity'::timestamptz) IS NOT NULL
          AND NULLIF(ols.last_activity_at, '-infinity'::timestamptz) >= (_end - interval '3 days') THEN 'Houve login ou atividade recente na organizacao.'
        WHEN ols.last_login_at >= (_end - interval '7 days') THEN 'O ultimo login ocorreu dentro de 7 dias.'
        WHEN ols.last_login_at >= (_end - interval '30 days') THEN 'O ultimo login ocorreu dentro de 30 dias.'
        ELSE 'Sem login recente ha mais de 30 dias.'
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

CREATE OR REPLACE FUNCTION public.system_user_activity_list(
  _start timestamptz,
  _end timestamptz,
  _recent_days int DEFAULT 7,
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _role text DEFAULT NULL,
  _order_by text DEFAULT 'last_seen_at',
  _order_dir text DEFAULT 'desc',
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  primary_role text,
  organization_id uuid,
  organization_name text,
  activity_status text,
  first_login_at timestamptz,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  page_views int,
  top_pages text[],
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
  WITH role_ranked AS (
    SELECT
      ur.user_id,
      ur.role,
      COALESCE(ur.organization_id, g.organization_id) AS organization_id,
      ROW_NUMBER() OVER (
        PARTITION BY ur.user_id
        ORDER BY
          CASE ur.role
            WHEN 'SYSTEM_ADMIN' THEN 4
            WHEN 'ORG_ADMIN' THEN 3
            WHEN 'GROUP_MANAGER' THEN 2
            ELSE 1
          END DESC,
          ur.created_at ASC
      ) AS rn
    FROM public.user_roles ur
    LEFT JOIN public.groups g ON g.id = ur.group_id
  ),
  role_primary AS (
    SELECT
      rr.user_id,
      rr.role AS primary_role,
      rr.organization_id
    FROM role_ranked rr
    WHERE rr.rn = 1
  ),
  log_window AS (
    SELECT *
    FROM public.user_activity_log l
    WHERE l.created_at >= _start
      AND l.created_at <= _end
  ),
  user_pages AS (
    SELECT
      l.user_id,
      COUNT(*) FILTER (WHERE l.event_type = 'page_view')::int AS page_views,
      ARRAY(
        SELECT lp.page
        FROM (
          SELECT l2.page, COUNT(*) AS views
          FROM log_window l2
          WHERE l2.user_id = l.user_id
            AND l2.event_type = 'page_view'
            AND l2.page IS NOT NULL
          GROUP BY l2.page
          ORDER BY views DESC, l2.page ASC
          LIMIT 2
        ) lp
      ) AS top_pages
    FROM log_window l
    GROUP BY l.user_id
  ),
  base AS (
    SELECT
      au.id AS user_id,
      COALESCE(NULLIF(p.name, ''), split_part(COALESCE(au.email, ''), '@', 1), au.id::text) AS user_name,
      COALESCE(rp.primary_role::text, 'USER') AS primary_role,
      rp.organization_id,
      o.name AS organization_name,
      COALESCE(uaf.first_login_at, au.last_sign_in_at) AS first_login_at,
      COALESCE(uaf.last_login_at, au.last_sign_in_at) AS last_login_at,
      COALESCE(uaf.last_seen_at, uaf.last_login_at, au.last_sign_in_at) AS last_seen_at,
      COALESCE(up.page_views, 0) AS page_views,
      COALESCE(up.top_pages, ARRAY[]::text[]) AS top_pages
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    LEFT JOIN public.user_access_facts uaf ON uaf.user_id = au.id
    LEFT JOIN role_primary rp ON rp.user_id = au.id
    LEFT JOIN public.organizations o ON o.id = rp.organization_id
    LEFT JOIN user_pages up ON up.user_id = au.id
    WHERE au.deleted_at IS NULL
  ),
  classified AS (
    SELECT
      b.*,
      CASE
        WHEN b.last_login_at IS NULL THEN 'never_logged_in'
        WHEN b.last_seen_at IS NOT NULL
          AND b.last_seen_at >= (_end - make_interval(days => GREATEST(1, COALESCE(_recent_days, 7)))) THEN 'active'
        ELSE 'inactive'
      END AS activity_status
    FROM base b
  ),
  filtered AS (
    SELECT *
    FROM classified b
    WHERE (
      _search IS NULL
      OR btrim(_search) = ''
      OR lower(b.user_name) LIKE ('%' || lower(btrim(_search)) || '%')
      OR b.user_id::text LIKE ('%' || btrim(_search) || '%')
      OR lower(COALESCE(b.organization_name, '')) LIKE ('%' || lower(btrim(_search)) || '%')
    )
    AND (
      _status IS NULL
      OR btrim(_status) = ''
      OR b.activity_status = _status
    )
    AND (
      _role IS NULL
      OR btrim(_role) = ''
      OR b.primary_role = _role
    )
  )
  SELECT
    f.user_id,
    f.user_name,
    f.primary_role,
    f.organization_id,
    f.organization_name,
    f.activity_status,
    f.first_login_at,
    f.last_login_at,
    f.last_seen_at,
    f.page_views,
    f.top_pages,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY
    CASE WHEN _order_by = 'user_name' AND _order_dir = 'asc' THEN f.user_name END ASC,
    CASE WHEN _order_by = 'user_name' AND _order_dir = 'desc' THEN f.user_name END DESC,
    CASE WHEN _order_by = 'last_login_at' AND _order_dir = 'asc' THEN f.last_login_at END ASC NULLS LAST,
    CASE WHEN _order_by = 'last_login_at' AND _order_dir = 'desc' THEN f.last_login_at END DESC NULLS LAST,
    CASE WHEN _order_by = 'last_seen_at' AND _order_dir = 'asc' THEN f.last_seen_at END ASC NULLS LAST,
    CASE WHEN _order_by = 'last_seen_at' AND _order_dir = 'desc' THEN f.last_seen_at END DESC NULLS LAST,
    CASE WHEN _order_by = 'page_views' AND _order_dir = 'asc' THEN f.page_views END ASC,
    CASE WHEN _order_by = 'page_views' AND _order_dir = 'desc' THEN f.page_views END DESC,
    f.user_name ASC
  LIMIT GREATEST(1, LEAST(200, COALESCE(_limit, 20)))
  OFFSET GREATEST(0, COALESCE(_offset, 0));
END;
$$;
