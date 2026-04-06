-- Auditoria operacional para detectar enquetes com risco de truncamento
-- ou ingestao incompleta de votos.

DROP VIEW IF EXISTS public.v_poll_ingestion_audit;

CREATE VIEW public.v_poll_ingestion_audit WITH (security_invoker = true) AS
WITH per_person AS (
  SELECT
    pv.poll_id,
    pv.person_id,
    COUNT(*) AS vote_events
  FROM public.poll_votes pv
  WHERE pv.person_id IS NOT NULL
  GROUP BY pv.poll_id, pv.person_id
),
poll_vote_stats AS (
  SELECT
    pv.poll_id,
    COUNT(*) AS total_vote_rows,
    COUNT(*) FILTER (WHERE pv.provider_vote_message_id IS NULL) AS vote_rows_without_message_id,
    COUNT(*) FILTER (WHERE pv.raw_payload IS NULL) AS vote_rows_without_raw_payload,
    COUNT(*) FILTER (WHERE jsonb_typeof(pv.voted_options) = 'string') AS vote_rows_as_string,
    COUNT(*) FILTER (WHERE jsonb_typeof(pv.voted_options) = 'array') AS vote_rows_as_array
  FROM public.poll_votes pv
  GROUP BY pv.poll_id
),
poll_person_stats AS (
  SELECT
    pp.poll_id,
    COUNT(*) AS voters_with_votes,
    COUNT(*) FILTER (WHERE pp.vote_events >= 2) AS voters_at_two_or_more_events,
    MAX(pp.vote_events) AS max_vote_events_per_person
  FROM per_person pp
  GROUP BY pp.poll_id
)
SELECT
  p.id AS poll_id,
  p.group_id,
  p.question,
  p.created_at,
  p.max_options,
  p.max_votes_per_member,
  COALESCE(pvs.total_vote_rows, 0) AS total_vote_rows,
  COALESCE(pps.voters_with_votes, 0) AS voters_with_votes,
  COALESCE(pps.voters_at_two_or_more_events, 0) AS voters_at_two_or_more_events,
  COALESCE(pps.max_vote_events_per_person, 0) AS max_vote_events_per_person,
  COALESCE(pvs.vote_rows_without_message_id, 0) AS vote_rows_without_message_id,
  COALESCE(pvs.vote_rows_without_raw_payload, 0) AS vote_rows_without_raw_payload,
  COALESCE(pvs.vote_rows_as_string, 0) AS vote_rows_as_string,
  COALESCE(pvs.vote_rows_as_array, 0) AS vote_rows_as_array,
  (
    COALESCE(p.max_options, 0) = 0
    AND COALESCE(pps.voters_at_two_or_more_events, 0) > 0
    AND COALESCE(pps.max_vote_events_per_person, 0) <= 2
  ) AS is_multiselect_with_possible_legacy_truncation,
  (
    COALESCE(pvs.total_vote_rows, 0) > 0
    AND COALESCE(pvs.vote_rows_without_message_id, 0) = COALESCE(pvs.total_vote_rows, 0)
  ) AS is_missing_vote_message_ids_for_all_rows,
  (
    COALESCE(pvs.total_vote_rows, 0) > 0
    AND COALESCE(pvs.vote_rows_without_raw_payload, 0) = COALESCE(pvs.total_vote_rows, 0)
  ) AS is_missing_raw_payload_for_all_rows
FROM public.polls p
LEFT JOIN poll_vote_stats pvs ON pvs.poll_id = p.id
LEFT JOIN poll_person_stats pps ON pps.poll_id = p.id;
