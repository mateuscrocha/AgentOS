-- Modo limpeza de sincronização de membros (grupos de teste)

ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;

ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS name_detected text,
ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;

CREATE TABLE IF NOT EXISTS public.group_members_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  source text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  phone_e164 text,
  provider_member_id text,
  member_name text,
  member_display_name text,
  profile_pic_url text,
  joined_at timestamptz,
  left_at timestamptz,
  status text,
  last_seen_message_at timestamptz,
  total_messages bigint DEFAULT 0,
  last_message_at timestamptz,
  cleaned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_members_archive_group_id
  ON public.group_members_archive (group_id);

CREATE INDEX IF NOT EXISTS idx_group_members_archive_member_id
  ON public.group_members_archive (member_id);

CREATE INDEX IF NOT EXISTS idx_group_members_archive_operation_id
  ON public.group_members_archive (operation_id);

ALTER TABLE public.group_members_archive ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_members_archive'
      AND policyname = 'Users can view group members archive of their groups'
  ) THEN
    CREATE POLICY "Users can view group members archive of their groups"
    ON public.group_members_archive
    FOR SELECT
    TO authenticated
    USING (
      public.is_system_admin(auth.uid())
      OR public.has_group_access(auth.uid(), group_id)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_members_archive'
      AND policyname = 'Admins can insert group members archive'
  ) THEN
    CREATE POLICY "Admins can insert group members archive"
    ON public.group_members_archive
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.can_edit_group(auth.uid(), group_id)
    );
  END IF;
END $$;
