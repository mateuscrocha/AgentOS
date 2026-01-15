# Admin do Bóris (v2) — 04_ONBOARDING_FLOW

## Contexto
- Onboarding público substitui signup clássico.
- Coleta dados do lead, valida grupo de WhatsApp e provisiona registros.
- Validação via Edge Function que chama n8n e confirma se o Bóris está no grupo.
- Provisionamento cria `User`, `Organization`, `Group`, `Members` e vínculos.
- Após sucesso, redireciona direto para a página do grupo.

## O que este documento define
- Entradas necessárias no onboarding (lead, organização, link do grupo).
- Validações obrigatórias (grupo válido e Bóris presente).
- Ações de provisionamento no Supabase.
- Registro de eventos de auditoria.
- Redirecionamento pós-onboarding.
- Fronteiras com Z-API/n8n/Supabase.

## Regras que NÃO podem ser quebradas
- Não existe signup clássico; onboarding é público.
- O fluxo só conclui se `is_boris_in_group = true` e sem `data_incomplete`.
- `Group` sempre pertence a uma `Organization`.
- `Members` e `Messages` sempre pertencem a um `Group`.
- O Admin não envia mensagens nem altera grupos no WhatsApp.
- Provedor do grupo é `whatsapp` no provisionamento inicial.

## Decisões já tomadas
- Validação do grupo via Edge Function `validate-whatsapp-group` com n8n.
- Provisionamento inicial via `provision-onboarding` (service role).
- Criação automática de `Organization` e `Group`.
- Inserção automática obrigatória de `Members` baseada nos participantes retornados, com deduplicação e hierarquia consistente (`OWNER`/`SUPERADMIN`/`ADMIN`).
- Upsert de `profiles` com nome do lead.
- Atribuição de papel `ORG_ADMIN` ao usuário criado para a nova organização.
- Registro do evento `ONBOARDING_COMPLETED` em `events`.
- Redirecionamento direto para `/group/{group_id}` após sucesso.

## O que não é responsabilidade deste escopo
- Desenhar UI ou microinterações do onboarding.
- Implementar automações no n8n.
- Alterar políticas RLS ou papéis.
- Incluir grupos adicionais (feito em fluxo separado).
- Enviar mensagens ou operar grupos no WhatsApp.

## Referências no código (paths quando fizer sentido)
- Rota e fluxo de onboarding (público):
  - `src/components/auth/AuthGuard.tsx:11` (rotas públicas)
  - `src/pages/Onboarding.tsx:16` (etapas do fluxo)
  - `src/pages/Onboarding.tsx:27` (estrutura `GroupValidation`)
  - `src/pages/Onboarding.tsx:46` (normalização de telefone para E.164)
  - `src/pages/Onboarding.tsx:166` (invocação `validate-whatsapp-group`)
  - `src/pages/Onboarding.tsx:200` (signup `supabase.auth.signUp`)
  - `src/pages/Onboarding.tsx:247` (invocação `provision-onboarding`)
  - `src/pages/Onboarding.tsx:265` (redirecionamento para página do grupo)
  - `src/pages/OnboardingError.tsx:11` (tratamento de erro e navegação)
- Validação do grupo (Edge Function):
  - `supabase/functions/validate-whatsapp-group/index.ts:24` (env `N8N_VALIDATE_GROUP_WEBHOOK_URL`)
  - `supabase/functions/validate-whatsapp-group/index.ts:37` (chamada webhook n8n)
  - `supabase/functions/validate-whatsapp-group/index.ts:60` (caso Bóris fora do grupo)
  - `supabase/functions/validate-whatsapp-group/index.ts:78` (caso Bóris dentro do grupo)
  - `supabase/functions/validate-whatsapp-group/index.ts:94` (campos faltantes e `data_incomplete_reason`)
- Provisionamento inicial (Edge Function):
  - `supabase/functions/provision-onboarding/index.ts:83` (criar `organizations`)
  - `supabase/functions/provision-onboarding/index.ts:103` (criar `groups`)
  - `supabase/functions/provision-onboarding/index.ts:126` (criar `members`)
  - `supabase/functions/provision-onboarding/index.ts:149` (atualizar `profiles`)
  - `supabase/functions/provision-onboarding/index.ts:161` (atribuir `ORG_ADMIN` em `user_roles`)
  - `supabase/functions/provision-onboarding/index.ts:178` (registrar `ONBOARDING_COMPLETED` em `events`)
  - `supabase/functions/provision-onboarding/index.ts:199` (resposta de sucesso com `organization_id` e `group_id`)
- Fluxo de inclusão de grupo adicional (fora do onboarding):
  - `supabase/functions/provision-group/index.ts:64` (cliente com token do usuário para respeitar RLS)
  - `supabase/functions/provision-group/index.ts:123` (inserir `groups`)
  - `supabase/functions/provision-group/index.ts:152` (inserir `members`)
  - `supabase/functions/provision-group/index.ts:184` (registrar `GROUP_ADDED` em `events`)
- Núcleo compartilhado (membros a partir de participantes):
  - `supabase/functions/_shared/members-from-participants.ts`
- Tipos e tabelas relacionadas:
  - `src/integrations/supabase/types.ts:17` (`events` Row)
  - `src/integrations/supabase/types.ts:613` (`user_roles` Row)
  - `src/integrations/supabase/types.ts:491` (`organizations` Row)
  - `src/integrations/supabase/types.ts:125` (`groups` Row)
  - `src/integrations/supabase/types.ts:208` (`members` Row)
