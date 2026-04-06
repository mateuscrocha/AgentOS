CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  event_type TEXT NOT NULL,
  page TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_activity_log_role_check CHECK (role IN ('system_admin', 'org_admin', 'group_admin', 'viewer')),
  CONSTRAINT user_activity_log_event_type_check CHECK (event_type IN ('login', 'page_view')),
  CONSTRAINT user_activity_log_page_check CHECK (
    page IS NULL OR page IN ('dashboard', 'grupos', 'configuracoes', 'usuarios', 'relatorios', 'onboarding')
  ),
  CONSTRAINT user_activity_log_page_requires_event_type CHECK (
    (event_type = 'page_view' AND page IS NOT NULL) OR (event_type = 'login' AND page IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS user_activity_log_created_at_idx ON public.user_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_org_created_at_idx ON public.user_activity_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_user_created_at_idx ON public.user_activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_event_type_created_at_idx ON public.user_activity_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_page_created_at_idx ON public.user_activity_log (page, created_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admin can read user activity log" ON public.user_activity_log;
CREATE POLICY "System admin can read user activity log"
ON public.user_activity_log
FOR SELECT
TO authenticated
USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Org admins can write own activity log" ON public.user_activity_log;
CREATE POLICY "Org admins can write own activity log"
ON public.user_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'org_admin'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'ORG_ADMIN'
      AND ur.organization_id = org_id
  )
);

CREATE OR REPLACE FUNCTION public.activity_overview(
  _start timestamptz,
  _end timestamptz,
  _recent_days int,
  _min_active_days int
)
RETURNS TABLE(
  orgs_total bigint,
  orgs_with_activity bigint,
  orgs_active bigint,
  orgs_warm bigint,
  orgs_inactive bigint,
  org_admins_active bigint,
  logins bigint,
  page_views bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH orgs AS (
    SELECT id
    FROM public.organizations
    WHERE deleted_at IS NULL
  ),
  logs AS (
    SELECT *
    FROM public.user_activity_log
    WHERE role = 'org_admin'
      AND created_at >= _start
      AND created_at <= _end
  ),
  org_agg AS (
    SELECT
      org_id,
      MAX(created_at) AS last_activity_at,
      COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS active_days
    FROM logs
    GROUP BY org_id
  ),
  classified AS (
    SELECT
      o.id AS org_id,
      a.last_activity_at,
      COALESCE(a.active_days, 0) AS active_days,
      CASE
        WHEN a.last_activity_at IS NULL THEN 'inactive'
        WHEN COALESCE(a.active_days, 0) >= _min_active_days
          AND a.last_activity_at >= (_end - make_interval(days => _recent_days)) THEN 'active'
        ELSE 'warm'
      END AS status
    FROM orgs o
    LEFT JOIN org_agg a ON a.org_id = o.id
  )
  SELECT
    (SELECT COUNT(*) FROM orgs) AS orgs_total,
    (SELECT COUNT(DISTINCT org_id) FROM logs) AS orgs_with_activity,
    (SELECT COUNT(*) FROM classified WHERE status = 'active') AS orgs_active,
    (SELECT COUNT(*) FROM classified WHERE status = 'warm') AS orgs_warm,
    (SELECT COUNT(*) FROM classified WHERE status = 'inactive') AS orgs_inactive,
    (SELECT COUNT(DISTINCT user_id) FROM logs) AS org_admins_active,
    (SELECT COUNT(*) FROM logs WHERE event_type = 'login') AS logins,
    (SELECT COUNT(*) FROM logs WHERE event_type = 'page_view') AS page_views;
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_daily_org_admins(
  _start timestamptz,
  _end timestamptz
)
RETURNS TABLE(
  day date,
  org_admins bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
    COUNT(DISTINCT user_id) AS org_admins
  FROM public.user_activity_log
  WHERE role = 'org_admin'
    AND created_at >= _start
    AND created_at <= _end
  GROUP BY 1
  ORDER BY 1;
END;
$$;

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
SET search_path = public
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
  WHERE l.role = 'org_admin'
    AND l.event_type = 'page_view'
    AND l.page IS NOT NULL
    AND l.created_at >= _start
    AND l.created_at <= _end
  GROUP BY l.page
  ORDER BY page_views DESC, admins DESC, l.page ASC
  LIMIT GREATEST(1, LEAST(50, COALESCE(_limit, 10)));
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_orgs(
  _start timestamptz,
  _end timestamptz,
  _recent_days int,
  _min_active_days int,
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _order_by text DEFAULT 'last_activity_at',
  _order_dir text DEFAULT 'desc',
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  org_id uuid,
  org_name text,
  status text,
  last_activity_at timestamptz,
  last_login_at timestamptz,
  admins_active int,
  active_days int,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH logs AS (
    SELECT *
    FROM public.user_activity_log
    WHERE role = 'org_admin'
      AND created_at >= _start
      AND created_at <= _end
  ),
  org_agg AS (
    SELECT
      org_id,
      MAX(created_at) AS last_activity_at,
      MAX(created_at) FILTER (WHERE event_type = 'login') AS last_login_at,
      COUNT(DISTINCT user_id)::int AS admins_active,
      COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date)::int AS active_days
    FROM logs
    GROUP BY org_id
  ),
  base AS (
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      a.last_activity_at,
      a.last_login_at,
      COALESCE(a.admins_active, 0) AS admins_active,
      COALESCE(a.active_days, 0) AS active_days,
      CASE
        WHEN a.last_activity_at IS NULL THEN 'inactive'
        WHEN COALESCE(a.active_days, 0) >= _min_active_days
          AND a.last_activity_at >= (_end - make_interval(days => _recent_days)) THEN 'active'
        ELSE 'warm'
      END AS status
    FROM public.organizations o
    LEFT JOIN org_agg a ON a.org_id = o.id
    WHERE o.deleted_at IS NULL
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE (
      _search IS NULL
      OR btrim(_search) = ''
      OR lower(org_name) LIKE ('%' || lower(btrim(_search)) || '%')
      OR org_id::text LIKE ('%' || btrim(_search) || '%')
    )
    AND (
      _status IS NULL
      OR btrim(_status) = ''
      OR status = _status
    )
  )
  SELECT
    org_id,
    org_name,
    status,
    last_activity_at,
    last_login_at,
    admins_active,
    active_days,
    COUNT(*) OVER() AS total_count
  FROM filtered
  ORDER BY
    CASE WHEN _order_by = 'org_name' AND _order_dir = 'asc' THEN org_name END ASC,
    CASE WHEN _order_by = 'org_name' AND _order_dir = 'desc' THEN org_name END DESC,
    CASE WHEN _order_by = 'status' AND _order_dir = 'asc' THEN status END ASC,
    CASE WHEN _order_by = 'status' AND _order_dir = 'desc' THEN status END DESC,
    CASE WHEN _order_by = 'admins_active' AND _order_dir = 'asc' THEN admins_active END ASC,
    CASE WHEN _order_by = 'admins_active' AND _order_dir = 'desc' THEN admins_active END DESC,
    CASE WHEN _order_by = 'active_days' AND _order_dir = 'asc' THEN active_days END ASC,
    CASE WHEN _order_by = 'active_days' AND _order_dir = 'desc' THEN active_days END DESC,
    CASE WHEN _order_by = 'last_activity_at' AND _order_dir = 'asc' THEN last_activity_at END ASC NULLS LAST,
    CASE WHEN _order_by = 'last_activity_at' AND _order_dir = 'desc' THEN last_activity_at END DESC NULLS LAST,
    org_name ASC
  LIMIT GREATEST(1, LEAST(200, COALESCE(_limit, 20)))
  OFFSET GREATEST(0, COALESCE(_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_org_admins(
  _start timestamptz,
  _end timestamptz,
  _org_id uuid DEFAULT NULL,
  _search text DEFAULT NULL,
  _order_by text DEFAULT 'last_activity_at',
  _order_dir text DEFAULT 'desc',
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  org_id uuid,
  org_name text,
  last_activity_at timestamptz,
  last_login_at timestamptz,
  active_days int,
  top_pages text[],
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH logs AS (
    SELECT *
    FROM public.user_activity_log
    WHERE role = 'org_admin'
      AND created_at >= _start
      AND created_at <= _end
      AND (_org_id IS NULL OR org_id = _org_id)
  ),
  user_agg AS (
    SELECT
      user_id,
      org_id,
      MAX(created_at) AS last_activity_at,
      MAX(created_at) FILTER (WHERE event_type = 'login') AS last_login_at,
      COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date)::int AS active_days
    FROM logs
    GROUP BY user_id, org_id
  ),
  base AS (
    SELECT
      ua.user_id,
      COALESCE(p.name, '') AS user_name,
      ua.org_id,
      o.name AS org_name,
      ua.last_activity_at,
      ua.last_login_at,
      ua.active_days,
      (
        SELECT ARRAY(
          SELECT pg.page
          FROM (
            SELECT l.page, COUNT(*) AS c
            FROM logs l
            WHERE l.user_id = ua.user_id
              AND l.org_id = ua.org_id
              AND l.event_type = 'page_view'
              AND l.page IS NOT NULL
            GROUP BY l.page
            ORDER BY c DESC, l.page ASC
            LIMIT 2
          ) pg
        )
      ) AS top_pages
    FROM user_agg ua
    LEFT JOIN public.profiles p ON p.id = ua.user_id
    JOIN public.organizations o ON o.id = ua.org_id
    WHERE o.deleted_at IS NULL
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE (
      _search IS NULL
      OR btrim(_search) = ''
      OR lower(user_name) LIKE ('%' || lower(btrim(_search)) || '%')
      OR user_id::text LIKE ('%' || btrim(_search) || '%')
      OR lower(org_name) LIKE ('%' || lower(btrim(_search)) || '%')
    )
  )
  SELECT
    user_id,
    NULLIF(user_name, '') AS user_name,
    org_id,
    org_name,
    last_activity_at,
    last_login_at,
    active_days,
    top_pages,
    COUNT(*) OVER() AS total_count
  FROM filtered
  ORDER BY
    CASE WHEN _order_by = 'user_name' AND _order_dir = 'asc' THEN user_name END ASC,
    CASE WHEN _order_by = 'user_name' AND _order_dir = 'desc' THEN user_name END DESC,
    CASE WHEN _order_by = 'active_days' AND _order_dir = 'asc' THEN active_days END ASC,
    CASE WHEN _order_by = 'active_days' AND _order_dir = 'desc' THEN active_days END DESC,
    CASE WHEN _order_by = 'last_activity_at' AND _order_dir = 'asc' THEN last_activity_at END ASC NULLS LAST,
    CASE WHEN _order_by = 'last_activity_at' AND _order_dir = 'desc' THEN last_activity_at END DESC NULLS LAST,
    org_name ASC
  LIMIT GREATEST(1, LEAST(200, COALESCE(_limit, 20)))
  OFFSET GREATEST(0, COALESCE(_offset, 0));
END;
$$;
