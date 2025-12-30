DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'GROUP_PARTICIPANT_INVITE'
      AND enumtypid = 'public.member_event_type'::regtype
  ) THEN
    EXECUTE 'ALTER TYPE public.member_event_type ADD VALUE ' || quote_literal('GROUP_PARTICIPANT_INVITE');
  END IF;
END $$;
