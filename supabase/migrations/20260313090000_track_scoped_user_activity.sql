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

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.role = 'SYSTEM_ADMIN'
  )
  INTO v_is_system_admin;

  WITH scoped_roles AS (
    SELECT
      CASE ur.role
        WHEN 'ORG_ADMIN' THEN 'org_admin'
        WHEN 'GROUP_MANAGER' THEN 'group_admin'
        WHEN 'USER' THEN 'viewer'
        ELSE NULL
      END AS resolved_role,
      COALESCE(ur.organization_id, g.organization_id) AS resolved_org_id,
      CASE ur.role
        WHEN 'ORG_ADMIN' THEN 3
        WHEN 'GROUP_MANAGER' THEN 2
        WHEN 'USER' THEN 1
        ELSE 0
      END AS role_priority,
      ur.created_at
    FROM public.user_roles ur
    LEFT JOIN public.groups g ON g.id = ur.group_id
    WHERE ur.user_id = v_user_id
      AND ur.role IN ('ORG_ADMIN', 'GROUP_MANAGER', 'USER')
      AND COALESCE(ur.organization_id, g.organization_id) IS NOT NULL
  )
  SELECT sr.resolved_role, sr.resolved_org_id
  INTO v_role, v_org_id
  FROM scoped_roles sr
  ORDER BY sr.role_priority DESC, sr.created_at ASC
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
  ELSIF v_role IS NULL AND v_is_system_admin THEN
    v_role := 'system_admin';
    v_org_id := NULL;
  ELSIF v_role IS NULL THEN
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
