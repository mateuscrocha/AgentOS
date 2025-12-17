-- Allow SYSTEM_ADMIN to view all user roles
CREATE POLICY "System admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (is_system_admin(auth.uid()));

-- Allow SYSTEM_ADMIN to insert user roles
CREATE POLICY "System admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (is_system_admin(auth.uid()));

-- Allow SYSTEM_ADMIN to update user roles
CREATE POLICY "System admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Allow SYSTEM_ADMIN to delete user roles
CREATE POLICY "System admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (is_system_admin(auth.uid()));

-- Allow SYSTEM_ADMIN to view all profiles for user management
CREATE POLICY "System admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_system_admin(auth.uid()));