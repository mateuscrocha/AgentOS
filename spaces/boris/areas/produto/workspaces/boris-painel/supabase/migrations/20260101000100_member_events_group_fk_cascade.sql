DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'member_events'
  ) THEN
    ALTER TABLE public.member_events
      DROP CONSTRAINT IF EXISTS member_events_group_id_fkey;

    ALTER TABLE public.member_events
      ADD CONSTRAINT member_events_group_id_fkey
      FOREIGN KEY (group_id)
      REFERENCES public.groups(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END $$;
