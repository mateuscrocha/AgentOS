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

Conduz a abertura do dia com foco em clareza operacional, transformando tarefas soltas, compromissos e preocupações em um plano curto e executável.

## Quando usar

- quando o dia estiver começando e for preciso definir foco
- quando houver muitas demandas concorrendo por atenção
- quando for necessário reorganizar o dia depois de mudanças de contexto

## Processo

1. Levantar compromissos fixos, restrições de tempo e contexto do dia.
2. Separar o que é prioridade real, o que é desejável e o que deve ficar apenas como captura.
3. Escolher até 3 prioridades executáveis para hoje.
4. Organizar uma visão simples com prioridades, compromissos, capturas e próximo passo imediato.

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
