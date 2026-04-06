# Inventario dos Workflows do n8n

## Objetivo

Mapear o que ainda existe no ecossistema do n8n alem do `🔥 [CORE] Main Listener`, separar o que ja foi absorvido pelo repo, o que ainda pode ser dependencia real e o que e apenas utilitario operacional fora do produto.

## Fontes auditadas

- `/Users/eu.rochamateus/Downloads/🔥 [CORE] Main Listener.json`
- `/Users/eu.rochamateus/Downloads/🔥 [CORE] Main Listener (1).json`
- `/Users/eu.rochamateus/Downloads/[GLOBAL] Global Variables.json`
- `/Users/eu.rochamateus/Downloads/[GLOBAL] Global Variables (1).json`
- `/Users/eu.rochamateus/Downloads/[CORE] Add_Update Member.json`
- `/Users/eu.rochamateus/Downloads/[CORE] Add_Update Member (1).json`
- `/Users/eu.rochamateus/Downloads/[CORE] [FEATURES] Generate a Summary.json`
- `/Users/eu.rochamateus/Downloads/[CORE] [FEATURES] Summary_Topics and Keywords Trigger.json`
- `/Users/eu.rochamateus/Downloads/Generate Topic:Keywords.json`
- `/Users/eu.rochamateus/Downloads/Generate Topic:Keywords Trigger.json`
- `/Users/eu.rochamateus/Downloads/Add Group Topics.json`
- `/Users/eu.rochamateus/Downloads/Add Group Keywords.json`
- `/Users/eu.rochamateus/Downloads/Register Group and Member [SUPABASE].json`
- `/Users/eu.rochamateus/Downloads/[n8n][Backup Generate] N8N.json`
- `/Users/eu.rochamateus/Downloads/[n8n][Backup Restore] N8N.json`
- `/Users/eu.rochamateus/Downloads/Fluxo de Registro de mensagens (UAZAPI).json`

## Resumo executivo

- O listener principal da Z-API ja saiu do n8n e hoje esta no Supabase.
- Os fluxos de resumo diario, topicos e keywords tambem ja possuem equivalentes nativos no repo.
- O cadastro/provisionamento de grupo e membros ja possui equivalentes nativos no repo.
- O que aparenta restar no n8n se divide em dois blocos:
  - utilitarios operacionais do proprio n8n, como backup e restore
  - fluxos externos ou paralelos ao produto Bóris, como o fluxo `UAZAPI`

Conclusao pratica:

- Para o produto Bóris, o n8n ja esta muito perto de ficar dispensavel.
- O que ainda precisa de decisao nao parece ser o core do produto, e sim workflows auxiliares ou externos.

## Matriz de inventario

| Workflow | Papel no n8n | Equivalente no repo | Status | Observacao |
| --- | --- | --- | --- | --- |
| `🔥 [CORE] Main Listener` | Ingestao principal do webhook da Z-API | `incoming-provider-event` + `webhook-zapi-messages` | Migrado | Ja pode ser considerado fora do n8n |
| `[GLOBAL] Global Variables` | Variaveis globais compartilhadas | Secrets do Supabase Edge Functions | Migrado em grande parte | ZAPI e telefone operacional ja mapeados |
| `[CORE] Add_Update Member` | Upsert e enriquecimento de membro | `webhook-zapi-messages` + `members-from-participants` | Migrado | Sem dependencia funcional restante conhecida |
| `Register Group and Member [SUPABASE]` | Criacao de grupo e membros iniciais | `provision-group`, `provision-onboarding`, `provision-group-core` | Migrado | Fluxo de onboarding/provisionamento ja esta no repo |
| `[CORE] [FEATURES] Generate a Summary` | Geracao e envio de resumo | `generate-group-summary` | Migrado | Regras e prompts foram internalizados no repo |
| `[CORE] [FEATURES] Summary_Topics and Keywords Trigger` | Disparo agendado de resumo, topicos e keywords | `run-group-ai-daily-jobs` | Migrado | Cron do produto ja pode rodar sem n8n |
| `Generate Topic:Keywords` | Geracao de topicos e keywords via OpenAI | `generate-group-topics-keywords` | Migrado | Persistencia tambem internalizada |
| `Generate Topic:Keywords Trigger` | Trigger agendado de topicos/keywords | `run-group-ai-daily-jobs` | Migrado | Coberto pelo job diario do repo |
| `Add Group Topics` | Persistencia de topicos do dia | `generate-group-topics-keywords` | Migrado | Repo grava direto no banco |
| `Add Group Keywords` | Persistencia de keywords do dia | `generate-group-topics-keywords` | Migrado | Repo grava direto no banco |
| `[n8n][Backup Generate] N8N` | Backup de workflows e credenciais do proprio n8n | Nenhum no repo | Fora do escopo do produto | So precisa existir se voce quiser manter o n8n vivo como ferramenta |
| `[n8n][Backup Restore] N8N` | Restore de workflows e credenciais do proprio n8n | Nenhum no repo | Fora do escopo do produto | Mesmo caso do backup |
| `[DGM] Fluxo de Registro de mensagens (UAZAPI)` | Fluxo paralelo de outro contexto | Nenhum confirmado no repo | Nao relacionado ao corte do Bóris | Tratar como sistema externo ou legado separado |

## O que ja saiu do n8n no produto

### Ingestao WhatsApp

- Entrada publica: `incoming-provider-event`
- Processamento real: `webhook-zapi-messages`
- Cobertura validada:
  - mensagens
  - eventos de membro
  - reacoes
  - enquetes
  - votos

### Resumos, topicos e keywords

- Resumo: `generate-group-summary`
- Topicos e keywords: `generate-group-topics-keywords`
- Orquestracao diaria: `run-group-ai-daily-jobs`

### Provisionamento

- Cadastro de grupo: `provision-group`
- Onboarding: `provision-onboarding`
- Nucleo compartilhado: `provision-group-core`
- Insercao de participantes: `members-from-participants`

## O que ainda pode restar no n8n

### 1. Operacao do proprio n8n

Se voce ainda quiser manter a instancia do n8n por qualquer outro motivo, os workflows de backup e restore continuam fazendo sentido:

- `[n8n][Backup Generate] N8N`
- `[n8n][Backup Restore] N8N`

Eles nao sao dependencia funcional do Bóris.

### 2. Fluxos fora do escopo do Bóris

O arquivo `Fluxo de Registro de mensagens (UAZAPI).json` parece ser um fluxo paralelo, com outro webhook, outra integracao e outro contexto operacional.

Ele nao deve bloquear o desligamento do n8n para o Bóris, mas precisa de uma decisao separada:

- arquivar como legado
- migrar para outro lugar
- ou manter como sistema independente

## O que ainda precisa de confirmacao

1. Se existem workflows ativos no n8n que nao foram exportados nos arquivos auditados.
2. Se o cron de `run-group-ai-daily-jobs` ja substitui integralmente qualquer agendamento que ainda esteja vivo no n8n em producao.
3. Se o fluxo `UAZAPI` tem qualquer dependencia compartilhada com a base do Bóris.

## Leitura final

Se o objetivo for:

- desligar o n8n do produto Bóris: falta muito pouco e o core ja esta migrado
- desligar a infra inteira do n8n: ainda falta decidir o destino dos workflows de backup/restore e de quaisquer fluxos externos como o `UAZAPI`
