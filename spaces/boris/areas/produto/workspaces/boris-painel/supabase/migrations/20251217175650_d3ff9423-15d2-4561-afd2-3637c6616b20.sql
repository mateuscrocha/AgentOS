-- Tabela de reações de mensagens
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referências
  message_id UUID NOT NULL,
  group_id UUID NOT NULL,
  member_id UUID,
  
  -- Dados da reação
  emoji TEXT NOT NULL,
  reacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  
  -- Campos do provedor
  provider TEXT DEFAULT 'whatsapp',
  provider_message_id TEXT,
  provider_reaction_key TEXT,
  raw_provider JSONB,
  
  -- Campos padrão
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX idx_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_reactions_group_id ON message_reactions(group_id);
CREATE INDEX idx_reactions_member_id ON message_reactions(member_id);
CREATE INDEX idx_reactions_active ON message_reactions(message_id) WHERE removed_at IS NULL;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_message_reactions_updated_at
  BEFORE UPDATE ON message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: visualização segue regra de acesso ao grupo
CREATE POLICY "Users can view reactions of their groups"
  ON message_reactions FOR SELECT
  USING (
    is_system_admin(auth.uid()) 
    OR has_group_access(auth.uid(), group_id)
  );

-- View para reações com dados do membro
CREATE OR REPLACE VIEW v_message_reactions AS
SELECT 
  r.id AS reaction_id,
  r.message_id,
  r.group_id,
  r.member_id,
  r.emoji,
  r.reacted_at,
  r.removed_at,
  r.provider_message_id,
  m.name AS member_name,
  m.display_name AS member_display_name,
  m.phone_e164 AS member_phone,
  m.profile_pic_url AS member_avatar,
  CASE WHEN r.removed_at IS NULL THEN 'active' ELSE 'removed' END AS reaction_status
FROM message_reactions r
LEFT JOIN members m ON m.id = r.member_id
WHERE r.deleted_at IS NULL;

-- View agregada para sumário de reações por mensagem
CREATE OR REPLACE VIEW v_message_reactions_summary AS
SELECT 
  r.message_id,
  r.emoji,
  COUNT(*) AS count,
  ARRAY_AGG(
    jsonb_build_object(
      'member_id', r.member_id,
      'member_name', COALESCE(m.display_name, m.name),
      'member_avatar', m.profile_pic_url,
      'reacted_at', r.reacted_at
    ) ORDER BY r.reacted_at
  ) AS reactors
FROM message_reactions r
LEFT JOIN members m ON m.id = r.member_id
WHERE r.removed_at IS NULL AND r.deleted_at IS NULL
GROUP BY r.message_id, r.emoji;