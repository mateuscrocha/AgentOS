---
name: design-cross-functional-workflow
description: Desenha workflows entre áreas do Boris com handoffs, critérios e visibilidade
agent: operations-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: design-cross-functional-workflow

## O que esta skill faz

Estrutura workflows entre áreas e agentes do Boris, definindo dependências, handoffs, pontos de decisão e visibilidade de progresso.

## Quando usar

- quando uma entrega depende de mais de uma área do Boris
- quando o trabalho está se perdendo entre comercial, conteúdo, produto, suporte e operações

## Processo

1. Identificar quais áreas e agentes participam da entrega.
2. Mapear o fluxo ideal, dependências e pontos de handoff.
3. Definir critérios de entrada, passagem e conclusão para cada etapa.
4. Entregar o workflow de forma simples e rastreável.

## Inputs

- `$ARGUMENTS`: objetivo do workflow, áreas envolvidas, etapas conhecidas, gargalos atuais e resultado esperado

## Outputs

Workflow entre áreas com:
- sequência de etapas
- responsável por etapa
- critérios de handoff
- dependências
- estado final esperado

## Regras

1. Handoff sem critério claro vira ruído; sempre explicitar entrada e saída.
2. O workflow deve reduzir ambiguidade, não criar novas camadas de aprovação sem necessidade.
3. Se o fluxo puder ser resolvido com menos etapas, simplificar.
