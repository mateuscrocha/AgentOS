-- Fila segura endurecida para a jornada de prospecção do Mateus Rocha.
-- Objetivo: impedir novo lote em cima de espelhos de manager/grupo,
-- placeholders de triagem e qualquer sinal de contato anterior.

with sent_registry(phone) as (
  values
    ('554791362808'),
    ('5516991737022'),
    ('5511964107294'),
    ('17372174284'),
    ('5511941525252'),
    ('5511940207654'),
    ('5511975309733'),
    ('5511944850914'),
    ('5511954957051'),
    ('5511976293469')
),
base as (
  select
    a.id,
    a.name,
    a.phone,
    regexp_replace(coalesce(a.phone, ''), '\D', '', 'g') as phone_digits,
    regexp_replace(regexp_replace(coalesce(a.phone, ''), '\D', '', 'g'), '0+$', '') as phone_trim,
    a.source,
    a.status,
    a.stage,
    a.commercial_priority,
    a.pipeline_track,
    a.next_step,
    a.last_contact_at,
    a.quick_notes,
    a.lead_source_detail,
    a.handoff_summary
  from public.crm_accounts a
),
blocked_phone as (
  select distinct regexp_replace(phone, '\D', '', 'g') as phone_digits
  from sent_registry
),
blocked_related as (
  select distinct b.phone_trim
  from base b
  where b.phone_trim <> ''
    and (
      b.last_contact_at is not null
      or b.stage in ('qualification', 'meeting', 'proposal', 'approval_pending', 'customer', 'lost')
      or b.status in ('prospect', 'customer', 'inactive')
      or coalesce(b.next_step, '') ~* '(reuni[aã]o|proposta|follow[_ -]?up|retomar|reativar|encerrado|pausado|confirmar|aguarda|validar proposta|perdido|nao faz sentido)'
      or coalesce(b.quick_notes, '') ~* '(typebot|interessado|subscriber|qualificad|cliente sincronizado|reativad|proposta|reuni[aã]o|follow[_ -]?up|pausado|perda)'
      or coalesce(b.lead_source_detail, '') ~* '(postgres_subscriber|Base antiga do B[óo]ris)'
    )
),
queue as (
  select *
  from base b
  where b.phone_trim <> ''
    and b.last_contact_at is null
    and b.stage = 'new_lead'
    and b.status = 'lead'
    and b.commercial_priority in ('P1', 'P2')
    and b.pipeline_track in ('entrada_nova', 'legado', 'reativacao')
    and coalesce(b.lead_source_detail, '') !~* '(Manager|Super Admin|Contato de grupo)'
    and coalesce(b.quick_notes, '') !~* 'v_group_with_managers_rows'
    and coalesce(b.next_step, '') !~* '(Triar legado e definir 1º contato|validar se contato administrativo vira lead acionavel)'
    and b.phone_digits not in (select phone_digits from blocked_phone)
    and b.phone_trim not in (select phone_trim from blocked_related)
)
select
  id,
  name,
  phone,
  source,
  commercial_priority,
  pipeline_track,
  lead_source_detail,
  next_step,
  quick_notes,
  handoff_summary
from queue
order by commercial_priority, pipeline_track, name;
