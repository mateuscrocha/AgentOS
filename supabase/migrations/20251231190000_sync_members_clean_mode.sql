ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;
