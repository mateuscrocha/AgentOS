-- Permitir novos tipos de mensagem: 'poll' e 'poll_vote'
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%message_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.messages
ADD CONSTRAINT messages_message_type_check
CHECK (message_type IN ('text','image','audio','video','document','sticker','location','poll','poll_vote'));
