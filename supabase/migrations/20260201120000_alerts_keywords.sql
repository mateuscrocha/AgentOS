-- =====================================================
-- ALERTAS: Termos monitorados e geração de alertas por mensagem
-- =====================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalize_alert_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        unaccent(lower(coalesce(input, ''))),
        '[^[:alnum:]]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  )
$$;

CREATE TABLE IF NOT EXISTS public.alert_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id uuid NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  scope_all_groups boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  match_mode text NOT NULL DEFAULT 'WINDOW',
  dedupe_window_sec int NOT NULL DEFAULT 300,
  notify_in_app boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_definitions_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT alert_definitions_match_mode_check CHECK (match_mode IN ('WINDOW', 'PER_MESSAGE')),
  CONSTRAINT alert_definitions_dedupe_window_check CHECK (dedupe_window_sec >= 0),
  CONSTRAINT alert_definitions_scope_check CHECK (
    (scope_all_groups IS TRUE AND group_id IS NULL)
    OR (scope_all_groups IS FALSE AND group_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_alert_definitions_user_id
  ON public.alert_definitions (user_id);

CREATE INDEX IF NOT EXISTS idx_alert_definitions_scope
  ON public.alert_definitions (status, scope_all_groups, organization_id, group_id);

DROP TRIGGER IF EXISTS update_alert_definitions_updated_at ON public.alert_definitions;
CREATE TRIGGER update_alert_definitions_updated_at
  BEFORE UPDATE ON public.alert_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_alert_definition_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.groups
    WHERE id = NEW.group_id;
    IF v_org_id IS NOT NULL THEN
      NEW.organization_id := v_org_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_alert_definition_org_id_trg ON public.alert_definitions;
CREATE TRIGGER set_alert_definition_org_id_trg
  BEFORE INSERT OR UPDATE ON public.alert_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_alert_definition_org_id();

CREATE TABLE IF NOT EXISTS public.alert_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_definition_id uuid NOT NULL REFERENCES public.alert_definitions(id) ON DELETE CASCADE,
  term_raw text NOT NULL,
  term_norm text NOT NULL,
  term_kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_terms_kind_check CHECK (term_kind IN ('word', 'phrase')),
  CONSTRAINT alert_terms_norm_not_empty CHECK (length(trim(term_norm)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS alert_terms_unique_per_definition
  ON public.alert_terms (alert_definition_id, term_norm);

CREATE INDEX IF NOT EXISTS idx_alert_terms_definition_id
  ON public.alert_terms (alert_definition_id);

DROP TRIGGER IF EXISTS update_alert_terms_updated_at ON public.alert_terms;
CREATE TRIGGER update_alert_terms_updated_at
  BEFORE UPDATE ON public.alert_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_alert_term_normalized_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := public.normalize_alert_text(NEW.term_raw);
  NEW.term_norm := v_norm;
  NEW.term_kind := CASE WHEN position(' ' in v_norm) > 0 THEN 'phrase' ELSE 'word' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_alert_term_normalized_fields_trg ON public.alert_terms;
CREATE TRIGGER set_alert_term_normalized_fields_trg
  BEFORE INSERT OR UPDATE ON public.alert_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_alert_term_normalized_fields();

CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_definition_id uuid NOT NULL REFERENCES public.alert_definitions(id) ON DELETE CASCADE,
  alert_term_id uuid NOT NULL REFERENCES public.alert_terms(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  first_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  last_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  first_triggered_at timestamptz NOT NULL DEFAULT now(),
  last_triggered_at timestamptz NOT NULL DEFAULT now(),
  occurrences int NOT NULL DEFAULT 1,
  message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  snippet text NULL,
  status text NOT NULL DEFAULT 'unread',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_events_status_check CHECK (status IN ('unread', 'read', 'archived')),
  CONSTRAINT alert_events_occurrences_check CHECK (occurrences >= 1)
);

CREATE INDEX IF NOT EXISTS idx_alert_events_user_status
  ON public.alert_events (user_id, status, last_triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_group_time
  ON public.alert_events (group_id, last_triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_definition_term
  ON public.alert_events (alert_definition_id, alert_term_id, group_id, last_triggered_at DESC);

DROP TRIGGER IF EXISTS update_alert_events_updated_at ON public.alert_events;
CREATE TRIGGER update_alert_events_updated_at
  BEFORE UPDATE ON public.alert_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.alert_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_alert_definition(
  _user_id uuid,
  _organization_id uuid,
  _group_id uuid,
  _scope_all_groups boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _scope_all_groups IS TRUE AND _organization_id IS NULL AND _group_id IS NULL
      THEN public.is_system_admin(_user_id)
    WHEN _scope_all_groups IS TRUE AND _organization_id IS NOT NULL AND _group_id IS NULL
      THEN public.can_edit_org(_user_id, _organization_id)
    WHEN _scope_all_groups IS FALSE AND _group_id IS NOT NULL
      THEN public.can_edit_group(_user_id, _group_id)
    ELSE false
  END
$$;

DROP POLICY IF EXISTS "Users can view their own alert definitions" ON public.alert_definitions;
CREATE POLICY "Users can view their own alert definitions"
  ON public.alert_definitions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own alert definitions" ON public.alert_definitions;
CREATE POLICY "Users can insert their own alert definitions"
  ON public.alert_definitions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_manage_alert_definition(auth.uid(), organization_id, group_id, scope_all_groups)
  );

DROP POLICY IF EXISTS "Users can update their own alert definitions" ON public.alert_definitions;
CREATE POLICY "Users can update their own alert definitions"
  ON public.alert_definitions
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_manage_alert_definition(auth.uid(), organization_id, group_id, scope_all_groups)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_manage_alert_definition(auth.uid(), organization_id, group_id, scope_all_groups)
  );

DROP POLICY IF EXISTS "Users can delete their own alert definitions" ON public.alert_definitions;
CREATE POLICY "Users can delete their own alert definitions"
  ON public.alert_definitions
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_manage_alert_definition(auth.uid(), organization_id, group_id, scope_all_groups)
  );

DROP POLICY IF EXISTS "Users can view alert terms" ON public.alert_terms;
CREATE POLICY "Users can view alert terms"
  ON public.alert_terms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.alert_definitions ad
      WHERE ad.id = alert_terms.alert_definition_id
        AND (ad.user_id = auth.uid() OR public.is_system_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can manage alert terms" ON public.alert_terms;
CREATE POLICY "Users can manage alert terms"
  ON public.alert_terms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.alert_definitions ad
      WHERE ad.id = alert_terms.alert_definition_id
        AND ad.user_id = auth.uid()
        AND public.can_manage_alert_definition(auth.uid(), ad.organization_id, ad.group_id, ad.scope_all_groups)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.alert_definitions ad
      WHERE ad.id = alert_terms.alert_definition_id
        AND ad.user_id = auth.uid()
        AND public.can_manage_alert_definition(auth.uid(), ad.organization_id, ad.group_id, ad.scope_all_groups)
    )
  );

DROP POLICY IF EXISTS "Users can view their own alert events" ON public.alert_events;
CREATE POLICY "Users can view their own alert events"
  ON public.alert_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own alert events" ON public.alert_events;
CREATE POLICY "Users can update their own alert events"
  ON public.alert_events
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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

  v_text := COALESCE(NEW.text, NEW.media_caption);
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
      IF v_norm !~ ('\\m' || r.term_norm || '\\M') THEN
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

DROP TRIGGER IF EXISTS process_alerts_on_message_insert ON public.messages;
CREATE TRIGGER process_alerts_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.process_alerts_for_message();

NOTIFY pgrst, 'reload schema';
