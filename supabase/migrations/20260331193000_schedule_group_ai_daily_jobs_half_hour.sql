create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'group_ai_cron_api_key'
  ) then
    perform vault.create_secret(
      gen_random_uuid()::text,
      'group_ai_cron_api_key',
      'API key usada pelo cron de 30 em 30 minutos para run-group-ai-daily-jobs'
    );
  end if;
end;
$$;

create or replace function public.verify_group_ai_cron_api_key(provided_key text)
returns boolean
language sql
stable
security definer
set search_path = public, vault
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'group_ai_cron_api_key'
      and decrypted_secret = nullif(btrim(provided_key), '')
  );
$$;

revoke all on function public.verify_group_ai_cron_api_key(text) from public;
revoke all on function public.verify_group_ai_cron_api_key(text) from anon;
revoke all on function public.verify_group_ai_cron_api_key(text) from authenticated;
grant execute on function public.verify_group_ai_cron_api_key(text) to service_role;

select cron.unschedule('group-ai-daily-jobs-half-hour')
where exists (
  select 1
  from cron.job
  where jobname = 'group-ai-daily-jobs-half-hour'
);

select cron.schedule(
  'group-ai-daily-jobs-half-hour',
  '0,30 * * * *',
  $$
  select net.http_post(
    url := 'https://ceugwdfpbvziiumnxknt.supabase.co/functions/v1/run-group-ai-daily-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-api-key', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'group_ai_cron_api_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);
