-- Corrigir views para usar SECURITY INVOKER (padrão seguro)
-- Isso garante que RLS seja aplicado baseado no usuário que consulta, não no criador

-- Recriar v_message_reactions com security_invoker
DROP VIEW IF EXISTS v_message_reactions;
CREATE VIEW v_message_reactions 
WITH (security_invoker = on) AS
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

-- Recriar v_message_reactions_summary com security_invoker
DROP VIEW IF EXISTS v_message_reactions_summary;
CREATE VIEW v_message_reactions_summary 
WITH (security_invoker = on) AS
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