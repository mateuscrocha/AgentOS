-- Suporte/Atendimento por grupo (designação de participantes do grupo para KPIs de suporte)

CREATE TABLE IF NOT EXISTS public.group_support_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  granted_at timestamptz NULL DEFAULT now(),
  granted_by_user_id uuid NULL REFERENCES public.profiles(id),
  revoked_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT group_support_members_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT group_support_members_unique_member UNIQUE (group_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_group_support_members_group_id
  ON public.group_support_members(group_id);

CREATE INDEX IF NOT EXISTS idx_group_support_members_group_active
  ON public.group_support_members(group_id, is_active)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_group_support_members_updated_at ON public.group_support_members;
CREATE TRIGGER trg_group_support_members_updated_at
  BEFORE UPDATE ON public.group_support_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.group_support_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View group support members" ON public.group_support_members;
CREATE POLICY "View group support members"
ON public.group_support_members
FOR SELECT
TO authenticated
USING (
  public.is_system_admin(auth.uid())
  OR public.has_group_access(auth.uid(), group_id)
);

DROP POLICY IF EXISTS "Manage group support members" ON public.group_support_members;
CREATE POLICY "Manage group support members"
ON public.group_support_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_system_admin(auth.uid())
  OR public.can_edit_group(auth.uid(), group_id)
);

DROP POLICY IF EXISTS "Update group support members" ON public.group_support_members;
CREATE POLICY "Update group support members"
ON public.group_support_members
FOR UPDATE
TO authenticated
USING (
  public.is_system_admin(auth.uid())
  OR public.can_edit_group(auth.uid(), group_id)
)
WITH CHECK (
  public.is_system_admin(auth.uid())
  OR public.can_edit_group(auth.uid(), group_id)
);

DROP POLICY IF EXISTS "Delete group support members" ON public.group_support_members;
CREATE POLICY "Delete group support members"
ON public.group_support_members
FOR DELETE
TO authenticated
USING (
  public.is_system_admin(auth.uid())
  OR public.can_edit_group(auth.uid(), group_id)
);
