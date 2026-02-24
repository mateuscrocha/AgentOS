-- Align alert visibility with ownership-based CRUD rules.
-- Prevents system admins from seeing other users' alert definitions/events
-- that they cannot edit/delete with current ownership policies.

DROP POLICY IF EXISTS "Users can view their own alert definitions" ON public.alert_definitions;
CREATE POLICY "Users can view their own alert definitions"
  ON public.alert_definitions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

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
        AND ad.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their own alert events" ON public.alert_events;
CREATE POLICY "Users can view their own alert events"
  ON public.alert_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
