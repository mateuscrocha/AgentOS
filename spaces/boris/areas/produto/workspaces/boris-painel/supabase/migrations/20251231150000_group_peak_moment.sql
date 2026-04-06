CREATE OR REPLACE FUNCTION public.get_group_peak_moment(
  p_group_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_window_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH cfg AS (
  SELECT GREATEST(1, COALESCE(NULLIF(p_window_minutes, 0), 60))::integer AS window_minutes
),
filtered AS (
  SELECT
    m.id AS message_id,
    m.created_at,
    m.member_id,
    m.sender_phone,
    COALESCE(mem.display_name, mem.name, m.sender_name, m.sender_phone, 'Desconhecido') AS sender_label,
    COALESCE(m.text, m.content, m.media_caption, '') AS text_content
  FROM public.messages m
  LEFT JOIN public.members mem ON mem.id = m.member_id
  WHERE m.group_id = p_group_id
    AND m.deleted_at IS NULL
    AND m.created_at >= p_start
    AND m.created_at <= p_end
    AND m.message_type <> 'poll_vote'
),
buckets AS (
  SELECT
    to_timestamp(
      floor(extract(epoch FROM f.created_at) / (cfg.window_minutes::bigint * 60))
      * (cfg.window_minutes::bigint * 60)
    ) AS bucket_start,
    count(*)::integer AS messages_count
  FROM filtered f
  CROSS JOIN cfg
  GROUP BY 1
),
peak AS (
  SELECT b.bucket_start, b.messages_count
  FROM buckets b
  ORDER BY b.messages_count DESC, b.bucket_start ASC
  LIMIT 1
),
peak_interval AS (
  SELECT
    p.bucket_start AS start_pico,
    p.bucket_start + make_interval(mins => cfg.window_minutes) AS end_pico
  FROM peak p
  CROSS JOIN cfg
),
peak_msgs AS (
  SELECT f.*
  FROM filtered f
  JOIN peak_interval i
    ON f.created_at >= i.start_pico
   AND f.created_at < i.end_pico
),
kpis AS (
  SELECT
    count(*)::integer AS total_messages,
    count(DISTINCT COALESCE(pm.member_id::text, pm.sender_phone, pm.sender_label))::integer AS unique_participants
  FROM peak_msgs pm
),
top_participants_items AS (
  SELECT
    COALESCE(pm.member_id::text, pm.sender_phone, pm.sender_label) AS sender_key,
    min(pm.member_id::text) AS sender_id,
    max(pm.sender_label) AS sender_name,
    count(*)::integer AS messages_count,
    round(
      100.0 * count(*)::numeric / GREATEST(1, (SELECT total_messages FROM kpis))::numeric,
      1
    ) AS percent_of_total
  FROM peak_msgs pm
  GROUP BY 1
  ORDER BY messages_count DESC, sender_name ASC
  LIMIT 5
),
top_participants AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sender_id', t.sender_id,
        'sender_name', t.sender_name,
        'messages_count', t.messages_count,
        'percent_of_total', t.percent_of_total
      )
      ORDER BY t.messages_count DESC, t.sender_name ASC
    ),
    '[]'::jsonb
  ) AS items
  FROM top_participants_items t
),
stopwords AS (
  SELECT unnest(ARRAY[
    'tem','mas','aqui','pra','pro','isso','dia',
    'de','da','do','das','dos',
    'a','o','as','os',
    'e','em','no','na','nos','nas',
    'por','com','sem','para',
    'que','se','não','nao','sim','já','ja','tá','ta',
    'eu','vc','você','voce','vocês','voces','ele','ela','eles','elas','gente',
    'ai','aí','lá','la','hoje','ontem','amanhã','amanha',
    'mano','cara','agora','tudo','tipo','alguém','alguem','fica','melhor',
    'coisa','coisas','galera','pessoal','acho','acham','achar','mesmo','assim',
    'vai','vão','vao','fazer','faz','feito'
  ]) AS term
),
terms_raw AS (
  SELECT lower(regexp_replace(w, '[^[:alpha:]]', '', 'g')) AS term
  FROM peak_msgs pm,
  LATERAL regexp_split_to_table(pm.text_content, '\\s+') w
),
terms_filtered AS (
  SELECT tr.term
  FROM terms_raw tr
  WHERE tr.term IS NOT NULL
    AND length(tr.term) >= 3
    AND tr.term NOT IN (SELECT s.term FROM stopwords s)
    AND tr.term NOT IN ('faz','fica','vai','tem','acha','acham','vao')
    AND tr.term !~ '(ar|er|ir)$'
),
terms_count AS (
  SELECT tf.term, count(*)::integer AS frequency
  FROM terms_filtered tf
  GROUP BY 1
),
top_terms_items AS (
  SELECT tc.term, tc.frequency
  FROM terms_count tc
  WHERE tc.frequency > 1
  ORDER BY tc.frequency DESC, tc.term ASC
  LIMIT 12
),
top_terms AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'term', t.term,
        'frequency', t.frequency
      )
      ORDER BY t.frequency DESC, t.term ASC
    ),
    '[]'::jsonb
  ) AS items
  FROM top_terms_items t
),
reactions AS (
  SELECT v.message_id, sum(v.count)::integer AS reactions_total
  FROM public.v_message_reactions_summary v
  GROUP BY 1
),
rep_src AS (
  SELECT
    pm.message_id,
    pm.sender_label AS sender_name,
    pm.created_at,
    left(pm.text_content, 160) AS preview_text,
    COALESCE(r.reactions_total, 0) AS reactions_total
  FROM peak_msgs pm
  LEFT JOIN reactions r ON r.message_id = pm.message_id
  ORDER BY reactions_total DESC, length(pm.text_content) DESC, pm.created_at ASC
  LIMIT 5
),
representative_messages AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'message_id', r.message_id,
        'sender_name', r.sender_name,
        'created_at', r.created_at,
        'preview_text', r.preview_text
      )
      ORDER BY r.created_at ASC
    ),
    '[]'::jsonb
  ) AS items
  FROM rep_src r
)
SELECT
  CASE
    WHEN (SELECT start_pico FROM peak_interval) IS NULL THEN NULL
    ELSE jsonb_build_object(
      'interval', jsonb_build_object(
        'start_pico', (SELECT start_pico FROM peak_interval),
        'end_pico', (SELECT end_pico FROM peak_interval)
      ),
      'kpis', jsonb_build_object(
        'total_messages', (SELECT total_messages FROM kpis),
        'unique_participants', (SELECT unique_participants FROM kpis),
        'intensity', round(
          (SELECT total_messages FROM kpis)::numeric / ((SELECT window_minutes FROM cfg)::numeric / 60.0),
          2
        )
      ),
      'top_participants', (SELECT items FROM top_participants),
      'top_terms', (SELECT items FROM top_terms),
      'representative_messages', (SELECT items FROM representative_messages),
      'summary', NULL
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_peak_moment(uuid, timestamptz, timestamptz, integer) TO authenticated;
