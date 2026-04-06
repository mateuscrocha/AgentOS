
-- Members: entradas por dia (joined_at) no grupo, ignorando deletados
CREATE INDEX IF NOT EXISTS idx_members_group_joined_at_active 
ON public.members(group_id, joined_at)
WHERE deleted_at IS NULL;

-- Members: saídas por dia (left_at) no grupo, ignorando deletados
CREATE INDEX IF NOT EXISTS idx_members_group_left_at_active 
ON public.members(group_id, left_at)
WHERE deleted_at IS NULL;

-- Messages: consultas por período no grupo, ignorando deletados
CREATE INDEX IF NOT EXISTS idx_messages_group_created_at_active 
ON public.messages(group_id, created_at)
WHERE deleted_at IS NULL;

-- Messages: atividade de membros (inbound, não do admin), por período
CREATE INDEX IF NOT EXISTS idx_messages_inbound_not_me_period 
ON public.messages(group_id, created_at)
WHERE direction = 'inbound' AND from_me = false AND deleted_at IS NULL;

-- Messages: contagens por membro no período
CREATE INDEX IF NOT EXISTS idx_messages_group_member_created_at_active 
ON public.messages(group_id, member_id, created_at)
WHERE deleted_at IS NULL;

-- Reactions: filtrar por grupo e período, ignorando removidas/deletadas
CREATE INDEX IF NOT EXISTS idx_message_reactions_group_reacted_at_active 
ON public.message_reactions(group_id, reacted_at)
WHERE removed_at IS NULL AND deleted_at IS NULL;
