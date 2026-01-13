-- Remover coluna `keywords` da tabela de tópicos diários
-- Observação: essa mudança é apenas de schema (DDL)

ALTER TABLE public.group_daily_topics
DROP COLUMN IF EXISTS keywords;
