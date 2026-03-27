# CRM Simplificado Sem Oportunidade

## Decisao central

Para o contexto atual do Bóris, a empresa deve ser a unidade principal do fluxo comercial.

Isso significa:

- `crm_accounts` vira a entidade principal do pipeline
- `crm_contacts` continua representando as pessoas da conta
- `crm_timeline_items` continua representando notas, tarefas e proximos passos
- `crm_opportunities` sai do fluxo principal

Hoje o sistema ja mostra que a maior parte da operacao gira em torno de uma relacao comercial por empresa. Nesse contexto, manter uma entidade separada de oportunidade adiciona atrito sem gerar clareza proporcional.

## Modelo alvo

### Entidades

#### `crm_accounts`

Cada conta passa a concentrar:

- identificacao da empresa
- tipo de relacao (`lead`, `prospect`, `customer`, `inactive`)
- etapa comercial
- responsavel comercial
- valor potencial
- data alvo
- origem
- necessidade
- proximo passo
- observacoes
- ultimo contato
- proxima acao
- contexto financeiro e Stripe
- vinculo opcional com `organizations`

#### `crm_contacts`

Mantem:

- pessoas da conta
- contato principal
- email
- telefone
- cargo
- cidade
- vinculo opcional com `organization_contacts`

#### `crm_timeline_items`

Mantem:

- notas
- tarefas
- proximos passos
- datas de follow-up
- conclusao

## O que sai do fluxo principal

`crm_opportunities` deixa de ser a unidade principal do comercial.

Ela so faria sentido se o negocio precisasse lidar frequentemente com:

- varias negociacoes paralelas na mesma empresa
- upsell separado da venda principal
- renovacoes independentes
- varios produtos ou unidades ao mesmo tempo

Como esse nao e o comportamento dominante hoje, o melhor desenho e fazer a conta ser o card do pipeline.

## Novo fluxo operacional

1. A empresa entra no sistema pelo onboarding ou por cadastro interno.
2. A `organization` sincroniza automaticamente para `crm_accounts`.
3. O contato principal sincroniza para `crm_contacts`.
4. A conta aparece no CRM como unidade comercial.
5. O time ajusta etapa, responsavel e contexto comercial da propria conta.
6. O time registra follow-ups na timeline.
7. As tarefas abertas aparecem na aba de tarefas.
8. Quando fecha, a conta vira cliente.
9. Quando perde ou esfria, a conta muda de etapa/status e segue em nutricao ou sai da fila.

## Como ficam as telas

### Pipeline

Hoje:

- cards de `crm_opportunities`

Alvo:

- cards de `crm_accounts`

Cada card deve mostrar:

- nome da conta
- contato principal
- etapa
- valor potencial
- proxima acao
- responsavel
- sinal financeiro se ja for cliente

### Contas

Continua existindo, mas vira a visao tabular da mesma entidade do pipeline.

Na pratica:

- `Pipeline` = visao kanban das contas
- `Contas` = visao tabela das mesmas contas

### Contatos

Continua igual, com melhoria de origem:

- badge `Sincronizado`
- badge `Manual`

### Tarefas

Continua igual.

A diferenca e que as tarefas passam a se vincular so a `account_id`, sem depender de oportunidade.

### Drawer da conta

Vira o centro da operacao.

Deve concentrar:

- resumo da conta
- contato principal e contatos secundarios
- etapa comercial
- responsavel
- valor potencial
- proxima acao
- historico e tarefas
- sync Stripe quando aplicavel

## Estrutura de dados sugerida

### Novos campos em `crm_accounts`

Adicionar:

- `stage public.crm_opportunity_stage null default 'new_lead'`
- `potential_value numeric(12,2) null`
- `target_date date null`
- `need text null`
- `next_step text null`
- `notes text null`
- `last_contact_at timestamptz null`
- `next_action_at timestamptz null`

Opcionalmente:

- reutilizar `assigned_user_id` como responsavel comercial

Ou, se preferirem separar dono da conta de dono da negociacao:

- `owner_user_id uuid null references public.profiles(id)`

### `crm_timeline_items`

Sugestao:

- manter `opportunity_id` durante a transicao
- no modelo final, deixar o fluxo usar apenas `account_id`

## Regras de produto sugeridas

### Contas ligadas a `organization`

Campos operacionais sincronizados devem ser tratados como derivados:

- nome
- email principal
- telefone principal
- status financeiro
- IDs Stripe

Campos comerciais devem ser editaveis no CRM:

- etapa
- responsavel
- valor potencial
- necessidade
- proximo passo
- notas
- ultima interacao
- proxima acao

### Contas sem `organization`

Funcionam como lead puro:

- editaveis integralmente no CRM
- sem dependencia do produto principal

## UX recomendada

### Remover complexidade desnecessaria

Eliminar do fluxo principal:

- botao de criar oportunidade
- cards de oportunidade
- drawer de oportunidade como entidade separada

Substituir por:

- editar conta
- mover conta no pipeline
- adicionar tarefa
- adicionar nota
- registrar proximo passo

### Clarificar origem dos dados

Badges recomendadas:

- `Cliente real`
- `Lead CRM`
- `Contato sincronizado`
- `Contato manual`

### Primeira rotina de uso

O usuario deve conseguir operar assim:

1. abrir `Contas`
2. completar conta sem contato
3. ajustar etapa da conta
4. registrar proxima acao
5. criar tarefa
6. acompanhar pela aba `Tarefas`

## Plano de migracao

### Fase 1 - Preparacao

- adicionar campos comerciais em `crm_accounts`
- adaptar UI para ler etapa da conta
- adaptar drawer da conta para mostrar contexto comercial da conta

### Fase 2 - Backfill

Migrar de `crm_opportunities` para `crm_accounts`:

- `stage`
- `potential_value`
- `target_date`
- `need`
- `next_step`
- `notes`
- `last_contact_at`
- `next_action_at`
- responsavel

Regra sugerida:

- se houver varias oportunidades por conta, escolher a mais recente aberta
- manter as demais em tabela legada ou converter em historico

### Fase 3 - Interface

- trocar Pipeline para usar `crm_accounts`
- remover CTA principal de oportunidade
- trocar timeline para operar por conta
- manter compatibilidade temporaria com dados antigos

### Fase 4 - Limpeza

- congelar criacao de `crm_opportunities`
- migrar referencias restantes
- remover `crm_opportunities` do fluxo principal
- depois avaliar se a tabela sera removida ou arquivada

## Riscos e cuidados

### Risco de perda de casos avancados

Se no futuro aparecerem varias negociacoes paralelas por empresa, o modelo simplificado pode precisar de extensao.

Mitigacao:

- manter o conceito de oportunidade apenas como excecao futura, nao como fluxo principal agora

### Risco de mistura entre dado operacional e comercial

Contas ligadas a `organization` nao podem ter campos sincronizados e comerciais misturados sem criterio.

Mitigacao:

- travar ou sinalizar campos derivados
- separar visualmente `Dados do cliente` de `Contexto comercial`

## Recomendacao final

Para o Bóris hoje, o melhor CRM e:

- empresa como unidade principal
- contato como pessoa
- timeline como operacao
- tarefa como acompanhamento

Ou seja:

- `crm_accounts`
- `crm_contacts`
- `crm_timeline_items`

E nao:

- `crm_accounts`
- `crm_contacts`
- `crm_opportunities`
- `crm_timeline_items`

Esse modelo reduz atrito, combina melhor com o comportamento atual do produto e deixa o CRM mais facil de usar no dia a dia.
