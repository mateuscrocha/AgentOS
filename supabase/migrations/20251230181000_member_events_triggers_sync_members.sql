CREATE OR REPLACE FUNCTION public.member_events_sync_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_name text;
BEGIN
  SELECT id INTO v_member_id
  FROM public.members
  WHERE group_id = NEW.group_id
    AND COALESCE(whatsapp_provider_id, lid) = NEW.external_member_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_member_id IS NULL AND NEW.meta ? 'phone_e164' THEN
    SELECT id INTO v_member_id
    FROM public.members
    WHERE group_id = NEW.group_id
      AND phone_e164 = NEW.meta->>'phone_e164'
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_member_id IS NULL AND NEW.event_type = 'GROUP_PARTICIPANT_ADD' THEN
    v_name := COALESCE(NEW.meta->>'name', NEW.meta->>'display_name', 'Membro');
    INSERT INTO public.members (group_id, name, display_name, phone_e164, whatsapp_provider_id, lid, joined_at, status)
    VALUES (
      NEW.group_id,
      v_name,
      NEW.meta->>'display_name',
      NEW.meta->>'phone_e164',
      NEW.external_member_id,
      CASE WHEN NEW.meta ? 'lid' THEN NEW.meta->>'lid' ELSE NULL END,
      NEW.occurred_at,
      'active'
    )
    RETURNING id INTO v_member_id;
  END IF;

  IF v_member_id IS NOT NULL THEN
    UPDATE public.member_events
    SET member_id = v_member_id
    WHERE id = NEW.id;
  END IF;

  IF NEW.event_type = 'GROUP_PARTICIPANT_ADD' AND v_member_id IS NOT NULL THEN
    UPDATE public.members
    SET joined_at = COALESCE(joined_at, NEW.occurred_at),
        status = COALESCE(status, 'active')
    WHERE id = v_member_id;
  ELSIF NEW.event_type IN ('GROUP_PARTICIPANT_LEAVE','GROUP_PARTICIPANT_REMOVE') AND v_member_id IS NOT NULL THEN
    UPDATE public.members
    SET left_at = COALESCE(left_at, NEW.occurred_at),
        status = 'inactive'
    WHERE id = v_member_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_events_sync_members ON public.member_events;
CREATE TRIGGER trg_member_events_sync_members
AFTER INSERT ON public.member_events
FOR EACH ROW
EXECUTE FUNCTION public.member_events_sync_members();

WITH first_add AS (
  SELECT
    COALESCE(me.member_id, m.id) AS member_id,
    MIN(me.occurred_at) AS occurred_at
  FROM public.member_events me
  LEFT JOIN public.members m
    ON m.group_id = me.group_id
   AND COALESCE(m.whatsapp_provider_id, m.lid) = me.external_member_id
  WHERE me.event_type = 'GROUP_PARTICIPANT_ADD'
  GROUP BY COALESCE(me.member_id, m.id)
), last_exit AS (
  SELECT
    COALESCE(me.member_id, m.id) AS member_id,
    MAX(me.occurred_at) AS occurred_at
  FROM public.member_events me
  LEFT JOIN public.members m
    ON m.group_id = me.group_id
   AND COALESCE(m.whatsapp_provider_id, m.lid) = me.external_member_id
  WHERE me.event_type IN ('GROUP_PARTICIPANT_LEAVE','GROUP_PARTICIPANT_REMOVE')
  GROUP BY COALESCE(me.member_id, m.id)
)
UPDATE public.members m
SET joined_at = COALESCE(m.joined_at, fa.occurred_at),
    status = COALESCE(m.status, 'active')
FROM first_add fa
WHERE m.id = fa.member_id;

UPDATE public.members m
SET left_at = COALESCE(m.left_at, le.occurred_at),
    status = 'inactive'
FROM last_exit le
WHERE m.id = le.member_id;

