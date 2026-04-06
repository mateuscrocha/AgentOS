BEGIN;

-- Ajuste histórico: subtrair 3 horas de timestamps de eventos
-- Mensagens
UPDATE public.messages SET created_at = created_at - interval '3 hours' WHERE created_at IS NOT NULL;
UPDATE public.messages SET delivered_at = delivered_at - interval '3 hours' WHERE delivered_at IS NOT NULL;
UPDATE public.messages SET edited_at = edited_at - interval '3 hours' WHERE edited_at IS NOT NULL;
UPDATE public.messages SET last_read_at = last_read_at - interval '3 hours' WHERE last_read_at IS NOT NULL;
UPDATE public.messages SET message_ts = message_ts - interval '3 hours' WHERE message_ts IS NOT NULL;
UPDATE public.messages SET updated_at = updated_at - interval '3 hours' WHERE updated_at IS NOT NULL;
UPDATE public.messages SET deleted_at = deleted_at - interval '3 hours' WHERE deleted_at IS NOT NULL;

-- Reações às mensagens
UPDATE public.message_reactions SET reacted_at = reacted_at - interval '3 hours' WHERE reacted_at IS NOT NULL;
UPDATE public.message_reactions SET created_at = created_at - interval '3 hours' WHERE created_at IS NOT NULL;
UPDATE public.message_reactions SET updated_at = updated_at - interval '3 hours' WHERE updated_at IS NOT NULL;
UPDATE public.message_reactions SET removed_at = removed_at - interval '3 hours' WHERE removed_at IS NOT NULL;
UPDATE public.message_reactions SET deleted_at = deleted_at - interval '3 hours' WHERE deleted_at IS NOT NULL;

-- Membros
UPDATE public.members SET joined_at = joined_at - interval '3 hours' WHERE joined_at IS NOT NULL;
UPDATE public.members SET left_at = left_at - interval '3 hours' WHERE left_at IS NOT NULL;
UPDATE public.members SET last_seen_message_at = last_seen_message_at - interval '3 hours' WHERE last_seen_message_at IS NOT NULL;
UPDATE public.members SET created_at = created_at - interval '3 hours' WHERE created_at IS NOT NULL;
UPDATE public.members SET updated_at = updated_at - interval '3 hours' WHERE updated_at IS NOT NULL;
UPDATE public.members SET deleted_at = deleted_at - interval '3 hours' WHERE deleted_at IS NOT NULL;

-- Relações de membros com grupos
UPDATE public.group_members SET granted_at = granted_at - interval '3 hours' WHERE granted_at IS NOT NULL;
UPDATE public.group_members SET revoked_at = revoked_at - interval '3 hours' WHERE revoked_at IS NOT NULL;
UPDATE public.group_members SET created_at = created_at - interval '3 hours' WHERE created_at IS NOT NULL;
UPDATE public.group_members SET updated_at = updated_at - interval '3 hours' WHERE updated_at IS NOT NULL;
UPDATE public.group_members SET deleted_at = deleted_at - interval '3 hours' WHERE deleted_at IS NOT NULL;

-- Eventos (logs)
UPDATE public.events SET created_at = created_at - interval '3 hours' WHERE created_at IS NOT NULL;

-- Enquetes e votos
UPDATE public.polls SET created_at = created_at - interval '3 hours' WHERE created_at IS NOT NULL;
UPDATE public.poll_votes SET created_at = created_at - interval '3 hours' WHERE created_at IS NOT NULL;

-- Grupos — campos de sincronização/provedor (evitar alterar created_at administrativo)
UPDATE public.groups SET last_sync_at = last_sync_at - interval '3 hours' WHERE last_sync_at IS NOT NULL;
UPDATE public.groups SET created_at_provider = created_at_provider - interval '3 hours' WHERE created_at_provider IS NOT NULL;

COMMIT;

