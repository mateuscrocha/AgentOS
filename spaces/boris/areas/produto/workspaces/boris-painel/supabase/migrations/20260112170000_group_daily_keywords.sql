CREATE TABLE IF NOT EXISTS public.group_daily_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  keyword_date date NOT NULL,
  keyword text NOT NULL,
  rank int NOT NULL,
  mentions_count int NOT NULL DEFAULT 0,
  participants_count int NOT NULL DEFAULT 0,
  messages_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, keyword_date, keyword)
);

CREATE INDEX IF NOT EXISTS idx_group_daily_keywords_group_id_keyword_date
  ON public.group_daily_keywords (group_id, keyword_date);

CREATE INDEX IF NOT EXISTS idx_group_daily_keywords_group_id_keyword_date_rank
  ON public.group_daily_keywords (group_id, keyword_date, rank);

CREATE INDEX IF NOT EXISTS idx_group_daily_keywords_keyword_date_desc
  ON public.group_daily_keywords (keyword_date DESC);

ALTER TABLE public.group_daily_keywords ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_daily_keywords'
      AND policyname = 'Users can view daily keywords of their groups'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view daily keywords of their groups"
      ON public.group_daily_keywords
      FOR SELECT
      TO authenticated
      USING (
        public.is_system_admin(auth.uid())
        OR public.has_group_access(auth.uid(), group_id)
      )
    $policy$;
  END IF;
END $$;
