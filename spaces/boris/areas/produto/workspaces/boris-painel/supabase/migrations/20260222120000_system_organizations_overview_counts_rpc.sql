create or replace function public.get_system_organizations_overview_counts()
returns table (
  orgs_total bigint,
  orgs_active bigint,
  orgs_inactive bigint,
  orgs_suspended bigint,
  groups_total bigint
)
language sql
stable
as $$
  select
    (select count(*) from public.organizations) as orgs_total,
    (select count(*) from public.organizations where status = 'active') as orgs_active,
    (select count(*) from public.organizations where status = 'inactive') as orgs_inactive,
    (select count(*) from public.organizations where status = 'suspended') as orgs_suspended,
    (
      select count(*)
      from public.groups
      where deleted_at is null
        and coalesce(is_archived, false) = false
    ) as groups_total;
$$;

