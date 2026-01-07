-- Multi-votos por membro em enquetes

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'polls'
      AND column_name = 'provider_poll_message_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'polls'
      AND column_name = 'whatsapp_provider_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.polls RENAME COLUMN provider_poll_message_id TO whatsapp_provider_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'polls'
      AND column_name = 'whatsapp_provider_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.polls ADD COLUMN whatsapp_provider_id text';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'polls'
      AND column_name = 'provider_poll_message_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'polls'
      AND column_name = 'whatsapp_provider_id'
  ) THEN
    EXECUTE 'UPDATE public.polls SET whatsapp_provider_id = COALESCE(whatsapp_provider_id, provider_poll_message_id)';
  END IF;
END $$;

DROP INDEX IF EXISTS public.polls_provider_message_unique;
CREATE UNIQUE INDEX IF NOT EXISTS polls_provider_whatsapp_message_unique
ON public.polls(provider, whatsapp_provider_id)
WHERE whatsapp_provider_id IS NOT NULL;

ALTER TABLE public.polls
ADD COLUMN IF NOT EXISTS max_votes_per_member integer NOT NULL DEFAULT 2;

ALTER TABLE public.poll_votes
ADD COLUMN IF NOT EXISTS vote_sequence integer;

ALTER TABLE public.poll_votes
ADD COLUMN IF NOT EXISTS provider_vote_message_id text;

DROP INDEX IF EXISTS public.poll_votes_unique_person_per_poll;

DROP INDEX IF EXISTS public.poll_votes_provider_message_unique;
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_provider_message_unique
ON public.poll_votes(provider, provider_vote_message_id)
WHERE provider_vote_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx
ON public.poll_votes(poll_id);

CREATE INDEX IF NOT EXISTS poll_votes_poll_person_idx
ON public.poll_votes(poll_id, person_id)
WHERE person_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_poll_vote_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_current integer;
BEGIN
  IF NEW.person_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.max_votes_per_member, 2)
    INTO v_max
  FROM public.polls p
  WHERE p.id = NEW.poll_id;

  IF v_max IS NULL THEN
    v_max := 2;
  END IF;

  IF v_max <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_current
  FROM public.poll_votes pv
  WHERE pv.poll_id = NEW.poll_id
    AND pv.person_id = NEW.person_id;

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'max_votes_per_member_reached' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.vote_sequence IS NULL THEN
    NEW.vote_sequence := v_current + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_poll_vote_limits ON public.poll_votes;
CREATE TRIGGER trg_enforce_poll_vote_limits
BEFORE INSERT ON public.poll_votes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_poll_vote_limits();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'polls' AND policyname = 'Update polls (admins)'
  ) THEN
    CREATE POLICY "Update polls (admins)" ON public.polls FOR UPDATE
    USING (is_system_admin(auth.uid()) OR can_edit_group(auth.uid(), group_id))
    WITH CHECK (is_system_admin(auth.uid()) OR can_edit_group(auth.uid(), group_id));
  END IF;
END $$;

DROP VIEW IF EXISTS public.v_poll_results;
CREATE VIEW public.v_poll_results WITH (security_invoker = true) AS
WITH normalized_votes AS (
  SELECT
    pv.poll_id,
    CASE
      WHEN jsonb_typeof(pv.voted_options) = 'array' THEN pv.voted_options
      WHEN jsonb_typeof(pv.voted_options) = 'object' THEN (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
        FROM jsonb_each_text(pv.voted_options)
      )
      WHEN jsonb_typeof(pv.voted_options) = 'string' THEN jsonb_build_array(pv.voted_options #>> '{}')
      ELSE '[]'::jsonb
    END AS voted_options
  FROM public.poll_votes pv
)
SELECT
  po.poll_id,
  po.option_index,
  po.option_text,
  COUNT(*) FILTER (WHERE nv.voted_options @> jsonb_build_array(po.option_text)) AS votes_count
FROM public.poll_options po
LEFT JOIN normalized_votes nv ON nv.poll_id = po.poll_id
GROUP BY po.poll_id, po.option_index, po.option_text;

DROP VIEW IF EXISTS public.v_poll_summary;
CREATE VIEW public.v_poll_summary WITH (security_invoker = true) AS
WITH normalized_votes AS (
  SELECT
    pv.poll_id,
    pv.person_id,
    CASE
      WHEN jsonb_typeof(pv.voted_options) = 'array' THEN pv.voted_options
      WHEN jsonb_typeof(pv.voted_options) = 'object' THEN (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
        FROM jsonb_each_text(pv.voted_options)
      )
      WHEN jsonb_typeof(pv.voted_options) = 'string' THEN jsonb_build_array(pv.voted_options #>> '{}')
      ELSE '[]'::jsonb
    END AS voted_options
  FROM public.poll_votes pv
)
SELECT
  nv.poll_id,
  COUNT(DISTINCT nv.person_id) FILTER (WHERE nv.person_id IS NOT NULL) AS voters_count,
  COUNT(*) AS vote_events_count,
  COALESCE(SUM(jsonb_array_length(nv.voted_options)), 0) AS selections_count
FROM normalized_votes nv
GROUP BY nv.poll_id;

DROP VIEW IF EXISTS public.v_poll_votes_by_person;
CREATE VIEW public.v_poll_votes_by_person WITH (security_invoker = true) AS
WITH normalized_votes AS (
  SELECT
    pv.id,
    pv.poll_id,
    pv.person_id,
    CASE
      WHEN jsonb_typeof(pv.voted_options) = 'array' THEN pv.voted_options
      WHEN jsonb_typeof(pv.voted_options) = 'object' THEN (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
        FROM jsonb_each_text(pv.voted_options)
      )
      WHEN jsonb_typeof(pv.voted_options) = 'string' THEN jsonb_build_array(pv.voted_options #>> '{}')
      ELSE '[]'::jsonb
    END AS voted_options,
    pv.created_at
  FROM public.poll_votes pv
  WHERE pv.person_id IS NOT NULL
),
ranked AS (
  SELECT
    nv.*, 
    ROW_NUMBER() OVER (PARTITION BY nv.poll_id, nv.person_id ORDER BY nv.created_at ASC, nv.id ASC) AS vote_sequence,
    COUNT(*) OVER (PARTITION BY nv.poll_id, nv.person_id) AS votes_count
  FROM normalized_votes nv
)
SELECT
  r.poll_id,
  r.person_id,
  m.name AS person_name,
  r.voted_options,
  r.created_at,
  r.vote_sequence,
  r.votes_count
FROM ranked r
LEFT JOIN public.members m ON m.id = r.person_id;
