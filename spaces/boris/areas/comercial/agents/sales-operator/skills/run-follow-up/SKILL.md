---
name: run-follow-up
description: Constrói follow-ups do Boris com contexto, prova e próximo passo claro
agent: sales-operator
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: run-follow-up

## O que esta skill faz

Monta mensagens de follow-up para leads em silêncio antes ou depois de reunião, demo, proposta, trial ou pagamento.

## Quando usar

- quando um lead parou de responder e ainda não deve ser marcado como perdido
- quando for preciso retomar contexto após reunião, proposta, trial ou decisão pendente

## Processo

1. Identificar o estágio do lead e o último contexto real da conversa.
2. Escolher o tipo de follow-up: pré-reunião, pós-reunião, pós-demo, pós-trial, pós-proposta ou toque final.
3. Escrever uma mensagem curta, natural e WhatsApp-first com uma única chamada clara para ação.
4. Sugerir quando reenviar, quando pausar e quando mover o lead para `lost`.

## Inputs

- `$ARGUMENTS`: estágio atual, histórico resumido da conversa, último contato, dor principal, prova disponível e objetivo do follow-up

## Outputs

Mensagem de follow-up pronta para uso, com:
- objetivo da mensagem
- texto sugerido
- próximo prazo sugerido
- decisão de CRM recomendada se não houver resposta

## Regras

1. Nunca usar pressão artificial, culpa ou linguagem agressiva de fechamento.
2. Cada follow-up deve ter um único próximo passo explícito.
3. Todo lead contatado deve receber pelo menos um follow-up antes de ser considerado perdido, salvo recusa clara ou no-fit evidente.
