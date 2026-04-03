---
name: triage-issue
description: Faz triagem de demandas de suporte do Boris com clareza de prioridade e encaminhamento
agent: support-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: triage-issue

## O que esta skill faz

Classifica uma demanda de suporte do Boris em termos de urgência, tipo de problema, área responsável e próximo encaminhamento.

## Quando usar

- quando chegar uma dúvida, incidente, reclamação ou bloqueio de uso
- quando for preciso decidir quem assume e qual é a prioridade real do caso

## Processo

1. Identificar o problema relatado e seu impacto imediato.
2. Separar se é dúvida, incidente, fricção de onboarding, bug percebido ou promessa pendente.
3. Definir prioridade, responsável e próximo passo.
4. Entregar uma triagem clara e acionável.

## Inputs

- `$ARGUMENTS`: relato do caso, contexto do usuário, impacto percebido, histórico conhecido e urgência

## Outputs

Triagem com:
- tipo de caso
- prioridade
- responsável sugerido
- próximo passo
- observação de risco

## Regras

1. Nem toda urgência aparente é prioridade alta; olhar impacto real no uso.
2. Se o caso depender de outra área, o handoff deve sair com critério claro.
3. Evitar respostas vagas sem encaminhamento.
