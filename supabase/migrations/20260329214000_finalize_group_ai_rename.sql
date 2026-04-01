DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'group_ai_prompt_configs'
  ) THEN
    UPDATE public.group_ai_prompt_configs current_row
    SET prompt_key = 'group_ai_base'
    WHERE prompt_key = 'assistant_base'
      AND NOT EXISTS (
        SELECT 1
        FROM public.group_ai_prompt_configs existing_row
        WHERE existing_row.group_id = current_row.group_id
          AND existing_row.prompt_key = 'group_ai_base'
      );

    DELETE FROM public.group_ai_prompt_configs
    WHERE prompt_key = 'assistant_base';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'groups'
  ) THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.v_groups_with_settings AS
      SELECT
        g.id,
        g.organization_id,
        g.name,
        g.whatsapp_provider_id,
        g.description,
        g.provider_phone,
        g.is_active,
        g.ai_enabled,
        g.ai_prompt,
        g.ai_model,
        g.ai_runtime,
        g.provider,
        g.status,
        g.is_archived,
        g.created_at AS group_created_at,
        g.updated_at AS group_updated_at,
        gs.daily_summary_enabled,
        gs.daily_summary_time,
        gs.daily_topics_enabled,
        gs.peak_moment_enabled,
        gs.polls_enabled,
        gs.welcome_message_enabled,
        gs.updated_at AS settings_updated_at
      FROM public.groups g
      LEFT JOIN public.group_settings gs ON gs.group_id = g.id
      WHERE g.deleted_at IS NULL
    $view$;

    ALTER TABLE public.groups
      DROP COLUMN IF EXISTS assistant_id,
      DROP COLUMN IF EXISTS has_assistant,
      DROP COLUMN IF EXISTS assistant_prompt,
      DROP COLUMN IF EXISTS assistant_model,
      DROP COLUMN IF EXISTS assistant_runtime;
  END IF;
END $$;
