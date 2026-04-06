ALTER TABLE public.poll_votes
ADD COLUMN IF NOT EXISTS raw_payload jsonb;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY poll_id, person_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.poll_votes
  WHERE person_id IS NOT NULL
)
DELETE FROM public.poll_votes pv
USING ranked r
WHERE pv.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_unique_person_per_poll
ON public.poll_votes(poll_id, person_id)
WHERE person_id IS NOT NULL;

DROP VIEW IF EXISTS public.v_poll_results;
CREATE VIEW public.v_poll_results WITH (security_invoker = true) AS
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
    END AS voted_options,
    pv.created_at
  FROM public.poll_votes pv
  WHERE pv.person_id IS NOT NULL
),
last_votes AS (
  SELECT DISTINCT ON (poll_id, person_id)
    poll_id,
    person_id,
    voted_options
  FROM normalized_votes
  ORDER BY poll_id, person_id, created_at DESC
)
SELECT
  po.poll_id,
  po.option_index,
  po.option_text,
  COUNT(*) FILTER (WHERE lv.voted_options @> jsonb_build_array(po.option_text)) AS votes_count
FROM public.poll_options po
LEFT JOIN last_votes lv ON lv.poll_id = po.poll_id
GROUP BY po.poll_id, po.option_index, po.option_text;

DROP VIEW IF EXISTS public.v_poll_votes_by_person;
CREATE VIEW public.v_poll_votes_by_person WITH (security_invoker = true) AS
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
    END AS voted_options,
    pv.created_at
  FROM public.poll_votes pv
  WHERE pv.person_id IS NOT NULL
),
last_votes AS (
  SELECT DISTINCT ON (poll_id, person_id)
    poll_id,
    person_id,
    voted_options,
    created_at
  FROM normalized_votes
  ORDER BY poll_id, person_id, created_at DESC
)
SELECT
  lv.poll_id,
  lv.person_id,
  m.name AS person_name,
  lv.voted_options,
  lv.created_at
FROM last_votes lv
LEFT JOIN public.members m ON m.id = lv.person_id;
