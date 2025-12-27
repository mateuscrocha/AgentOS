-- Garantir um único snapshot de voto por pessoa em cada enquete
-- Parcial (apenas onde person_id não é nulo)
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_unique_person_per_poll
ON public.poll_votes(poll_id, person_id)
WHERE person_id IS NOT NULL;
