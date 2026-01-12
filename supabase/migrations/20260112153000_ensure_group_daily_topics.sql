CREATE TABLE IF NOT EXISTS public.group_daily_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  topic_date date NOT NULL,
  rank int NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  keywords text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, topic_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_group_daily_topics_group_id_topic_date
  ON public.group_daily_topics (group_id, topic_date);

CREATE INDEX IF NOT EXISTS idx_group_daily_topics_topic_date_desc
  ON public.group_daily_topics (topic_date DESC);

ALTER TABLE public.group_daily_topics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_daily_topics'
      AND policyname = 'Users can view daily topics of their groups'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view daily topics of their groups"
      ON public.group_daily_topics
      FOR SELECT
      TO authenticated
      USING (
        public.is_system_admin(auth.uid())
        OR public.has_group_access(auth.uid(), group_id)
      )
    $policy$;
  END IF;
END $$;
