create or replace function public.members_normalize_membership_state()
returns trigger
language plpgsql
as $$
begin
  if new.deleted_at is not null then
    new.status := 'inactive';
    return new;
  end if;

  if new.left_at is not null then
    new.status := 'inactive';
    return new;
  end if;

  new.status := 'active';
  return new;
end;
$$;

drop trigger if exists trg_members_normalize_membership_state on public.members;
create trigger trg_members_normalize_membership_state
before insert or update of left_at, deleted_at, status
on public.members
for each row
execute function public.members_normalize_membership_state();

update public.members
set status = case
  when deleted_at is not null then 'inactive'
  when left_at is not null then 'inactive'
  else 'active'
end
where status is distinct from case
  when deleted_at is not null then 'inactive'
  when left_at is not null then 'inactive'
  else 'active'
end;

alter table public.members
  drop column if exists is_member;

