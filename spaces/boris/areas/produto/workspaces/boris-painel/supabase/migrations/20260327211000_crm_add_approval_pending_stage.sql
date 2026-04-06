ALTER TYPE public.crm_opportunity_stage
ADD VALUE IF NOT EXISTS 'approval_pending' AFTER 'proposal';
