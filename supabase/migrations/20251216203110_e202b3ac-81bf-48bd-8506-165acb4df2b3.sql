-- Fix security definer views by recreating them without SECURITY DEFINER
-- By default views are SECURITY INVOKER in PostgreSQL 15+

-- Drop and recreate v_messages_feed with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.v_messages_feed;
CREATE VIEW public.v_messages_feed 
WITH (security_invoker = true)
AS
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

-- Drop and recreate v_group_overview with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.v_group_overview;
CREATE VIEW public.v_group_overview
WITH (security_invoker = true)
AS
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