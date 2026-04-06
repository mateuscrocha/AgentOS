ALTER TABLE public.group_settings
  ADD COLUMN IF NOT EXISTS welcome_message_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_transcription_enabled boolean NOT NULL DEFAULT false;
