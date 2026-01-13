CREATE TABLE IF NOT EXISTS public.group_daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  summary_text text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_group_daily_summaries_group_id_summary_date
  ON public.group_daily_summaries (group_id, summary_date);

CREATE INDEX IF NOT EXISTS idx_group_daily_summaries_summary_date_desc
  ON public.group_daily_summaries (summary_date DESC);

ALTER TABLE public.group_daily_summaries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_daily_summaries'
      AND policyname = 'Users can view daily summaries of their groups'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view daily summaries of their groups"
      ON public.group_daily_summaries
      FOR SELECT
      TO authenticated
      USING (
        public.is_system_admin(auth.uid())
        OR public.has_group_access(auth.uid(), group_id)
      )
    $policy$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.daily_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_date date NOT NULL,
  rank int NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  keywords text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_daily_topics_topic_date
  ON public.daily_topics (topic_date, rank);

CREATE INDEX IF NOT EXISTS idx_daily_topics_topic_date_desc
  ON public.daily_topics (topic_date DESC);

ALTER TABLE public.daily_topics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_topics'
      AND policyname = 'Authenticated users can view daily topics'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can view daily topics"
      ON public.daily_topics
      FOR SELECT
      TO authenticated
      USING (true)
    $policy$;
  END IF;
END $$;
