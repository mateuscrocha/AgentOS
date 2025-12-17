-- Create function to check if user can create groups in an organization
CREATE OR REPLACE FUNCTION public.can_create_group(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = 'SYSTEM_ADMIN'
        OR (role = 'ORG_ADMIN' AND organization_id = _org_id)
      )
  )
$$;

-- Allow SYSTEM_ADMIN and ORG_ADMIN to insert groups
CREATE POLICY "Admins can insert groups"
ON public.groups
FOR INSERT
WITH CHECK (can_create_group(auth.uid(), organization_id));

-- Allow SYSTEM_ADMIN and ORG_ADMIN to insert members
CREATE POLICY "Admins can insert members"
ON public.members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_id
    AND can_create_group(auth.uid(), g.organization_id)
  )
);