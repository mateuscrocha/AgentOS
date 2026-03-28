# Caso De Teste E2E: Entrada No CRM Ate Vínculo Com Stripe

## Objetivo
Validar o fluxo completo de uma nova entrada comercial, desde o onboarding/provisionamento inicial até o momento em que a organização e a conta CRM ficam vinculadas e sincronizadas com a Stripe.

## Escopo
Este caso cobre:
- criação da `organization` a partir do onboarding
- criação do contato principal e papel do usuário
- criação automática da `crm_account`
- vínculo da `organization` com `stripe_customer_id` e `stripe_subscription_id`
- propagação do contexto Stripe para o CRM
- sincronização financeira via `crm-sync-stripe`

## Tipo
Teste manual E2E com validação em UI, banco e Edge Functions.

## Pré-condições
- Ambiente local rodando com app e Supabase ativos.
- Usuário de teste com permissão de `SYSTEM_ADMIN`.
- `STRIPE_SECRET_KEY` configurada nas Edge Functions.
- Uma organização nova, sem vínculo Stripe prévio.
- Um cliente de teste na Stripe com:
  - `customer_id` válido, por exemplo `cus_test_boris_e2e`
  - ao menos uma assinatura válida, por exemplo `sub_test_boris_e2e`
- Payload de onboarding disponível para execução.

## Dados de teste sugeridos
- Lead nome: `Teste Fluxo CRM Stripe`
- Lead email: `teste.crm.stripe+e2e@boris.local`
- Lead telefone: `+5511999999999`
- Organização: `Empresa Teste CRM Stripe`
- Grupo: `Grupo Teste CRM Stripe`
- Stripe customer: usar um `cus_...` de sandbox
- Stripe subscription: usar um `sub_...` de sandbox pertencente ao customer acima

## Passo a passo

### Etapa 1: Executar a entrada inicial
Acione o onboarding público ou invoque a função `provision-onboarding` com um payload válido.

Exemplo de resultado esperado:
- a `organization` é criada com nome da empresa
- o lead vira contato principal
- o usuário recebe papel `ORG_ADMIN`
- o grupo é criado
- o evento `ONBOARDING_COMPLETED` é registrado

### Etapa 2: Validar a persistência base
Verifique no banco:

#### `organizations`
- existe uma linha com `name = Empresa Teste CRM Stripe`
- `contact_name = Teste Fluxo CRM Stripe`
- `contact_email = teste.crm.stripe+e2e@boris.local`
- `contact_phone` preenchido
- `stripe_customer_id IS NULL`
- `stripe_subscription_id IS NULL`

#### `organization_contacts`
- existe um contato ligado à organização
- `is_primary = true`
- `email` e `phone` batem com o lead

#### `user_roles`
- existe um registro com `role = ORG_ADMIN`

#### `events`
- existe um evento `ONBOARDING_COMPLETED`

### Etapa 3: Validar criação automática no CRM
Abra o CRM ou consulte diretamente `crm_accounts`.

Resultado esperado:
- existe uma `crm_account` com `organization_id` apontando para a organização criada
- `name`, `email` e `phone` espelham os dados da organização
- `status = prospect`
- `stage = meeting`
- `stripe_customer_id IS NULL`
- `stripe_subscription_id IS NULL`

Valide também `crm_contacts`:
- existe um contato CRM correspondente ao contato principal da organização

### Etapa 4: Vincular com Stripe
Abra a tela de edição da organização e tente selecionar:
- o cliente Stripe
- a assinatura Stripe desse cliente

Resultado esperado funcional:
- a organização passa a ter `stripe_customer_id`
- a organização passa a ter `stripe_subscription_id`
- `billing_status`, `billing_plan` e `current_period_end` são preenchidos

Resultado esperado no banco em `organizations`:
- `stripe_customer_id = cus_...`
- `stripe_subscription_id = sub_...`
- `billing_status` preenchido
- `billing_plan` preenchido ou derivado da price
- `current_period_end` preenchido

### Etapa 5: Validar propagação automática para CRM
Após o update da `organization`, confira `crm_accounts`.

Resultado esperado:
- a `crm_account` da mesma organização recebe os mesmos `stripe_customer_id` e `stripe_subscription_id`
- `stripe_subscription_status` reflete o billing atual
- `stripe_next_billing_at` é preenchido
- `financial_context_updated_at` é preenchido
- `status = customer`
- `stage = customer`

### Etapa 6: Rodar sincronização financeira explícita
No drawer da conta CRM, clique em `Sync Stripe`.

Resultado esperado:
- a função `crm-sync-stripe` executa sem erro
- a conta CRM continua vinculada ao mesmo customer/subscription
- campos financeiros são enriquecidos

Resultado esperado em `crm_accounts`:
- `stripe_monthly_amount_cents` preenchido
- `stripe_last_invoice_at` preenchido
- `stripe_last_invoice_amount_cents` preenchido
- `stripe_next_billing_at` preenchido
- `stripe_is_delinquent` coerente com a assinatura

### Etapa 7: Validar leitura final na UI
Abra o drawer da conta CRM.

Resultado esperado:
- badge/status da conta como cliente
- seção `Financeiro Stripe` com mensalidade, última cobrança, vencimento e origem do vínculo
- `Último sync` preenchido

## Critérios de aprovação
O teste passa se:
- a entrada inicial cria organização, contato, papel e evento
- a organização gera automaticamente a conta CRM
- o vínculo Stripe fica salvo na `organization`
- o CRM herda o vínculo Stripe
- o `Sync Stripe` completa o enriquecimento financeiro
- a UI final mostra a conta como cliente com leitura financeira

## Consultas úteis para validação

```sql
select id, name, contact_name, contact_email, contact_phone, stripe_customer_id, stripe_subscription_id, billing_status, billing_plan, current_period_end
from organizations
where name = 'Empresa Teste CRM Stripe';
```

```sql
select id, organization_id, name, email, phone, status, stage, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_monthly_amount_cents, stripe_last_invoice_at, stripe_last_invoice_amount_cents, stripe_next_billing_at, stripe_is_delinquent, financial_context_updated_at
from crm_accounts
where name = 'Empresa Teste CRM Stripe';
```

```sql
select id, organization_id, name, email, phone, is_primary
from organization_contacts
where email = 'teste.crm.stripe+e2e@boris.local';
```

```sql
select id, account_id, first_name, last_name, email, phone, is_primary
from crm_contacts
where email = 'teste.crm.stripe+e2e@boris.local';
```

```sql
select id, event_type, entity_type, entity_id, user_id, created_at
from events
where event_type = 'ONBOARDING_COMPLETED'
order by created_at desc;
```

## Observação importante
Há um possível bloqueio no fluxo manual de vínculo do customer Stripe: a UI chama a Edge Function `billing-link-organization-stripe-customer`, mas essa função não apareceu no repositório atual. Se ao salvar a organização o vínculo falhar antes da assinatura, isso provavelmente é o motivo.

Nesse caso, registre o teste como:
- `PASS` para etapas 1 a 3
- `BLOCKED` na etapa 4
- causa provável: função ausente no backend para salvar somente o `stripe_customer_id`

## Resultado esperado atual do teste
- Se a função ausente já existir no ambiente implantado, o caso deve passar de ponta a ponta.
- Se ela não existir também no ambiente, o caso deve falhar no momento do vínculo manual da organização com a Stripe.
