-- Ajuste/Criação da view vw_groups_members para refletir o schema atual de members/messages
-- Inclui provider_member_id (fallback: whatsapp_provider_id ou lid), métricas básicas e campos úteis ao dashboard

DROP VIEW IF EXISTS public.vw_groups_members;
CREATE VIEW public.vw_groups_members
WITH (security_invoker = true)
AS
SELECT 
  m.id AS member_id,
  m.group_id,
  g.organization_id,
  g.name AS group_name,
  g.provider,
  m.name,
  m.display_name,
  m.phone_e164,
  COALESCE(m.whatsapp_provider_id, m.lid) AS provider_member_id,
  m.is_admin,
  m.is_super_admin,
  m.is_owner,
  m.joined_at,
  m.left_at,
  m.last_seen_message_at,
  m.status,
  m.profile_pic_url,
  COALESCE((
    SELECT COUNT(*)
    FROM public.messages msg
    WHERE msg.member_id = m.id
      AND msg.group_id = m.group_id
      AND msg.deleted_at IS NULL
  ), 0) AS messages_count,
  (
    SELECT msg.created_at
    FROM public.messages msg
    WHERE msg.member_id = m.id
      AND msg.group_id = m.group_id
      AND msg.deleted_at IS NULL
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) AS last_message_at,
  (
    SELECT COALESCE(msg.text, msg.content)
    FROM public.messages msg
    WHERE msg.member_id = m.id
      AND msg.group_id = m.group_id
      AND msg.deleted_at IS NULL
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) AS last_message_preview
FROM public.members m
JOIN public.groups g ON g.id = m.group_id
WHERE m.deleted_at IS NULL
  AND g.deleted_at IS NULL;

