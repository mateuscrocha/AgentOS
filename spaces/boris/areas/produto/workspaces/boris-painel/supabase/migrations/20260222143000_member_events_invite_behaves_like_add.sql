create or replace function public.member_events_sync_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_name text;
begin
  select id into v_member_id
  from public.members
  where group_id = new.group_id
    and coalesce(whatsapp_provider_id, lid) = new.member_lid
    and deleted_at is null
  limit 1;

  if v_member_id is null and new.meta ? 'phone_e164' then
    select id into v_member_id
    from public.members
    where group_id = new.group_id
      and phone_e164 = new.meta->>'phone_e164'
      and deleted_at is null
    limit 1;
  end if;

  if v_member_id is null and new.event_type in ('GROUP_PARTICIPANT_ADD', 'GROUP_PARTICIPANT_INVITE') then
    v_name := coalesce(new.meta->>'name', new.meta->>'display_name', 'Membro');
    insert into public.members (group_id, name, display_name, phone_e164, whatsapp_provider_id, lid, joined_at, left_at, status)
    values (
      new.group_id,
      v_name,
      new.meta->>'display_name',
      new.meta->>'phone_e164',
      new.member_lid,
      case when new.meta ? 'lid' then new.meta->>'lid' else null end,
      new.occurred_at,
      null,
      'active'
    )
    returning id into v_member_id;
  end if;

  if v_member_id is not null then
    update public.member_events
    set member_id = v_member_id
    where id = new.id;
  end if;

  if new.event_type in ('GROUP_PARTICIPANT_ADD', 'GROUP_PARTICIPANT_INVITE') and v_member_id is not null then
    update public.members
    set joined_at = coalesce(joined_at, new.occurred_at),
        left_at = null,
        status = 'active'
    where id = v_member_id;
  elsif new.event_type in ('GROUP_PARTICIPANT_LEAVE','GROUP_PARTICIPANT_REMOVE') and v_member_id is not null then
    update public.members
    set left_at = coalesce(left_at, new.occurred_at),
        status = 'inactive'
    where id = v_member_id;
  end if;

  return new;
end;
$$;

with resolved_events as (
  select
    coalesce(me.member_id, m.id) as member_id,
    me.event_type,
    me.occurred_at,
    row_number() over (
      partition by coalesce(me.member_id, m.id)
      order by me.occurred_at desc, me.created_at desc, me.id desc
    ) as rn
  from public.member_events me
  left join public.members m
    on m.group_id = me.group_id
   and coalesce(m.whatsapp_provider_id, m.lid) = me.member_lid
  where me.event_type in (
    'GROUP_PARTICIPANT_ADD',
    'GROUP_PARTICIPANT_INVITE',
    'GROUP_PARTICIPANT_LEAVE',
    'GROUP_PARTICIPANT_REMOVE'
  )
),
latest_event as (
  select member_id, event_type, occurred_at
  from resolved_events
  where member_id is not null and rn = 1
)
update public.members m
set
  left_at = case
    when le.event_type in ('GROUP_PARTICIPANT_ADD', 'GROUP_PARTICIPANT_INVITE') then null
    else coalesce(m.left_at, le.occurred_at)
  end,
  status = case
    when le.event_type in ('GROUP_PARTICIPANT_ADD', 'GROUP_PARTICIPANT_INVITE') then 'active'
    else 'inactive'
  end
from latest_event le
where m.id = le.member_id;

