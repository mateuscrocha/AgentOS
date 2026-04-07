---
name: run-daily-checkin
description: Organiza um check-in diário com prioridades, compromissos, capturas e próximo passo
agent: day-manager
project: pessoal
version: 1.0
created: 2026-04-06
---

# Skill: run-daily-checkin

## O que esta skill faz

Conduz a abertura do dia com foco em clareza operacional, usando o Google Calendar como base dos compromissos fixos e transformando tarefas soltas, reuniões e preocupações em um plano curto e executável.

## Quando usar

- quando o dia estiver começando e for preciso definir foco
- quando houver muitas demandas concorrendo por atenção
- quando for necessário reorganizar o dia depois de mudanças de contexto

## Processo

1. Ler ou confirmar os compromissos fixos do dia, preferindo o Google Calendar quando disponível.
2. Levantar restrições de tempo e contexto do dia.
3. Separar o que é prioridade real, o que é desejável e o que deve ficar apenas como captura.
4. Escolher até 3 prioridades executáveis para hoje.
5. Organizar uma visão simples com prioridades, compromissos, capturas e próximo passo imediato.

## Inputs

- `$ARGUMENTS`: tarefas do dia, compromissos, pendências, contexto atual, bloqueios e qualquer preocupação relevante

## Outputs

Check-in diário organizado, com:
- foco do dia
- até 3 prioridades
- compromissos fixos
- capturas sem prioridade imediata
- primeiro próximo passo

## Regras

1. Clareza vale mais do que completude.
2. Nunca promover tudo à mesma prioridade.
3. Se o dia estiver lotado, reduzir escopo antes de otimizar agenda.
4. Sempre distinguir o que precisa ser feito hoje do que só precisa ser lembrado.
5. Se houver acesso ao Google Calendar, usar os eventos do calendário como base dos compromissos fixos.
