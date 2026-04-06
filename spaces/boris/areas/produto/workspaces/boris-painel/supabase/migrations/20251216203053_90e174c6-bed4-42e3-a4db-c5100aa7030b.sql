-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('SYSTEM_ADMIN', 'ORG_ADMIN', 'GROUP_MANAGER', 'USER');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role, organization_id, group_id)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Create function to check if user is SYSTEM_ADMIN
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'SYSTEM_ADMIN'
  )
$$;

-- 6. Create function to check org access
CREATE OR REPLACE FUNCTION public.has_org_access(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = 'SYSTEM_ADMIN'
        OR (role = 'ORG_ADMIN' AND organization_id = _org_id)
        OR (role = 'GROUP_MANAGER' AND organization_id = _org_id)
        OR (role = 'USER' AND organization_id = _org_id)
      )
  )
$$;

-- 7. Create function to check group access
CREATE OR REPLACE FUNCTION public.has_group_access(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.groups g ON g.id = _group_id
    WHERE ur.user_id = _user_id
      AND (
        ur.role = 'SYSTEM_ADMIN'
        OR (ur.role = 'ORG_ADMIN' AND ur.organization_id = g.organization_id)
        OR (ur.role = 'GROUP_MANAGER' AND (ur.group_id = _group_id OR ur.organization_id = g.organization_id))
        OR (ur.role = 'USER' AND (ur.group_id = _group_id OR ur.organization_id = g.organization_id))
      )
  )
$$;

-- 8. Create function to check if user can edit org
CREATE OR REPLACE FUNCTION public.can_edit_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- 9. Create function to check if user can edit group
CREATE OR REPLACE FUNCTION public.can_edit_group(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.groups g ON g.id = _group_id
    WHERE ur.user_id = _user_id
      AND (
        ur.role = 'SYSTEM_ADMIN'
        OR (ur.role = 'ORG_ADMIN' AND ur.organization_id = g.organization_id)
        OR (ur.role = 'GROUP_MANAGER' AND ur.group_id = _group_id)
      )
  )
$$;

-- 10. RLS policy for user_roles - users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 11. Create v_messages_feed view
CREATE OR REPLACE VIEW public.v_messages_feed AS
SELECT 
    m.id AS message_id,
    m.group_id,
    m.created_at,
    m.message_type,
    LEFT(m.content, 160) AS content_preview,
    m.member_id,
    COALESCE(mem.name, 'Unknown') AS member_name,
    m.provider_message_id
FROM public.messages m
LEFT JOIN public.members mem ON mem.id = m.member_id;

-- 12. Create v_group_overview view
CREATE OR REPLACE VIEW public.v_group_overview AS
SELECT 
    g.id AS group_id,
    g.name AS group_name,
    g.organization_id,
    g.provider,
    g.provider_group_id,
    COALESCE(mc.members_count, 0) AS members_count,
    COALESCE(msg_c.messages_count, 0) AS messages_count,
    lm.last_message_at,
    lm.last_message_preview,
    lm.last_message_member_name
FROM public.groups g
LEFT JOIN (
    SELECT group_id, COUNT(*) AS members_count
    FROM public.members
    GROUP BY group_id
) mc ON mc.group_id = g.id
LEFT JOIN (
    SELECT group_id, COUNT(*) AS messages_count
    FROM public.messages
    GROUP BY group_id
) msg_c ON msg_c.group_id = g.id
LEFT JOIN LATERAL (
    SELECT 
        m.created_at AS last_message_at,
        LEFT(m.content, 100) AS last_message_preview,
        COALESCE(mem.name, 'Unknown') AS last_message_member_name
    FROM public.messages m
    LEFT JOIN public.members mem ON mem.id = m.member_id
    WHERE m.group_id = g.id
    ORDER BY m.created_at DESC
    LIMIT 1
) lm ON true;

-- 13. Update RLS policies on organizations to use role functions
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;

CREATE POLICY "Users can view organizations they have access to"
ON public.organizations
FOR SELECT
TO authenticated
USING (
    public.is_system_admin(auth.uid()) 
    OR public.has_org_access(auth.uid(), id)
);

-- 14. Add UPDATE policy for organizations (SYSTEM_ADMIN and ORG_ADMIN only)
CREATE POLICY "Admins can update organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.can_edit_org(auth.uid(), id))
WITH CHECK (public.can_edit_org(auth.uid(), id));

-- 15. Update RLS policies on groups
DROP POLICY IF EXISTS "Authenticated users can view groups" ON public.groups;

CREATE POLICY "Users can view groups they have access to"
ON public.groups
FOR SELECT
TO authenticated
USING (
    public.is_system_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id)
    OR public.has_group_access(auth.uid(), id)
);

-- 16. Add UPDATE policy for groups
CREATE POLICY "Admins can update groups"
ON public.groups
FOR UPDATE
TO authenticated
USING (public.can_edit_group(auth.uid(), id))
WITH CHECK (public.can_edit_group(auth.uid(), id));

-- 17. Update RLS policies on members
DROP POLICY IF EXISTS "Authenticated users can view members" ON public.members;

CREATE POLICY "Users can view members of their groups"
ON public.members
FOR SELECT
TO authenticated
USING (
    public.is_system_admin(auth.uid())
    OR public.has_group_access(auth.uid(), group_id)
);

-- 18. Update RLS policies on messages
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;

CREATE POLICY "Users can view messages of their groups"
ON public.messages
FOR SELECT
TO authenticated
USING (
    public.is_system_admin(auth.uid())
    OR public.has_group_access(auth.uid(), group_id)
);