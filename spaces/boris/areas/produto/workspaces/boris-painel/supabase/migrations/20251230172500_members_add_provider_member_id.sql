ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS provider_member_id text GENERATED ALWAYS AS (COALESCE(whatsapp_provider_id, lid)) STORED;

CREATE INDEX IF NOT EXISTS idx_members_provider_member_id_active
  ON public.members(provider_member_id)
  WHERE provider_member_id IS NOT NULL AND deleted_at IS NULL;

