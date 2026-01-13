-- Renomear coluna `summary` -> `content` em tabelas de tópicos
-- Requisitos:
-- - Backup antes da migração
-- - Sem perda de dados

DO $$
BEGIN
  IF to_regclass('public.group_daily_topics') IS NOT NULL THEN
    IF to_regclass('public.group_daily_topics_backup_before_content_rename_20260113') IS NULL THEN
      EXECUTE 'CREATE TABLE public.group_daily_topics_backup_before_content_rename_20260113 (LIKE public.group_daily_topics INCLUDING ALL)';
      EXECUTE 'INSERT INTO public.group_daily_topics_backup_before_content_rename_20260113 SELECT * FROM public.group_daily_topics';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'group_daily_topics'
        AND column_name = 'summary'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'group_daily_topics'
        AND column_name = 'content'
    ) THEN
      ALTER TABLE public.group_daily_topics RENAME COLUMN summary TO content;
    END IF;
  END IF;

  IF to_regclass('public.daily_topics') IS NOT NULL THEN
    IF to_regclass('public.daily_topics_backup_before_content_rename_20260113') IS NULL THEN
      EXECUTE 'CREATE TABLE public.daily_topics_backup_before_content_rename_20260113 (LIKE public.daily_topics INCLUDING ALL)';
      EXECUTE 'INSERT INTO public.daily_topics_backup_before_content_rename_20260113 SELECT * FROM public.daily_topics';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'daily_topics'
        AND column_name = 'summary'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'daily_topics'
        AND column_name = 'content'
    ) THEN
      ALTER TABLE public.daily_topics RENAME COLUMN summary TO content;
    END IF;
  END IF;
END $$;
