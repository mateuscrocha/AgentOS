BEGIN;

DROP FUNCTION IF EXISTS public.admin_get_journey_timeline(uuid, timestamptz, timestamptz, text, uuid, uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.admin_get_journey_event_types(uuid, timestamptz, timestamptz, uuid, uuid);
DROP FUNCTION IF EXISTS public.admin_get_journey_metrics(uuid, timestamptz, timestamptz, uuid, uuid);
DROP FUNCTION IF EXISTS public.admin_get_journey_funnel(uuid, timestamptz, timestamptz, uuid, uuid);

DROP TABLE IF EXISTS public.journey_events CASCADE;

COMMIT;
