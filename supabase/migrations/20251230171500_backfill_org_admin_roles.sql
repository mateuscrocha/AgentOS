-- Backfill: garantir papel ORG_ADMIN para donos de organização
-- Critério: organizations.owner_user_id definido e ausente em user_roles
-- Idempotente: ON CONFLICT DO NOTHING evita duplicatas

WITH to_assign AS (
  SELECT o.id AS organization_id, o.owner_user_id AS user_id
  FROM public.organizations o
  WHERE o.owner_user_id IS NOT NULL
), inserted AS (
  INSERT INTO public.user_roles (user_id, role, organization_id)
  SELECT t.user_id, 'ORG_ADMIN', t.organization_id
  FROM to_assign t
  ON CONFLICT DO NOTHING
  RETURNING user_id, organization_id
)
INSERT INTO public.events (event_type, entity_type, entity_id, user_id, metadata)
SELECT 'ORG_ADMIN_ASSIGNED', 'organization', i.organization_id, i.user_id, jsonb_build_object('source', 'backfill')
FROM inserted;

