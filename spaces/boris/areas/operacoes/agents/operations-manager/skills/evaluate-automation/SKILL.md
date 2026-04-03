---
name: evaluate-automation
description: Avalia se uma automação do Boris realmente reduz carga sem gerar ruído
agent: operations-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: evaluate-automation

## O que esta skill faz

Analisa uma ideia de automação do Boris para decidir se ela reduz trabalho real ou se apenas adiciona ruído, risco e falsa sensação de eficiência.

## Quando usar

- quando alguém propuser automação de rotina, follow-up, conteúdo, monitoramento ou operação
- quando for preciso decidir o que automatizar, o que manter manual e qual guardrail usar

## Processo

1. Identificar a rotina atual, o custo manual e o objetivo da automação.
2. Avaliar risco de ruído, confiança, erro, dependência e perda de contexto.
3. Definir se a automação deve ser implementada, ajustada, limitada ou evitada.
4. Entregar a recomendação com critérios práticos.

## Inputs

- `$ARGUMENTS`: descrição da automação proposta, rotina atual, problema a resolver, áreas afetadas e risco percebido

## Outputs

Parecer operacional com:
- benefício esperado
- risco principal
- recomendação
- limites e guardrails
- próximo passo sugerido

## Regras

1. Automação só vale quando reduz carga real sem piorar confiança, clareza ou experiência.
2. Se a operação ainda não está clara manualmente, automatizar costuma piorar.
3. Sempre diferenciar automação útil de automação barulhenta.
