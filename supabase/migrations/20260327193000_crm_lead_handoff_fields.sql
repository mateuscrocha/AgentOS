ALTER TABLE public.crm_accounts
  ADD COLUMN IF NOT EXISTS lead_source_category text NULL,
  ADD COLUMN IF NOT EXISTS lead_source_detail text NULL,
  ADD COLUMN IF NOT EXISTS inbound_channel text NULL,
  ADD COLUMN IF NOT EXISTS handoff_summary text NULL;

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS role_in_deal text NULL;

CREATE INDEX IF NOT EXISTS idx_crm_accounts_lead_source_category
  ON public.crm_accounts (lead_source_category);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_role_in_deal
  ON public.crm_contacts (role_in_deal);
