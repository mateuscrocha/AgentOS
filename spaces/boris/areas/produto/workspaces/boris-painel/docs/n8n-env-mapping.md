# Mapeamento de Variáveis: n8n -> Supabase Edge Functions

## Objetivo

Registrar para onde cada configuracao relevante dos workflows auxiliares do n8n deve migrar no ambiente atual do repo.

Fluxos analisados:

- `/Users/eu.rochamateus/Downloads/[GLOBAL] Global Variables (1).json`
- `/Users/eu.rochamateus/Downloads/[CORE] Add_Update Member (1).json`

## Mapeamento principal

| Origem no n8n | Valor/uso no n8n | Destino novo | Onde configurar | Observacao |
| --- | --- | --- | --- | --- |
| `notification_phone` | Telefone de notificacao operacional | `MATEUS_PHONE` ou `MATEUS_PHONE_E164` | Secrets das Edge Functions | Usado pelo branch de payload fora de grupo em [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts) |
| `ZAPI_INSTANCE` | Identificador da instancia Z-API | `ZAPI_INSTANCE` | Secrets das Edge Functions | Ja usado por [`zapi-send-text`](../supabase/functions/_shared/zapi-send-text.ts) |
| `ZAPI_TOKEN` | Token da instancia Z-API | `ZAPI_TOKEN` | Secrets das Edge Functions | Nao expor no frontend |
| `ZAPI_CLIENT_TOKEN` | Client token da Z-API | `ZAPI_CLIENT_TOKEN` | Secrets das Edge Functions | Nao expor no frontend |

## Variaveis vistas no n8n sem uso direto confirmado nesta migracao

| Origem no n8n | Situacao atual | Acao sugerida |
| --- | --- | --- |
| `notification_phone_juan` | Nao apareceu nos fluxos migrados lidos ate aqui | Manter fora do repo ate confirmar uso |
| `DATASET_FOLDER_ID` | Nao relacionado ao listener principal | Nao migrar junto com o corte do n8n |
| `GROUP_METRICS_TEMPLATE_ID` | Nao relacionado ao listener principal | Nao migrar junto com o corte do n8n |
| `ENVIRONMENT` | Sem dependencia explicita no listener | Opcional, somente se outro fluxo ainda precisar |
| `EVO_URL` | Nao usado na function migrada | Nao migrar para esta function |
| `EVO_API_TOKEN` | Nao usado na function migrada | Nao migrar para esta function |
| `EVO_INSTANCE_01` | Nao usado na function migrada | Nao migrar para esta function |
| `SECRET_KEY` | Nao usado na function migrada | Nao migrar para esta function |
| `ID_group_equipe` | Nao usado na function migrada | Nao migrar sem prova de uso |
| `ID_group_equipe_teste` | Nao usado na function migrada | Nao migrar sem prova de uso |
| `bot_start_time` | Nao usado na function migrada | Nao migrar sem prova de uso |
| `bot_end_time` | Nao usado na function migrada | Nao migrar sem prova de uso |

## Campos de membro que o helper do n8n atualizava

O workflow `[CORE] Add/Update Member` atualizava ou preenchia:

- `name`
- `phone_e164`
- `profile_pic_url`
- `lid`
- `is_admin`
- `is_super_admin`

Esse comportamento agora foi incorporado ao fluxo de resolucao/upsert da function:

- [`webhook-zapi-messages`](../supabase/functions/webhook-zapi-messages/index.ts)

## Recomendações operacionais

1. Colocar secrets somente no ambiente das Edge Functions.
2. Nao copiar tokens operacionais para `VITE_*`.
3. Rotacionar qualquer segredo exportado em JSON do n8n se ele ainda estiver valido.

## Exemplo de configuração

```sh
supabase secrets set \
  MATEUS_PHONE='5561981569893' \
  ZAPI_INSTANCE='SEU_ZAPI_INSTANCE' \
  ZAPI_TOKEN='SEU_ZAPI_TOKEN' \
  ZAPI_CLIENT_TOKEN='SEU_ZAPI_CLIENT_TOKEN' \
  --project-ref ceugwdfpbvziiumnxknt
```
