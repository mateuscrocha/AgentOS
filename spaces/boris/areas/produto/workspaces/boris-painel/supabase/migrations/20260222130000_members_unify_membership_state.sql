create or replace function public.members_normalize_membership_state()
returns trigger
language plpgsql
as $$
begin
  if new.deleted_at is not null then
    new.is_member := false;
    new.status := 'inactive';
    return new;
  end if;

  if new.left_at is not null then
    new.is_member := false;
    new.status := 'inactive';
    return new;
  end if;

  new.is_member := true;
  new.status := 'active';
  return new;
end;
$$;

drop trigger if exists trg_members_normalize_membership_state on public.members;
create trigger trg_members_normalize_membership_state
before insert or update of left_at, deleted_at, status, is_member
on public.members
for each row
execute function public.members_normalize_membership_state();

update public.members
set
  is_member = case
    when deleted_at is not null then false
    when left_at is not null then false
    else true
  end,
  status = case
    when deleted_at is not null then 'inactive'
    when left_at is not null then 'inactive'
    else 'active'
  end
where
  is_member is distinct from case
    when deleted_at is not null then false
    when left_at is not null then false
    else true
  end
  or status is distinct from case
    when deleted_at is not null then 'inactive'
    when left_at is not null then 'inactive'
    else 'active'
  end;

alter table public.members
  alter column is_member set not null;

alter table public.members
  alter column status set not null,
  alter column status set default 'active';

