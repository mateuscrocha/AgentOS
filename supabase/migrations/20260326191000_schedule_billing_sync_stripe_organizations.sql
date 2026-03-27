create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'billing_sync_cron_api_key'
  ) then
    perform vault.create_secret(
      gen_random_uuid()::text,
      'billing_sync_cron_api_key',
      'API key usada pelo cron horario de sincronizacao Stripe -> Organizations -> CRM'
    );
  end if;
end;
$$;

create or replace function public.verify_billing_sync_cron_api_key(provided_key text)
returns boolean
language sql
stable
security definer
set search_path = public, vault
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'billing_sync_cron_api_key'
      and decrypted_secret = nullif(btrim(provided_key), '')
  );
$$;

revoke all on function public.verify_billing_sync_cron_api_key(text) from public;
revoke all on function public.verify_billing_sync_cron_api_key(text) from anon;
revoke all on function public.verify_billing_sync_cron_api_key(text) from authenticated;
grant execute on function public.verify_billing_sync_cron_api_key(text) to service_role;

select cron.unschedule('billing-sync-stripe-organizations-hourly')
where exists (
  select 1
  from cron.job
  where jobname = 'billing-sync-stripe-organizations-hourly'
);

select cron.schedule(
  'billing-sync-stripe-organizations-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://ceugwdfpbvziiumnxknt.supabase.co/functions/v1/billing-sync-stripe-organizations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-api-key', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'billing_sync_cron_api_key'
      )
    ),
    body := jsonb_build_object('limit', 100),
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);
