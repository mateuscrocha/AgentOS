CREATE TABLE IF NOT EXISTS public.system_secrets (
  id text PRIMARY KEY,
  encrypted_value text NOT NULL,
  key_prefix text NOT NULL,
  key_last4 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_secrets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_system_secrets_updated_at'
  ) THEN
    CREATE TRIGGER update_system_secrets_updated_at
    BEFORE UPDATE ON public.system_secrets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_secrets_updated_at ON public.system_secrets(updated_at DESC);
