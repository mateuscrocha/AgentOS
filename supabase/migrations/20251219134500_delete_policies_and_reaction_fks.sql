-- Políticas de DELETE restritas a SYSTEM_ADMIN e FKs em message_reactions

-- DELETE em organizações: apenas SYSTEM_ADMIN
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'Admins can delete organizations'
  ) THEN
    CREATE POLICY "Admins can delete organizations"
    ON public.organizations
    FOR DELETE
    TO authenticated
    USING (public.is_system_admin(auth.uid()));
  END IF;
END $$;

-- DELETE em grupos: apenas SYSTEM_ADMIN
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'groups' AND policyname = 'Admins can delete groups'
  ) THEN
    CREATE POLICY "Admins can delete groups"
    ON public.groups
    FOR DELETE
    TO authenticated
    USING (public.is_system_admin(auth.uid()));
  END IF;
END $$;

-- Adicionar FKs em message_reactions para garantir cascata
ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_message_fk
    FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_group_fk
    FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_member_fk
    FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE SET NULL;

