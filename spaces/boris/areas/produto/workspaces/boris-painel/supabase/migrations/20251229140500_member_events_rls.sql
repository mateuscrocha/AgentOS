-- =====================================================
-- RLS para member_events
-- Permitir leitura apenas para usuários com acesso ao grupo
-- =====================================================

ALTER TABLE public.member_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view member events of their groups"
ON public.member_events
FOR SELECT
TO authenticated
USING (
  public.is_system_admin(auth.uid())
  OR public.has_group_access(auth.uid(), group_id)
);

