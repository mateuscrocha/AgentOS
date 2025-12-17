-- Fix security definer view - use security_invoker instead
DROP VIEW IF EXISTS v_messages_feed;
CREATE VIEW v_messages_feed 
WITH (security_invoker = true) AS
SELECT 
  m.id AS message_id,
  m.group_id,
  m.created_at,
  m.message_type,
  CASE 
    WHEN m.message_type = 'text' THEN LEFT(m.content, 100)
    WHEN m.message_type IN ('image', 'video', 'document', 'audio', 'sticker') THEN COALESCE(m.media_caption, '[' || m.message_type || ']')
    ELSE '[' || m.message_type || ']'
  END AS content_preview,
  m.member_id,
  COALESCE(mb.name, m.sender_name, 'Unknown') AS member_name,
  m.sender_phone,
  m.from_me,
  m.status,
  m.media_url,
  m.provider_message_id
FROM messages m
LEFT JOIN members mb ON m.member_id = mb.id
ORDER BY m.created_at DESC;