---
name: build-knowledge-base-entry
description: Transforma dúvidas recorrentes do Boris em entradas de base de conhecimento
agent: support-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: build-knowledge-base-entry

## O que esta skill faz

Transforma uma dúvida recorrente, incidente frequente ou orientação repetida em uma entrada clara de base de conhecimento do Boris.

## Quando usar

- quando a mesma dúvida ou instrução aparece várias vezes
- quando valer mais sistematizar a resposta do que repeti-la manualmente

## Processo

1. Identificar a dúvida ou problema recorrente.
2. Organizar contexto, causa provável, resposta e próximos passos.
3. Escrever a entrada com linguagem clara e orientada ao usuário.
4. Indicar quando a resposta precisa acionar outra área.

## Inputs

- `$ARGUMENTS`: dúvida recorrente, contexto, resposta usual, risco de erro e observações relevantes

## Outputs

Entrada de base de conhecimento com:
- título do problema
- contexto
- resposta orientada
- próximos passos
- observação de escalonamento quando necessário

## Regras

1. Base de conhecimento deve reduzir retrabalho real, não virar repositório morto.
2. A resposta deve ser clara o suficiente para evitar nova rodada de confusão.
3. Se o problema indicar falha estrutural, sinalizar também para produto ou operações.
