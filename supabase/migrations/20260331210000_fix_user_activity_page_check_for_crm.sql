ALTER TABLE public.user_activity_log
  DROP CONSTRAINT IF EXISTS user_activity_log_page_check;

ALTER TABLE public.user_activity_log
  ADD CONSTRAINT user_activity_log_page_check
    CHECK (
      page IS NULL OR page IN (
        'dashboard',
        'organizacoes',
        'grupos',
        'membros',
        'mensagens',
        'suporte',
        'eventos',
        'enquetes',
        'crm',
        'configuracoes',
        'usuarios',
        'relatorios',
        'resumos',
        'alertas',
        'insights',
        'onboarding'
      )
    );
