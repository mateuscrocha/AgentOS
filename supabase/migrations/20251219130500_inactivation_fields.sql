-- Inativação (soft) para organizações e grupos
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS inactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivated_reason text;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS inactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivated_reason text;
