-- Create events table for audit logging
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_events_entity ON public.events(entity_type, entity_id);
CREATE INDEX idx_events_type ON public.events(event_type);
CREATE INDEX idx_events_created_at ON public.events(created_at DESC);

-- RLS policies
-- SYSTEM_ADMIN can view all events
CREATE POLICY "System admins can view all events"
ON public.events
FOR SELECT
TO authenticated
USING (public.is_system_admin(auth.uid()));

-- Users can insert events (the actual permission check happens at the entity level)
CREATE POLICY "Authenticated users can insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);