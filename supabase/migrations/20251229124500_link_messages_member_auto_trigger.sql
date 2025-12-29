-- Vincular automaticamente mensagens a membros por telefone (inbound, não-bot)
CREATE OR REPLACE FUNCTION public.link_message_member_by_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  IF NEW.member_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.direction IS NULL OR NEW.direction = 'inbound') AND (NEW.from_me IS NULL OR NEW.from_me = false) THEN
    IF NEW.sender_phone IS NOT NULL THEN
      SELECT id INTO v_member_id
      FROM public.members
      WHERE group_id = NEW.group_id
        AND phone_e164 = NEW.sender_phone
        AND deleted_at IS NULL
      LIMIT 1;

      IF v_member_id IS NOT NULL THEN
        NEW.member_id := v_member_id;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_message_member_by_phone_trigger ON public.messages;
CREATE TRIGGER link_message_member_by_phone_trigger
BEFORE INSERT OR UPDATE OF sender_phone, member_id
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.link_message_member_by_phone();

-- Índice de apoio para vincular por grupo+telefone
CREATE INDEX IF NOT EXISTS idx_messages_group_sender_phone
  ON public.messages(group_id, sender_phone)
  WHERE sender_phone IS NOT NULL;

-- Backfill: vincular mensagens existentes por telefone (inbound, não-bot)
UPDATE public.messages m
SET member_id = mem.id
FROM public.members mem
WHERE mem.group_id = m.group_id
  AND m.member_id IS NULL
  AND m.sender_phone IS NOT NULL
  AND mem.phone_e164 = m.sender_phone
  AND mem.deleted_at IS NULL
  AND (m.direction IS NULL OR m.direction = 'inbound')
  AND (m.from_me IS NULL OR m.from_me = false);

