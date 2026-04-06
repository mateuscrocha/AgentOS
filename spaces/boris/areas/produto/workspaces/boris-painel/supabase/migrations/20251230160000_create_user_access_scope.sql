-- Tabela de escopo de acesso inicial do usuário
CREATE TABLE public.user_access_scope (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'group')),
    scope_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, scope_type, scope_id)
);

-- Índice para consultas por contexto
CREATE INDEX IF NOT EXISTS user_access_scope_by_scope ON public.user_access_scope (scope_type, scope_id);

-- Habilitar RLS
ALTER TABLE public.user_access_scope ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver seus próprios escopos
CREATE POLICY "Users can view their own access scopes"
ON public.user_access_scope
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Política: admins de sistema podem ver todos os escopos
CREATE POLICY "System admins can view all access scopes"
ON public.user_access_scope
FOR SELECT
USING (is_system_admin(auth.uid()));

-- Política: admins de sistema podem inserir escopos
CREATE POLICY "System admins can insert access scopes"
ON public.user_access_scope
FOR INSERT
WITH CHECK (is_system_admin(auth.uid()));

