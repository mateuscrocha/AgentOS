CREATE TABLE IF NOT EXISTS public.group_ai_prompt_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  prompt_key text NOT NULL,
  prompt_text text NOT NULL,
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  runtime text NOT NULL DEFAULT 'responses',
  is_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, prompt_key)
);

CREATE INDEX IF NOT EXISTS idx_group_ai_prompt_configs_group_id
  ON public.group_ai_prompt_configs (group_id, prompt_key);

ALTER TABLE public.group_ai_prompt_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_ai_prompt_configs'
      AND policyname = 'Users can view prompt configs of their groups'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view prompt configs of their groups"
      ON public.group_ai_prompt_configs
      FOR SELECT
      TO authenticated
      USING (
        public.is_system_admin(auth.uid())
        OR public.has_group_access(auth.uid(), group_id)
      )
    $policy$;
  END IF;
END $$;
