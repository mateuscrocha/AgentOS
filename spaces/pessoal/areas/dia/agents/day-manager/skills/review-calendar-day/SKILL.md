---
name: review-calendar-day
description: Lê os calendários operacionais do dia e transforma eventos em visão prática de agenda, conflitos e janelas úteis
agent: day-manager
project: pessoal
version: 1.0
created: 2026-04-06
---

# Skill: review-calendar-day

## O que esta skill faz

Lê os compromissos do dia no Google Calendar e devolve uma visão prática para planejamento diário, com agenda, pontos de atenção e janelas de foco.

Por padrão, deve considerar tanto a agenda principal de Mateus quanto a agenda compartilhada `Catapulta Digital`, porque reuniões operacionais podem existir em qualquer uma delas.

## Quando usar

- quando for preciso começar o dia com base no calendário real
- quando houver dúvida sobre janelas livres para foco
- quando for necessário revisar sobreposições, deslocamentos ou excesso de reuniões

## Processo

1. Ler os eventos do dia no Google Calendar usando, por padrão, os calendários `primary` e `qdmv02aj79ha0pnb5q2qcaeutk@group.calendar.google.com`, salvo instrução diferente.
2. Ao consultar múltiplos calendários, consolidar os eventos em ordem cronológica, preservando o calendário de origem para contexto quando necessário.
3. Preservar títulos, horários e ordem dos eventos exatamente como vierem do calendário.
4. Identificar conflitos, blocos ocupados e janelas úteis entre compromissos já consolidados.
5. Entregar uma visão curta que ajude a decidir como montar o restante do dia.

## Inputs

- `$ARGUMENTS`: data desejada, calendário específico se houver, e foco opcional como conflitos, janelas livres ou resumo do dia

## Outputs

Resumo operacional do calendário do dia, com:
- agenda do dia
- possíveis conflitos ou atenção
- janelas livres relevantes
- leitura prática da forma do dia

## Regras

1. O Google Calendar é a fonte de verdade dos compromissos com hora marcada.
2. A checagem padrão deve incluir a agenda principal de Mateus e a agenda `Catapulta Digital`, salvo instrução explícita para restringir.
3. Sempre trabalhar com data, hora e fuso explícitos.
4. Não inventar compromissos nem reescrever títulos manualmente.
5. A leitura deve ajudar decisão, não virar dump cru de eventos.
6. Seguir a política herdada em `spaces/pessoal/guidelines/gestao-de-agenda.md`.
