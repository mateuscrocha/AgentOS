# Checklist de Corte do Main Listener no n8n

## Objetivo

Desligar o workflow `🔥 [CORE] Main Listener` mantendo o backend do repo como unico ponto de ingestao dos eventos da Z-API.

## Pre-corte

1. Confirmar que a Edge Function de entrada publicada e [`incoming-provider-event`](../supabase/functions/incoming-provider-event/index.ts), que delega integralmente para [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts).
2. Garantir que as envs da funcao estao configuradas no ambiente produtivo:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ZAPI_INSTANCE`
   - `ZAPI_TOKEN`
   - `ZAPI_CLIENT_TOKEN`
   - `MATEUS_PHONE` ou `MATEUS_PHONE_E164`
3. Confirmar que o endpoint atualmente chamado pelo n8n aponta para a function produtiva correta.
4. Rodar a suite local da function antes do deploy:

```sh
deno test -A --node-modules-dir=auto supabase/functions/webhook-zapi-messages/index.test.ts
```

## Deploy

1. Publicar as functions:
   - `incoming-provider-event`
   - `webhook-zapi-messages`
2. Aplicar as envs novas no projeto Supabase se `MATEUS_PHONE` ainda nao existir.
3. Validar manualmente uma chamada de teste no endpoint da function com payload de grupo conhecido.

## Smoke test antes de desligar o n8n

Validar pelo menos um exemplo de cada classe:

1. Mensagem de texto em grupo
   - espera: insert em `messages`
   - espera: `groups.sync_status = 'active'`
2. Evento de membro `GROUP_PARTICIPANT_ADD`
   - espera: insert em `member_events`
   - espera: `member_id` resolvido ou criado quando aplicavel
3. Reacao
   - espera: insert em `message_reactions`
4. Voto de enquete
   - espera: insert em `poll_votes`
   - espera: troca de voto substitui o estado anterior da mesma pessoa
5. Payload fora de grupo
   - espera: retorno `200`
   - espera: alerta enviado para `MATEUS_PHONE`

## Corte

1. Desabilitar o envio do webhook da Z-API para o n8n ou desligar o workflow `🔥 [CORE] Main Listener`.
2. Manter somente o endpoint da Edge Function como destino.
3. Registrar horario do corte para facilitar comparacao de eventos.

## Pos-corte imediato

Nos primeiros minutos apos o desligamento, verificar:

1. Se novos registros continuam entrando em `messages`, `member_events`, `message_reactions` e `poll_votes`.
2. Se grupos ativos continuam atualizando `last_sync_at`.
3. Se nao surgiram grupos com `sync_status = 'error'` por falhas na function.
4. Se payloads nao-grupo continuam chegando ao Mateus.

## Consultas uteis

Mensagens recentes:

```sql
select created_at, group_id, message_type, provider, whatsapp_provider_id
from public.messages
order by created_at desc
limit 20;
```

Eventos de membro recentes:

```sql
select occurred_at, group_id, event_type, member_id, member_lid
from public.member_events
order by occurred_at desc
limit 20;
```

Reacoes recentes:

```sql
select reacted_at, group_id, message_id, member_id, emoji, removed_at
from public.message_reactions
order by reacted_at desc
limit 20;
```

Votos recentes:

```sql
select created_at, poll_id, person_id, vote_sequence, provider_vote_message_id, voted_options
from public.poll_votes
order by created_at desc
limit 20;
```

Grupos com problema de sync:

```sql
select id, name, sync_status, last_sync_at, sync_error
from public.groups
where sync_status = 'error'
order by last_sync_at desc nulls last;
```

## Validacoes de borda ainda recomendadas

1. Remocao de reacao com payload real do provedor
2. Remocao parcial de voto em enquete multipla com payload real do provedor

## Rollback rapido

Se algo falhar apos o corte:

1. Reativar temporariamente o workflow `🔥 [CORE] Main Listener` no n8n
2. Restaurar o destino do webhook da Z-API para o n8n
3. Capturar um payload real que falhou
4. Corrigir a Edge Function e repetir o smoke test
