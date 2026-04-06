CREATE TYPE public.crm_opportunity_stage AS ENUM (
  'new_lead',
  'qualification',
  'meeting',
  'proposal',
  'customer',
  'lost'
);

CREATE TYPE public.crm_opportunity_status AS ENUM (
  'open',
  'won',
  'lost',
  'stalled'
);

CREATE TYPE public.crm_account_status AS ENUM (
  'lead',
  'prospect',
  'customer',
  'inactive'
);

CREATE TYPE public.crm_timeline_item_type AS ENUM (
  'note',
  'task',
  'next_step'
);

CREATE TABLE public.crm_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  assigned_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  domain text NULL,
  phone text NULL,
  email text NULL,
  source text NULL,
  status public.crm_account_status NOT NULL DEFAULT 'lead',
  quick_notes text NULL,
  stripe_customer_id text NULL,
  stripe_subscription_id text NULL,
  stripe_subscription_status text NULL,
  stripe_last_invoice_at timestamptz NULL,
  stripe_last_invoice_amount_cents integer NULL,
  stripe_next_billing_at timestamptz NULL,
  stripe_is_delinquent boolean NULL,
  financial_context_updated_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX crm_accounts_organization_unique
  ON public.crm_accounts (organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX idx_crm_accounts_name ON public.crm_accounts (name);
CREATE INDEX idx_crm_accounts_domain ON public.crm_accounts (domain);
CREATE INDEX idx_crm_accounts_status ON public.crm_accounts (status);
CREATE INDEX idx_crm_accounts_updated_at ON public.crm_accounts (updated_at DESC);

CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
  organization_contact_id uuid NULL REFERENCES public.organization_contacts(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NULL,
  email text NULL,
  phone text NULL,
  title text NULL,
  city text NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX crm_contacts_primary_unique
  ON public.crm_contacts (account_id)
  WHERE is_primary IS TRUE;

CREATE INDEX idx_crm_contacts_account_id ON public.crm_contacts (account_id);
CREATE INDEX idx_crm_contacts_email ON public.crm_contacts (email);
CREATE INDEX idx_crm_contacts_updated_at ON public.crm_contacts (updated_at DESC);

CREATE TABLE public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
  contact_id uuid NULL REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  owner_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage public.crm_opportunity_stage NOT NULL DEFAULT 'new_lead',
  status public.crm_opportunity_status NOT NULL DEFAULT 'open',
  potential_value numeric(12,2) NULL,
  target_date date NULL,
  source text NULL,
  need text NULL,
  next_step text NULL,
  notes text NULL,
  last_contact_at timestamptz NULL,
  next_action_at timestamptz NULL,
  stage_position integer NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_opportunities_account_id ON public.crm_opportunities (account_id);
CREATE INDEX idx_crm_opportunities_contact_id ON public.crm_opportunities (contact_id);
CREATE INDEX idx_crm_opportunities_stage_position ON public.crm_opportunities (stage, stage_position, updated_at DESC);
CREATE INDEX idx_crm_opportunities_target_date ON public.crm_opportunities (target_date);

CREATE TABLE public.crm_timeline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
  opportunity_id uuid NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  item_type public.crm_timeline_item_type NOT NULL,
  title text NULL,
  content text NOT NULL,
  due_at timestamptz NULL,
  follow_up_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_timeline_items_entity_check CHECK (
    account_id IS NOT NULL OR opportunity_id IS NOT NULL
  )
);

CREATE INDEX idx_crm_timeline_account_id ON public.crm_timeline_items (account_id, created_at DESC);
CREATE INDEX idx_crm_timeline_opportunity_id ON public.crm_timeline_items (opportunity_id, created_at DESC);
CREATE INDEX idx_crm_timeline_open_tasks ON public.crm_timeline_items (item_type, completed_at, due_at);

CREATE OR REPLACE FUNCTION public.crm_sync_opportunity_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage = 'customer' THEN
    NEW.status := 'won';
  ELSIF NEW.stage = 'lost' THEN
    NEW.status := 'lost';
  ELSIF NEW.status IN ('won', 'lost') THEN
    NEW.status := 'open';
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_timeline_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_accounts_updated_at
  BEFORE UPDATE ON public.crm_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_opportunities_updated_at
  BEFORE UPDATE ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_timeline_items_updated_at
  BEFORE UPDATE ON public.crm_timeline_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_crm_sync_opportunity_status
  BEFORE INSERT OR UPDATE OF stage, status ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_opportunity_status();

CREATE POLICY "System admins can view crm accounts"
  ON public.crm_accounts
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can insert crm accounts"
  ON public.crm_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can update crm accounts"
  ON public.crm_accounts
  FOR UPDATE
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can delete crm accounts"
  ON public.crm_accounts
  FOR DELETE
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can view crm contacts"
  ON public.crm_contacts
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can insert crm contacts"
  ON public.crm_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can update crm contacts"
  ON public.crm_contacts
  FOR UPDATE
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can delete crm contacts"
  ON public.crm_contacts
  FOR DELETE
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can view crm opportunities"
  ON public.crm_opportunities
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can insert crm opportunities"
  ON public.crm_opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can update crm opportunities"
  ON public.crm_opportunities
  FOR UPDATE
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can delete crm opportunities"
  ON public.crm_opportunities
  FOR DELETE
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can view crm timeline items"
  ON public.crm_timeline_items
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can insert crm timeline items"
  ON public.crm_timeline_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can update crm timeline items"
  ON public.crm_timeline_items
  FOR UPDATE
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can delete crm timeline items"
  ON public.crm_timeline_items
  FOR DELETE
  TO authenticated
  USING (public.is_system_admin(auth.uid()));
