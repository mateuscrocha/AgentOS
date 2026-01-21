DROP FUNCTION IF EXISTS public.admin_group_delete_preview(uuid);
DROP FUNCTION IF EXISTS public.admin_group_delete_cascade(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.admin_group_delete_cascade(
  _group_id uuid,
  _requester_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _requester_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.groups g WHERE g.id = _group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo não encontrado' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_group_delete_cascade(uuid, uuid) TO authenticated, service_role;
