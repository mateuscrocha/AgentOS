DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'groups'
  ) THEN
    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS assistant_prompt text;

    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS assistant_model text;

    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS assistant_runtime text;

    UPDATE public.groups
    SET
      assistant_runtime = COALESCE(NULLIF(assistant_runtime, ''), 'responses'),
      assistant_model = COALESCE(NULLIF(assistant_model, ''), 'gpt-4o-mini')
    WHERE has_assistant = TRUE
      AND (
        assistant_runtime IS NULL OR assistant_runtime = ''
        OR assistant_model IS NULL OR assistant_model = ''
      );
  END IF;
END $$;
