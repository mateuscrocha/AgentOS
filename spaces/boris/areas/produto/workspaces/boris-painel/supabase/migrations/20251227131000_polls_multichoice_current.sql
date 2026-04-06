ALTER TABLE public.poll_votes
ADD COLUMN IF NOT EXISTS raw_payload jsonb;

DROP VIEW IF EXISTS public.v_poll_results;

CREATE VIEW public.v_poll_results WITH (security_invoker = true) AS
WITH last_votes AS (
  SELECT DISTINCT ON (pv.poll_id, pv.person_id)
    pv.poll_id,
    pv.person_id,
    pv.voted_options
  FROM public.poll_votes pv
  ORDER BY pv.poll_id, pv.person_id, pv.created_at DESC
)
SELECT 
  po.poll_id,
  po.option_index,
  po.option_text,
  COUNT(*) FILTER (WHERE lv.voted_options ? po.option_text) AS votes_count
FROM public.poll_options po
LEFT JOIN last_votes lv ON lv.poll_id = po.poll_id
GROUP BY po.poll_id, po.option_index, po.option_text;
