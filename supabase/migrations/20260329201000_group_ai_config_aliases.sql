DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'groups'
  ) THEN
    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS ai_enabled boolean;

    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS ai_prompt text;

    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS ai_model text;

    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS ai_runtime text;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'groups'
        AND column_name = 'has_assistant'
    ) THEN
      UPDATE public.groups
      SET
        ai_enabled = COALESCE(ai_enabled, has_assistant, false),
        ai_prompt = COALESCE(NULLIF(ai_prompt, ''), assistant_prompt),
        ai_model = COALESCE(NULLIF(ai_model, ''), assistant_model),
        ai_runtime = COALESCE(NULLIF(ai_runtime, ''), assistant_runtime)
      WHERE
        ai_enabled IS NULL
        OR ai_prompt IS NULL OR ai_prompt = ''
        OR ai_model IS NULL OR ai_model = ''
        OR ai_runtime IS NULL OR ai_runtime = '';
    ELSE
      UPDATE public.groups
      SET
        ai_enabled = COALESCE(ai_enabled, (assistant_id IS NOT NULL), false),
        ai_prompt = COALESCE(NULLIF(ai_prompt, ''), assistant_prompt),
        ai_model = COALESCE(NULLIF(ai_model, ''), assistant_model),
        ai_runtime = COALESCE(NULLIF(ai_runtime, ''), assistant_runtime)
      WHERE
        ai_enabled IS NULL
        OR ai_prompt IS NULL OR ai_prompt = ''
        OR ai_model IS NULL OR ai_model = ''
        OR ai_runtime IS NULL OR ai_runtime = '';
    END IF;
  END IF;
END $$;
