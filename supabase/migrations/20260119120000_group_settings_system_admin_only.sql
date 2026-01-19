-- Restringe atualizações em grupos/membros para SYSTEM_ADMIN

DROP POLICY IF EXISTS "Admins can update groups" ON public.groups;
CREATE POLICY "System admins can update groups"
ON public.groups
FOR UPDATE
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update members" ON public.members;
CREATE POLICY "System admins can update members"
ON public.members
FOR UPDATE
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));
