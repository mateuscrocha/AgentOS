-- =====================================================
-- Group settings defaults + ensure row exists per group
-- Objetivo: sempre criar um registro em public.group_settings ao criar um grupo
-- Padrão: daily_summary_time = 19:00
-- =====================================================

CREATE TABLE IF NOT EXISTS public.group_settings (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  daily_summary_time time NOT NULL DEFAULT '19:00:00'::time,
  daily_summary_enabled boolean NOT NULL DEFAULT false,
  daily_topics_enabled boolean NOT NULL DEFAULT false,
  peak_moment_enabled boolean NOT NULL DEFAULT false,
  polls_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_settings
  ALTER COLUMN daily_summary_time SET DEFAULT '19:00:00'::time;

UPDATE public.group_settings
SET daily_summary_time = '19:00:00'::time
WHERE daily_summary_time = '09:00:00'::time;

INSERT INTO public.group_settings (group_id)
SELECT g.id
FROM public.groups g
LEFT JOIN public.group_settings gs ON gs.group_id = g.id
WHERE g.deleted_at IS NULL
  AND gs.group_id IS NULL
ON CONFLICT (group_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_group_settings_for_new_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_settings (group_id)
  VALUES (NEW.id)
  ON CONFLICT (group_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_groups_ensure_settings ON public.groups;
CREATE TRIGGER trg_groups_ensure_settings
AFTER INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.ensure_group_settings_for_new_group();

