# Migração interna de `assistant_*` para o modelo Responses

Status atual:

- concluída no código ativo
- `assistant_*` removido do runtime principal
- `ai_*` adotado como convenção oficial

## Estado atual

Hoje o produto já está parcialmente alinhado com a direção atual da OpenAI:

- o onboarding do grupo **não cria** um Assistant remoto na OpenAI;
- o grupo sai provisionado com configuração local em `groups`;
- o runtime salvo hoje já é `responses`;
- o `assistant_id` permanece `null`.

Arquivos principais:

- [`supabase/functions/_shared/configure-group-ai.ts`](/Users/eu.rochamateus/Documents/Codex/boris-panel/supabase/functions/_shared/configure-group-ai.ts)
- [`supabase/functions/provision-onboarding/index.ts`](/Users/eu.rochamateus/Documents/Codex/boris-panel/supabase/functions/provision-onboarding/index.ts)
- [`supabase/functions/provision-group/index.ts`](/Users/eu.rochamateus/Documents/Codex/boris-panel/supabase/functions/provision-group/index.ts)

## O que o onboarding faz hoje

No final do provisionamento, o grupo recebe:

- `has_assistant = true`
- `assistant_prompt = <prompt base do grupo>`
- `assistant_model = "gpt-4o-mini"`
- `assistant_runtime = "responses"`
- `assistant_id = null`

Isso significa que, semanticamente, o sistema já opera mais como:

- `prompt_config`
- `model_config`
- `runtime_config`

do que como um objeto "Assistant" persistido na OpenAI.

## Onde o legado aparecia

Os nomes antigos ainda existem nestes pontos:

- colunas da tabela `groups`
  - `assistant_id`
  - `has_assistant`
  - `assistant_prompt`
  - `assistant_model`
  - `assistant_runtime`
- coluna `assistant_id` em `group_summaries`
- tipos gerados em [`src/integrations/supabase/types.ts`](/Users/eu.rochamateus/Documents/Codex/boris-panel/src/integrations/supabase/types.ts)
- placeholders antigos em [`supabase/functions/generate-group-summary/index.ts`](/Users/eu.rochamateus/Documents/Codex/boris-panel/supabase/functions/generate-group-summary/index.ts)

Hoje isso é principalmente **histórico de migração**, não dependência real da Assistants API.

## Achado importante

Não foi encontrado uso ativo no repo de:

- `/v1/assistants`
- `/v1/threads`
- `runs`
- `beta.assistants`

Então a urgência não é "parar uma integração quebrando", e sim:

- remover nomes legados;
- evitar novas features baseadas no conceito antigo;
- consolidar o produto sobre `Responses`.

## Recomendações

### Fase 1: congelar o conceito antigo

Sem quebrar nada:

- manter `assistant_runtime = "responses"`
- parar de usar `assistant_id` como campo com significado operacional
- tratar `assistant_id` apenas como legado

### Fase 2: introduzir nomes novos no schema

Adicionar colunas novas em `groups`, por exemplo:

- `ai_enabled boolean`
- `ai_prompt text`
- `ai_model text`
- `ai_runtime text`

Opcional:

- `ai_provider text` com default `openai`

Em `group_summaries`, substituir `assistant_id` por algo mais honesto, por exemplo:

- `ai_run_ref text` se realmente precisar guardar referência externa
- ou remover completamente se não houver uso real

### Fase 3: dupla leitura / dupla escrita

Por um período:

- provisionamento escreve nos campos novos e antigos
- leitura prioriza os campos novos
- fallback para os antigos quando necessário

Isso reduz risco e permite migração gradual da aplicação.

### Fase 4: limpar legado

Depois da transição:

- remover `assistant_id`
- remover `has_assistant`
- remover `assistant_prompt`
- remover `assistant_model`
- remover `assistant_runtime`

e regenerar os tipos do Supabase.

## Tradução conceitual recomendada

Em vez de:

- "criar assistant no onboarding"

usar:

- "habilitar IA do grupo"
- "configurar prompt base do grupo"
- "configurar runtime do grupo"

Isso fica mais fiel ao produto e evita acoplamento com a terminologia deprecated da OpenAI.

## Resultado final

O fluxo ativo passou a operar com:

1. `ai_enabled`
2. `ai_prompt`
3. `ai_model`
4. `ai_runtime`

O helper compartilhado agora é `configure-group-ai`, e o legado `assistant_*` foi mantido apenas no histórico de migrações antigas e neste documento.
