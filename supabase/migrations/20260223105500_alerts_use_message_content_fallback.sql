-- Some inbound message flows persist text in `content` while `text` is null.
-- Alerts must inspect `content` as a fallback, otherwise valid messages are skipped.

CREATE OR REPLACE FUNCTION public.process_alerts_for_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_org_id uuid;
  v_text text;
  v_norm text;
  v_now timestamptz;
  r record;
  v_existing_id uuid;
  v_window_start timestamptz;
  v_snippet text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.from_me, false) IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.direction IS NOT NULL AND NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  SELECT organization_id
  INTO v_org_id
  FROM public.groups
  WHERE id = NEW.group_id;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_text := COALESCE(NEW.text, NEW.media_caption, NEW.content);
  IF v_text IS NULL OR length(trim(v_text)) = 0 THEN
    RETURN NEW;
  END IF;

  v_norm := public.normalize_alert_text(v_text);
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN NEW;
  END IF;

  v_now := COALESCE(NEW.created_at, now());
  v_snippet := CASE
    WHEN length(v_text) <= 160 THEN v_text
    ELSE left(v_text, 160) || '…'
  END;

  FOR r IN
    SELECT
      ad.id AS alert_definition_id,
      ad.user_id AS user_id,
      ad.match_mode AS match_mode,
      ad.dedupe_window_sec AS dedupe_window_sec,
      at.id AS alert_term_id,
      at.term_norm AS term_norm,
      at.term_raw AS term_raw,
      at.term_kind AS term_kind
    FROM public.alert_definitions ad
    JOIN public.alert_terms at
      ON at.alert_definition_id = ad.id
    WHERE ad.status = 'active'
      AND ad.notify_in_app IS TRUE
      AND (
        (ad.scope_all_groups IS TRUE AND (ad.organization_id IS NULL OR ad.organization_id = v_org_id))
        OR (ad.scope_all_groups IS FALSE AND ad.group_id = NEW.group_id)
      )
      AND (
        (ad.scope_all_groups IS TRUE AND ad.organization_id IS NULL AND public.is_system_admin(ad.user_id))
        OR (ad.scope_all_groups IS TRUE AND ad.organization_id IS NOT NULL AND public.can_edit_org(ad.user_id, ad.organization_id))
        OR (ad.scope_all_groups IS FALSE AND ad.group_id IS NOT NULL AND public.can_edit_group(ad.user_id, ad.group_id))
      )
  LOOP
    IF r.term_kind = 'word' THEN
      IF strpos(' ' || v_norm || ' ', ' ' || r.term_norm || ' ') = 0 THEN
        CONTINUE;
      END IF;
    ELSE
      IF strpos(v_norm, r.term_norm) = 0 THEN
        CONTINUE;
      END IF;
    END IF;

    IF r.match_mode = 'PER_MESSAGE' THEN
      INSERT INTO public.alert_events (
        user_id,
        alert_definition_id,
        alert_term_id,
        organization_id,
        group_id,
        first_message_id,
        last_message_id,
        first_triggered_at,
        last_triggered_at,
        occurrences,
        message_ids,
        snippet,
        status
      ) VALUES (
        r.user_id,
        r.alert_definition_id,
        r.alert_term_id,
        v_org_id,
        NEW.group_id,
        NEW.id,
        NEW.id,
        v_now,
        v_now,
        1,
        jsonb_build_array(NEW.id::text),
        v_snippet,
        'unread'
      );
      CONTINUE;
    END IF;

    v_window_start := v_now - make_interval(secs => r.dedupe_window_sec);
    SELECT id
    INTO v_existing_id
    FROM public.alert_events ae
    WHERE ae.user_id = r.user_id
      AND ae.alert_definition_id = r.alert_definition_id
      AND ae.alert_term_id = r.alert_term_id
      AND ae.group_id = NEW.group_id
      AND ae.status <> 'archived'
      AND ae.last_triggered_at >= v_window_start
    ORDER BY ae.last_triggered_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.alert_events
      SET
        occurrences = occurrences + 1,
        last_triggered_at = v_now,
        last_message_id = NEW.id,
        message_ids = CASE
          WHEN jsonb_array_length(message_ids) < 50 THEN message_ids || jsonb_build_array(NEW.id::text)
          ELSE message_ids
        END,
        snippet = v_snippet,
        status = 'unread',
        updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.alert_events (
        user_id,
        alert_definition_id,
        alert_term_id,
        organization_id,
        group_id,
        first_message_id,
        last_message_id,
        first_triggered_at,
        last_triggered_at,
        occurrences,
        message_ids,
        snippet,
        status
      ) VALUES (
        r.user_id,
        r.alert_definition_id,
        r.alert_term_id,
        v_org_id,
        NEW.group_id,
        NEW.id,
        NEW.id,
        v_now,
        v_now,
        1,
        jsonb_build_array(NEW.id::text),
        v_snippet,
        'unread'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
