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
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organization_contacts_user_id
  ON public.organization_contacts (user_id)
  WHERE user_id IS NOT NULL;
