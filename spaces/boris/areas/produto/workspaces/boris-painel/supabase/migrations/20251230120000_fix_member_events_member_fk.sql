ALTER TABLE public.member_events DROP CONSTRAINT IF EXISTS member_events_member_id_fkey;
ALTER TABLE public.member_events
  ADD CONSTRAINT member_events_member_id_fkey
  FOREIGN KEY (member_id)
  REFERENCES public.members(id)
  ON DELETE SET NULL;
