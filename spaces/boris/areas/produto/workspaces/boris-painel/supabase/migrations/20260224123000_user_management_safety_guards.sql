DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'System admins can update all profiles'
  ) THEN
    CREATE POLICY "System admins can update all profiles"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (public.is_system_admin(auth.uid()))
    WITH CHECK (public.is_system_admin(auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_last_system_admin_role_removal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_system_admin_count integer;
  v_is_system_admin_being_removed boolean;
BEGIN
  v_is_system_admin_being_removed :=
    (TG_OP = 'DELETE' AND OLD.role = 'SYSTEM_ADMIN')
    OR (
      TG_OP = 'UPDATE'
      AND OLD.role = 'SYSTEM_ADMIN'
      AND (
        NEW.role IS DISTINCT FROM OLD.role
        OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.group_id IS DISTINCT FROM OLD.group_id
      )
    );

  IF NOT v_is_system_admin_being_removed THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*)
    INTO v_system_admin_count
  FROM public.user_roles
  WHERE role = 'SYSTEM_ADMIN';

  IF v_system_admin_count <= 1 THEN
    RAISE EXCEPTION 'Não é possível remover o último administrador do sistema'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_system_admin_role_removal ON public.user_roles;

CREATE TRIGGER trg_prevent_last_system_admin_role_removal
BEFORE DELETE OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_system_admin_role_removal();
