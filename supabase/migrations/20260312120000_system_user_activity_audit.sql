ALTER TABLE public.user_activity_log
  ALTER COLUMN org_id DROP NOT NULL;

ALTER TABLE public.user_activity_log
  ADD COLUMN IF NOT EXISTS route text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_activity_log
  DROP CONSTRAINT IF EXISTS user_activity_log_role_check,
  DROP CONSTRAINT IF EXISTS user_activity_log_event_type_check,
  DROP CONSTRAINT IF EXISTS user_activity_log_page_check,
  DROP CONSTRAINT IF EXISTS user_activity_log_page_requires_event_type,
  DROP CONSTRAINT IF EXISTS user_activity_log_org_required_for_scoped_roles;

ALTER TABLE public.user_activity_log
  ADD CONSTRAINT user_activity_log_role_check
    CHECK (role IN ('system_admin', 'org_admin', 'group_admin', 'viewer')),
  ADD CONSTRAINT user_activity_log_event_type_check
    CHECK (event_type IN ('login', 'page_view')),
  ADD CONSTRAINT user_activity_log_page_check
    CHECK (
      page IS NULL OR page IN ('dashboard', 'grupos', 'configuracoes', 'usuarios', 'relatorios', 'onboarding')
    ),
  ADD CONSTRAINT user_activity_log_page_requires_event_type
    CHECK (
      (event_type = 'page_view' AND page IS NOT NULL) OR (event_type = 'login' AND page IS NULL)
    ),
  ADD CONSTRAINT user_activity_log_org_required_for_scoped_roles
    CHECK (
      (role = 'system_admin' AND org_id IS NULL)
      OR (role IN ('org_admin', 'group_admin', 'viewer') AND org_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS user_activity_log_user_event_created_at_idx
  ON public.user_activity_log (user_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_log_user_session_created_at_idx
  ON public.user_activity_log (user_id, session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_access_facts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_login_at timestamptz NULL,
  last_login_at timestamptz NULL,
  last_seen_at timestamptz NULL,
  last_role text NULL,
  last_org_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_access_facts_role_check
    CHECK (last_role IS NULL OR last_role IN ('system_admin', 'org_admin', 'group_admin', 'viewer'))
);

CREATE INDEX IF NOT EXISTS user_access_facts_last_seen_at_idx
  ON public.user_access_facts (last_seen_at DESC NULLS LAST);

ALTER TABLE public.user_access_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admin can read user access facts" ON public.user_access_facts;
CREATE POLICY "System admin can read user access facts"
ON public.user_access_facts
FOR SELECT
TO authenticated
USING (public.is_system_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_user_activity(
  _event_type text,
  _page text DEFAULT NULL,
  _route text DEFAULT NULL,
  _session_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_role text;
  v_org_id uuid;
  v_is_system_admin boolean := false;
  v_default_org_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF _event_type NOT IN ('login', 'page_view') THEN
    RAISE EXCEPTION 'invalid event_type' USING errcode = '22023';
  END IF;

  IF _event_type = 'page_view' AND (_page IS NULL OR btrim(_page) = '') THEN
    RAISE EXCEPTION 'page required for page_view' USING errcode = '22023';
  END IF;

  SELECT true
  INTO v_is_system_admin
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
    AND ur.role = 'SYSTEM_ADMIN'
  LIMIT 1;

  SELECT ur.organization_id
  INTO v_default_org_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
    AND ur.role = 'ORG_ADMIN'
    AND ur.organization_id IS NOT NULL
  ORDER BY ur.created_at ASC
  LIMIT 1;

  IF v_is_system_admin
    AND (
      _route = '/'
      OR _route LIKE '/system%'
      OR _route LIKE '/alerts%'
      OR _route LIKE '/alert-definitions%'
    ) THEN
    v_role := 'system_admin';
    v_org_id := NULL;
  ELSIF v_default_org_id IS NOT NULL THEN
    v_role := 'org_admin';
    v_org_id := v_default_org_id;
  ELSIF v_is_system_admin THEN
    v_role := 'system_admin';
    v_org_id := NULL;
  ELSE
    RETURN;
  END IF;

  INSERT INTO public.user_activity_log (
    user_id,
    org_id,
    role,
    event_type,
    page,
    route,
    session_id,
    metadata,
    created_at
  )
  VALUES (
    v_user_id,
    v_org_id,
    v_role,
    _event_type,
    _page,
    NULLIF(btrim(COALESCE(_route, '')), ''),
    NULLIF(btrim(COALESCE(_session_id, '')), ''),
    COALESCE(_metadata, '{}'::jsonb),
    v_now
  );

  INSERT INTO public.user_access_facts (
    user_id,
    first_login_at,
    last_login_at,
    last_seen_at,
    last_role,
    last_org_id,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    CASE WHEN _event_type = 'login' THEN v_now ELSE NULL END,
    CASE WHEN _event_type = 'login' THEN v_now ELSE NULL END,
    v_now,
    v_role,
    v_org_id,
    v_now,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    first_login_at = COALESCE(public.user_access_facts.first_login_at, EXCLUDED.first_login_at),
    last_login_at = COALESCE(EXCLUDED.last_login_at, public.user_access_facts.last_login_at),
    last_seen_at = GREATEST(
      COALESCE(public.user_access_facts.last_seen_at, '-infinity'::timestamptz),
      EXCLUDED.last_seen_at
    ),
    last_role = EXCLUDED.last_role,
    last_org_id = COALESCE(EXCLUDED.last_org_id, public.user_access_facts.last_org_id),
    updated_at = v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_user_activity(text, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_user_activity_overview(
  _start timestamptz,
  _end timestamptz,
  _recent_days int DEFAULT 7
)
RETURNS TABLE(
  users_total bigint,
  users_logged_in bigint,
  users_never_logged_in bigint,
  users_active_recent bigint,
  users_inactive_recent bigint
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
  WITH base AS (
    SELECT
      au.id AS user_id,
      COALESCE(uaf.first_login_at, au.last_sign_in_at) AS first_login_at,
      COALESCE(uaf.last_login_at, au.last_sign_in_at) AS last_login_at,
      COALESCE(uaf.last_seen_at, uaf.last_login_at, au.last_sign_in_at) AS last_seen_at
    FROM auth.users au
    LEFT JOIN public.user_access_facts uaf ON uaf.user_id = au.id
    WHERE au.deleted_at IS NULL
  )
  SELECT
    COUNT(*) AS users_total,
    COUNT(*) FILTER (WHERE last_login_at IS NOT NULL) AS users_logged_in,
    COUNT(*) FILTER (WHERE last_login_at IS NULL) AS users_never_logged_in,
    COUNT(*) FILTER (
      WHERE last_seen_at IS NOT NULL
        AND last_seen_at >= (_end - make_interval(days => GREATEST(1, COALESCE(_recent_days, 7))))
    ) AS users_active_recent,
    COUNT(*) FILTER (
      WHERE last_login_at IS NOT NULL
        AND (
          last_seen_at IS NULL
          OR last_seen_at < (_end - make_interval(days => GREATEST(1, COALESCE(_recent_days, 7))))
        )
    ) AS users_inactive_recent
  FROM base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_user_activity_overview(timestamptz, timestamptz, int) TO authenticated;

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
      ur.organization_id,
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

GRANT EXECUTE ON FUNCTION public.system_user_activity_list(timestamptz, timestamptz, int, text, text, text, text, text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_user_activity_timeline(
  _user_id uuid,
  _start timestamptz,
  _end timestamptz,
  _limit int DEFAULT 20
)
RETURNS TABLE(
  created_at timestamptz,
  event_type text,
  page text,
  route text,
  role text,
  org_id uuid,
  org_name text,
  session_id text
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
    l.created_at,
    l.event_type,
    l.page,
    l.route,
    l.role,
    l.org_id,
    o.name AS org_name,
    l.session_id
  FROM public.user_activity_log l
  LEFT JOIN public.organizations o ON o.id = l.org_id
  WHERE l.user_id = _user_id
    AND l.created_at >= _start
    AND l.created_at <= _end
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(100, COALESCE(_limit, 20)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_user_activity_timeline(uuid, timestamptz, timestamptz, int) TO authenticated;
