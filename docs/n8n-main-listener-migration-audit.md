# Auditoria de Migracao do n8n

## Fluxo analisado

- Workflow: `🔥 [CORE] Main Listener`
- Arquivo de origem: `/Users/eu.rochamateus/Downloads/🔥 [CORE] Main Listener (1).json`
- Objetivo: mapear cada responsabilidade do listener principal do n8n para a implementacao atual no repo e identificar as lacunas para desligamento seguro.

## Resumo executivo

- O repo atual ja absorveu a maior parte da ingestao de webhook em [`incoming-provider-event`](../supabase/functions/incoming-provider-event/index.ts) e [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts).
- Mensagens, enquetes, votos e eventos de membros ja possuem cobertura parcial ou ampla no backend atual.
- Em 2026-03-29, o backend atual passou a cobrir tambem:
  - reacoes em `message_reactions`
  - upsert consistente de `members` reutilizado entre mensagens, votos e eventos de membro
  - substituicao do voto anterior da mesma pessoa em `poll_votes`, alinhando a semantica com o fluxo legado
- O caminho "nao e grupo" tambem foi preservado no backend atual via notificacao por WhatsApp para o destino configurado em `MATEUS_PHONE` ou `MATEUS_PHONE_E164`.

## Matriz operacional

| Bloco no n8n | Nos principais | Destino atual no repo | Status | Acao necessaria |
| --- | --- | --- | --- | --- |
| Entrada do webhook | `Webhook` | [`supabase/functions/incoming-provider-event/index.ts`](../supabase/functions/incoming-provider-event/index.ts) | Migrado | Manter como unico endpoint de entrada |
| Repasse imediato para backend novo | `HTTP Request` -> Supabase Function | [`supabase/functions/incoming-provider-event/index.ts`](../supabase/functions/incoming-provider-event/index.ts) | Migrado | Nenhuma, so consolidar documentacao do contrato |
| Filtrar se evento e de grupo | `Is a group?` | [`supabase/functions/webhook-zapi-messages/index.ts`](../supabase/functions/webhook-zapi-messages/index.ts) via resolucao do grupo | Parcial | Decidir estrategia para payloads nao associados a grupo |
| Caminho "nao e grupo" | `Set` + `Send Message to Mateus` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) via `MATEUS_PHONE` | Migrado | Garantir env configurada no ambiente produtivo |
| Normalizacao do payload | `Set Message`, `Set Group`, `Set Sender` | [`supabase/functions/webhook-zapi-messages/index.ts`](../supabase/functions/webhook-zapi-messages/index.ts) | Migrado | Consolidar contrato de payload aceito |
| Buscar grupo por provider id | `Get Group` | [`supabase/functions/webhook-zapi-messages/index.ts`](../supabase/functions/webhook-zapi-messages/index.ts) | Migrado | Nenhuma |
| Workflow auxiliar de variaveis globais | `Call '[GLOBAL] Global Variables'` | Nao ha equivalente explicito | Provavelmente obsoleto | Confirmar se ainda existe dependencia funcional real |
| Workflow auxiliar add/update member | `Call Add/Update Member` | Criacao parcial inline em [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) | Parcial | Extrair funcao compartilhada de upsert de membro |
| Workflow auxiliar add/update member para added | `Call Add/Update Member Added` | Nao ha equivalente explicito no branch de member events | Nao migrado | Implementar upsert antes de registrar `GROUP_PARTICIPANT_ADD` e `GROUP_PARTICIPANT_INVITE` |
| Switch inicial entre mensagem e evento de membro | `Switch` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) | Migrado | Nenhuma |
| Texto | `Create Message Event [TEXT]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `messages` | Migrado | Validar com payload real |
| Imagem | `Create Message Event [IMAGE]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `messages` | Migrado | Validar media fields com payload real |
| Documento | `Create Message Event [DOCUMENT]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `messages` | Migrado | Validar media fields com payload real |
| Audio | `Create Message Event [AUDIO]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `messages` | Migrado | Validar media fields com payload real |
| Sticker | `Create Message Event [STICKER]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `messages` | Migrado | Validar com payload real |
| Video | `Create Message Event [VIDEO]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `messages` | Migrado | Validar com payload real |
| Reacao | `Get Refered Message` + `Create Message Event [REACTION]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `message_reactions` | Migrado | Validar payload real de remocao de reacao em producao |
| Criacao da mensagem de enquete | `Create Message Event [POLL]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `messages` | Migrado | Nenhuma |
| Criacao da entidade poll | `Set Poll Infos` + `Create a Poll [TABLE]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `polls` | Migrado | Nenhuma |
| Criacao das opcoes da enquete | `Set Poll Id` + `Split Out` + `Loop Over Items` + `Create a Poll Options [TABLE]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `poll_options` | Migrado | Nenhuma |
| Busca de info da poll para voto | `Get Poll Info` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) | Migrado | Nenhuma |
| Voto simples | `Get Vote Info` + `Vote Type` + `Create Poll Vote` + `Delete a Vote [POLL VOTE]` + `Create New Poll Vote` + `Remove Vote [POLL VOTE]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `poll_votes` | Migrado | Validar payload real de troca/remocao em producao |
| Voto multiplo | `Get Vote Info [MULTIPLE]` + `Vote Type [MULTIPLE]` + `Create Poll Vote [MULTIPLE]` + `Delete a Vote [POLL VOTE MULTIPLE]` + `Create New Poll Vote [MULTIPLE]` + `Remove Vote [POLL MULTIPLE VOTE]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `poll_votes` | Migrado | Validar payload real quando houver remocao parcial de opcoes |
| Deteccao de evento de membro | `Member Event` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) | Migrado | Nenhuma |
| Membro adicionado | `Set Added Member` + `Call Add/Update Member Added` + `Set Member Event [Added]` + `Register Event [Member Added]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `member_events` | Migrado | Nenhuma alem de validar payload real |
| Membro saiu | `Set Left Member` + `Member Left Info` + `Set Member Event [Left]` + `Register Event [Member Left]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `member_events` | Parcial | Resolver `member_id` real quando existir |
| Membro removido | `Set Removed Member` + `Get Removed Member` + `Set Member Event [Removed]` + `Register Event [Member Removed]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `member_events` | Parcial | Resolver `member_id` real quando existir |
| Membro convidado | `Member Invited [lid]` + `Member Invited Info` + `Set Member Event [Invited]` + `Register Event [Member Invited]` | [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) -> `member_events` | Migrado | Nenhuma alem de validar payload real |

## Lacunas criticas restantes

No listener principal auditado, nao restam lacunas funcionais obrigatorias para o desligamento do n8n.

Pontos de validacao recomendados antes do corte final:

- confirmar `MATEUS_PHONE` ou `MATEUS_PHONE_E164` configurado no ambiente produtivo
- validar com payload real a remocao de reacao
- validar com payload real remocao parcial de votos em enquete multipla

## Ordem sugerida de migracao

1. Configurar `MATEUS_PHONE` no ambiente da Edge Function
2. Validar em producao os payloads reais de remocao de reacao e remocao parcial de voto multiplo
3. Desligar o listener principal do n8n

## Proximo artefato recomendado

Depois desta auditoria, o proximo documento ideal e uma matriz dos workflows auxiliares:

- nome do workflow
- quando e chamado
- efeitos em tabelas
- dependencia atual no repo
- status de migracao
