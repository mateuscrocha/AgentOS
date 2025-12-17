-- Allow SYSTEM_ADMIN to delete organizations
CREATE POLICY "System admins can delete organizations"
ON public.organizations
FOR DELETE
USING (is_system_admin(auth.uid()));