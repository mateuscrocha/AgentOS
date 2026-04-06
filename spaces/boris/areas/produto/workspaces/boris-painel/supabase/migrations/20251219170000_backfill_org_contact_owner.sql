-- Backfill organization contact fields and owner from existing roles and profiles
WITH admin_candidates AS (
  SELECT organization_id, user_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at ASC) AS rn
  FROM public.user_roles
  WHERE role = 'ORG_ADMIN' AND organization_id IS NOT NULL
),
chosen_admin AS (
  SELECT organization_id, user_id FROM admin_candidates WHERE rn = 1
),
profile_info AS (
  SELECT id AS user_id, name, phone_e164 FROM public.profiles
),
user_emails AS (
  SELECT id AS user_id, email FROM auth.users
)
UPDATE public.organizations o
SET owner_user_id = CASE WHEN o.owner_user_id IS NULL THEN ca.user_id ELSE o.owner_user_id END,
    contact_name = CASE WHEN o.contact_name IS NULL AND p.name IS NOT NULL THEN p.name ELSE o.contact_name END,
    contact_phone = CASE WHEN o.contact_phone IS NULL AND p.phone_e164 IS NOT NULL THEN p.phone_e164 ELSE o.contact_phone END,
    contact_email = CASE WHEN o.contact_email IS NULL AND ue.email IS NOT NULL THEN ue.email ELSE o.contact_email END
FROM chosen_admin ca
LEFT JOIN profile_info p ON p.user_id = ca.user_id
LEFT JOIN user_emails ue ON ue.user_id = ca.user_id
WHERE o.id = ca.organization_id;

-- Mark group members as owners when phone matches organization's contact phone
WITH org_contact AS (
  SELECT id AS organization_id, contact_phone
  FROM public.organizations
  WHERE contact_phone IS NOT NULL
),
org_groups AS (
  SELECT id AS group_id, organization_id
  FROM public.groups
)
UPDATE public.members m
SET is_owner = TRUE, name = COALESCE(m.name, m.phone_e164)
FROM org_contact oc
JOIN org_groups g ON g.organization_id = oc.organization_id
WHERE m.group_id = g.group_id
  AND oc.contact_phone IS NOT NULL
  AND regexp_replace(m.phone_e164, '\\D', '', 'g') = regexp_replace(oc.contact_phone, '\\D', '', 'g')
  AND (m.is_owner IS DISTINCT FROM TRUE);
