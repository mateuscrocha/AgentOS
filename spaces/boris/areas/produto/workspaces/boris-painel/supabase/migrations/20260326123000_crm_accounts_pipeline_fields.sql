ALTER TABLE public.crm_accounts
  ADD COLUMN IF NOT EXISTS stage public.crm_opportunity_stage NOT NULL DEFAULT 'new_lead',
  ADD COLUMN IF NOT EXISTS potential_value numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS target_date date NULL,
  ADD COLUMN IF NOT EXISTS need text NULL,
  ADD COLUMN IF NOT EXISTS next_step text NULL,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS stage_position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_crm_accounts_stage_position
  ON public.crm_accounts (stage, stage_position, updated_at DESC);

WITH ranked_opportunities AS (
  SELECT
    opportunity.*,
    ROW_NUMBER() OVER (
      PARTITION BY opportunity.account_id
      ORDER BY
        CASE WHEN opportunity.status = 'open' THEN 0 ELSE 1 END,
        opportunity.updated_at DESC,
        opportunity.created_at DESC
    ) AS rn
  FROM public.crm_opportunities AS opportunity
)
UPDATE public.crm_accounts AS account
SET
  stage = ranked.stage,
  potential_value = COALESCE(ranked.potential_value, account.potential_value),
  target_date = COALESCE(ranked.target_date, account.target_date),
  need = COALESCE(NULLIF(ranked.need, ''), account.need),
  next_step = COALESCE(NULLIF(ranked.next_step, ''), account.next_step),
  quick_notes = COALESCE(NULLIF(ranked.notes, ''), account.quick_notes),
  last_contact_at = COALESCE(ranked.last_contact_at, account.last_contact_at),
  next_action_at = COALESCE(ranked.next_action_at, account.next_action_at),
  assigned_user_id = COALESCE(ranked.owner_user_id, account.assigned_user_id),
  stage_position = CASE
    WHEN ranked.stage_position IS NOT NULL AND ranked.stage_position > 0 THEN ranked.stage_position
    ELSE account.stage_position
  END,
  updated_at = now()
FROM ranked_opportunities AS ranked
WHERE ranked.account_id = account.id
  AND ranked.rn = 1;

UPDATE public.crm_accounts
SET
  stage = CASE
    WHEN status = 'customer' THEN 'customer'::public.crm_opportunity_stage
    WHEN status = 'inactive' THEN 'lost'::public.crm_opportunity_stage
    WHEN status = 'prospect' THEN 'qualification'::public.crm_opportunity_stage
    ELSE stage
  END
WHERE stage IS NULL
   OR (
     stage = 'new_lead'
     AND status IN ('customer', 'inactive', 'prospect')
   );

CREATE OR REPLACE FUNCTION public.crm_sync_account_stage_from_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'customer' THEN
    NEW.stage := 'customer';
  ELSIF NEW.status = 'inactive' AND NEW.stage <> 'customer' THEN
    NEW.stage := 'lost';
  END IF;

  IF NEW.stage = 'customer' AND NEW.status <> 'customer' THEN
    NEW.status := 'customer';
  ELSIF NEW.stage = 'lost' AND NEW.status = 'customer' THEN
    NEW.status := 'inactive';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_sync_account_stage_from_status ON public.crm_accounts;
CREATE TRIGGER trg_crm_sync_account_stage_from_status
  BEFORE INSERT OR UPDATE OF status, stage ON public.crm_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_sync_account_stage_from_status();
