DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_contacts'
  ) THEN
    CREATE TABLE public.organization_contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
      name text NOT NULL,
      email text NULL,
      phone text NULL,
      role_title text NULL,
      contact_role text NULL,
      is_primary boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.organization_contacts ENABLE ROW LEVEL SECURITY;

    CREATE TRIGGER update_organization_contacts_updated_at
      BEFORE UPDATE ON public.organization_contacts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    CREATE UNIQUE INDEX organization_contacts_primary_unique
      ON public.organization_contacts (organization_id)
      WHERE is_primary IS TRUE;

    CREATE POLICY "Users can view organization contacts"
      ON public.organization_contacts
      FOR SELECT
      TO authenticated
      USING (
        public.is_system_admin(auth.uid())
        OR public.has_org_access(auth.uid(), organization_id)
      );

    CREATE POLICY "Admins can insert organization contacts"
      ON public.organization_contacts
      FOR INSERT
      TO authenticated
      WITH CHECK (public.can_edit_org(auth.uid(), organization_id));

    CREATE POLICY "Admins can update organization contacts"
      ON public.organization_contacts
      FOR UPDATE
      TO authenticated
      USING (public.can_edit_org(auth.uid(), organization_id))
      WITH CHECK (public.can_edit_org(auth.uid(), organization_id));

    CREATE POLICY "Admins can delete organization contacts"
      ON public.organization_contacts
      FOR DELETE
      TO authenticated
      USING (public.can_edit_org(auth.uid(), organization_id));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_contacts'
  ) THEN
    ALTER TABLE public.organization_contacts
      ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS contact_role text NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS organization_contacts_primary_unique
      ON public.organization_contacts (organization_id)
      WHERE is_primary IS TRUE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'members'
  ) THEN
    ALTER TABLE public.members
      ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_members_group_user_id
      ON public.members (group_id, user_id)
      WHERE user_id IS NOT NULL AND deleted_at IS NULL;
  END IF;
END $$;
