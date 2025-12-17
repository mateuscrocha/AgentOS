-- =====================================================
-- COMPREHENSIVE SCHEMA UPDATE FOR BORIS ADMIN
-- =====================================================

-- 1) PROFILES (User) - Add new fields
-- =====================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_e164 text,
ADD COLUMN IF NOT EXISTS whatsapp_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS role_global text DEFAULT 'user',
ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS locale text DEFAULT 'pt-BR',
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2) ORGANIZATIONS - Add new fields
-- =====================================================
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique ON public.organizations(slug) WHERE slug IS NOT NULL;

-- 3) GROUPS - Add new fields (some already exist)
-- =====================================================
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS provider_phone text,
ADD COLUMN IF NOT EXISTS invite_link text,
ADD COLUMN IF NOT EXISTS invite_link_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_at_provider timestamptz,
ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sync_error text,
ADD COLUMN IF NOT EXISTS counts_cache jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS raw_provider jsonb;

-- 4) GROUP_MEMBERS (ACL) - New table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_group text NOT NULL DEFAULT 'viewer',
  granted_by_user_id uuid REFERENCES public.profiles(id),
  granted_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  status text DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_members
CREATE POLICY "Users can view their own group memberships"
ON public.group_members FOR SELECT
USING (user_id = auth.uid() OR is_system_admin(auth.uid()));

CREATE POLICY "Admins can manage group memberships"
ON public.group_members FOR ALL
USING (is_system_admin(auth.uid()) OR can_edit_group(auth.uid(), group_id));

-- Trigger for updated_at
CREATE TRIGGER update_group_members_updated_at
BEFORE UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) MEMBERS (Participant) - Add new fields (some already exist)
-- =====================================================
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS lid text,
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_owner boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS joined_at timestamptz,
ADD COLUMN IF NOT EXISTS left_at timestamptz,
ADD COLUMN IF NOT EXISTS last_seen_message_at timestamptz,
ADD COLUMN IF NOT EXISTS profile_pic_url text,
ADD COLUMN IF NOT EXISTS raw_provider jsonb,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Rename phone to phone_e164 if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'phone') THEN
    ALTER TABLE public.members RENAME COLUMN phone TO phone_e164;
  END IF;
END $$;

-- Rename provider_member_id to provider_member_id if not exists (already exists, skip)
-- Add provider column if not exists
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'whatsapp';

-- Unique constraints for members
CREATE UNIQUE INDEX IF NOT EXISTS members_group_phone_unique 
ON public.members(group_id, phone_e164) 
WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS members_group_lid_unique 
ON public.members(group_id, lid) 
WHERE lid IS NOT NULL AND phone_e164 IS NULL AND deleted_at IS NULL;

-- 6) MESSAGES - Add new fields (many already exist from z-API migration)
-- =====================================================
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS direction text DEFAULT 'inbound',
ADD COLUMN IF NOT EXISTS type text,
ADD COLUMN IF NOT EXISTS text text,
ADD COLUMN IF NOT EXISTS media_size_bytes bigint,
ADD COLUMN IF NOT EXISTS media_duration_sec integer,
ADD COLUMN IF NOT EXISTS message_ts timestamptz,
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS edited_at timestamptz,
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'whatsapp',
ADD COLUMN IF NOT EXISTS provider_chat_id text,
ADD COLUMN IF NOT EXISTS reply_to_provider_message_id text,
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS read_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_read_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS status text DEFAULT 'received',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Rename raw_payload to raw_provider if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'raw_payload' AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'raw_provider')) THEN
    ALTER TABLE public.messages RENAME COLUMN raw_payload TO raw_provider;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'raw_provider') THEN
    ALTER TABLE public.messages ADD COLUMN raw_provider jsonb;
  END IF;
END $$;

-- Rename content to text if exists and text doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'content') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'text') THEN
    ALTER TABLE public.messages RENAME COLUMN content TO text;
  END IF;
END $$;

-- Trigger for messages updated_at
DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- UPDATE VIEWS
-- =====================================================

-- Update v_group_overview with new fields
DROP VIEW IF EXISTS public.v_group_overview;
CREATE VIEW public.v_group_overview WITH (security_invoker = true) AS
SELECT 
  g.id as group_id,
  g.name as group_name,
  g.organization_id,
  g.provider,
  g.provider_group_id,
  g.description,
  g.invite_link_status,
  g.is_active,
  g.is_archived,
  g.sync_status,
  g.last_sync_at,
  g.counts_cache,
  (SELECT COUNT(*) FROM public.members m WHERE m.group_id = g.id AND m.deleted_at IS NULL) as members_count,
  (SELECT COUNT(*) FROM public.messages msg WHERE msg.group_id = g.id AND msg.deleted_at IS NULL) as messages_count,
  (SELECT MAX(msg.created_at) FROM public.messages msg WHERE msg.group_id = g.id AND msg.deleted_at IS NULL) as last_message_at,
  (SELECT msg.text FROM public.messages msg WHERE msg.group_id = g.id AND msg.deleted_at IS NULL ORDER BY msg.created_at DESC LIMIT 1) as last_message_preview,
  (SELECT m.name FROM public.messages msg JOIN public.members m ON m.id = msg.member_id WHERE msg.group_id = g.id AND msg.deleted_at IS NULL ORDER BY msg.created_at DESC LIMIT 1) as last_message_member_name
FROM public.groups g
WHERE g.deleted_at IS NULL;

-- Update v_messages_feed with new fields
DROP VIEW IF EXISTS public.v_messages_feed;
CREATE VIEW public.v_messages_feed WITH (security_invoker = true) AS
SELECT 
  msg.id as message_id,
  msg.group_id,
  msg.member_id,
  msg.created_at,
  msg.direction,
  msg.type,
  msg.message_type,
  COALESCE(msg.text, msg.content) as content_preview,
  msg.media_url,
  msg.media_mime_type,
  msg.delivery_status,
  msg.from_me,
  msg.provider,
  msg.provider_message_id,
  msg.status,
  m.name as member_name,
  m.display_name as member_display_name,
  m.phone_e164 as sender_phone,
  m.profile_pic_url as member_avatar
FROM public.messages msg
LEFT JOIN public.members m ON m.id = msg.member_id
WHERE msg.deleted_at IS NULL
ORDER BY msg.created_at DESC;