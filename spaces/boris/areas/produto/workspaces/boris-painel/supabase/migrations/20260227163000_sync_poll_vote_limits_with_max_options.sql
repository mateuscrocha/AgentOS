-- Sincronizar o limite de votos por pessoa com o max_options informado pela enquete.
-- Isso evita truncar enquetes "marque todas" quando o provider salva cada selecao como evento separado.

CREATE OR REPLACE FUNCTION public.sync_poll_vote_limits_from_max_options()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.max_options IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.max_votes_per_member IS NULL OR NEW.max_votes_per_member = 2 THEN
      NEW.max_votes_per_member := NEW.max_options;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.max_options IS DISTINCT FROM OLD.max_options THEN
    IF NEW.max_votes_per_member IS NULL OR NEW.max_votes_per_member = OLD.max_votes_per_member THEN
      NEW.max_votes_per_member := NEW.max_options;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_poll_vote_limits_from_max_options ON public.polls;
CREATE TRIGGER trg_sync_poll_vote_limits_from_max_options
BEFORE INSERT OR UPDATE ON public.polls
FOR EACH ROW
EXECUTE FUNCTION public.sync_poll_vote_limits_from_max_options();

UPDATE public.polls
SET max_votes_per_member = max_options
WHERE max_options IS NOT NULL
  AND max_votes_per_member = 2
  AND max_options <> 2;
