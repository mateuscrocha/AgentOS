-- Allow authorized users to update members (admin flags, etc.)
-- Uses can_edit_group to gate updates by group-level permissions

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can update members"
ON public.members
FOR UPDATE
USING (public.can_edit_group(auth.uid(), group_id))
WITH CHECK (public.can_edit_group(auth.uid(), group_id));

