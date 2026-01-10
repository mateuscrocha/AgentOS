ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON TABLE public.messages TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Admins can insert outbound messages'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can insert outbound messages"
      ON public.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (public.is_system_admin(auth.uid()) OR public.can_edit_group(auth.uid(), group_id))
        AND from_me IS TRUE
        AND direction = 'outbound'
      )
    $policy$;
  END IF;
END $$;
