-- Assistants por grupo + resumos por período

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'groups'
  ) THEN
    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS assistant_id text;

    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS has_assistant boolean NOT NULL DEFAULT false;

    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS last_summary_at timestamptz;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'groups'
        AND column_name = 'assistant_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'groups'
        AND column_name = 'has_assistant'
    ) THEN
      UPDATE public.groups
      SET has_assistant = TRUE
      WHERE has_assistant = FALSE
        AND assistant_id IS NOT NULL;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  assistant_id text NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  summary_text text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_summaries_group_id_created_at
  ON public.group_summaries (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_summaries_group_id_period_start
  ON public.group_summaries (group_id, period_start);

ALTER TABLE public.group_summaries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_summaries'
      AND policyname = 'Users can view summaries of their groups'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view summaries of their groups"
      ON public.group_summaries
      FOR SELECT
      TO authenticated
      USING (
        public.is_system_admin(auth.uid())
        OR public.has_group_access(auth.uid(), group_id)
      )
    $policy$;
  END IF;
END $$;
