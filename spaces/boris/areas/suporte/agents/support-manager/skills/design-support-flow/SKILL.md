---
name: design-support-flow
description: Estrutura fluxo de suporte do Boris com triagem, resposta e escalonamento
agent: support-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: design-support-flow

## O que esta skill faz

Desenha o fluxo de suporte do Boris com lógica de entrada, triagem, resposta, escalonamento e fechamento.

## Quando usar

- quando o atendimento estiver confuso ou sem padrão
- quando for preciso estruturar SLA, escalonamento ou roteamento entre áreas

## Processo

1. Identificar os tipos de demanda mais comuns.
2. Organizar a sequência de entrada, triagem, resposta e escalonamento.
3. Definir pontos de decisão, dono e critério de encerramento.
4. Entregar o fluxo com visão prática de operação.

## Inputs

- `$ARGUMENTS`: contexto atual do suporte, tipos de demanda, áreas envolvidas, gargalos e objetivo do novo fluxo

## Outputs

Fluxo de suporte com:
- etapas
- regras de triagem
- escalonamento
- responsáveis
- critério de fechamento

## Regras

1. O fluxo precisa ser operável, não apenas correto no papel.
2. Escalonamento sem critério claro vira atraso; explicitar sempre.
3. O usuário deve sentir continuidade, não ser empurrado entre áreas.
