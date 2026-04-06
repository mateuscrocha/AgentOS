DROP POLICY IF EXISTS "System admins can insert organizations" ON public.organizations;
CREATE POLICY "System admins can insert organizations"
ON public.organizations
FOR INSERT
WITH CHECK (is_system_admin(auth.uid()));

