-- Enquetes como entidade de primeira classe

-- Tabela principal de enquetes
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'zapi',
  provider_poll_message_id text NOT NULL,
  question text NOT NULL,
  max_options integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deduplicação: provider + provider_poll_message_id
CREATE UNIQUE INDEX IF NOT EXISTS polls_provider_message_unique 
ON public.polls(provider, provider_poll_message_id);

-- Opções de enquete
CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  option_index integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_options_unique_index 
ON public.poll_options(poll_id, option_index);

-- Votos da enquete
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  voted_options text[] NOT NULL,
  provider text NOT NULL DEFAULT 'zapi',
  provider_vote_message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deduplicação: provider + provider_vote_message_id
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_provider_message_unique 
ON public.poll_votes(provider, provider_vote_message_id);

-- RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura: System Admin ou quem pode editar o grupo
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'polls' AND policyname = 'Read polls'
  ) THEN
    CREATE POLICY "Read polls" ON public.polls FOR SELECT
    USING (is_system_admin(auth.uid()) OR can_edit_group(auth.uid(), group_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_options' AND policyname = 'Read poll options'
  ) THEN
    CREATE POLICY "Read poll options" ON public.poll_options FOR SELECT
    USING (
      is_system_admin(auth.uid()) OR 
      EXISTS (
        SELECT 1 FROM public.polls p 
        WHERE p.id = poll_options.poll_id 
          AND can_edit_group(auth.uid(), p.group_id)
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_votes' AND policyname = 'Read poll votes'
  ) THEN
    CREATE POLICY "Read poll votes" ON public.poll_votes FOR SELECT
    USING (
      is_system_admin(auth.uid()) OR 
      EXISTS (
        SELECT 1 FROM public.polls p 
        WHERE p.id = poll_votes.poll_id 
          AND can_edit_group(auth.uid(), p.group_id)
      )
    );
  END IF;
END $$;

-- Escrita via Service Role (webhook). Opcionalmente, admins de grupo também podem inserir.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'polls' AND policyname = 'Insert polls (admins)'
  ) THEN
    CREATE POLICY "Insert polls (admins)" ON public.polls FOR INSERT
    WITH CHECK (is_system_admin(auth.uid()) OR can_edit_group(auth.uid(), group_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_options' AND policyname = 'Insert options (admins)'
  ) THEN
    CREATE POLICY "Insert options (admins)" ON public.poll_options FOR INSERT
    WITH CHECK (
      is_system_admin(auth.uid()) OR 
      EXISTS (
        SELECT 1 FROM public.polls p 
        WHERE p.id = poll_options.poll_id 
          AND can_edit_group(auth.uid(), p.group_id)
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_votes' AND policyname = 'Insert votes (admins)'
  ) THEN
    CREATE POLICY "Insert votes (admins)" ON public.poll_votes FOR INSERT
    WITH CHECK (
      is_system_admin(auth.uid()) OR 
      EXISTS (
        SELECT 1 FROM public.polls p 
        WHERE p.id = poll_votes.poll_id 
          AND can_edit_group(auth.uid(), p.group_id)
      )
    );
  END IF;
END $$;

-- Views auxiliares
-- Votos por opção
DROP VIEW IF EXISTS public.v_poll_option_votes;
CREATE VIEW public.v_poll_option_votes WITH (security_invoker = true) AS
SELECT 
  po.poll_id,
  po.option_index,
  po.option_text,
  COUNT(*) FILTER (WHERE po.option_text = ANY(pv.voted_options)) AS votes_count
FROM public.poll_options po
LEFT JOIN public.poll_votes pv ON pv.poll_id = po.poll_id
GROUP BY po.poll_id, po.option_index, po.option_text;
