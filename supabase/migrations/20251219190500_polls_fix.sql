-- Ajustes estruturais obrigatórios para enquetes e votos

-- polls: adicionar created_by_person_id
ALTER TABLE public.polls
ADD COLUMN IF NOT EXISTS created_by_person_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

-- poll_votes: adicionar person_id, migrar dados e ajustar tipo de voted_options para jsonb
ALTER TABLE public.poll_votes
ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'poll_votes' AND column_name = 'member_id'
  ) THEN
    UPDATE public.poll_votes SET person_id = COALESCE(person_id, member_id);
    ALTER TABLE public.poll_votes DROP COLUMN member_id;
  END IF;
END $$;

-- Remover views antigas que dependem de voted_options antes de alterar o tipo
DROP VIEW IF EXISTS public.v_poll_option_votes;

ALTER TABLE public.poll_votes
ALTER COLUMN voted_options TYPE jsonb USING to_jsonb(voted_options);

-- Views para analytics
DROP VIEW IF EXISTS public.v_poll_results;
CREATE VIEW public.v_poll_results WITH (security_invoker = true) AS
SELECT 
  po.poll_id,
  po.option_index,
  po.option_text,
  COUNT(*) FILTER (WHERE pv.voted_options ? po.option_text) AS votes_count
FROM public.poll_options po
LEFT JOIN public.poll_votes pv ON pv.poll_id = po.poll_id
GROUP BY po.poll_id, po.option_index, po.option_text;

DROP VIEW IF EXISTS public.v_poll_summary;
CREATE VIEW public.v_poll_summary WITH (security_invoker = true) AS
SELECT 
  pv.poll_id,
  COUNT(DISTINCT pv.person_id) AS voters_count
FROM public.poll_votes pv
GROUP BY pv.poll_id;

DROP VIEW IF EXISTS public.v_poll_votes_by_person;
CREATE VIEW public.v_poll_votes_by_person WITH (security_invoker = true) AS
SELECT 
  pv.poll_id,
  pv.person_id,
  m.name AS person_name,
  pv.voted_options,
  pv.created_at
FROM public.poll_votes pv
LEFT JOIN public.members m ON m.id = pv.person_id;
