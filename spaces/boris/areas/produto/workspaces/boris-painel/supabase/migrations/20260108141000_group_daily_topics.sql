-- =====================================================
-- Tópicos mais falados no grupo (por dia)
-- Fonte de escrita: n8n (Service Role)
-- Consumo: frontend (somente leitura via RLS)
-- =====================================================

CREATE TABLE public.group_daily_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  topic_date date NOT NULL,
  rank int NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  keywords text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, topic_date, rank)
);

-- Índices mínimos para leitura
CREATE INDEX idx_group_daily_topics_group_id_topic_date
  ON public.group_daily_topics (group_id, topic_date);

CREATE INDEX idx_group_daily_topics_topic_date_desc
  ON public.group_daily_topics (topic_date DESC);

-- RLS: leitura apenas para quem tem acesso ao grupo
ALTER TABLE public.group_daily_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view daily topics of their groups"
ON public.group_daily_topics
FOR SELECT
TO authenticated
USING (
  public.is_system_admin(auth.uid())
  OR public.has_group_access(auth.uid(), group_id)
);
