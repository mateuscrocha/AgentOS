-- Adapt messages table to z-API webhook structure

-- Add new columns for z-API data
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS sender_phone text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS from_me boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'RECEIVED',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_caption text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS is_edit boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference_message_id text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- Add index for faster lookups by provider_message_id
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id ON messages(provider_message_id);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- Update v_messages_feed view to include new fields
DROP VIEW IF EXISTS v_messages_feed;
CREATE VIEW v_messages_feed AS
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