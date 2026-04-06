CREATE OR REPLACE FUNCTION public.get_system_trends_snapshot(
  p_start timestamptz,
  p_end timestamptz,
  p_prev_start timestamptz,
  p_prev_end timestamptz,
  p_org_id uuid DEFAULT NULL,
  p_group_status text DEFAULT NULL,
  p_blacklist text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH params AS (
  SELECT
    COALESCE(
      (
        SELECT array_agg(DISTINCT normalized)
        FROM (
          SELECT NULLIF(regexp_replace(public.unaccent(lower(value)), '[^a-z]', '', 'g'), '') AS normalized
          FROM unnest(COALESCE(p_blacklist, '{}'::text[])) AS value
        ) blacklist_values
        WHERE normalized IS NOT NULL
      ),
      '{}'::text[]
    ) AS blacklist,
    ARRAY[
      'tem','mas','aqui','pra','pro','isso','dia',
      'de','da','do','das','dos',
      'a','o','as','os','um','uma','uns','umas',
      'e','em','no','na','nos','nas','num','numa',
      'por','com','sem','para','como',
      'que','se','nao','sim','ja','ta','foi','ser','era','sao','sendo',
      'eu','vc','voce','voces','ele','ela','eles','elas','gente',
      'meu','minha','meus','minhas','seu','sua','seus','suas','nosso','nossa','nossos','nossas',
      'esse','essa','esses','essas','aquele','aquela','aqueles','aquelas','este','esta','estes','estas',
      'isto','aquilo','qual','quais','quem','onde','quando',
      'ai','la','hoje','ontem','amanha',
      'mano','cara','agora','tudo','tipo','alguem','fica','melhor',
      'coisa','coisas','galera','pessoal','acho','acham','achar','mesmo','assim',
      'vai','vao','fazer','faz','feito','teve','tenho','tinha','estar','estou','esta','estao'
    ]::text[] AS stopwords
),
filtered_groups AS (
  SELECT
    g.id,
    g.name,
    g.organization_id,
    o.name AS organization_name,
    g.status
  FROM public.groups g
  LEFT JOIN public.organizations o ON o.id = g.organization_id
  WHERE g.deleted_at IS NULL
    AND COALESCE(g.is_archived, false) = false
    AND (p_org_id IS NULL OR g.organization_id = p_org_id)
    AND (p_group_status IS NULL OR g.status = p_group_status)
),
current_messages AS (
  SELECT
    m.group_id,
    m.created_at,
    COALESCE(NULLIF(trim(m.content), ''), NULLIF(trim(m.text), '')) AS body
  FROM public.messages m
  JOIN filtered_groups fg ON fg.id = m.group_id
  WHERE m.deleted_at IS NULL
    AND m.created_at >= p_start
    AND m.created_at <= p_end
),
previous_messages AS (
  SELECT
    m.group_id,
    m.created_at,
    COALESCE(NULLIF(trim(m.content), ''), NULLIF(trim(m.text), '')) AS body
  FROM public.messages m
  JOIN filtered_groups fg ON fg.id = m.group_id
  WHERE m.deleted_at IS NULL
    AND m.created_at >= p_prev_start
    AND m.created_at <= p_prev_end
),
current_topics AS (
  SELECT
    t.group_id,
    concat_ws(' ', t.title, t.content) AS source_text
  FROM public.group_daily_topics t
  JOIN filtered_groups fg ON fg.id = t.group_id
  WHERE t.topic_date >= timezone('America/Sao_Paulo', p_start)::date
    AND t.topic_date <= timezone('America/Sao_Paulo', p_end)::date
),
previous_topics AS (
  SELECT
    t.group_id,
    concat_ws(' ', t.title, t.content) AS source_text
  FROM public.group_daily_topics t
  JOIN filtered_groups fg ON fg.id = t.group_id
  WHERE t.topic_date >= timezone('America/Sao_Paulo', p_prev_start)::date
    AND t.topic_date <= timezone('America/Sao_Paulo', p_prev_end)::date
),
current_token_source AS (
  SELECT group_id, body AS source_text
  FROM current_messages
  WHERE body IS NOT NULL
  UNION ALL
  SELECT group_id, source_text
  FROM current_topics
  WHERE source_text IS NOT NULL
),
previous_token_source AS (
  SELECT group_id, body AS source_text
  FROM previous_messages
  WHERE body IS NOT NULL
  UNION ALL
  SELECT group_id, source_text
  FROM previous_topics
  WHERE source_text IS NOT NULL
),
current_tokens AS (
  SELECT
    source.group_id,
    token
  FROM current_token_source source
  CROSS JOIN params p
  CROSS JOIN LATERAL regexp_split_to_table(
    regexp_replace(public.unaccent(lower(source.source_text)), '[^a-z]+', ' ', 'g'),
    '\s+'
  ) AS token
  WHERE length(token) > 3
    AND token <> ALL (p.stopwords)
    AND token <> ALL (p.blacklist)
    AND token !~ '^(isso|essa|esse|esta|este|aqui|ali|la)$'
    AND token !~ '(ar|er|ir)$'
),
previous_tokens AS (
  SELECT
    source.group_id,
    token
  FROM previous_token_source source
  CROSS JOIN params p
  CROSS JOIN LATERAL regexp_split_to_table(
    regexp_replace(public.unaccent(lower(source.source_text)), '[^a-z]+', ' ', 'g'),
    '\s+'
  ) AS token
  WHERE length(token) > 3
    AND token <> ALL (p.stopwords)
    AND token <> ALL (p.blacklist)
    AND token !~ '^(isso|essa|esse|esta|este|aqui|ali|la)$'
    AND token !~ '(ar|er|ir)$'
),
current_keyword_counts AS (
  SELECT
    token,
    count(*)::integer AS count,
    count(DISTINCT group_id)::integer AS groups_impacted
  FROM current_tokens
  GROUP BY token
),
previous_keyword_counts AS (
  SELECT
    token,
    count(*)::integer AS count
  FROM previous_tokens
  GROUP BY token
),
top_keywords AS (
  SELECT
    ckc.token AS key,
    ckc.token AS label,
    ckc.count,
    COALESCE(pkc.count, 0) AS previous_count,
    (ckc.count - COALESCE(pkc.count, 0))::integer AS delta_count,
    ckc.groups_impacted
  FROM current_keyword_counts ckc
  LEFT JOIN previous_keyword_counts pkc ON pkc.token = ckc.token
  WHERE ckc.count >= 3
  ORDER BY delta_count DESC, ckc.count DESC, ckc.token ASC
  LIMIT 8
),
current_messages_text AS (
  SELECT
    group_id,
    public.unaccent(lower(body)) AS normalized_body
  FROM current_messages
  WHERE body IS NOT NULL
),
previous_messages_text AS (
  SELECT
    group_id,
    public.unaccent(lower(body)) AS normalized_body
  FROM previous_messages
  WHERE body IS NOT NULL
),
current_pains AS (
  SELECT
    group_id,
    CASE
      WHEN normalized_body ~* '\m(bug|erro|falha)\M|trav(ou|ando|a)|quebrad[oa]|nao funciona' THEN 'bug'
      WHEN normalized_body ~* '\m(login|senha|acess[oa]|acessar|entrar|token|permissao)\M' THEN 'acesso'
      WHEN normalized_body ~* '\m(fatura|boleto|cobranca|pagamento|nota fiscal|financeiro)\M' THEN 'financeiro'
      WHEN normalized_body ~* '\m(reclamacao|insatisfeit[oa]|pessim[oa]|ruim|frustrad[oa]|critica)\M' THEN 'reclamacao'
      WHEN normalized_body ~* '\m(solicitacao|melhoria|feature)\M|seria possivel|poderia(m)?|implement(ar|acao)' THEN 'solicitacao'
      WHEN normalized_body ~* '\m(duvida|ajuda)\M|como (faco|usar|configurar)|tem como|\mposso\M.*\?' THEN 'duvida'
      ELSE 'outros'
    END AS pain_key
  FROM current_messages_text
),
previous_pains AS (
  SELECT
    CASE
      WHEN normalized_body ~* '\m(bug|erro|falha)\M|trav(ou|ando|a)|quebrad[oa]|nao funciona' THEN 'bug'
      WHEN normalized_body ~* '\m(login|senha|acess[oa]|acessar|entrar|token|permissao)\M' THEN 'acesso'
      WHEN normalized_body ~* '\m(fatura|boleto|cobranca|pagamento|nota fiscal|financeiro)\M' THEN 'financeiro'
      WHEN normalized_body ~* '\m(reclamacao|insatisfeit[oa]|pessim[oa]|ruim|frustrad[oa]|critica)\M' THEN 'reclamacao'
      WHEN normalized_body ~* '\m(solicitacao|melhoria|feature)\M|seria possivel|poderia(m)?|implement(ar|acao)' THEN 'solicitacao'
      WHEN normalized_body ~* '\m(duvida|ajuda)\M|como (faco|usar|configurar)|tem como|\mposso\M.*\?' THEN 'duvida'
      ELSE 'outros'
    END AS pain_key
  FROM previous_messages_text
),
pain_labels AS (
  SELECT *
  FROM (
    VALUES
      ('bug', 'Bug'),
      ('duvida', 'Dúvida'),
      ('reclamacao', 'Reclamação'),
      ('solicitacao', 'Solicitação'),
      ('financeiro', 'Financeiro'),
      ('acesso', 'Acesso/Login'),
      ('outros', 'Outros')
  ) AS labels(key, label)
),
current_pain_counts AS (
  SELECT
    pain_key,
    count(*)::integer AS count,
    count(DISTINCT group_id)::integer AS groups_impacted
  FROM current_pains
  GROUP BY pain_key
),
previous_pain_counts AS (
  SELECT
    pain_key,
    count(*)::integer AS count
  FROM previous_pains
  GROUP BY pain_key
),
top_pains AS (
  SELECT
    pl.key,
    pl.label,
    COALESCE(cpc.count, 0) AS count,
    COALESCE(ppc.count, 0) AS previous_count,
    (COALESCE(cpc.count, 0) - COALESCE(ppc.count, 0))::integer AS delta_count,
    COALESCE(cpc.groups_impacted, 0) AS groups_impacted,
    CASE
      WHEN (SELECT count(*) FROM current_messages_text) > 0
        THEN round((COALESCE(cpc.count, 0)::numeric / (SELECT count(*) FROM current_messages_text)::numeric) * 100, 1)
      ELSE 0
    END AS pct
  FROM pain_labels pl
  LEFT JOIN current_pain_counts cpc ON cpc.pain_key = pl.key
  LEFT JOIN previous_pain_counts ppc ON ppc.pain_key = pl.key
  WHERE COALESCE(cpc.count, 0) > 0
  ORDER BY delta_count DESC, count DESC, pl.label ASC
  LIMIT 6
),
hour_series AS (
  SELECT
    h.hour,
    COALESCE(mc.count, 0)::integer AS messages
  FROM generate_series(0, 23) AS h(hour)
  LEFT JOIN (
    SELECT
      EXTRACT(HOUR FROM timezone('America/Sao_Paulo', created_at))::integer AS hour,
      count(*)::integer AS count
    FROM current_messages
    GROUP BY 1
  ) mc ON mc.hour = h.hour
  ORDER BY h.hour
),
weekday_series AS (
  SELECT
    w.weekday_index,
    w.weekday_label,
    COALESCE(mc.count, 0)::integer AS messages
  FROM (
    VALUES
      (0, 'Dom'),
      (1, 'Seg'),
      (2, 'Ter'),
      (3, 'Qua'),
      (4, 'Qui'),
      (5, 'Sex'),
      (6, 'Sab')
  ) AS w(weekday_index, weekday_label)
  LEFT JOIN (
    SELECT
      EXTRACT(DOW FROM timezone('America/Sao_Paulo', created_at))::integer AS weekday_index,
      count(*)::integer AS count
    FROM current_messages
    GROUP BY 1
  ) mc ON mc.weekday_index = w.weekday_index
  ORDER BY w.weekday_index
),
daily_series AS (
  SELECT
    d.day::date AS day,
    COALESCE(mc.count, 0)::integer AS messages
  FROM generate_series(
    timezone('America/Sao_Paulo', p_start)::date,
    timezone('America/Sao_Paulo', p_end)::date,
    interval '1 day'
  ) AS d(day)
  LEFT JOIN (
    SELECT
      timezone('America/Sao_Paulo', created_at)::date AS day,
      count(*)::integer AS count
    FROM current_messages
    GROUP BY 1
  ) mc ON mc.day = d.day::date
  ORDER BY d.day
),
current_group_counts AS (
  SELECT
    group_id,
    count(*)::integer AS messages
  FROM current_messages
  GROUP BY group_id
),
previous_group_counts AS (
  SELECT
    group_id,
    count(*)::integer AS messages
  FROM previous_messages
  GROUP BY group_id
),
current_group_pain_ranked AS (
  SELECT
    cp.group_id,
    pl.label,
    count(*)::integer AS pain_count,
    row_number() OVER (
      PARTITION BY cp.group_id
      ORDER BY count(*) DESC, pl.label ASC
    ) AS rank
  FROM current_pains cp
  JOIN pain_labels pl ON pl.key = cp.pain_key
  GROUP BY cp.group_id, pl.label
),
current_group_keyword_ranked AS (
  SELECT
    ct.group_id,
    ct.token,
    count(*)::integer AS token_count,
    row_number() OVER (
      PARTITION BY ct.group_id
      ORDER BY count(*) DESC, ct.token ASC
    ) AS rank
  FROM current_tokens ct
  GROUP BY ct.group_id, ct.token
),
impacted_groups AS (
  SELECT
    fg.id AS group_id,
    fg.name AS group_name,
    fg.organization_name,
    COALESCE(cgc.messages, 0)::integer AS messages,
    COALESCE(pgc.messages, 0)::integer AS previous_messages,
    (COALESCE(cgc.messages, 0) - COALESCE(pgc.messages, 0))::integer AS delta_messages,
    COALESCE(cgpr.label, '—') AS top_pain,
    COALESCE(cgkr.token, '—') AS top_keyword
  FROM filtered_groups fg
  LEFT JOIN current_group_counts cgc ON cgc.group_id = fg.id
  LEFT JOIN previous_group_counts pgc ON pgc.group_id = fg.id
  LEFT JOIN current_group_pain_ranked cgpr ON cgpr.group_id = fg.id AND cgpr.rank = 1
  LEFT JOIN current_group_keyword_ranked cgkr ON cgkr.group_id = fg.id AND cgkr.rank = 1
  WHERE COALESCE(cgc.messages, 0) > 0
  ORDER BY COALESCE(cgc.messages, 0) DESC, fg.name ASC
  LIMIT 10
)
SELECT jsonb_build_object(
  'groupsCount', COALESCE((SELECT count(*)::integer FROM filtered_groups), 0),
  'currentTotalMessages', COALESCE((SELECT count(*)::integer FROM current_messages), 0),
  'previousTotalMessages', COALESCE((SELECT count(*)::integer FROM previous_messages), 0),
  'hourSeries', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'hour', lpad(hour_series.hour::text, 2, '0') || 'h',
          'messages', hour_series.messages
        )
        ORDER BY hour_series.hour
      )
      FROM hour_series
    ),
    '[]'::jsonb
  ),
  'weekdaySeries', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'weekday', weekday_series.weekday_label,
          'messages', weekday_series.messages
        )
        ORDER BY weekday_series.weekday_index
      )
      FROM weekday_series
    ),
    '[]'::jsonb
  ),
  'dailySeries', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'day', daily_series.day,
          'messages', daily_series.messages
        )
        ORDER BY daily_series.day
      )
      FROM daily_series
    ),
    '[]'::jsonb
  ),
  'topKeywords', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', top_keywords.key,
          'label', top_keywords.label,
          'count', top_keywords.count,
          'previousCount', top_keywords.previous_count,
          'deltaCount', top_keywords.delta_count,
          'groupsImpacted', top_keywords.groups_impacted
        )
        ORDER BY top_keywords.delta_count DESC, top_keywords.count DESC, top_keywords.label ASC
      )
      FROM top_keywords
    ),
    '[]'::jsonb
  ),
  'topPains', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', top_pains.key,
          'label', top_pains.label,
          'count', top_pains.count,
          'previousCount', top_pains.previous_count,
          'deltaCount', top_pains.delta_count,
          'groupsImpacted', top_pains.groups_impacted,
          'pct', top_pains.pct
        )
        ORDER BY top_pains.delta_count DESC, top_pains.count DESC, top_pains.label ASC
      )
      FROM top_pains
    ),
    '[]'::jsonb
  ),
  'impactedGroups', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'groupId', impacted_groups.group_id,
          'groupName', impacted_groups.group_name,
          'organizationName', impacted_groups.organization_name,
          'messages', impacted_groups.messages,
          'previousMessages', impacted_groups.previous_messages,
          'deltaMessages', impacted_groups.delta_messages,
          'topPain', impacted_groups.top_pain,
          'topKeyword', impacted_groups.top_keyword
        )
        ORDER BY impacted_groups.messages DESC, impacted_groups.group_name ASC
      )
      FROM impacted_groups
    ),
    '[]'::jsonb
  )
);
$$;

GRANT EXECUTE ON FUNCTION public.get_system_trends_snapshot(
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  text,
  text[]
) TO authenticated;
