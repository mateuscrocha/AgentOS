DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_roles' 
      AND policyname = 'Org admins can insert group manager roles'
  ) THEN
    CREATE POLICY "Org admins can insert group manager roles"
    ON public.user_roles
    FOR INSERT
    WITH CHECK (
      role = 'GROUP_MANAGER'
      AND organization_id IS NOT NULL
      AND group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = user_roles.group_id
          AND user_roles.organization_id = g.organization_id
          AND public.can_edit_org(auth.uid(), g.organization_id)
      )
    );
  END IF;
END $$;
