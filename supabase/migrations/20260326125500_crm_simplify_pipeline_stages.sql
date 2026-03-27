UPDATE public.crm_accounts
SET stage = 'meeting'
WHERE stage IN ('qualification', 'proposal');

UPDATE public.crm_opportunities
SET stage = 'meeting'
WHERE stage IN ('qualification', 'proposal');
