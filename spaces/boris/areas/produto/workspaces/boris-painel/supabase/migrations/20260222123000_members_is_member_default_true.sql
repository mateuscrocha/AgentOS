alter table public.members
  alter column is_member set default true;

update public.members
set is_member = true
where is_member is null;

